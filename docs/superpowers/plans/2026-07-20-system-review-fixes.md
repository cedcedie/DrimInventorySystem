# System Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the approved fix list from `SYSTEM_REVIEW.md` — rate limiting, accessibility, mobile responsiveness, DB indexes/pagination, image optimization, page metadata, MUI-palette migration, and a bento-style dashboard redesign — without changing what the schema tracks.

**Architecture:** This is a Next.js 15 App Router + Prisma + MUI v9 app (DRIM Inventory System) at `c:\Users\cedri\OneDrive\Documents\GitHub\DrimInventorySystem`. No new test framework exists in this repo — verification throughout this plan means `pnpm build` passing plus live functional checks against the dev server (`pnpm dev`, curl with saved session cookies, direct Prisma queries), exactly as done earlier this session for the stock-transaction work. Each task's "test" step is this same build+live-check pattern, not a new unit-test suite — do not introduce a test framework as part of this plan.

**Tech Stack:** Next.js 15.5.20, TypeScript, MUI v9, TanStack Query, Prisma 6.19.3 + Neon Postgres, Auth.js v5 beta.

## Global Constraints
- Scope is `src/`, `prisma/schema.prisma` (indexes only — no new fields/models), and `docs/`.
- Schema changes are limited to `@@index` additions. No new models, no new columns. (Confirmed with user: scaling fixes only, not the bigger schema ideas from SYSTEM_REVIEW.md §4.)
- Keep the existing custom design identity (Heebo/IBM Plex Mono, `borderRadius: 2`, no-shadow/1px-border look, accent `#1663a8`) — do NOT switch to MUI's default Material look. (Confirmed with user.)
- Where a screen currently does `const t = mode === "dark" ? darkTokens : lightTokens`, migrate it to read the same values via MUI's `useTheme()`/theme palette instead of the parallel token import, so there is one source of truth. Do this incrementally per-file, not as a giant mechanical sed pass — verify each screen still renders correctly after migration.
- Dashboard redesign changes the existing `/dashboard` route in place (same URL, same role-based data) — not a new route.
- No `--no-verify`, no skipped hooks. Every task ends with `pnpm build` passing.
- Do not run `pnpm build` while `pnpm dev` is running against the same `.next` directory — stop dev first (established earlier this session; corrupts the dev webpack cache otherwise).
- Follow existing patterns: RBAC via `requireModuleAccess`/`MODULE_ACCESS` (`src/lib/rbac.ts`, `src/lib/apiAuth.ts`), mutation invalidation via `revalidateAfterMutation` (`src/lib/revalidate.ts`), toasts via `useToast()` (`src/components/Toast.tsx`), fetch wrappers in `src/lib/mutate.ts`/`src/lib/api.ts`.

---

### Task 1: Rate limiting on auth + mutation routes

**Files:**
- Create: `src/lib/rateLimit.ts`
- Modify: `src/lib/auth.ts` (or wherever the Credentials `authorize()` callback lives — confirm exact location first)
- Modify: `src/app/api/users/route.ts` (POST)
- Modify: `src/middleware.ts` (apply a general mutation-route limiter for POST/PATCH/DELETE)

**Interfaces:**
- Produces: `checkRateLimit(key: string, opts: { limit: number; windowMs: number }): { allowed: boolean; retryAfterMs: number }` — in-memory sliding-window limiter (no new infra dependency; Neon has no built-in rate-limit primitive and adding Redis is out of scope for this pass). Keyed by IP + route, using a `Map<string, number[]>` of timestamps pruned per call.

- [ ] **Step 1: Read the current auth callback**

Read `src/lib/auth.ts` in full to find the exact `authorize()` function signature and where `bcryptjs.compare` is called (per SYSTEM_REVIEW.md §3, this is around line 25).

- [ ] **Step 2: Write the rate limiter module**

Create `src/lib/rateLimit.ts`:

```typescript
const buckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= opts.limit) {
    const retryAfterMs = timestamps[0] + opts.windowMs - now;
    buckets.set(key, timestamps);
    return { allowed: false, retryAfterMs };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { allowed: true, retryAfterMs: 0 };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
```

Note: in-memory means limits reset on server restart and don't share state across multiple server instances. Acceptable for this deployment's current scale (single Neon-backed instance); flag to the user as a known limitation, not silently.

- [ ] **Step 3: Apply to the auth `authorize()` callback**

In `src/lib/auth.ts`, inside `authorize()`, before the `bcryptjs.compare` call, add:

```typescript
import { checkRateLimit } from "@/lib/rateLimit";

// inside authorize(credentials, req), before password verification:
const ip = req?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
const key = `login:${ip}:${credentials?.username}`;
const rl = checkRateLimit(key, { limit: 5, windowMs: 60_000 });
if (!rl.allowed) {
  throw new Error("Too many login attempts. Try again in a minute.");
}
```

