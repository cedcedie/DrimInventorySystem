# DRIM Inventory System — Full-System Review

**Date:** 2026-07-20
**Scope:** UI/UX & design system, security, database schema & architecture, performance/SEO
**Method:** Direct code audit (no assumptions) — every finding below cites the file and line it comes from.

---

## 1. Executive Summary

- **The design system is real, not generic MUI defaults.** Custom theme, custom fonts, a deliberate "dense enterprise console" identity, and it matches the original design-handoff spec almost exactly. This is the strongest part of the build.
- **Biggest risk: no rate limiting anywhere.** Login, account creation, and every mutation route are wide open to brute-force/spam. This is the single highest-priority fix.
- **Second risk: accessibility is at zero.** No `aria-*` attributes anywhere in the codebase. If anyone using assistive tech touches this app, it currently doesn't work for them.
- **The app is desktop-only.** Outside the login page, nothing responds to a smaller viewport — the sidebar and tables use hardcoded pixel widths.
- **The database is clean but young.** Well-normalized schema, correct transactional stock mutations, but only one explicit index exists in the whole schema. Fine at demo scale, will slow down as real data accumulates.
- **"SEO" doesn't really apply here** — see the callout in §5. What you actually want is perceived speed, and there's room to improve it (unbounded queries, no image optimization).
- **Quickest win:** add indexes to the unindexed foreign keys (§4) — this is a single migration, zero UI risk, and removes a scaling cliff before it matters.
- **Nothing here is a structural rebuild.** Every finding below is additive — a new index, a validation layer, a rate limiter, a breakpoint. The core architecture (Next.js App Router + Prisma transactions + RBAC) is sound.

---

## 2. UI/UX & Design System

### What's working
The theme is genuinely custom, not defaults with a color swapped in:
- `src/theme/tokens.ts:1-64` defines a full light/dark token system — background/surface/border/hover/row-selection tiers, five-way status chip colors (success/danger/warn/neutral/info) per mode.
- `src/theme/index.ts:5,7,17-25` sets `shape.borderRadius: 2`, custom font (`'Heebo', sans-serif`), `disableElevation` on buttons, and strips shadows from `MuiCard`/`MuiAppBar` — all deliberate choices, not leftovers.
- This matches the design-handoff brief almost line for line: `design_handoff_drim_inventory/README.md` calls for "dense, square-cornered, enterprise" with "no shadows; 1px borders instead," Heebo/IBM Plex Mono fonts, and exact modal widths (420/560/660px) and chrome dimensions — all implemented as specified.
- The result reads as a real data-console product (dense rows, mono font for reference codes, uppercase letter-spaced column headers) rather than a templated admin dashboard.

### Gaps

**Accessibility — currently zero.** A full-repo search found no `aria-*` attributes, no `role=` usage, and no `tabIndex`/`autoFocus` anywhere in `src`. Interactive elements like the pagination controls and modal close button rely entirely on native HTML semantics with no supplemental labeling. For icon-only buttons (edit/delete actions in tables) this means a screen reader user gets no indication of what the control does.

**No responsive/mobile support.** Everything outside `src/app/(auth)/login/page.tsx` (which does use `xs`/`md` breakpoints) is fixed-width:
- `AppShell.tsx` hardcodes `ml: "198px"` and `mt: "46px"` for content offset — no collapse behavior.
- `SideNav.tsx` hardcodes `width: 198` with no drawer/hamburger fallback.
- Every data table (`DataTable.tsx` consumers like `InventoryScreen.tsx:85-87`) uses CSS grid with fixed pixel column widths — there's no breakpoint-based reflow, so on a narrow viewport the tables just overflow or get cut off.

**Minimal motion.** Only three transitions exist in the entire app: a 0.12s opacity fade on table refetch (`DataTable.tsx:29`), a similar fade on the sidebar (`SideNav.tsx:103`), and a CSS spinner keyframe (`CenteredLoading.tsx:31`). No `Fade`, `Grow`, `Collapse`, or animation library. Modals and toasts currently appear/disappear instantly.

**Theme duplication pattern.** Nearly every screen component re-derives `const t = mode === "dark" ? darkTokens : lightTokens` locally instead of reading from MUI's theme palette via `useTheme()`. It works, but it means the token system and the MUI theme object are two parallel sources of truth that happen to agree today — a future palette change would need to be made in both places.

