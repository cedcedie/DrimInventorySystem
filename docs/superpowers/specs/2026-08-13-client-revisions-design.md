# Client revisions: Stock In batches, technician history, category grouping, MRF PDF export

Date: 2026-08-13

## Context

Client reviewed the live app and requested 4 changes, verified against code before this
spec was written (none were already implemented):

1. **Stock In modal** only accepts one product per submission. Suppliers often deliver
   several items in one shipment; the client wants to add multiple items in one Stock In
   entry, the same way `MultiItemMrfModal` already lets technicians file multi-item MRFs.
2. **Technician profile panel** ("Technicians" screen) shows only the single most recent
   MRF as one collapsed line. Client wants to see more history.
3. **MRF filing modal**'s product dropdown is a long flat alphabetical list. Client wants
   it grouped by category.
4. **No way to export a single MRF as a PDF.** Client wants the technician who filed an
   MRF (and admins) to download a PDF of that specific request.

## Decisions locked with client/user before design

- Stock In batch: all items in one submission share **one reference number** (mirrors how
  one MRF has one refNo with multiple `MrfItem`s).
- Existing `StockIn` history is **preserved**, migrated into the new batch shape (not
  wiped).
- Technician "recent" list shows **last 5 MRFs**, each row **clickable**, opening the
  existing `MrfDetailModal`.
- Category grouping applies to **both** the MRF product picker and the new Stock In
  product picker, for UI consistency.
- MRF PDF export button lives **inside `MrfDetailModal`** (no separate row-level icon).
- PDF content is **full detail**: header (refNo, project, technician, status, date), item
  table (product, qty requested/fulfilled/remaining), and release history (fulfilling
  stock-outs).
- PDF export is **scoped to MRF only** — Stock In batches do not get a detail view or PDF
  in this round.

## 1. Stock In → multi-item batches

### Schema

Add two new models, following the existing `Mrf`/`MrfItem` split:

```prisma
model StockInBatch {
  id         String        @id @default(cuid())
  refNo      String        @unique // SI-0442, shared across all items in the batch
  supplierId String
  supplier   Supplier      @relation(fields: [supplierId], references: [id])
  byUserId   String
  byUser     User          @relation(fields: [byUserId], references: [id])
  createdAt  DateTime      @default(now())
  items      StockInItem[]

  @@index([supplierId])
  @@index([byUserId])
  @@index([createdAt])
}

model StockInItem {
  id             String       @id @default(cuid())
  stockInBatchId String
  stockInBatch   StockInBatch @relation(fields: [stockInBatchId], references: [id], onDelete: Cascade)
  productId      String
  product        Product      @relation(fields: [productId], references: [id])
  qty            Int

  @@index([stockInBatchId])
  @@index([productId])
}
```

The old `StockIn` model is removed after a one-time data migration (see below). Update
`Product`, `Supplier`, `User` relation fields (`stockIns` → point at `StockInBatch`).

### Data migration

A migration SQL step (run once, ordered before dropping the old table) that:

1. Creates `StockInBatch` rows 1:1 from existing `StockIn` rows, copying
   `refNo`, `supplierId`, `byUserId`, `createdAt`.
2. Creates one `StockInItem` per old `StockIn` row, copying `productId`, `qty`, linked to
   the new batch by matching `refNo`.
3. Drops the old `StockIn` table.

This preserves every existing SI refNo, date, and quantity.

### API — `POST /api/stock-in`

Request body changes from `{ productId, supplierId, qty }` to:

```ts
{ supplierId: string, items: { productId: string; qty: number }[] }
```

