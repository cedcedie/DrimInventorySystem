# Handoff: DRIM Inventory System (Warehouse Module)

## Overview
Role-based warehouse inventory system for an HVAC/refrigeration contractor (Davao, PH). Four roles (Owner, Admin, Warehouse Staff, Technician/Engineer) see different modules. Core flows: product/material catalog, live inventory with low-stock thresholds, supplier registry, Stock In (from suppliers), Stock Out (released against Material Request Forms filed by technicians), reports, user management, and a full activity/audit log.

## About the Design Files
`DRIM Inventory System v3.dc.html` (+ `support.js` runtime) is a **design reference built in HTML** — an interactive prototype showing intended look and behavior. It is NOT production code. Your task is to **recreate this design in the target stack below**, using its established patterns. Open the file in a browser to explore every screen, role, modal, and dark mode.

## Target Stack (user-specified)
- **Framework**: Next.js (App Router) + TypeScript
- **UI**: Material UI (MUI) — adapt the design via a custom MUI theme (see Design Tokens); do not chase pixel-perfection against raw HTML, match the *feel*: dense, square-cornered, enterprise
- **DB/ORM**: PostgreSQL (Neon) + Prisma. Stock In/Out MUST run in `prisma.$transaction` (serializable) so quantity updates + movement rows + activity-log rows commit atomically
- **Auth**: Auth.js (NextAuth) credentials provider, session carries `role`; RBAC enforced in middleware + per-route
- **Storage**: Cloudflare R2 (product images, generated PDF report exports)
- **Data fetching**: TanStack Query (query keys per module, optimistic updates on mutations, invalidate on success)

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy, and interactions in the prototype are final intent. Recreate them with MUI components + theme overrides.

## Suggested Project Structure
```
src/
  app/
    (auth)/login/page.tsx
    (app)/layout.tsx            # chrome bar + sidebar shell
    (app)/dashboard/page.tsx
    (app)/inventory/page.tsx
    (app)/products/page.tsx
    (app)/suppliers/page.tsx
    (app)/stock/page.tsx        # tabs: Stock In | Stock Out; MRF view for technicians
    (app)/technicians/page.tsx
    (app)/reports/page.tsx
    (app)/users/page.tsx        # Owner only
    (app)/activity/page.tsx
    (app)/settings/page.tsx     # Owner only
    api/auth/[...nextauth]/route.ts
    api/... (route handlers per module)
  components/ (AppBar, SideNav, DataTable, StatusChip, KpiCard, EntityModal, ...)
  lib/ (prisma.ts, auth.ts, rbac.ts, r2.ts, queryKeys.ts)
  theme/ (mui theme light+dark)
prisma/schema.prisma
middleware.ts                    # role-gates route groups
```