### Proposed follow-ups (not built — pick what you want)
| Item | What it does | Effort |
|---|---|---|
| A11y pass | Add `aria-label` to icon-only buttons (edit/delete/pagination), verify focus rings are visible, add `role`/`aria-live` to the toast | Small |
| Mobile breakpoint strategy | Collapse `SideNav` into a drawer below `md`, let tables scroll horizontally in a contained wrapper instead of overflowing the page | Medium |
| Modal motion | Swap `EntityModal`'s instant show/hide for MUI's `Fade`/`Grow` transition | Small |
| Toast motion | Add slide-in/out instead of the current abrupt appear/disappear | Small |
| Row-update flash | Brief background-color pulse on a `DataTable` row right after a mutation lands (Stock In/Out, edit) — makes the change visibly register instead of a silent re-render | Small |
| Sidebar active-item transition | Animate the active nav-item indicator instead of an instant color swap | Small |

---

## 3. Security

### What's working
- **Auth architecture is sound.** NextAuth v5 (beta) with a single Credentials provider (`src/lib/auth.ts`), JWT session strategy (`src/lib/auth.config.ts:6`), passwords hashed with bcrypt cost factor 10 (`src/app/api/users/route.ts:40`), verified via `bcryptjs.compare` (`auth.ts:25`). The config is correctly split between an edge-safe `auth.config.ts` (consumed by middleware, no Prisma/bcrypt) and the Node-only `auth.ts` — this is the right pattern for Next.js middleware's edge runtime constraints.
- **RBAC has defense in depth.** Every route is gated twice: globally by `src/middleware.ts:23-51` via `canAccess()` (`src/lib/rbac.ts:31-33`), and again per-route via `requireModuleAccess()` (`src/lib/apiAuth.ts:6-16`). Spot-checked ~20 route files — all call it before doing work.
- **No SQL injection surface.** Zero `$queryRaw`/`$executeRaw` usage anywhere — Prisma's query builder is used exclusively.
- **No secrets committed.** `.env.example` contains only placeholders; the real `.env` is gitignored (confirmed via `git ls-files`).
- **File upload is reasonably locked down.** `src/app/api/upload/route.ts:9-13` requires Owner/Admin, validates MIME type against an allowlist and a 5MB cap (lines 21-26), and generates the storage key server-side with `crypto.randomUUID()` (line 30) — the client-supplied filename is never used, so there's no path-traversal risk.
- **Error responses don't leak stack traces.** Catch blocks consistently return `e.message` with a generic fallback, not raw exception dumps.

### Gaps

**No rate limiting anywhere (highest priority).** A full-repo search for rate-limiting patterns returned zero matches. Login (`/api/auth`), account creation (`POST /api/users`), and every mutation route are unthrottled — open to brute-force credential attacks and spam account/data creation.

**No schema-based input validation.** No `zod` (or similar) in `package.json`. Every route does manual, shallow checks after `await req.json()` — presence and type coercion only, e.g. `products/route.ts:24-29`, `users/route.ts:26-37`. String fields like `name`, `code`, `username` are `.trim()`ed but have no max-length or character-set restriction, and there's no protection against oversized payloads.

**A few routes leak on unmatched errors.** Several routes catch Prisma unique-constraint errors by string-matching (`e.message.includes("Unique constraint")` in `users/route.ts:58`, `products/route.ts:59`, `technicians/route.ts:46`, `suppliers/route.ts:46`), and `rethrow` anything else (`throw e` in `users/route.ts:61`, `products/route.ts:62`) with no visible top-level handler in the sampled files — meaning an unexpected Prisma error could surface raw DB error text (table/column names) to the client depending on environment configuration.

**Inconsistent secondary role checks.** Some mutating routes add an extra check beyond module-level RBAC (e.g. `isOwnerOrAdmin` in `products/route.ts:20`), but others (`suppliers/route.ts`, `technicians/route.ts` POST) rely solely on module access. Currently safe because only OWNER/ADMIN have those modules in the RBAC matrix, but it's fragile — if the matrix changes, these routes wouldn't automatically get the tighter check.

**File upload trusts client-supplied MIME type.** `file.type` is browser-reported metadata, not verified against actual file bytes (no magic-number check) — a mismatched content-type could in principle bypass the allowlist.

