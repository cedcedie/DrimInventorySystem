# Activity feed + manual notifications — what shipped, and what's next

Date: 2026-08-15. Supersedes and replaces
`2026-08-13-activity-feed-and-email-notifications.md` (deleted alongside
this doc) — that file's open questions were resolved via a full grilling
session before any code was written; this doc records the outcome.

## What was decided (grilled, one question at a time)

1. **Feed audience:** operational events (stock, MRF, purchase orders,
   catalog) visible to every role. Sensitive events (permission changes,
   account edits, company settings) stay Owner/Admin-only.
2. **Feed vs. NotificationBell:** sit alongside each other, not merged.
   The bell stays the focused "things about you" inbox; the feed is the
   shared "what's happening" timeline.
3. **Where the feed lives:** both — a compact live widget on the
   Dashboard (last 10 events, every role including Technicians) and a
   full paginated page for scrolling further back.
4. **Email notifications:** dropped entirely, after walking through why
   they're needed (reaching someone with no tab open) versus the cost
   (external provider, `User.email` collection, deliverability setup) —
   decided the in-app signal is sufficient for a 6-person team checking
   the app regularly, and cheap to add later if that stops being true.
5. **Manual notifications — who sends:** Owner + Admin (matches Admin's
   near-Owner access everywhere else in the permission model).
6. **Manual notifications — targeting:** individuals or whole roles
   ("all Technicians"), not just one person at a time.
7. **Manual notifications — entry point:** primarily the Users screen
   (per-row "Notify" + multi-select "Notify selected" bar), with a
   general compose option in the NotificationBell popover for role-group
   sends or for Admins who don't have `users` module access by default.
8. **Manual notifications — attribution:** shown to the recipient as
   "From [sender's name]" — a manual message is a person talking to
   another person, not a system event report.

## What was built

**Schema** (migration `20260815032848_activity_feed_and_manual_notifications`,
applied to the live Neon DB):
- `ActivityLog.sensitive` (`Boolean`, default `false`) — set `true` at the
  5 call sites that touch account/permission/company-config
  (`permissions/update`, `permissions/user-update` ×2, `users` create,
  `users/[id]` edit, `settings`). Every other `activityLog.create()` call
  (stock, MRF, purchase orders, products, suppliers, technicians, reports,
  categories) is unaffected and shows up in the feed as before.
- `Notification.senderUserId` (nullable, FK to `User`, `onDelete: SetNull`)
  — populated only by manual sends.

**Activity feed:**
- `src/lib/data/activityFeed.ts` — `getActivityFeedData` (paginated, 20/page)
  and `getActivityFeedWidgetData` (last 10), both filtering
  `sensitive: false`.
- `GET /api/activity-feed` — gated via `requireModuleAccess("activity-feed")`,
  which resolves through the static `MODULE_ACCESS` map (every role now has
  `"activity-feed"` in `rbac.ts`), not the configurable permission matrix —
  deliberate, since this is meant to be universally visible, not something
  an Owner can accidentally hide from a role.
- `ActivityFeedWidget.tsx` on the Dashboard (wired into both the technician
  and warehouse branches of `getDashboardData`), `ActivityFeedScreen.tsx` +
  `/activity-feed` page for the full history.
- The existing `/activity` page (full unfiltered audit log) is untouched —
  still Owner/Admin only, still shows everything including sensitive rows.

**Manual notifications:**
- `sendManualNotification()` in `src/lib/notifications.ts`, reusing the
  existing `createNotifications()` fan-out.
- `POST /api/notifications/send` — static Owner/Admin role gate (not tied
  to the `users` permission module, since sending notifications and
  managing user accounts are different capabilities).
- `GET /api/users/options` — lightweight unpaginated active-user list for
  the recipient picker (the existing `GET /api/users` is paginated at 15,
  wrong shape for a "pick from everyone" UI at this team size).
- `SendNotificationModal.tsx` — title + message, role checkboxes, and a
  scrollable individual-user checklist; accepts `initialUserIds` so the
  Users-screen shortcuts open it pre-scoped.
- `UsersScreen.tsx` — row-level "Notify" action, row checkboxes, and a
  floating "N selected → Notify selected" bar (Owner/Admin only, via
  `useSession()` role check since this screen itself is Owner-only by
  permission default and Admin may not always have it).
- `NotificationBell.tsx` — "Send" button in the popover header for
  Owner/Admin, plus `senderName` now rendered as "From X ·" on manual
  notification items in the inbox.

## Verification

Full pass, all green: `tsc --noEmit`, `eslint` (0 warnings across every
touched file), `vitest run` (57/57), `next build` (clean, `/activity-feed`,
`/api/activity-feed`, `/api/notifications/send`, `/api/users/options` all
present in the route table with no errors), migration applied to the live
Neon DB and confirmed via a second clean build afterward.

## Suggestions for what's next

These are informed by having just built this — not new asks, just the
natural follow-ons once you're back and looking at it:

1. **Read/unread state for the activity feed?** Right now the feed has no
   read tracking (it's a timeline, not an inbox) — that was the right call
   for a shared "what's happening" view, but worth confirming that's still
   what you want once you're looking at it live. If it starts feeling like
   people miss things, a lightweight "seen up to" marker per user (much
   simpler than per-row read state) is a small addition.
2. **Filtering the full feed page.** `ActivityFeedScreen.tsx` currently
   shows everything chronologically with no filter by type (stock vs. MRF
   vs. PO) or by user. Cheap to add if the page gets busy enough that
   scanning becomes a chore — the data layer already has everything needed
   (`action` strings and `refNo` prefixes already distinguish event kinds).
3. **Manual notification history.** There's no "sent notifications" view
   for an Owner/Admin to see what they've sent and to whom, beyond the
   ActivityLog row created per send (`"Sent a notification to N
   recipient(s)"`) and the recipients' own inboxes. If manual sends get
   used a lot, a small "sent" tab somewhere would close that gap.
4. **Recipient picker doesn't search/filter.** `SendNotificationModal`'s
   individual-picker is a plain scrollable checklist — completely fine at
   ~6 people, will not be fine if the team grows. Matches the same
   category of thing flagged in the UI-polish doc (searchable pickers).
5. **This is a good moment for the redesign pass you mentioned.** Every
   surface built today (`ActivityFeedWidget`, `ActivityFeedScreen`,
   `SendNotificationModal`, the Users-screen notify bar) used the existing
   visual language deliberately — functional, not styled — specifically so
   a redesign tool has clean, working components to reskin rather than
   half-finished ones to both fix and restyle at once.

## Docs cleanup

`2026-08-13-activity-feed-and-email-notifications.md` (the original
deferred/open-questions doc) is deleted — its questions are answered above
and its content is now historical. `2026-08-13-ui-polish-next-session.md`
(rounded corners, "e.g." text, MRF row collapsing, searchable pickers,
mobile, collapsible sidebar, animations) is untouched — none of tonight's
work overlapped with it, still fully pending.
