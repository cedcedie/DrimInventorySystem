# DRIM Inventory System — Architecture Review

**Date:** 2026-07-30
**Phase:** 1 (Audit, read-only) + 2 (Plan, awaiting approval)
**Method:** Direct code audit. Every claim cites the file and line it came from. Live Neon connection verified via `prisma migrate status`.

---

## 1. Current Stack Summary

| Layer | What's actually there | Evidence |
|---|---|---|
| Framework | Next.js 15.5.20, App Router, React 19.2.4 | `package.json:23,26` |
| Language | TypeScript 5, strict | `tsconfig.json` |
| Routing | App Router, route group `(app)` for authed screens, `(auth)` for login | `src/app/(app)/`, `src/app/(auth)/login/` |
| UI kit | MUI v9 + Emotion, custom theme | `package.json:14-19` |
| Fonts | Heebo (UI) + IBM Plex Mono (data/refs), self-hosted via Fontsource | `package.json:16-17` |
| Server state | TanStack Query v5, hydrated from RSC `initialData` | `package.json:21`, `DashboardScreen.tsx:20-24` |
| Client state | React local state only — no Redux/Zustand/Context store beyond theme | `src/theme/ThemeRegistry.tsx` |
| Auth | NextAuth v5 beta 31, Credentials provider, JWT sessions | `src/lib/auth.ts`, `src/lib/auth.config.ts:6` |
| Passwords | bcryptjs, cost 10 | `src/app/api/users/route.ts:36` |
| DB layer | Prisma 6.19.3 → PostgreSQL (Neon) | `prisma/schema.prisma:5-8` |
| Validation | Zod 4.4.3 on all POST/PATCH routes | `src/lib/schemas.ts`, `src/lib/validate.ts` |
| Object storage | Cloudflare R2 via `@aws-sdk/client-s3` (S3-compatible — **not** AWS) | `src/lib/r2.ts:19` |
| PDF export | `pdf-lib`, generated server-side, stored to R2 | `src/lib/pdfReport.ts` |
| Rate limiting | In-memory Map, per-IP | `src/lib/rateLimit.ts` |
| Deployment | **Nothing configured** | no `wrangler.toml`, `open-next.config.ts`, or CI |

### Constraint compliance
Only Neon and Cloudflare are in use. `@aws-sdk/client-s3` is a red herring — it is the standard S3-compatible client pointed at `https://<account>.r2.cloudflarestorage.com` (`src/lib/r2.ts:19`). No AWS account is involved. **No constraint violation.**

### Architecture pattern
Reads follow a consistent and genuinely good pattern:

```
RSC page  →  src/lib/data/*.ts  (unstable_cache + tags)  →  Prisma  →  Neon
   ↓ initialData
Client screen  →  TanStack Query  →  /api/*  (same data fn)
```

Writes: `/api/*` route → `requireModuleAccess()` → Zod → `prisma.$transaction` → `ActivityLog` row → `revalidateAfterMutation(tags)`. Stock mutations correctly use `isolationLevel: "Serializable"` (`stock-in/route.ts`, `stock-out/route.ts`).

This is a sound foundation. The problems below are gaps and misconfigurations, not structural defects.

---

## 2. Neon Status — LIVE ✅ (migrated to Singapore 2026-07-30)

| Item | Status |
|---|---|
| Region | ✅ **`ap-southeast-1` (Singapore)** — migrated from `us-east-1` |
| Connection string | ✅ Pooled endpoint in `DATABASE_URL` (`pgbouncer=true&connect_timeout=15`) |
| Direct URL | ✅ `DIRECT_URL` set to the unpooled host; `directUrl` wired into the datasource |
| ORM | ✅ Prisma 6.19.3 |
| Migrations | ✅ All 3 applied to Singapore — `init`, `add_technician_user_link`, `add_scaling_indexes` |
| Seed data | ✅ Re-seeded: 6 categories, 29 products, 3 suppliers, 3 technicians, 6 users, 5 MRFs, 36 activity rows |
| Indexes | ✅ FK + `createdAt` indexes present |

### Measured latency improvement

Head-to-head benchmark, 5 warm `SELECT 1` round-trips per region from the dev machine:

| Region | Average round-trip |
|---|---|
| `us-east-1` (Virginia, old) | **1371 ms** |
| `ap-southeast-1` (Singapore, new) | **332 ms** |

**~4.1× faster — 1,039 ms saved on every query round-trip.** The original estimate in this report (~200–250 ms for Virginia) was far too conservative; the real figure was over a second. This was the single largest performance win available and it is now banked.

