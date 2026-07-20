# DRIM Inventory System — Scaffold Implementation Notes

This file documents what was built in this pass (Next.js + Prisma + Auth.js scaffold,
per `design_handoff_drim_inventory/README.md`), what's still needed from you, and how
the DB is wired up.

## ✅ Completed and verified end-to-end

1. **Scaffolded** Next.js (App Router) + TypeScript with the project layout from the
   README's "Suggested Project Structure": route groups `(auth)/login`, `(app)/...`
   for all 10 modules, `components/`, `lib/`, `theme/`, `prisma/`, `src/middleware.ts`.
2. **`prisma/schema.prisma`** — copied verbatim from the README, with the minimal
   fixes Prisma's parser required (see "Deviations from the README" below).
3. **`prisma/seed.ts`** — reproduces the prototype's `state = {...}` seed data:
   29 products / 6 categories, 3 suppliers, 3 technicians, 6 users, 5 MRFs, Stock
   In/Out rows, and 36 activity-log rows. All 4 demo users get password
   `demo1234` (bcrypt-hashed at seed time). **Migrated and seeded against the real
   Neon database** — confirmed via `prisma migrate dev` + `prisma db seed`, output:
   `Seeded: 6 categories, 29 products, 3 suppliers, 3 technicians, 6 users, 5 MRFs,
   4 stock-ins, 4 stock-outs, 36 activity rows.`
4. **Auth.js (NextAuth v5, beta)** credentials provider — username + password,
   session JWT carries `role`. Split into two files:
   - `src/lib/auth.config.ts` — edge-safe config (no Prisma/bcrypt), used by middleware.
   - `src/lib/auth.ts` — full config with the Prisma-backed `authorize()` callback,
     used everywhere else (route handler, Server Components).
   Route handler at `src/app/api/auth/[...nextauth]/route.ts`.
5. **`src/middleware.ts`** — gates every route by the README's RBAC matrix
   (`src/lib/rbac.ts`), redirecting unauthenticated users to `/login` and
   unauthorized users back to `/dashboard`. **Verified live** for all 4 roles
   against every restricted module (see "Middleware placement bug" below for why
   this took real debugging to get right).
6. **`src/theme/`** — light + dark MUI themes built from the README's Design
   Tokens table (Heebo font, `shape.borderRadius: 2`, no shadows, exact palette
   hexes, Steel `#22303e` chrome, Comfortable density baked into placeholder
   screens).
7. **`.env.example`** — `DATABASE_URL`, `AUTH_SECRET`, `R2_*` vars (placeholders only,
   no real secrets committed). Real values live in the gitignored `.env`.
8. Placeholder pages for all 10 RBAC-gated modules, each showing the logged-in
   user's role, reachable via a role-filtered sidebar nav.
9. `pnpm build` passes cleanly with zero errors and zero lint warnings.
10. **Login flow verified for all 4 demo users** (`owner`/`admin`/`warehouse`/
    `technician`, all password `demo1234`) — each lands on `/dashboard` showing
    their correct role, and middleware correctly blocks/allows every module per
    the RBAC matrix (spot-checked ~15 role×route combinations).

## Deviations from the README

### Prisma schema (parser required minimal reformatting)
- **Prisma pinned to v6.19.3** (not v7, which was the latest at scaffold time).
  Prisma 7 moved `datasource.url` out of `schema.prisma` into a separate
  `prisma.config.ts` and tightened parsing — a bigger structural change than
  "adjust only if Prisma rejects it" calls for. v6 accepts the README's schema
  with only whitespace-level fixes.
- **Reformatted** the single-line `enum Role { OWNER ADMIN ... }` and
  `model Category { id String ...; name String ...; }` declarations onto
  multiple lines — Prisma 6's parser rejects single-line enum/model bodies.
  No field or model names changed.
- **Added `mrfs Mrf[]` to `Product`** — the README's `Mrf` model has
  `product Product @relation(...)`, but `Product` had no matching back-relation
  field, which Prisma requires. This is the only field added beyond the
  README's literal schema text.