Handler (mirrors `POST /api/mrf/multi`):
- Validates all `productId`s exist and are not archived, in one query.
- Validates supplier exists.
- One `nextRefNo(tx, "stockInBatch", "SI")` call for the whole batch.
- Creates `StockInBatch` with nested `items: { create: [...] }`.
- Loops the items to `increment` each product's `stocks`.
- One `activityLog` entry summarizing item count (same pattern as MRF multi: "Recorded
  Stock In — 3 items (42 total qty)" vs the single-item wording when there's just one).
- Wrapped in the existing `Serializable` transaction + `withRefNoRetry`.

### API — `GET /api/stock-in`

`getStockInData()` in `src/lib/data/stock.ts` changes its Prisma query from
`prisma.stockIn.findMany` to `prisma.stockInBatch.findMany({ include: { items: {
include: { product: true } }, supplier: true } })`, then **flattens** batch+items back
into the existing per-row shape (`{ id, ref, date, supplier, item, qty }`) — one row per
item, sharing the batch's `refNo` and `date`. This keeps `StockScreen.tsx`'s `StockInTab`
table unchanged; only the data layer changes.

Pagination: paginate on `StockInBatch` (not flattened rows), consistent with today's
page-of-15 behavior — a batch with 3 items still counts as one "page slot" conceptually,
but the rendered table will show its 3 rows. This is an acceptable trade-off given typical
batch sizes are small (a delivery has a handful of line items); no user-facing page-count
mismatch was called out as a concern.

### UI — `StockInModal.tsx`

Rebuilt on the existing `MultiItemMrfModal` cart pattern:
- Supplier picked once at the top (unchanged single `<Select>`).
- "Add item" row: category-grouped product `<Select>` (see section 3) + quantity input +
  "+ Add" button, pushing into a local `items` cart array.
- Cart list below: each row shows product name/code, qty with +/- steppers, remove button
  — reusing the same visual treatment as `MultiItemMrfModal`'s cart.
- Submit button: "Save Stock In (N items)", disabled until at least one item is in the
  cart.
- On success: same toast/invalidate pattern as today, plus `sessionStorage` highlight key
  if we want to highlight the new batch in the table (optional, matches MRF's
  `drim-mrf-filed` pattern — include for parity).

## 2. Technician "Recent Transactions" → list of last 5

### Data layer — `src/lib/data/technicians.ts`

`getTechniciansData()`'s `mrfs` include changes `take: 1` → `take: 5`. Instead of
collapsing to one `recent: string`, return:

```ts
recentMrfs: {
  id: string;
  refNo: string;
  itemSummary: string; // "Flexible Duct 10x12" or "3 items"
  qty: number;
  date: string; // ISO
}[]
```

Drop the old `recent: string` field entirely (no other consumer depends on it — confirmed
`TechniciansScreen.tsx` is the only reader).

### UI — `TechniciansScreen.tsx`

Profile panel's single "Recent Transaction" field becomes a "Recent Transactions" section
listing up to 5 rows, each showing refNo (mono, accent color, matching table link
styling), item summary, qty, and date. Each row is a `ButtonBase`/clickable row that sets
a `detailMrfId` state and opens `MrfDetailModal` (imported fresh into this screen — it's
already used in `MrfScreen.tsx` and `StockScreen.tsx`, so this is the third usage of an
existing, role-agnostic component). Empty state: "No recent activity" (unchanged wording).

## 3. Category-grouped product picker (shared)

### Data layer — `src/lib/data/stock.ts`

`StockFormOptions.products` gains `categoryId` and `categoryName` per product (one extra
`select` field via the existing `category: { select: { name: true } }` relation include).
Applies to both `loadStockFormOptions()` and `loadMrfFilingProducts()` so both the MRF
modal and the new Stock In modal get grouping data from the same `/api/stock/options`
endpoint they already call.

### UI — shared grouping helper

A small helper (e.g. `src/lib/groupByCategory.ts`) that takes the flat product list and
returns `{ categoryName: string; products: ProductOption[] }[]`, sorted by category name,
products alphabetical within each group.

Both `MultiItemMrfModal.tsx` and the new `StockInModal.tsx` render their product
`<Select>` using MUI `<ListSubheader>` per category group instead of a flat `<MenuItem>`
list. Selection behavior (value = productId) is unchanged; only the rendering groups
visually.

## 4. Per-MRF PDF export

### API — `GET /api/mrf/[id]/pdf`

New route, auth logic copied from the existing `GET /api/mrf/[id]`:
- Technician role: only their own MRF (`tech.id === mrf.technicianId`).
- Others: require `stock.canView` or `mrf.canView` per existing check.
- Fetches the same data `GET /api/mrf/[id]` already assembles (header, items, releases) —
  extract the shared query into a small helper in `src/lib/data/mrf.ts`
  (`getMrfDetailForApi(id)`) so both routes call the same function instead of duplicating
  the Prisma query.
- Calls `generateReportPdf()` from `src/lib/pdfReport.ts`:
  - `title`: `Material Request ${refNo}`
  - `summary`: `${project} · ${technician.name} (${technician.empNo}) · ${statusLabel}`
  - `headers`/`rows` (items table): `["Product", "Code", "Requested", "Fulfilled",
    "Remaining"]`
  - A second table section isn't natively supported by `generateReportPdf` (single
    header/rows only) — call it twice into two pages, or extend `generateReportPdf` to
    accept an optional second `{ headers, rows, sectionTitle }` block for releases.
    **Chosen approach:** extend `generateReportPdf` with an optional `sections` param
    (array of `{ title, headers, rows }`) so both tables render on the same flowing
    page(s), replacing the single `headers`/`rows` args. Existing callers
    (`reports/export`) get migrated to pass one section, keeping their output identical.
  - `company`: reuse `getCompanySettings()` like the existing reports export route.
- Returns the PDF as `Buffer`, `Content-Type: application/pdf`,
  `Content-Disposition: attachment; filename="${refNo}.pdf"`, `Cache-Control: no-store`
  (same pattern as `reports/export`). No activity log entry needed — downloading isn't a
  mutating action worth an audit row (consistent with "PDFs are a view, not data").

### UI — `MrfDetailModal.tsx`

Add a "Download PDF" button in the action row (next to Cancel/Fulfill/Done), visible to
anyone who can already see the modal (auth is enforced server-side by the endpoint, so no
extra client-side permission check is needed beyond "the modal is open"). Clicking
triggers a `fetch` to the new endpoint, reads the response as a `Blob`, and creates a
short-lived object URL to click through as a download (standard blob-download pattern —
no plain `<a href>` to the API route directly, since that discards the auth/session
cookie behavior... actually `fetch` with `credentials: "include"` is unnecessary here
since it's same-origin; a plain `<a href="/api/mrf/[id]/pdf">` works and is simpler,
reusing the browser's normal cookie-based session). **Chosen approach:** plain anchor
link/`window.open`, letting the browser handle the download natively — no blob
plumbing needed, since this is a same-origin authenticated GET the browser already
carries the session cookie for.

## Testing

- Vitest coverage for the new `POST /api/stock-in` multi-item handler (happy path,
  archived product rejection, missing supplier, partial validation failure) mirroring
  existing `mrf/multi` route tests if present.
- Vitest coverage for `groupByCategory` helper (empty list, single category, multiple
  categories, stable sort).
- Vitest coverage for `getTechniciansData()`'s new `recentMrfs` shape (0, 1, 5+ MRFs).
- Manual verification: run `verify:permissions` and `typecheck` after the Prisma schema
  change, since `verify:permissions` depends on generated Prisma types.