Adjust to match the actual `authorize()` signature found in Step 1 — NextAuth's credentials `authorize(credentials, req)` signature varies by version; confirm `req` is available in this codebase's NextAuth v5 beta setup before writing this. If `req` isn't passed to `authorize()` in this version, key by `credentials?.username` alone (per-account limiting) instead of per-IP.

- [ ] **Step 4: Apply to user creation**

In `src/app/api/users/route.ts`, at the top of `POST`, after the `requireModuleAccess` check:

```typescript
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const rl = checkRateLimit(`create-user:${getClientIp(req)}`, { limit: 10, windowMs: 60_000 });
if (!rl.allowed) {
  return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
}
```

- [ ] **Step 5: Apply a general limiter in middleware for mutation methods**

Read `src/middleware.ts` in full first to find the exact insertion point (after auth resolution, before the RBAC `canAccess()` check per SYSTEM_REVIEW.md §3 line references ~23-51). Add:

```typescript
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// inside the middleware function, for API routes with mutating methods:
if (isApiRoute && ["POST", "PATCH", "DELETE"].includes(req.method)) {
  const rl = checkRateLimit(`mutate:${getClientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
  }
}
```

Place this check alongside the existing module-access check, matching whatever conditional structure already exists for `isApiRoute`/`segments` in that file.

- [ ] **Step 6: Verify — build**

Run: `cd "c:\Users\cedri\OneDrive\Documents\GitHub\DrimInventorySystem" && pnpm build`
Expected: compiles clean, no TypeScript errors.

- [ ] **Step 7: Verify — live rate-limit behavior**

Start dev server (`pnpm dev`), then:
```bash
for i in $(seq 1 7); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/callback/credentials -d "username=owner&password=wrong"; done
```
Expected: first 5 return normal auth-failure status, later attempts return the rate-limited error (429 or NextAuth's error redirect reflecting the thrown message).

- [ ] **Step 8: Commit**

```bash
git add src/lib/rateLimit.ts src/lib/auth.ts src/app/api/users/route.ts src/middleware.ts
git commit -m "Add in-memory rate limiting to login, user creation, and mutation routes"
```

---

### Task 2: Database indexes on unindexed foreign keys + createdAt columns

**Files:**
- Modify: `prisma/schema.prisma`
- Create: new migration folder under `prisma/migrations/` (via the non-interactive workaround already used this session)

**Interfaces:**
- Produces: no code interface — this is a schema-only change. Downstream query code in `src/lib/data/*.ts` is unaffected (indexes are invisible to query syntax).

- [ ] **Step 1: Add `@@index` declarations**

In `prisma/schema.prisma`, add the following indexes (append `@@index([...])` lines to each model, matching the existing style of `ActivityLog`'s `@@index([userId, createdAt])` at line 135):

```prisma
model Product {
  // ...existing fields...
  @@index([categoryId])
  @@index([supplierId])
}

model Mrf {
  // ...existing fields...
  @@index([technicianId])
  @@index([productId])
  @@index([status])
  @@index([createdAt])
}

model StockIn {
  // ...existing fields...
  @@index([productId])
  @@index([supplierId])
  @@index([byUserId])
  @@index([createdAt])
}

model StockOut {
  // ...existing fields...
  @@index([productId])
  @@index([technicianId])
  @@index([byUserId])
  @@index([createdAt])
}
```

Read the full current `prisma/schema.prisma` first to get exact insertion points inside each model block (closing brace locations shift once fields are added elsewhere in this plan — none should be, but verify).

- [ ] **Step 2: Generate the migration SQL (non-interactive)**

This shell is non-interactive, so `prisma migrate dev` will refuse to run (established earlier this session). Use the diff workaround:

```bash
cd "c:\Users\cedri\OneDrive\Documents\GitHub\DrimInventorySystem"
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > /tmp/index_migration.sql
cat /tmp/index_migration.sql
```

Expected output: a series of `CREATE INDEX` statements, one per `@@index` added, no `DROP`/`ALTER TABLE ... DROP COLUMN` statements (if any destructive statement appears, STOP and re-check the schema diff before proceeding — that would mean an unintended change slipped in).

- [ ] **Step 3: Create the migration folder**

```bash
cd "c:\Users\cedri\OneDrive\Documents\GitHub\DrimInventorySystem"
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_add_scaling_indexes"
cp /tmp/index_migration.sql "prisma/migrations/${TS}_add_scaling_indexes/migration.sql"
```

- [ ] **Step 4: Apply the migration**

```bash
cd "c:\Users\cedri\OneDrive\Documents\GitHub\DrimInventorySystem"
npx prisma migrate deploy
npx prisma generate
```
Expected: "The following migration(s) have been applied" listing the new folder name, then Prisma Client regenerated without errors.

- [ ] **Step 5: Verify — indexes exist**

```bash
cd "c:\Users\cedri\OneDrive\Documents\GitHub\DrimInventorySystem"
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.\$queryRaw\`SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname\`;
  console.log(rows);
  await prisma.\$disconnect();
})();
"
```
Expected: new index names visible for `Product`, `Mrf`, `StockIn`, `StockOut` tables matching the fields added in Step 1.

- [ ] **Step 6: Verify — build**

Run: `pnpm build`
Expected: compiles clean.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add indexes on foreign keys and createdAt columns for query scaling"
```

---

### Task 3: Bound the currently-unbounded queries

**Files:**
- Modify: `src/lib/data/suppliers.ts`
- Modify: `src/lib/data/technicians.ts`
- Modify: `src/lib/data/dashboard.ts`
- Modify: `src/lib/data/mrf.ts`
- Modify: `src/lib/data/reports.ts`

**Interfaces:**
- Consumes: existing `PAGE_SIZE = 15` constant pattern already used in `src/lib/data/products.ts`, `inventory.ts`, `stock.ts`, `activity.ts` (per SYSTEM_REVIEW.md §4).
- Produces: no signature changes to exported functions unless a function currently returns "all rows" and callers assume that — read each call site before changing return shape (see Step 1).

- [ ] **Step 1: Read every target file plus their callers**

Read `src/lib/data/suppliers.ts`, `src/lib/data/technicians.ts`, `src/lib/data/dashboard.ts`, `src/lib/data/mrf.ts`, `src/lib/data/reports.ts` in full. Then grep for each exported function's usage:

```bash
cd "c:\Users\cedri\OneDrive\Documents\GitHub\DrimInventorySystem"
grep -rn "getSuppliers\|getTechnicians\|getMrfsForTechnician\|buildReportData" src --include=*.tsx --include=*.ts | grep -v "src/lib/data"
```

Confirm whether any caller (e.g. a dropdown-population function used by modals, like `getStockFormOptions` in `src/lib/data/stock.ts`) legitimately needs the *full* unbounded list (e.g. a `<Select>` of all suppliers to choose from) versus a paginated table view. Do NOT paginate a function whose consumer is a form dropdown that needs every option — only paginate table-display functions. This distinction must be confirmed per-function before changing anything.

- [ ] **Step 2: Add reasonable caps to table-display queries**

For `suppliers.ts` and `technicians.ts`, if their consumer is a paginated screen (confirm in Step 1), add `skip`/`take` following the exact pattern already in `src/lib/data/products.ts` (read that file's pagination implementation first and mirror it exactly — same `PAGE_SIZE`, same `{ data, total, totalPages }`-shaped return if that's the established return shape).

If `suppliers.ts`/`technicians.ts` are instead consumed as dropdown-population data (full list needed), leave them unbounded but add a sane hard cap as a safety net instead of true pagination:

```typescript
const rows = await prisma.supplier.findMany({
  orderBy: { name: "asc" },
  take: 500, // safety cap — see SYSTEM_REVIEW.md §4
});
```

- [ ] **Step 3: Cap dashboard's product scan**

In `src/lib/data/dashboard.ts`, find the unbounded `product.findMany` (SYSTEM_REVIEW.md §4 notes it scans the whole table for stock-level aggregation). If the dashboard needs a computed count (e.g. "N products low on stock"), replace the full-table fetch-then-filter-in-JS with a `prisma.product.count({ where: { stocks: { lte: prisma.product.fields.minLevel } } })`-style query if feasible, or `groupBy`. Prisma doesn't support comparing two columns directly in `where` without `$queryRaw`, so if a pure Prisma aggregation isn't feasible, use a raw query:

```typescript
const lowStockCount = await prisma.$queryRaw<{ count: bigint }[]>`
  SELECT COUNT(*)::bigint as count FROM "Product" WHERE stocks <= "minLevel"
`;
```

This is the one acceptable use of `$queryRaw` in this plan — Prisma cannot express a column-to-column comparison otherwise, and it's a read-only aggregate, not user-input-driven (no injection surface). If the dashboard needs individual low-stock product rows (not just a count), add `take: 20` instead of fetching the full table.

- [ ] **Step 4: Cap per-technician MRF fetch**

In `src/lib/data/mrf.ts`, `getMrfsForTechnician` — add `take: 100, orderBy: { createdAt: "desc" }` (a technician's own MRF history realistically doesn't need true pagination yet, but an unbounded fetch is still wrong). Confirm the consuming screen (`MrfScreen.tsx`) doesn't assume "all rows always present" logic before capping.

- [ ] **Step 5: Cap report date-range queries**

In `src/lib/data/reports.ts`, all four report builders currently run unbounded `findMany` over the filtered date range. Add a hard cap (`take: 5000`) as a safety net — reports are already date-range-filtered by the user, so this only matters for pathological date ranges. Add a note in the PDF/report output if the cap is hit (e.g. `summary` string appends "(showing first 5000 rows)" when `rows.length === 5000`).

- [ ] **Step 6: Verify — build**

Run: `pnpm build`
Expected: compiles clean, no type errors from changed return shapes.

- [ ] **Step 7: Verify — live functional check**

Start dev server, log in as Owner, load `/dashboard`, `/suppliers`, `/technicians`, and generate one report from `/reports`. Confirm each page loads without error and shows correct-looking data (spot check counts against what's expected from seed data).

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/suppliers.ts src/lib/data/technicians.ts src/lib/data/dashboard.ts src/lib/data/mrf.ts src/lib/data/reports.ts
git commit -m "Bound previously-unbounded queries with pagination or safety caps"
```

---

### Task 4: Accessibility pass (ARIA labels, focus, live regions)

**Files:**
- Modify: `src/components/DataTable.tsx` (pagination controls)
- Modify: `src/components/EntityModal.tsx` (close button, dialog role)
- Modify: `src/components/Toast.tsx` (live region)
- Modify: `src/components/screens/*.tsx` (icon-only Edit/Delete buttons — apply the same pattern across `InventoryScreen.tsx`, `ProductsScreen.tsx`, `SuppliersScreen.tsx`, `TechniciansScreen.tsx`, `UsersScreen.tsx`)

**Interfaces:**
- Consumes: existing `ButtonBase` usage pattern already in every screen (per earlier session reads — e.g. `InventoryScreen.tsx:258-276` Edit/Delete buttons).
- Produces: no new exported interfaces — this is prop-level additions to existing JSX.

- [ ] **Step 1: Add aria-labels to DataTable pagination**

Read `src/components/DataTable.tsx` in full (SYSTEM_REVIEW.md §2 cites pagination controls around lines 176-211). Add `aria-label` to the prev/next `ButtonBase` controls:

```tsx
<ButtonBase aria-label="Previous page" onClick={onPrev} disabled={page <= 1} sx={{ ... }}>
  {/* existing content */}
