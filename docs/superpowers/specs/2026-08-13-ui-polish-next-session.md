# UI/UX polish — next session TODO

Date noted: 2026-08-13. Captured at end of session, not yet started — user was
out of time. Nothing in this file has been implemented.

## Requests, as given

1. **Remove rounded rectangles on the "add item" modal** — the Stock In /
   MRF / Purchase Order item-add section (`ItemCartEditor.tsx`) uses
   `borderRadius.lg`/`borderRadius.md` from `theme/designTokens.ts` on the
   "Add Items" panel and cart list containers. User wants these squared off.
   Scope: `src/components/ItemCartEditor.tsx` — check whether the modals'
   outer shell (`EntityModal.tsx`, `12px` radius) is in scope too or just the
   inner cart panels; ask if ambiguous.

2. **Remove "e.g." example text on the MRF modal** — `MultiItemMrfModal.tsx`
   has `placeholder="e.g. Northgate Cold Storage"` (Project Name field) and
   `placeholder="e.g. PO-2024-001"` (External Ref. No. field). User wants
   these placeholder examples removed or reworded without "e.g."

3. **Open MRFs: one UX row per MRF, not one row per line item** — currently
   `OpenMrfsTab` in `StockScreen.tsx` flattens `mrf.items` so a 2-item MRF
   shows as 2 table rows (`flatRows = data?.mrfs.flatMap(...)`). User wants
   the queue to show **one row per MRF** (matching how `MrfScreen.tsx`'s own
   list already collapses multi-item MRFs into one row with an item-count
   badge), presumably expanding to show/fulfill individual lines from a
   detail view rather than flattening in the table itself. Needs a design
   pass — how does "Fulfill" work from a collapsed row when there are
   multiple lines with different qty-remaining/stock-availability? Likely:
   click row → open `MrfDetailModal` (already exists) → fulfill lines there,
   removing today's per-line "Fulfill" button directly in the flat table.

4. **Product picker: search instead of full category dropdown** — the
   `ItemCartEditor`'s "Select Item" field is a plain MUI `<Select>` with
   `<ListSubheader>` category groups (recently built). User wants a
   searchable/type-to-filter input instead, likely MUI `Autocomplete`,
   while still resolving to a real `productId` (not free text — see the
   data-integrity note from earlier in this session on why Stock In can't
   accept arbitrary text). Also mentioned "modals tend to be [long/heavy?]"
   — likely related complaint about the overall modal length; worth asking
   whether this also means shortening the Add-Items section's visual weight.

5. **Real login, not demo/1234** — no demo credentials found anywhere in the
   codebase (`src/app/(auth)/login`, `scripts/`) — this is almost certainly
   a manually-created test user directly in the Neon DB (username/password
   like "demo"/"1234"), not application code. This is a data/ops cleanup,
   not a code change: rotate or delete that test account, and consider
   whether to add a decent onboarding/seed flow for the real Owner/Admin
   account creation if one doesn't exist yet. Confirm with user what
   "1234" account they mean before touching any DB data.

6. **Mobile view** — no responsive audit has been done this session. Given
   the earlier UX audit's finding that field technicians file MRFs from
   phones, this is a real gap, not cosmetic. Needs its own pass: check
   `StockScreen.tsx`, `MultiItemMrfModal.tsx`/`StockInModal.tsx` (wide
   grid layouts, `gridTemplateColumns: "2fr 1fr auto"` etc.), `DataTable.tsx`
   (fixed-width `minWidth` tables force horizontal scroll on phones), and
   `AppShell.tsx`/`SideNav.tsx` (currently `{ xs: "none", md: "flex" }` —
   need to confirm the existing mobile nav/hamburger flow actually works end
   to end, not just that it renders).

7. **Collapsible sidebar** — `SideNav.tsx` currently has a fixed
   `SIDENAV_WIDTH` on desktop with no collapse/pin toggle. Add a
   collapse-to-icons (or fully hide) toggle for desktop, persisted
   (localStorage) across sessions. Check how `AppShell.tsx`'s
   `ml: { md: SIDENAV_WIDTH }` main-content margin would need to react to
   a collapsed state.

8. **General UX pass** — vague as given; ask user for specifics next
   session, or treat as a follow-on `impeccable critique`/`audit` pass on
   whatever ships from items 1–7 first.

9. **Animations** — no direction given (what should animate — modal
   open/close, table row updates, toast entry, sidebar collapse, page
   transitions?). Ask for a couple of concrete target moments before
   building anything; "add animations" without a target tends to produce
   generic motion nobody asked for.

## Suggested order for next session

1. Quick wins first (low risk, no design ambiguity): #1 (border-radius),
   #2 (remove "e.g." text) — probably 15 minutes combined.
2. #3 (Open MRFs one-row-per-MRF) — needs a short design conversation
   about the fulfill-from-collapsed-row flow before touching code.
3. #4 (searchable product picker) — swap `<Select>` for MUI `Autocomplete`
   in `ItemCartEditor.tsx`, keep `groupByCategory` grouping as
   `groupBy` on the Autocomplete options.
4. #6 + #7 (mobile + collapsible sidebar) — related, worth doing together
   since a collapsible sidebar is often the actual fix mobile needs.
5. #8 + #9 (general UX + animations) — get concrete direction first via
   `/impeccable` skill (this project doesn't have a `PRODUCT.md`/`DESIGN.md`
   yet — `impeccable init` first would make future rounds faster).
6. #5 (demo login) — this is a 2-minute DB cleanup once the user confirms
   which account they mean; do it whenever, doesn't block anything else.

## Context for whoever picks this up

This session shipped (see git log on `master`, commits from
`355b65b` through `75a538e`): multi-item Stock In, category-grouped
pickers, technician history, MRF PDF export, a full deployment-readiness
pass (security fixes, error pages, toast severity, staleness indicators),
a new Purchase Orders feature, and low-stock notifications with
background-tab polling. All migrations are applied to the live Neon DB.
Working tree is clean; `master` is in sync with `origin/master`.