## Prisma Schema (starting point — derived from design flows)
```prisma
enum Role { OWNER ADMIN WAREHOUSE_STAFF TECHNICIAN }
enum UserStatus { ACTIVE INACTIVE }
enum MrfStatus { PENDING FULFILLED CANCELLED }

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  name         String
  role         Role
  status       UserStatus @default(ACTIVE)
  activities   ActivityLog[]
  stockIns     StockIn[]
  stockOuts    StockOut[]
  createdAt    DateTime @default(now())
}

model Category { id String @id @default(cuid()); name String @unique; products Product[] }

model Supplier {
  id       String @id @default(cuid())
  name     String @unique
  contact  String        // phone or email
  supplies String        // free-text description
  products Product[]
  stockIns StockIn[]
}

model Product {
  id         String  @id @default(cuid())
  code       String  @unique   // e.g. PIP-012 (prefix per category)
  name       String
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])
  unit       String            // Pcs | Meter | ...
  amount     Decimal @db.Decimal(12,2)  // unit price, PHP
  stocks     Int     @default(0)
  minLevel   Int     @default(0)        // low-stock threshold
  supplierId String?
  supplier   Supplier? @relation(fields: [supplierId], references: [id])
  imageKey   String?           // R2 object key
  stockIns   StockIn[]
  stockOuts  StockOut[]
}

model Technician {
  id        String @id @default(cuid())
  empNo     String @unique     // EMP-0147
  name      String
  position  String             // HVAC Technician, Refrigeration Engineer
  mrfs      Mrf[]
  stockOuts StockOut[]
}

model Mrf {                    // Material Request Form
  id           String @id @default(cuid())
  refNo        String @unique  // MRF-118
  technicianId String
  technician   Technician @relation(fields: [technicianId], references: [id])
  productId    String
  product      Product @relation(fields: [productId], references: [id])
  qty          Int
  project      String          // e.g. Northgate Cold Storage
  status       MrfStatus @default(PENDING)
  createdAt    DateTime @default(now())
  stockOut     StockOut?
}

model StockIn {
  id         String @id @default(cuid())
  refNo      String @unique   // SI-0442
  productId  String
  product    Product @relation(fields: [productId], references: [id])
  supplierId String
  supplier   Supplier @relation(fields: [supplierId], references: [id])
  qty        Int
  byUserId   String
  byUser     User @relation(fields: [byUserId], references: [id])
  createdAt  DateTime @default(now())
}

model StockOut {
  id           String @id @default(cuid())
  refNo        String @unique // SO-0290
  productId    String
  product      Product @relation(fields: [productId], references: [id])
  mrfId        String? @unique
  mrf          Mrf?   @relation(fields: [mrfId], references: [id])
  technicianId String
  technician   Technician @relation(fields: [technicianId], references: [id])
  qty          Int
  byUserId     String
  byUser       User @relation(fields: [byUserId], references: [id])
  createdAt    DateTime @default(now())
}

model ActivityLog {
  id        String @id @default(cuid())
  userId    String
  user      User @relation(fields: [userId], references: [id])
  action    String            // "Recorded Stock In — 24 × Galvanized Sheet 4x8"
  refNo     String            // SI-0442 / SO-0290 / MRF-118 / RPT-088 / product code
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
}
```
Transactions: Stock In = create StockIn + increment `Product.stocks` + ActivityLog row in one `$transaction`. Stock Out = validate `qty <= stocks`, decrement, mark linked MRF `FULFILLED`, log — all atomic; reject (throw → rollback) on insufficient stock. Prototype also shows "Returned N × item unused" — model as a StockIn variant or a `Return` table if needed; ask the product owner.

## RBAC (exact matrix from prototype)
- **Owner**: all 10 modules — Dashboard, Inventory, Products/Materials, Suppliers, Stock In/Out, Technicians, Reports, Users, Activity Log, Settings
- **Admin**: all except Users & Settings
- **Warehouse Staff**: Dashboard, Inventory, Stock In/Out only
- **Technician/Engineer**: Dashboard + Stock In/Out, where Stock In/Out renders as **Material Requests (MRF)** — they file/view their own MRFs, never raw stock movements
Restricted modules are **absent from nav** (not disabled). Reports generation is Admin/Owner. Enforce in middleware AND in every route handler.

## Screens / Views
All app screens share: **chrome bar** (46px, dark `#22303e`, logo mark 24px square accent-blue "DR", module breadcrumb, role select, user avatar+name, theme toggle, logout) · **sidebar** (198px, bg `#f5f6f7`, grouped: Overview / Warehouse / People & Admin; items 13px, active = accent color + 700 weight + surface bg + left accent bar; count badges right-aligned in mono font) · **screen header** (surface bg, title 16px/700, subtitle 11.5px muted, right side "Permissions: …" summary with green dot).