> Remaining 332 ms is dev-machine-to-Singapore plus Neon free-tier cold start. From a Cloudflare data center in production this will be substantially lower.

### Remaining Neon work — YOU (manual)
1. **Rotate the `neondb_owner` password.** The Singapore connection string was pasted into a chat transcript. Neon → Project → Roles → Reset password, then update `.env` and Pages. Low risk today (seed data only), but do it before real stock data lands.
2. **Create a separate production branch.** Never point production at the dev database.
3. **Delete the old `us-east-1` project** once you're satisfied the new one is working. A backup of the old `.env` is at `.env.backup-us-east-1` (gitignored).

---

## 3. Cloudflare Status — PARTIALLY WIRED ⚠️

| Item | Status |
|---|---|
| R2 credentials | ❌ **All five vars are present but EMPTY strings** in `.env`. R2 is not set up. Any product-image upload or PDF export will throw `Missing required env var R2_ACCOUNT_ID` (`src/lib/r2.ts:7`). |
| R2 client code | ✅ Complete — upload, presigned GET, public URL (`src/lib/r2.ts`) |
| `next/image` allowlist | ✅ Derives R2 hostname at build time (`next.config.ts:8-18`) |
| **Pages/Workers config** | ❌ **Does not exist.** No `wrangler.toml`, no `open-next.config.ts` |
| **Build adapter** | ❌ Not installed |
| **DNS / custom domain** | ❌ Not configured |
| **Production env vars** | ❌ Not set anywhere but local `.env` |
| **CI/CD** | ❌ None |

### 🚨 The blocking issue: this app cannot deploy to Cloudflare as-is

This is the most important finding in the report, so I want to be precise rather than reassuring.

Cloudflare Workers is **not** Node.js. Three things in this codebase are Node-only:

1. **Prisma's default client** opens a raw TCP socket to Postgres. Workers has no TCP sockets.
2. **bcryptjs** is CPU-bound; Workers' free tier caps CPU at 10 ms per request. A bcrypt cost-10 hash takes ~100 ms. **Login would time out.**
3. **`@aws-sdk/client-s3`** is a heavy Node-targeted bundle that inflates the Worker past size limits.

There are exactly two viable paths. They are genuinely different products, not variations:

#### Path A — Cloudflare Workers (via OpenNext)
Add `@opennextjs/cloudflare`, switch Prisma to `@prisma/adapter-neon` (HTTP driver, no TCP), replace bcryptjs with WebCrypto PBKDF2 (**invalidates all existing password hashes — requires re-seeding every user**), and replace `@aws-sdk/client-s3` with R2 native bindings.

- **Cost:** free tier is generous (100k requests/day).
- **Effort:** high. Touches auth, DB, and storage layers.
- **Risk:** NextAuth v5 beta on Workers is not a well-trodden path.

#### Path B — Cloudflare Pages, Node runtime *(recommended)*
Cloudflare Pages can run Next.js with a Node-compatible build. Prisma, bcryptjs, and the S3 client all keep working unchanged.

- **Cost:** free tier.
- **Effort:** low — config only, no application rewrite.
- **Risk:** low.

**I recommend Path B.** Your constraint is "Cloudflare," and Pages is Cloudflare. Path A buys edge latency you cannot benefit from anyway while your database sits in Virginia — you'd do the hard rewrite and still eat the 200 ms DB round-trip. Fix the region first if latency matters; don't rewrite the auth layer for it.

### 💳 Getting Cloudflare free WITHOUT a credit card

You asked about this specifically. Good news:

**Cloudflare does not require a credit card to sign up or to use the free tier.**

1. Go to `dash.cloudflare.com/sign-up`, register with email + password, verify the email. **No payment details are requested.**
2. Free tier includes: Pages (500 builds/month, unlimited requests/bandwidth), Workers (100k req/day), R2 (10 GB storage, 1M Class-A ops/month), DNS, SSL.
3. You are only asked for a card if you deliberately upgrade to a paid plan or exceed R2's free storage.

**Two honest caveats:**
- **R2 is the one exception.** Cloudflare asks for a payment method to *activate* R2, even to use the free 10 GB tier. Your `.env` already has R2 credentials, so you or someone has already cleared this. If those are placeholders and you need to avoid a card entirely, tell me — product images and PDF exports would need a different approach, and that's a decision for you.
- **A custom domain needs a domain,** which costs money from a registrar. A free `*.pages.dev` subdomain needs nothing.