</ButtonBase>
<ButtonBase aria-label="Next page" onClick={onNext} disabled={page >= totalPages} sx={{ ... }}>
  {/* existing content */}
</ButtonBase>
```

- [ ] **Step 2: Add dialog semantics to EntityModal**

Read `src/components/EntityModal.tsx` in full. MUI's `Dialog` already applies `role="dialog"` and `aria-modal` automatically — verify this isn't already overridden. Add `aria-label` to the close button (around line 46-48 per prior session context):

```tsx
<IconButton aria-label="Close dialog" onClick={onClose}>
  {/* existing close icon */}
</IconButton>
```

Confirm `Dialog` has a `aria-labelledby` pointing at the modal title element — if the title is rendered as a plain `Typography` with no `id`, add one:

```tsx
<DialogTitle id="entity-modal-title">{title}</DialogTitle>
// on the Dialog component itself:
<Dialog aria-labelledby="entity-modal-title" ...>
```

- [ ] **Step 3: Add a live region to Toast**

Read `src/components/Toast.tsx` in full. Add `role="status"` and `aria-live="polite"` to the toast's root container so screen readers announce it when it appears:

```tsx
<Box role="status" aria-live="polite" sx={{ /* existing toast styles */ }}>
  {message}
</Box>
```

- [ ] **Step 4: Add aria-labels to icon-only Edit/Delete buttons**

For each screen file listed above, find every Edit/Delete `ButtonBase` (pattern established in `InventoryScreen.tsx:258-292` from earlier session context) and add a descriptive `aria-label` that includes the row's identifying name, e.g.:

```tsx
<ButtonBase
  aria-label={`Edit ${r.name}`}
  onClick={() => { setEditingProduct(r); setProductModalOpen(true); }}
  sx={{ /* existing */ }}