1. **Login** — split screen: left dark panel (`#22303e`) with brand + tagline "One warehouse. Four roles. Full trace."; right 360px form: "1 · Select role" (2×2 grid of role cards) then "2 · Enter credentials" (username, password), submit button labeled "Log In as {role}". With Auth.js, role comes from the user record — keep the two-step layout but role selection can prefill demo accounts or be display-only.
2. **Dashboard** — KPI strip (auto-fit grid, min 170px): total products, low stock, out of stock, inventory value, etc.; recent transactions table; low-stock list.
3. **Inventory** — search (by code/name), category filter, dense table: Code, Name, Category, Stocks, Unit, Amount (₱), Status chip (In Stock / Low Stock / Out of Stock via `minLevel`). Pagination 15 rows.
4. **Products/Materials** — master catalog CRUD; "stock levels managed in Inventory" note; add/edit product modal (560px), category modal (420px).
5. **Suppliers** — name, contact, supplies, last delivery, delivery count; add/edit modal.
6. **Stock In/Out** — tabs (hidden for technicians). Stock In: incoming deliveries table + record modal (ref, supplier, item, qty). Stock Out: two-panel (table + release form) tied to MRF ref, technician, project. Technician view: MRF filing form + own-request table with status chips.
7. **Technicians** — roster table (Name, Emp No, Position, Recent draw) + detail side panel.
8. **Reports** — filter bar (date range from/to, type) + generated report table; export → PDF stored in R2. Admin/Owner only.
9. **Users** — accounts + role + last activity + Active/Inactive chip; clicking a user opens their full activity history modal (660px). Owner only.
10. **Activity Log** — grid: Date/Time (130px), User, Role (140px), Action, Ref (96px, mono). Every mutation writes here. Pagination 15/page.
11. **Settings** — Company Profile card + read-only Role Permissions matrix card. Owner only.

## Interactions & Behavior
- Modals: overlay click closes, content click stops propagation; widths 420/560/660px by type; save shows toast confirmation (2.6s auto-dismiss).
- Tables: hover row bg `#e9ecef` (light) / `#232c35` (dark); selected row `#eef3f9` / `#243342`; pagination 15 rows, prev/next + page indicator.
- Status chips: square-ish, 1px border, soft bg, dark text — see token table below.
- Theme toggle persists per user; use MUI `ThemeProvider` with both palettes.
- Currency: PHP, `'₱' + toLocaleString('en-PH', {minimumFractionDigits: 2})`.
- Forms: required-field validation; Stock Out blocks qty > available with inline error.

## Design Tokens
**Type**: Heebo (Google Fonts) everywhere; IBM Plex Mono for ref codes/badges. Base sizes: table text 12.5–13px, labels 11–11.5px/600–700 uppercase +0.5–0.9px tracking, screen title 16px/700, login h1 30px/700.
**Radius**: 2px on everything (buttons, inputs, chips) — set MUI `shape.borderRadius: 2`. **No shadows**; 1px borders instead.
**Accent**: `#1663a8` (options seen in prototype: `#2f7d4f`, `#8a5b0f`, `#54586c`). Chrome bar: Steel `#22303e` (alt Graphite `#232323`).
**Density**: table row padding 6px (Compact) / 11px (Comfortable) — map to MUI table size / density toggle. *User's current preference: Comfortable + Steel.*

Light: bg `#eceef0`, bg2 `#f5f6f7`, surface `#ffffff`, text `#232a33`, hover `#e9ecef`, rowSel `#eef3f9`, warn `#8a5b0f`, danger `#a13230`, success `#2f8a4c`.
Dark: bg `#12161b`, bg2 `#191f26`, surface `#1e252d`, line `#2c3641`, border `#3d4854`, hover `#232c35`, rowSel `#243342`, text `#e6ebf0`, text2 `#c3ccd5`, muted `#8f9aa6`.
Chips (light, [border/bg/text]): success `#bfdcc8/#eaf4ed/#256b39`; danger `#e3bcbb/#fbeceb/#a13230`; warn `#e4cda1/#f9f1e0/#8a5b0f`; neutral `#cdd2d8`; info `#b6cde4/#e8f0f8/#1663a8`. Dark chips use translucent bgs (e.g. success `rgba(76,175,110,0.14)` text `#8fd3a5`).

## Seed Data
The prototype's state block (in the HTML, `class Component` → `state = {…}`) contains realistic seed data: 29 products across 6 categories, 3 suppliers, 3 technicians, stock movements, MRFs, 6 users, 36 activity rows. Use it verbatim for `prisma/seed.ts`.

## Assets
None external — logo is a text mark ("DR" in an accent square). Google Fonts: Heebo, IBM Plex Mono.

## Files
- `PROMPTS.md` — **start here**: three sequential, ready-to-paste Claude Code prompts (scaffold/DB/auth → shell/read screens → mutations/transactions/R2), each with scope locks and stop conditions
- `DRIM Inventory System v3.dc.html` — the full interactive prototype (open in browser; role switcher in top bar, theme toggle, all modals live)
- `support.js` — prototype runtime, required for the HTML to render; not part of the implementation