### Remaining Cloudflare work

**I can do in-repo (after approval):**
- Add the Pages build config and Node version pin
- Add `DIRECT_URL` to the Prisma datasource
- Add a `.env.production.example` documenting every required var
- Add build scripts that run `prisma migrate deploy` before `next build`

**YOU must do manually (I have no dashboard access):**
1. Create the Cloudflare account (no card — see above)
2. Connect the GitHub repo in Pages → Create project
3. Paste every env var into Pages → Settings → Environment variables:
   `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, all five `R2_*`
4. Generate a **fresh production** `AUTH_SECRET` (`npx auth secret`) — do not reuse the dev one
5. Create the production Neon branch and paste its URLs
6. (Optional) Add a custom domain + DNS

---

## 4. Feature Gaps vs. a Standard Warehouse Inventory System

| Capability | Status | Evidence |
|---|---|---|
| Stock In (inbound) | ✅ Complete, transactional, serializable | `api/stock-in/route.ts` |
| Stock Out (outbound) | ✅ Complete, MRF-linked, stock-guarded | `api/stock-out/route.ts` |
| Supplier linkage | ✅ On product + every stock-in | `schema.prisma:67,111` |
| Technician linkage | ✅ Technician ↔ User account link | `schema.prisma:82` |
| MRF workflow | ✅ File → Pending → Fulfilled | `api/mrf/route.ts` |
| Low-stock alerts | ✅ `stocks <= minLevel`, on dashboard | `data/dashboard.ts:31-33` |
| Out-of-stock alerts | ✅ `stocks = 0` | `data/dashboard.ts:34` |
| Audit trail | ⚠️ Present but free-text only | see below |
| Reports + PDF export | ✅ 4 report types → R2 | `data/reports.ts` |
| **Stock transfers** | ❌ **Missing entirely** | no model, no route |
| **Stock adjustments** | ❌ Missing — no way to correct count errors | — |
| **Returns** | ❌ Missing — seed text mentions returns, no mechanism | `seed.ts:116` |
| **Goods receipt vs. PO** | ❌ No purchase-order concept | — |
| **Batch / lot / expiry** | ❌ Missing | — |
| **Multi-location / bin** | ❌ Single global stock count | `schema.prisma:65` |
| **Barcode** | ❌ No scannable code field | — |
| **Supplier lead time** | ❌ Missing | — |

### The three gaps that matter most

**1. No stock adjustment path.** Every quantity change must flow through Stock In or Stock Out. When a physical count finds 46 sheets but the system says 48, there is no legitimate way to correct it — a user must either fake a Stock Out or edit the product directly (`api/products/[id]/route.ts` lets Owner/Admin overwrite `stocks` with **no audit of the delta**). That last path is a real integrity hole: it's a silent, unlogged inventory change.

**2. Transfers are absent** — correctly so, for now. Transfers only mean something with more than one location, and you have one warehouse (`Km. 7, Diversion Road, Davao City`). This is a **correct scoping decision, not a defect.** Listed for completeness.

**3. The audit trail is weaker than it looks.** `ActivityLog.action` and `.refNo` are plain strings with no FK to the entity described (`schema.prisma:146-147`). "Show all activity for Product X" requires string-matching a naming convention. For a system whose compliance story is "everything is logged," this is thin.

---

## 5. Root Cause of Slow Page Transitions

### Primary cause: there is no `next/link` anywhere in the codebase

```
$ grep -rn "from \"next/link\"" src/
(no matches)
```

`SideNav` navigates by attaching `onClick` to a plain MUI `<Box>` and calling `router.push()`:

```tsx
// src/components/SideNav.tsx:43-50
const go = (segment: string) => {
  onMobileClose?.();
  if (segment === activeSegment) return;
  setPendingSegment(segment);
  startTransition(() => {
    router.push(`/${segment}`);
  });
};
```

**Why this is the whole problem:** Next.js App Router prefetches routes when a `<Link>` enters the viewport. It fetches the RSC payload in the background so the click is near-instant. `router.push()` from an `onClick` **cannot be prefetched** — the router has no idea the destination exists until you click it.

Every single navigation is therefore a cold round-trip: click → RSC request → middleware `auth()` → JWT verify → layout `getBadgeCounts()` → page data fn → Prisma → **Neon in Virginia** → render → stream back.

There is a second, quieter cost: `<Box onClick>` renders a `<div>`, not an `<a>`. Middle-click, ctrl+click, and "open in new tab" are all broken, and screen readers don't announce these as links.

### Contributing factors, in order of impact

**2. Every route is dynamic; nothing is static.** The middleware matcher (`src/middleware.ts:62`) covers every path, and `auth()` reads cookies. Cookie access opts every route out of static rendering. Combined with no prefetch, there is zero caching between click and database.

**3. Database round-trip latency.** `us-east-1` from the Philippines is ~200–250 ms per query. `getDashboardData()` runs 11 queries — parallelized via `Promise.all` (`data/dashboard.ts:23`), so it's ~1 round-trip, not 11. But it's still ~250 ms on the critical path of every dashboard load, and `unstable_cache(revalidate: 20)` means it expires every 20 seconds.

**4. Layout waterfall.** `AppLayout` awaits `auth()` *then* `getBadgeCounts()` sequentially (`layout.tsx:26,28`) before children render. Small, but it's on every navigation.

**5. MUI + Emotion runtime cost.** Emotion serializes styles at runtime on the client. The 100 kB shared JS bundle is reasonable, but MUI's runtime styling adds hydration work on every screen.

**What is already done right:** `loading.tsx` exists for 9 of 10 routes, `Promise.all` batching is used consistently, `unstable_cache` + tag revalidation is well-structured, and `useTransition` gives immediate visual feedback on nav click. The bones are good — the prefetch is simply missing.

> **Missing:** `src/app/(app)/stock/loading.tsx` — every other route has one.

---

## 6. Role System: Implemented vs. Stubbed vs. Missing

### Login / session — ✅ Implemented
NextAuth v5 Credentials provider, JWT strategy. `role` and `username` are threaded into the token and session (`auth.config.ts:11-24`). Correct edge/Node split: `auth.config.ts` is Prisma-free for middleware, `auth.ts` is Node-only. Passwords bcrypt-verified. Inactive users are rejected at sign-in.

### Per-role UI visibility — ✅ Implemented, defense in depth
Three enforcement layers, all reading one matrix (`src/lib/rbac.ts:4-29`):
1. **Middleware** — `canAccess()` on every request, redirect or 403 (`middleware.ts:51`)
2. **Nav rendering** — `SideNav` filters items by `MODULE_ACCESS` (`SideNav.tsx:24,55`)
3. **API routes** — `requireModuleAccess()` per handler, plus secondary role checks

Screen titles and subtitles adapt per role via `screenTitleForRole()`. This is genuinely well built.

### Per-role dashboard routing — ⚠️ Partial
All four roles land on `/dashboard` and see the *same* `DashboardScreen` — the same 5 KPI cards, the same transaction table, the same alert panels. Only the header text differs. A Technician whose only job is filing MRFs sees total stock value and out-of-stock alerts they cannot act on. There is no role-specific dashboard composition.

### Per-role profile editing — ❌ **Missing**

This is the largest functional gap.

| Capability | Status |
|---|---|
| User views own profile | ❌ No route, no page |
| User edits own name | ❌ Missing |
| User changes own password | ❌ **Missing** — no endpoint anywhere |
| Owner edits other users | ⚠️ Create + list only; **no PATCH route** (`api/users/` has no `[id]/route.ts`) |
| Owner deactivates a user | ❌ `UserStatus` exists in schema but nothing can set it |
| Company profile editing | ❌ Stubbed — see below |

**Settings is a mockup.** `SettingsScreen.tsx` renders `readOnly` inputs, a permanently `disabled` Save button (`SettingsScreen.tsx:54`), and a `disabled` currency Select. The data behind it is **hardcoded constants**, not database rows:

```ts
// src/lib/data/settings.ts
export async function getSettingsData() {
  return {
    company: {
      name: "DRIM Refrigeration & Industrial Services",
      warehouseLocation: "Km. 7, Diversion Road, Davao City",
      currency: "PHP — Philippine Peso (₱)",
    },
    ...
  };
}
```

There is no `CompanySettings` model in the schema and no `PATCH /api/settings`. The permission matrix panel beside it is correctly read-only by design (it reflects code-level RBAC), but the Company Profile panel is a non-functional shell.

**Nobody can change their own password.** For a system with four roles and shared seeded credentials, this is the most urgent gap in the report.

---

## 7. Proposed Plan (Phase 2 — awaiting your approval)

### 7.1 UI direction

The existing design is genuinely good and I do **not** propose replacing it. It is a deliberate dense-enterprise console: 2 px radius, no shadows, 1 px borders, Heebo + IBM Plex Mono for reference codes, uppercase letter-spaced column headers. It matches the design handoff almost exactly and reads like a real operations tool, not a template.

Proposed refinements only — no rewrite:

| Change | Rationale |
|---|---|
| Role-composed dashboards | A Technician sees "My MRFs" and "My Requests," not company stock value. Same components, different composition per role. |
| Status color as a system | Low/out/pending currently use one-off hexes (`#c07d16`, `#a13230`). Promote to semantic theme tokens so status reads identically everywhere. |
| Density toggle | Comfortable/compact rows. Warehouse staff on a laptop scanning rows have different needs than an Owner reviewing on a large screen. |
| Real empty states | "No transactions recorded yet." → say what the screen is for and what action creates the first row. |
| Focus-visible rings | Currently unverified across interactive elements; keyboard users need them. |
| Stock-level meter | A 2 px bar under the qty cell showing `stocks` vs `minLevel`. Turns a number into an at-a-glance judgment. This is the one visual addition I'd argue for. |