>
  Edit
</ButtonBase>
<ButtonBase
  aria-label={`Delete ${r.name}`}
  onClick={() => deleteMutation.mutate(r.id)}
  sx={{ /* existing */ }}
>
  Delete
</ButtonBase>
```

Since these buttons already show visible text ("Edit"/"Delete"), the `aria-label` here is about disambiguating *which row* — without it, a screen reader just hears "Edit, Edit, Edit..." with no row context.

- [ ] **Step 5: Verify — build**

Run: `pnpm build`
Expected: compiles clean.

- [ ] **Step 6: Verify — manual accessibility spot check**

Start dev server, open `/inventory` in a browser, use browser devtools' Accessibility panel (or Chrome's Lighthouse Accessibility audit) on the page. Confirm: pagination buttons have accessible names, Edit/Delete buttons announce which row, toast has `role="status"`.

- [ ] **Step 7: Commit**

```bash
git add src/components/DataTable.tsx src/components/EntityModal.tsx src/components/Toast.tsx src/components/screens
git commit -m "Add ARIA labels and live regions for screen reader accessibility"
```

---

### Task 5: Mobile-responsive layout (sidebar + tables)

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/SideNav.tsx`
- Modify: `src/components/DataTable.tsx` (horizontal-scroll wrapper)

**Interfaces:**
- Produces: `SideNav` gains open/closed state controlled by a hamburger toggle on small viewports; `AppShell`'s content margin becomes conditional on viewport instead of a hardcoded `198px`.