### Proposed follow-ups (Critical / Recommended / Nice-to-have — see §6)
- Add rate limiting to `/api/auth` and mutation-heavy routes — **Critical**.
- Add zod schemas for all POST/PATCH bodies — **Recommended**.
- Add a top-level error boundary/handler so unmatched exceptions never reach the client raw — **Recommended**.
- Standardize the secondary role-check pattern across all mutating routes — **Nice-to-have** (current behavior is safe, just fragile).
- Verify uploaded file magic bytes, not just declared MIME type — **Nice-to-have**.

---

## 4. Database Schema & Architecture

### Schema shape (9 models)
`User` → `Category` → `Supplier` → `Product` → `Technician` → `Mrf` (Material Request Form) → `StockIn` / `StockOut` → `ActivityLog`. Full relations in `prisma/schema.prisma:28-136`. Two migrations exist total (`prisma/migrations/20260720054414_init`, `20260720165820_add_technician_user_link`), both from today — this is a fresh schema with no churn history yet.

### What's working
- Correct use of Prisma `$transaction` for every stock-affecting mutation (Stock In/Out, MRF fulfillment) — atomic by construction.
- Consistent `unstable_cache` + `revalidateTag` pattern across `src/lib/data/*.ts`, centralized in `src/lib/revalidate.ts`.
- No N+1 query patterns found — all list-fetch functions batch `include`/`select` in single `findMany` calls.
- Consistent `skip`/`take` pagination (`PAGE_SIZE = 15`) on the four main list routes (products, inventory, stock, activity).

### Gaps

**Only one explicit index in the entire schema** — `ActivityLog` at `schema.prisma:135` (`@@index([userId, createdAt])`). Every other foreign key is unindexed: `Product.categoryId`/`supplierId`, `Mrf.technicianId`/`productId`, all `StockIn`/`StockOut` FKs. Postgres does not auto-index FK columns (only `@unique`/`@id` fields get free indexes). These FKs are actively queried via `where`/`include` in `src/lib/data/*.ts` — fine at today's demo-data volume, but this is the first thing that will slow down as transaction history grows. `createdAt` (used in `orderBy` across stock, activity, dashboard, reports) is in the same position.

**Several endpoints run fully unbounded queries:** `suppliers.ts` and `technicians.ts` `findMany` with no `take`; `dashboard.ts` scans the entire product table on every load (only stockIn/stockOut are capped at `take: 10`); `mrf.ts`'s `getMrfsForTechnician` fetches every MRF for a tech with no limit; all four report types in `reports.ts` run unbounded `findMany` over the full table/date range. None of this breaks today — it's a scaling risk, not a bug.

**No `updatedAt` or soft-delete pattern anywhere** except `User.status` (ACTIVE/INACTIVE). Deleting or deactivating a referenced Product/Supplier/Category/Technician either gets blocked by the FK constraint or silently orphans history — there's no "who/when changed this price" trail outside the free-text `ActivityLog`.

**`ActivityLog` is free-text only.** `action` and `refNo` (`schema.prisma:132-133`) are plain strings with no real foreign key back to the entity they describe — you can't reliably join "show me all activity for Product X" without string-matching `refNo` against a convention (SI-/SO-/MRF-/RPT-/product code) rather than a real relation. This is workable but thin for a system whose main compliance feature is "everything is logged."

### Schema field gaps for a real-world inventory system
These are roadmap-level ideas, not quick fixes — each needs your explicit sign-off before any schema change, per how we've been working this session.