**On open-design.ai:** referenced as inspiration only, never a dependency. The patterns worth adapting are (a) the bento KPI grid where tile size encodes importance — already partly implemented via `StatCard span={2}`; and (b) split master-detail for Inventory, where selecting a row opens a right-hand detail panel instead of a modal. That second one suits Inventory well and I'd scope it separately.

### 7.2 Fix slow transitions

Ordered by impact per unit of effort:

1. **Convert `SideNav` items to `next/link`.** The single highest-impact change in this document. Restores automatic prefetching, fixes middle-click and ctrl+click, and makes nav items real links for screen readers. Keep `useTransition` for the pending state. *~30 lines.*
2. **Add `src/app/(app)/stock/loading.tsx`** — the one missing skeleton.
3. **Parallelize the layout waterfall** — `Promise.all([auth(), getBadgeCounts()])`.
4. **Raise cache windows** — dashboard `revalidate: 20` → `60`. Tag-based revalidation already invalidates on mutation, so the short window buys nothing but load.
5. **Decide on the Neon region** (see below). Moving to Singapore is a bigger win than items 2–4 combined.

Expected: navigation between already-visited routes becomes near-instant; first visits improve by the prefetch window.

### 7.3 Complete the role system

**A. Password change (highest priority)**
`PATCH /api/users/me/password` — requires current password, min 8 chars, bcrypt re-hash, writes an `ActivityLog` row. Available to all four roles for their own account.