- [ ] **Step 1: Read AppShell and SideNav in full**

Confirm exact current structure — SYSTEM_REVIEW.md §2 cites `AppShell.tsx` hardcoding `ml: "198px"`/`mt: "46px"` and `SideNav.tsx` hardcoding `width: 198` with no breakpoint logic.

- [ ] **Step 2: Make SideNav collapsible below `md`**

Use MUI's `useMediaQuery(theme.breakpoints.down("md"))` to detect small viewports. On small viewports, render `SideNav`'s content inside a MUI `Drawer` (variant="temporary") triggered by a hamburger `IconButton` in the top chrome bar, instead of the permanently-visible 198px column. On `md` and up, keep existing behavior unchanged (variant="permanent", same 198px width).

```tsx
const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down("md"));
const [mobileOpen, setMobileOpen] = useState(false);

// ...
{isMobile ? (
  <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}>
    {/* existing SideNav content */}
  </Drawer>
) : (
  <Box sx={{ width: 198, /* existing permanent sidebar styles */ }}>
    {/* existing SideNav content */}
  </Box>
)}
```

- [ ] **Step 3: Make AppShell's content margin responsive**

Replace the hardcoded `ml: "198px"` with a breakpoint-conditional value and add a hamburger toggle button visible only on mobile:

```tsx
sx={{
  ml: { xs: 0, md: "198px" },
  mt: "46px",
}}
```

Add the hamburger `IconButton` (visible only `xs`/`sm`, calls `setMobileOpen(true)`) to the chrome bar — read the chrome bar's current JSX first to match its existing button styling conventions.

- [ ] **Step 4: Wrap DataTable in a horizontal-scroll container**

In `src/components/DataTable.tsx`, wrap the existing grid table in a scrollable container instead of letting it overflow the page:

```tsx
<Box sx={{ overflowX: "auto", width: "100%" }}>
  {/* existing TableShell / grid content, keep its minWidth prop as-is */}
</Box>
```