| Idea | What it adds | Rough shape | Effort/impact |
|---|---|---|---|
| **Batch/lot + expiry tracking** | Track individual batches of stock with lot numbers and expiry dates, not just a running total | New `Batch` model (`lotNo`, `expiryDate`, `qty`, `productId` FK) sitting between `Product` and `StockIn`/`StockOut` | Medium-high — touches the Stock In/Out transaction logic directly. Only relevant if any stocked items are perishable or warrantied. |
| **Multi-warehouse/location/bin** | Stock counts per physical location instead of one global number | Replace `Product.stocks` (single Int) with a `StockLevel` join model (`productId`, `locationId`, `qty`) | High — the single biggest change on this list, cascades into nearly every screen that shows or edits stock. Only worth it if you actually operate more than one site. |
| **Structured supplier contact** | Real phone/email/contact-name fields instead of one free-text blob | Split `Supplier.contact` (currently `schema.prisma:51`) into `phone`/`email`/`contactName` | Low — additive, no cascading UI risk. |
| **Barcode field** | A scannable code distinct from the internal product code | Add `Product.barcode` (nullable, unique) alongside the existing `code` | Low. |
| **Supplier lead-time/pricing history** | Track how supplier pricing changes over time | New `SupplierPrice` model (`supplierId`, `productId`, `unitPrice`, `effectiveDate`) | Medium — valuable if suppliers change pricing often; skippable if pricing is static. |
| **Structured ActivityLog** | Real joins from an activity entry back to the record it describes | Add `entityType`/`entityId` columns alongside the existing `action`/`refNo` | Low-medium — meaningfully strengthens the audit-trail claim for relatively little schema change. |

---

## 5. Performance (and why "SEO" isn't the right framing)

**On SEO specifically:** this app sits entirely behind login (`src/middleware.ts` gates every non-public route). Search engines will never see it, so classic SEO — meta tags for ranking, sitemaps, structured data — doesn't apply. What's worth optimizing instead is **perceived speed** for the people who do use it, and correct browser-tab metadata. Framing it as "SEO" would send effort at the wrong target.

### Findings
- `src/app/layout.tsx:13-16` sets one static `title`/`description` for the whole app — every page shows the same browser tab title. Low-effort fix: per-route `metadata` exports (Next's built-in mechanism, already available, just unused).
- No `next/image` usage anywhere — product images render via a plain `<img>` pointed at the R2 URL, meaning no automatic resizing, lazy-loading, or format negotiation. Matters more as the product catalog and its images grow.
- The unbounded queries noted in §4 (dashboard's full product scan, unpaginated suppliers/technicians/reports) are as much a performance issue as a scaling one — every dashboard load currently does a full table scan.
- No rate limiting (§3) also has a performance angle: nothing stops accidental or malicious request floods from degrading the app for everyone else.

---

## 6. Prioritized Fix List

Each item is independent — tell me which ones to act on and I'll scope them separately. Schema-touching items always get called out for your sign-off first.

### Critical
- [ ] Add rate limiting to `/api/auth` (login) and mutation-heavy routes (§3)

### Recommended
- [ ] Add FK indexes: `Product.categoryId`/`supplierId`, `Mrf.technicianId`/`productId`, `StockIn`/`StockOut` FKs, plus `createdAt` where sorted on (§4) — *schema change, needs sign-off*
- [ ] Add zod validation schemas to all POST/PATCH API routes (§3)
- [ ] Add a top-level error handler so unmatched exceptions never reach the client raw (§3)
- [ ] Accessibility pass: `aria-label`s on icon buttons, verify focus rings, `aria-live` on toasts (§2)
- [ ] Paginate/cap the currently-unbounded queries: suppliers, technicians, dashboard's product scan, per-technician MRFs, all report types (§4)

### Nice-to-have
- [ ] Mobile breakpoint strategy — collapsible sidebar, scrollable tables (§2)
- [ ] Modal motion (`Fade`/`Grow` on `EntityModal`) (§2)
- [ ] Toast slide-in/out (§2)
- [ ] Row-update flash on mutation (§2)
- [ ] Sidebar active-item transition (§2)
- [ ] Per-route page metadata (§5)
- [ ] `next/image` for product photos (§5)
- [ ] Structured ActivityLog (`entityType`/`entityId`) — *schema change* (§4)
- [ ] Structured supplier contact fields — *schema change* (§4)
- [ ] Barcode field — *schema change* (§4)
- [ ] Verify uploaded file magic bytes vs. declared MIME type (§3)
- [ ] Standardize secondary role-checks across all mutating routes (§3)

### Bigger discussion (not a quick fix — talk before scoping)
- [ ] Batch/lot + expiry tracking — *schema change* (§4)
- [ ] Multi-warehouse/location/bin support — *schema change, largest item in this report* (§4)
- [ ] Supplier lead-time/pricing history — *schema change* (§4)

---

**Nothing in this report has been implemented.** It's a snapshot of where things stand. Let me know which section(s) or specific checkbox items you want to act on first.