**B. Self-service profile**
`/profile` route + `PATCH /api/users/me` — a user edits their own `name`. Username and role stay immutable (username is an identity key; self-editable roles are a privilege-escalation hole).

**C. Owner user management**
`PATCH /api/users/[id]` — Owner-only; change name, role, and `status` (ACTIVE/INACTIVE). This activates the existing `UserStatus` enum, which is currently dead schema.

**D. Role-composed dashboards**
One `DashboardScreen` that composes per role:
- **Owner** — full financial + operational picture (current view)
- **Admin** — operations, no total stock valuation
- **Warehouse Staff** — pending MRFs to fulfill, low stock, recent movements
- **Technician** — my MRFs, my requests, request-new-material action

No routing change, no RBAC change — same `/dashboard`, different composition.

**E. Company settings** — *needs your decision, see below.*

### 7.4 Neon + Cloudflare completion

**In-repo (me):** Pages build config; `DIRECT_URL` in the datasource; `.env.production.example`; `prisma migrate deploy` in the build script; Node version pin.

**Manual (you):** account creation; repo connection; all env vars in the Pages dashboard; fresh production `AUTH_SECRET`; production Neon branch; optional custom domain.

---

## 8. Decisions I Need From You

These are yours, not mine. I've given a recommendation for each.

1. **Cloudflare Path A (Workers/OpenNext) or Path B (Pages/Node)?** → *Recommend B.*
2. **Move Neon to `ap-southeast-1` (Singapore)?** Biggest single latency win (~200 ms → ~50 ms). Cost: new project, re-run migrations + seed. → *Recommend yes, before production.*
3. **Company settings — real or remove?** Either add a `CompanySettings` table (schema change, needs your sign-off) or drop the panel so the UI stops advertising a feature that doesn't work. → *Recommend making it real; a warehouse address that can't be corrected is a liability.*
4. **Stock adjustment feature?** Closes the silent-inventory-change hole in product edit. Schema change (`StockAdjustment` model). → *Recommend yes — this is an integrity gap, not a nice-to-have.*
5. **Structured ActivityLog** (`entityType`/`entityId`)? Schema change. → *Recommend yes, low cost, materially strengthens the audit story.*
6. **Do you actually have a Cloudflare account + R2 activated?** Your `.env` has R2 values. If they're placeholders and you want to avoid a card entirely, image upload and PDF export need rethinking.
7. **Scope for Phase 3?** → *Recommend starting with §7.2 (transitions) + §7.3 A–C (password, profile, user management). Highest value, zero schema risk.*