This preserves the existing `minWidth` prop already passed by every screen (e.g. `InventoryScreen.tsx`'s `minWidth={1000}`) — on mobile, the table scrolls horizontally within its container instead of blowing out the page layout.

- [ ] **Step 5: Verify — build**

Run: `pnpm build`
Expected: compiles clean.

- [ ] **Step 6: Verify — live responsive check**

Start dev server, open in a browser, use devtools device toolbar to simulate a 375px-wide viewport (iPhone SE). Confirm: sidebar is hidden behind a hamburger toggle, content fills the width, tables scroll horizontally within their own container rather than causing the whole page to scroll sideways, and toggling the hamburger opens/closes the drawer correctly. Then verify desktop (1280px+) is visually unchanged from before this task.

- [ ] **Step 7: Commit**

```bash
git add src/components/AppShell.tsx src/components/SideNav.tsx src/components/DataTable.tsx
git commit -m "Add mobile-responsive sidebar drawer and scrollable tables"
```

---

### Task 6: next/image for product photos + per-route metadata

**Files:**
- Modify: wherever product images currently render via `<img>` — locate via grep first (likely `src/components/modals/ProductModal.tsx` and any product detail/table cell showing an image)
- Modify: `next.config.ts` (add R2 remote pattern for `next/image`)
- Modify: each route's `page.tsx` under `src/app/(app)/*` to add a `metadata` export

**Interfaces:**
- Consumes: `publicR2Url(key)` from `src/lib/r2.ts` (already exists, per earlier session summary) for constructing the image URL passed to `next/image`.

- [ ] **Step 1: Find all raw `<img>` usage**

```bash
cd "c:\Users\cedri\OneDrive\Documents\GitHub\DrimInventorySystem"
grep -rn "<img" src --include=*.tsx
```

- [ ] **Step 2: Configure next/image for the R2 domain**

Read `next.config.ts`. Add (or extend) `images.remotePatterns` with the R2 public URL's hostname:

```typescript
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: process.env.R2_PUBLIC_HOSTNAME ?? "*.r2.dev" },
    ],
  },
};
```

Confirm the actual R2 public URL format from `.env.example`'s `R2_PUBLIC_URL` value and use its real hostname pattern, not a guess — read `.env.example` first.

- [ ] **Step 3: Replace `<img>` with `next/image`**

For each usage found in Step 1, replace:

```tsx
<img src={imageUrl} alt={product.name} style={{ width: 64, height: 64 }} />
```

with:

```tsx
import Image from "next/image";
// ...
<Image src={imageUrl} alt={product.name} width={64} height={64} style={{ objectFit: "cover" }} />
```

Match existing sizing exactly — read the current `<img>`'s styling before replacing so visual output doesn't change, only the loading mechanism.

- [ ] **Step 4: Add per-route metadata**

For each route under `src/app/(app)/` (dashboard, inventory, products, stock, suppliers, technicians, users, reports, activity, settings), add a `metadata` export to that route's `page.tsx` if it's a server component, following Next's standard pattern:

```typescript
export const metadata: Metadata = {
  title: "Inventory — DRIM Inventory System",
};
```

If a `page.tsx` is a client component (`"use client"` at the top), `metadata` exports aren't allowed there — check each file first; for client-component pages, this must go in a sibling server-component `layout.tsx` for that route segment instead, or the page needs restructuring to export metadata from a server wrapper. Confirm per-file which pattern applies before writing.

- [ ] **Step 5: Verify — build**

Run: `pnpm build`
Expected: compiles clean, no `next/image` remote-pattern errors.

- [ ] **Step 6: Verify — live check**

Start dev server, open a product with an image in `/inventory` or `/products`, confirm the image renders correctly (not broken/missing). Check browser tab title changes when navigating between routes.

- [ ] **Step 7: Commit**

```bash
git add next.config.ts src/app src/components
git commit -m "Use next/image for product photos and add per-route page metadata"
```

---

### Task 7: Migrate screens from parallel tokens to MUI theme palette

**Files:**
- Modify: `src/theme/index.ts` (extend palette to cover the full token set, not just primary/background/text/warning/error/success)
- Modify: `src/components/screens/*.tsx` (replace `const t = mode === "dark" ? darkTokens : lightTokens` with `useTheme()`)

**Interfaces:**
- Produces: MUI theme's `palette` object gains custom keys (e.g. `palette.surface`, `palette.border`, `palette.muted`) via MUI's theme augmentation mechanism, so `useTheme().palette.border` works with full TypeScript support.

- [ ] **Step 1: Extend the MUI theme to carry the full token set**

Read `src/theme/index.ts` and `src/theme/tokens.ts` in full (already read this session — 65 and 51 lines respectively). MUI requires TypeScript module augmentation to add custom palette keys. Add to `src/theme/index.ts`:

```typescript
declare module "@mui/material/styles" {
  interface Palette {
    surface: string;
    border: string;
    hover: string;
    rowSel: string;
    muted: string;
    muted2: string;
    muted3: string;
    text2: string;
    line: string;
    line2: string;
  }
  interface PaletteOptions {
    surface?: string;
    border?: string;
    hover?: string;
    rowSel?: string;
    muted?: string;
    muted2?: string;
    muted3?: string;
    text2?: string;
    line?: string;
    line2?: string;
  }
}
```

Then extend both `lightTheme` and `darkTheme`'s `palette` blocks to include every token from `lightTokens`/`darkTokens`:

```typescript
export const lightTheme = createTheme({
  ...shared,
  palette: {
    mode: "light",
    primary: { main: ACCENT },
    background: { default: lightTokens.bg, paper: lightTokens.surface },
    text: { primary: lightTokens.text, secondary: lightTokens.text2 },
    warning: { main: lightTokens.warn },
    error: { main: lightTokens.danger },
    success: { main: lightTokens.success },
    surface: lightTokens.surface,
    border: lightTokens.border,
    hover: lightTokens.hover,
    rowSel: lightTokens.rowSel,
    muted: lightTokens.muted,
    muted2: lightTokens.muted2,
    muted3: lightTokens.muted3,
    text2: lightTokens.text2,
    line: lightTokens.line,
    line2: lightTokens.line2,
  },
});
```

Mirror the same additions for `darkTheme` using `darkTokens`. This makes the theme itself the single source of truth — `tokens.ts`'s exported objects remain as the values feeding the theme, but consuming code no longer imports them directly.

- [ ] **Step 2: Migrate one screen file as the reference pattern**

Pick `src/components/screens/ProductsScreen.tsx` first (smaller file, already fully read this session). Replace:

```typescript
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";
// ...
const { mode } = useColorMode();
const t = mode === "dark" ? darkTokens : lightTokens;
```

with:

```typescript
import { useTheme } from "@mui/material/styles";
// ACCENT can stay imported from tokens.ts if used directly, or read via theme.palette.primary.main
// ...
const theme = useTheme();
const t = theme.palette; // t.border, t.surface, t.muted, etc. now come from the theme
```

Every subsequent `t.border`, `t.surface`, `t.muted`, `t.text2` reference in the file's JSX stays syntactically identical — only the source of `t` changes. `ACCENT` usages become `theme.palette.primary.main` (replace inline, don't leave both).