- Everything else (model names, field names, types, enums) is verbatim from
  the README.

### Next.js version: pinned to 15.5.20, not 16
The scaffold originally used Next.js 16.2.10 (latest at the time). During
verification, `middleware.ts` compiled and was correctly registered in Next's
build manifest, but **its function body never executed on any request** —
confirmed with a completely bare middleware (no NextAuth, no RBAC logic, just
a `console.log` + `NextResponse.next()`) under both Turbopack and webpack.
Downgrading to Next 15.5.20 alone didn't fix it either — the real cause turned
out to be **file placement** (see next section), which happened to surface at
the same time as the version investigation. Next 15.5.20 was kept after the
real fix was found because it's a stable, mature release with no open
questions about `middleware.ts` vs `proxy.ts` naming (Next 16 renamed the
convention; using 15 avoids that ambiguity entirely). If you want to move back
to Next 16 later, the same `src/middleware.ts` should work once you rename the
file to `src/proxy.ts` and adjust the export per Next 16's migration guide.

### Middleware placement bug (the actual root cause)
**`middleware.ts` must live at `src/middleware.ts`, not the project root**,
because this project uses a `src/` directory (`src/app/`, not root `app/`).
Next.js silently detects and compiles a root-level `middleware.ts` in this
layout — it shows up correctly in `.next/server/middleware-manifest.json` and
even appears in the `pnpm build` route summary as `ƒ Middleware` — but never
actually invokes it on incoming requests. There is no error or warning; page
components crash on `session!.user` (assuming middleware already redirected
unauthenticated users) instead. Moving the file to `src/middleware.ts` (same
level as `src/app/`) fixed it immediately and reproducibly. This cost
significant debugging time — logged here so it's never repeated.

### ESLint config regenerated for Next 15
`eslint.config.mjs` was originally scaffolded by Next 16's `create-next-app`,
which uses `eslint-config-next/core-web-vitals` (an array-based flat-config
export). Next 15.5.20's `eslint-config-next` ships an older CommonJS/object
export shape at that same path, so the file was rewritten to use
`@eslint/eslintrc`'s `FlatCompat` shim (Next 15's own documented pattern).
`@eslint/eslintrc` was added as a devDependency — it's a lint-config
compatibility shim required by `eslint-config-next` itself, not a new feature
dependency.

## Database status: migrated and seeded

`.env` has a **real** Neon `DATABASE_URL` and a generated `AUTH_SECRET`
(via `npx auth secret`). The migration and seed have already been run:

```
npx prisma migrate dev --name init   # created prisma/migrations/20260720054414_init
npx prisma db seed                    # seeded successfully
```

If you need to reset and reseed later:
```
npx prisma migrate reset   # drops, re-migrates, re-seeds
```

### Demo login credentials (all verified working)

| Username     | Password   | Role                 |
|--------------|------------|----------------------|
| `owner`      | `demo1234` | Owner                |
| `admin`      | `demo1234` | Admin                |
| `warehouse`  | `demo1234` | Warehouse Staff      |
| `technician` | `demo1234` | Technician/Engineer  |

Each lands on `/dashboard` showing their role. Middleware blocks access to
modules outside their role (redirects to `/dashboard`) and blocks all module
access when unauthenticated (redirects to `/login`), matching the README's
RBAC matrix exactly.

## What was intentionally NOT built (per scope lock)

- No real screens/data tables/modals — every module route is a placeholder
  showing the title, subtitle, and current role only.
- No R2 wiring, no report generation, no Stock In/Out transaction logic.
- No theme toggle UI (the light/dark themes exist and are wired via
  `ThemeRegistry`, but there's no button yet — that's a future screen-building
  task, not part of this scaffold pass).
- No dependencies beyond the approved list (`next-auth`, `prisma`,
  `@prisma/client`, `bcryptjs`, `@mui/*`, `@tanstack/react-query`,
  `@fontsource/heebo`, `@fontsource/ibm-plex-mono`) plus `tsx` (dev-only, runs
  `prisma/seed.ts`) and `@eslint/eslintrc` (dev-only, lint config compat shim).