---

## 9. Summary

**Working well:** clean RSC → cache → Prisma architecture; correct serializable transactions on stock mutations; three-layer RBAC on a single source of truth; Zod validation across all mutations; genuinely distinctive dense-console design; Neon fully live and migrated.

**Blocking production:** no Cloudflare deployment config of any kind, and the app cannot run on Workers without an auth/DB/storage rewrite (Pages avoids this).

**Biggest functional gap:** nobody can change their own password.

**Biggest performance cause:** no `next/link` anywhere — zero prefetching, every navigation a cold round-trip to a database 13,000 km away.

**Biggest integrity risk:** product edit can silently overwrite stock counts with no audit trail of the delta.

---

---

## 10. Phase 3 — What Was Built (2026-07-30)

All four tiers implemented and committed. Every item verified by typecheck, production build, and — where behavior mattered — a live probe against the database.

### Tier 1 — performance (`24363ca`)
| Change | Result |
|---|---|
| `SideNav` → `next/link` | **Routes prefetch again.** Also fixes middle/ctrl-click and adds `aria-current` + focus rings |
| `stock/loading.tsx` | Last missing route skeleton |
| Layout `Promise.all` | Removed a per-navigation round-trip |
| Cache 20s → 60s | Tag revalidation already handled freshness |
| PDFs stream directly | No R2 dependency, no expiring links, no orphaned files |

### Tier 2 — account management (`1b2398c`)
- `PATCH /api/me/password` — verifies current password, rate-limited 5/min (it is a password oracle)
- `GET`/`PATCH /api/me` — self-service profile; username and role deliberately immutable
- `PATCH /api/users/[id]` — Owner-only; **refuses to demote or deactivate the last active Owner**
- `/profile` screen, reachable from the ChromeBar user block
- Middleware `SELF_SERVICE_SEGMENTS` allowlist so self-scoped routes bypass module RBAC

### Tier 3 — data integrity (`3625e4d`)
- `StockAdjustment` + `AdjustmentReason` enum; stores `qtyBefore`/`qtyAfter`/`delta`
- `POST /api/stock-adjustments` — serializable; updates product, writes adjustment and `ActivityLog` atomically
- **`stocks` removed from `productUpdateSchema`** — verified: a payload with `stocks: 99999` is stripped before it reaches the database
- `CompanySettings` singleton; the Settings form went from mockup to functional
- Company name and address now print on the PDF letterhead

### Tier 4 — interface (`ee35456`)
- `stock` palette group (healthy/low/out/pending) replacing six hardcoded hexes, one of which had drifted from the token file and none of which adapted to dark mode
- Stock-level meter bars in Inventory
- Role-composed dashboard — stock valuation is Owner/Admin only; Technicians see "your open requests" in the wide slot
- Empty states rewritten to say what fills the screen; Inventory distinguishes a filtered no-match from an empty catalog
- `BlobStore` seam — `put`/`url`, Postgres adapter active, R2 adapter dormant. **Verified: correct adapter selected, bytes round-trip intact**

### Verified by live probe
- Adjustment: 46 → 44, delta −2, recorded and rolled back clean
- Product update: `stocks` stripped from payload — integrity hole closed
- BlobStore: Postgres adapter selected, bytes round-tripped, same-origin URL produced

### Still yours to do
1. **Rotate the Neon password** — it was pasted into a chat transcript
2. Create the Cloudflare account (no card needed for Pages)
3. Connect the repo in Pages and set env vars: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`
4. Generate a fresh production `AUTH_SECRET` (`npx auth secret`)
5. Create a production Neon branch
6. Optional: activate R2 and paste the four `R2_*` vars — images move to R2 with no code change

### Not built (deferred by decision)
Transfers (single warehouse), batch/lot/expiry, multi-location, barcode, supplier lead-time, structured `ActivityLog`, profile pictures, top-level error handler, magic-byte upload verification, motion polish.