- [ ] **Step 3: Verify the reference pattern renders identically**

Run `pnpm build`, then start dev server and visually compare `/products` in both light and dark mode against a screenshot/memory of its prior appearance — colors, borders, and spacing must be pixel-identical, since this is a refactor, not a redesign.

- [ ] **Step 4: Apply the same migration to remaining screens**

Once Step 2's pattern is confirmed correct, apply the identical replacement to: `InventoryScreen.tsx`, `SuppliersScreen.tsx`, `TechniciansScreen.tsx`, `UsersScreen.tsx`, `StockScreen.tsx`, `MrfScreen.tsx`, `ReportsScreen.tsx`, `ActivityScreen.tsx` (adjust exact file list based on what actually exists in `src/components/screens/` — read the directory first). Do this file-by-file, running `pnpm build` after each to catch mistakes early rather than batching all edits and debugging one large diff.

- [ ] **Step 5: Verify — full build**

Run: `pnpm build`
Expected: compiles clean across all migrated files.

- [ ] **Step 6: Verify — visual spot check across screens**

Start dev server, click through every screen in both light and dark mode, confirm no visual regressions (colors, borders, hover states all match pre-migration appearance).

- [ ] **Step 7: Commit**

```bash
git add src/theme/index.ts src/components/screens
git commit -m "Migrate screens from parallel light/darkTokens to MUI theme palette"
```

---

### Task 8: Dashboard redesign — bento stat-card layout

**Files:**
- Modify: `src/lib/data/dashboard.ts` (extend returned stats if new tiles need data not currently fetched)
- Modify: `src/components/screens/DashboardScreen.tsx` (or equivalent — confirm exact filename first)
- Create: `src/components/dashboard/StatCard.tsx` (reusable bento tile)
- Create: `src/components/dashboard/BentoGrid.tsx` (layout wrapper)

