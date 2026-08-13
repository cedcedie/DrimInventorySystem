# Deferred: system-wide activity feed + email notification settings

Date noted: 2026-08-13. Explicitly deferred out of that session's scope —
see chat: "just fix background-tab polling for notifications now; feed +
email are separate follow-ups." Nothing in this file has been implemented.

## What was asked

User wants, in their words: notifications that check out "like ya know fb
type of notifications on what happens on the full system, maybe all of it
can happen too," plus a Settings-page option for the Owner to configure
email notifications — "an email or whatnot too on a notification indicating
like this the message whatnot and a specific for user if can."

Untangled into two separate features:

### A. System-wide activity feed
A Facebook-style feed of *everything happening in the system* — not scoped
to "notifications relevant to you" like the current `Notification` model
is. The app already has `ActivityLog` (every mutation writes a row: MRF
filed, stock in/out, adjustments, permission changes, etc.) and an
`ActivityScreen.tsx` that lists it — so the raw data mostly already exists.
What's missing is turning that into a live, glanceable feed (not a
paginated audit table) — closer to what `DashboardScreen.tsx`'s "Recent
Transactions" panel does today, but system-wide, live-polled, and
presumably not gated behind the `activity` module's current
Owner/Admin-only permission (needs a real decision: does *everyone* see
*everything*, or is it still filtered by what that role could already see
elsewhere?).

Open questions to ask the user before building:
- Does this replace the personal `NotificationBell`, sit alongside it, or
  is `NotificationBell` just "your feed, filtered to you" over the same
  underlying event stream as the site-wide feed?
- Who can see it — everyone, or scoped by existing module permissions (a
  Technician seeing every Stock In/Out feels like a real permissions
  question, not just a UI one)?
- Where does it live — a new page, a dashboard widget, both?

### B. Per-user email notifications, configured in Settings
Owner-configurable (and the user specifically said "a specific for user
if can" — so possibly per-user opt-in/out, not just a single global
on/off) email notifications for at least MRF and low-stock events, sent
via email when they happen.

Needs, concretely:
- An email-sending provider — nothing in this codebase sends email today
  (no Resend/SendGrid/SES/nodemailer dependency found). This is a new
  external integration, not just a code change — will need an API key
  and a provider decision.
- A `NotificationPreference`-style table (or a JSON column) to track,
  per user, which event types they want emailed — matching the existing
  `Notification.type` values (`mrf_filed`, `mrf_fulfilled`, `mrf_closed`,
  `low_stock`) plus whatever the activity feed adds.
- A Settings UI section (`SettingsScreen.tsx` currently only has company
  profile fields) for the Owner to manage this — either a global default
  per event type, a per-user override list, or both, per the question
  above.
- Decide: fire-and-forget from the same code path that creates in-app
  `Notification` rows today (`src/lib/notifications.ts`), or a separate
  queued/batched job so a flaky email provider never blocks or fails a
  real mutation (MRF filing, stock release) the way a slow email API call
  could if called synchronously inline.

## Why this was deferred

Both are real, separately-scoped features — not incremental additions to
what shipped this session. The activity feed needs a permissions/scope
decision before any code; email needs an external provider decision
(cost, deliverability, which service) the user hasn't made yet. Bolting
either on without that groundwork risks building the wrong thing twice.

## Suggested first step next session

Brainstorm session (via `superpowers:brainstorming` or just a direct
conversation) to pin down:
1. Activity feed: who sees what, replace-vs-alongside `NotificationBell`.
2. Email: which provider, global-vs-per-user preference granularity,
   which event types ship first (probably just `mrf_filed` +
   `low_stock` — the two the client has already asked about twice).

Once those are answered, this becomes two normal build passes: a
`Notification`/`ActivityLog`-reuse pass for the feed, and a
schema + external-integration pass for email.