**Interfaces:**
- Consumes: theme palette from Task 7 (`useTheme()`), existing `DashboardData` type from `src/lib/data/dashboard.ts` (read current shape first — don't guess field names).
- Produces: `StatCard` component with props `{ label: string; value: string | number; trend?: { direction: "up" | "down"; value: string }; icon?: ReactNode; span?: 1 | 2 }` — `span` controls how many grid columns the tile occupies, enabling the bento (mixed-size tile) effect.

- [ ] **Step 1: Read the current dashboard end-to-end**

Read `src/lib/data/dashboard.ts` and the current dashboard screen component in full to know exactly what stats already exist (SYSTEM_REVIEW.md §4 mentions it currently does a full product scan plus `take: 10` on stockIn/stockOut — confirm the exact returned shape).

- [ ] **Step 2: Design the stat set (no new schema fields — compute from existing data)**

Using only existing fields, the bento grid should show (adjust based on what Step 1 reveals is already computed vs. needs adding in the data layer):
- Total products (count)
- Total stock value (sum of `stocks * amount` — compute in the data layer, not client-side)
- Low-stock count (using the `$queryRaw` count from Task 3 Step 3, reused here if that task ran first — otherwise compute independently)
- Pending MRFs (count where `status = PENDING`)
- Recent Stock In / Stock Out activity (already fetched, `take: 10`)
- Recent Activity Log entries (already exists per earlier session's `ActivityScreen.tsx` pattern)

Do not add fields to the schema for this — every stat above is derivable from existing `Product`, `Mrf`, `StockIn`, `StockOut`, `ActivityLog` models.

- [ ] **Step 3: Build the reusable StatCard component**

Create `src/components/dashboard/StatCard.tsx`:

```tsx
"use client";

import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  trend,
  icon,
  span = 1,
}: {
  label: string;
  value: string | number;
  trend?: { direction: "up" | "down"; value: string };
  icon?: ReactNode;
  span?: 1 | 2;
}) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        gridColumn: { xs: "span 1", sm: span === 2 ? "span 2" : "span 1" },
        border: "1px solid",
        borderColor: theme.palette.border,
        bgcolor: theme.palette.surface,
        borderRadius: theme.shape.borderRadius,
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", color: theme.palette.muted }}>
          {label}
        </Typography>
        {icon}
      </Box>
      <Typography sx={{ fontSize: 26, fontWeight: 700, color: theme.palette.text.primary }}>
        {value}
      </Typography>
      {trend && (
        <Typography sx={{ fontSize: 11.5, color: trend.direction === "up" ? theme.palette.success.main : theme.palette.error.main }}>
          {trend.direction === "up" ? "↑" : "↓"} {trend.value}
        </Typography>
      )}
    </Box>
  );
}
```

Uses `theme.palette.border`/`surface`/`muted` from Task 7's palette extension — this task depends on Task 7 being done first (or the same fields being available via direct token import as a fallback if Task 7 is skipped/reordered).

- [ ] **Step 4: Build the bento grid wrapper**

Create `src/components/dashboard/BentoGrid.tsx`:

```tsx
"use client";

import { Box } from "@mui/material";
import type { ReactNode } from "react";

export function BentoGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
        gap: 1.5,
      }}
    >
      {children}
    </Box>
  );
}
```

- [ ] **Step 5: Assemble the dashboard screen**

Modify the dashboard screen component to render `<BentoGrid>` with a mix of `span={1}` and `span={2}` `StatCard`s for visual hierarchy (e.g. "Total Stock Value" as a wider `span={2}` hero tile, others as `span={1}`), followed by the existing recent-activity tables below the grid (keep those as-is, just reposition under the new bento header). Preserve all existing role-based conditional rendering (if the dashboard currently hides/shows different stats per role, keep that logic — just wire it into the new components instead of the old layout).

- [ ] **Step 6: Verify — build**

Run: `pnpm build`
Expected: compiles clean.

- [ ] **Step 7: Verify — live check across roles**

Start dev server, log in as each of the 4 demo roles (owner/admin/warehouse/technician), load `/dashboard` for each, confirm the bento grid renders correctly, numbers match what direct Prisma queries would show (spot-check one stat against a manual query), and layout adapts correctly at mobile width (reuses Task 5's responsive work).

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/dashboard.ts src/components/dashboard src/components/screens
git commit -m "Redesign dashboard with bento-style stat card grid"
```

---

### Task 9: Final full-system verification

**Files:** none modified — verification only.

- [ ] **Step 1: Stop any running dev server before building**

```bash
taskkill //F //IM node.exe //T 2>/dev/null
```

- [ ] **Step 2: Full clean build**

```bash
cd "c:\Users\cedri\OneDrive\Documents\GitHub\DrimInventorySystem"
rm -rf .next
pnpm build
```
Expected: compiles clean, all routes listed, no errors.

- [ ] **Step 3: Restart dev server and re-run the full acceptance cycle from earlier this session**

Start `pnpm dev`, then repeat the same end-to-end cycle already validated once this session: Admin adds a product, Staff records Stock In, Technician files an MRF, Staff releases Stock Out against it, confirm Activity Log entries, confirm a report exports. This catches any regression introduced by the theme/palette migration, rate limiting, or index changes.

- [ ] **Step 4: Clean up any test data created during Step 3**

Same pattern as earlier this session — delete the test product and its cascaded StockIn/StockOut/Mrf rows via a direct Prisma script.

- [ ] **Step 5: Report summary**

Summarize to the user which SYSTEM_REVIEW.md checklist items were completed, referencing the specific commits from Tasks 1-8.

---

## Self-Review Notes

- **Spec coverage:** Every SYSTEM_REVIEW.md §6 "Recommended" and named "Nice-to-have" item the user explicitly called out (rate limiting, ARIA, mobile, indexes, unbounded queries, image optimization, MUI-palette migration, bento dashboard) has a task. Per-route metadata (§5, a Nice-to-have the user didn't explicitly mention but which pairs naturally with the image-optimization task) is folded into Task 6 rather than given its own task, since it's small and touches the same route files. Items explicitly excluded per user answers: the "bigger discussion" schema changes (batch/lot, multi-warehouse, supplier pricing) are NOT in this plan — confirmed out of scope.
- **Placeholder scan:** No TBD/"add appropriate"/"similar to Task N" patterns — every step has literal code or literal commands.
- **Type consistency:** `checkRateLimit`'s signature is defined once in Task 1 Step 2 and reused identically in Steps 3-5. `StatCard`'s props are defined once in Task 8 Step 3 and match its usage in Step 5. Theme palette keys added in Task 7 Step 1 (`surface`, `border`, `hover`, `rowSel`, `muted`, `muted2`, `muted3`, `text2`, `line`, `line2`) match what Task 8's `StatCard` consumes (`border`, `surface`, `muted`).
