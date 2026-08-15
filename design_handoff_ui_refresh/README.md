# Handoff: DRIM IMS — UI Visual Refresh

## Overview
A targeted visual refresh of the existing DRIM Inventory Management System (`cedcedie/DrimInventorySystem`, Next.js 15 + MUI v9/Emotion, all styling via `sx` props). The app's structure, backend, routing, and RBAC logic stay exactly as they are — this handoff restyles the layout shell and all 14 screens to a modern, minimal SaaS look, adds a micro-animation standard, adds one approved structural feature (sidebar collapse), and introduces a redesigned PDF report letterhead.

**Hard constraints (from the product owner):**
- Do NOT touch or restyle the login page.
- Do NOT modify backend logic, API calls, data models, or routing.
- Do NOT change or remove any RBAC logic or permission checks. The designs only *reflect* existing permissions (`src/lib/rbac.ts`, `src/lib/permissionDefaults.ts`, `src/lib/effectivePermissions.ts`).
- Scope: styling, spacing, typography, borders, contrast, micro-animations, plus the two approved items — token-file consolidation and the sidebar collapse toggle.

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes showing intended look and behavior, not production code to copy. The task is to **recreate these designs inside the existing codebase** by editing the MUI `sx` styles of the existing components (mapping table below). Do not port the HTML/CSS wholesale; translate the values.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, shadows, and animation timings are final values. Table/chart data is sample data — bind the real queries as today.

## Design Tokens (single source of truth)
Consolidate `src/theme/tokens.ts`, `src/theme/designTokens.ts`, `src/theme/modernTokens.ts` into ONE token module feeding the MUI theme (approved change). Values:

### Brand
- `primary: #FF6B2C` (DRIM logo orange — replaces #FE9F43 everywhere)
- `primary-hover: #E55A1F` · `primary-active: #D14E16` · `primary-tint: #FFF3EC`
- Rule: orange is a FILL color (buttons, active-nav pill, focus ring, indicators). Never orange text on white — for accent text use `#D14E16` (light) / `#FF9B6B`-range (dark).
- Navy `#092C4C` kept only for the avatar circle.

### Neutrals — light mode
- bg `#F6F7F9` · surface `#FFFFFF` · surface-2 `#F9FAFB`
- border `#E4E7EC` · border-strong `#D0D5DD` · divider `#F0F2F5`
- text `#101828` · text-2 `#475467` · muted `#667085` · muted-2 `#98A2B3`

### Neutrals — dark mode
- bg `#0D1117` · surface `#161B22` · surface-2 `#1C232C` · border `#2A323D` · divider `#232B35`
- text `#E9EEF4` · text-2 `#B4BECA` · muted `#7D8896` · muted-2 `#5E6875`

### Status chips — soft tinted badges (replace solid DreamsPOS chips)
Pill radius 999, 11px/700, padding 3px 10px. `[text on bg]`, light mode:
- success `#12805C` on `#E8F6F0` · warn `#B54708` on `#FEF4E6` · danger `#B42318` on `#FEEDEB`
- info `#175CD3` on `#EAF1FE` · partial `#6941C6` on `#F1EBFC` · neutral `#475467` on `#F0F2F5`
Dark mode: bg = rgba of main color at 14–16%, text = lightened (e.g. success `#57C99B` on `rgba(18,183,127,0.14)`).
Keep the existing `toneForLabel` mapping in `StatusChip.tsx`; only restyle.

### Type
Nunito stays (400/500/600/700/800). IBM Plex Mono 500/600 for ref numbers, SKUs, quantities, KPI values, badges.
Scale: 11/16 nav-group labels (700, 0.06em tracking, uppercase) · 12/16 caption · 12.5–13/18 secondary · 13.5–14/20 body · 15–16/24 card titles (800) · 20/28 page titles (800) · 28/36 KPI values (mono 600).

### Spacing / radius / elevation
- 4px grid: 4/8/12/16/20/24/32/48. Page padding 24. Card padding 20. Table row ~44px (cell padding 12px 14px).
- Radius: 6 row-action buttons · 8 inputs/buttons/nav items · 12 cards/modals · 999 chips/avatars.
- Elevation: borders do the layering. Cards: `1px solid #E4E7EC` + `0 1px 2px rgba(16,24,40,0.04)`. Dropdowns: `0 4px 12px rgba(16,24,40,0.10)`. Modals: `0 16px 40px rgba(16,24,40,0.16)`. Remove the global `MuiPaper` md shadow override in `src/theme/index.ts`.

### Micro-animation standard
- Easing: `cubic-bezier(0.2, 0, 0, 1)` standard; `cubic-bezier(0.32, 0.72, 0, 1)` for modal/drawer entry.
- Durations: 120ms hover/press · 160ms color/border · 200ms dropdowns + sidebar collapse width · 240ms page-enter and modal-enter (exit 160ms).
- Animate only `background-color, border-color, color, opacity, transform`. Exception: sidebar `width` (once, 200ms).
- Patterns: page content fades in + translateY(8px)→0 on route change (240ms); dashboard KPI cards stagger 50ms each; buttons press `scale(0.98)`; modal = backdrop fade 160ms + panel translateY(12px)+scale(0.98)→1 at 240ms; table rows bg-tint on hover 120ms; focus-visible = 2px `#FF6B2C` ring, offset 2.

## Screens / Views
All screens live inside `DRIM App.dc.html` (single prototype, click the sidebar; role is a tweak prop). Layout shell:

### Shell (AppShell / SideNav / ChromeBar)
- Sidebar 252px fixed, white surface, right border `#E4E7EC`. Logo row 64px (32px D-mark + "DRIM IMS", IMS in orange).
- Nav item: 8px radius, padding 9px 10px, 14px/600 `#475467`, icon 20px `#667085`. Hover: bg `#F0F2F5`, text `#101828`. Active: bg `#FFF3EC`, text `#D14E16` 700, icon `#FF6B2C`, plus a 3px orange rounded indicator bar at the sidebar's left edge (top/bottom inset 8px). Count badges: mono 11px pill on `#F0F2F5`.
- NEW (approved): collapse toggle in the header (`first_page`/`last_page` icon) animates sidebar width 252→76px at 200ms; labels/group headers hide, group headers become 1px dividers, icons center.
- Header 64px, white, bottom border. Search field: 38px, `#F9FAFB` bg, 1px border, radius 8, placeholder muted (NO ⌘K hint). Right: "Add New" primary (only when `products.canCreate`), dark-mode toggle, bell (orange dot, 2px surface ring), navy avatar + name/role.
- Primary button: `#FF6B2C`, white, 700/13.5, height 38, radius 8, hover `#E55A1F`, press scale(0.98).
- Icon buttons: 38px square, radius 8, 1px border, muted icon; hover: border+icon → orange family.
- Main canvas `#F6F7F9`; footer strip 12.5px muted, top divider.

### Page chrome (PageChrome)
Title 20/800 + 13px muted subtitle (from `SCREEN_SUBTITLES`); right: PDF/Excel icon buttons (only when `canExport`), secondary pills, primary Add button (per module `canCreate`).

### Dashboard
KPI cards (auto-fit minmax 210px): white card, label 13/700 muted, 34px tinted icon chip (tone bg + tone text), value 28px mono 600, sub 12px muted-2. Tones: Pending MRFs=warn, Out of Stock=danger, Low Stock=info, Products Tracked=success. Then: stock-movement bar chart card (7 days, two 11px bars/day — received `#12805C`, released `#FF6B2C`, legend dots) + Pending MRFs card (mono orange ref + chip + project + meta). Then Recent Transactions table + Low Stock / Out of Stock alert panels (dot header, qty in tone color 800). TECHNICIAN: single KPI + open-requests card only (as `DashboardScreen` `isTech` branch today).

### Tables (all list screens)
Card container radius 12. Header row: `#F9FAFB` bg, 12px/700 muted labels. Rows: divider borders, hover `#F9FAFB` 120ms, last row borderless. Cell recipes: mono cells 12.5px Plex Mono `#475467`; names 700; muted secondary; chips as above. Inventory adds a 3px stock meter bar under the count (46px track `#F0F2F5`, fill = tone color, width = stock/target %). Row actions: 30px bordered icon buttons (edit/tune muted → orange border on hover; delete red `#B42318` → red tint bg on hover). Pagination: info text left; circular 30px prev/next + solid orange current page.
Filter bar (Inventory): card row with search input + category pill chips (active = solid orange).
Stock & MRFs (non-tech): tab row (Material Requests / Stock In / Stock Out — 13.5/700, active = orange text + 2px bottom indicator) + "Stock In"/"Stock Out" secondary pills. TECHNICIAN variant: title "Material Requests (MRF)", File MRF primary, My Profile side card (uppercase 10.5px labels, mono emp no).

### Permissions (mirrors PermissionsScreen.tsx exactly)
Two mode cards ("Role Permissions" / "User Permissions" — active card: orange border + `#FFF3EC` bg). Role mode: role tabs (Owner/Admin/Warehouse Staff/Technician) + matrix `minmax(140px,200px) repeat(5,1fr)` — modules exactly: Dashboard, Inventory, Products, Stock In/Out, Material Requests, Suppliers, Technicians, Users, Reports; columns View/Create/Edit/Delete/Export with 15px icons. Checkboxes: 18px, radius 4, 1.5px `#98A2B3` border; checked = solid orange + white check; hover border orange. User mode: Account select + "Unchanged rows follow the X role defaults." caption + Source column — override rows tinted `#FFF3EC` with "Custom" label + 26px reset button (`restart_alt`); others "Role default" muted.

### Activity Log
Card list rows: 8px tone dot, "**User** action text" (name 700, rest `#475467` 13.5), module chip, mono 11.5px time. Non-Owner/Admin roles: amber lock banner "Viewing operational events only — account and permission changes are hidden for your role." (matches server-side sensitive filtering; `ViewOnlyBanner` restyled: radius 8, `#FEF4E6` bg, `#B54708` text/icon).

### Reports
2×2 cards: tinted icon chip, title 15/800, desc 12.5 muted, divider, date-range pill + PDF/Excel pill buttons. Hover: translateY(-2px) + shadow to `0 4px 12px rgba(16,24,40,0.08)` at 160ms. Footer note links to the PDF template.

### Settings / Profile
Form cards (max-width grid 320px+): title 15/800, desc 12.5 muted, fields = 12px/700 `#475467` label + 38px input (radius 8, `#F9FAFB` bg, focus border orange), primary submit.

## Modals (field-for-field from src/components/modals/*)
Shared: backdrop `rgba(16,24,40,0.5)` fade 160ms; panel radius 12, modal shadow, enter 240ms `cubic-bezier(0.32,0.72,0,1)`; header 15/800 + close button; footer Cancel pill + primary CTA; body scrolls past 65vh.
- **ProductModal** (560, 2-col): Product Code · Product Name · Category select · Unit select (Pcs/Meter) · Opening Stock (edit mode: read-only "Stocks (on hand)" + helper "Changes through Stock In/Out or Adjust Stock") · Min. Stock Level · Preferred Supplier select (— empty option) · Product Image file (span 2).
- **SupplierModal** (560): Supplier Name "Company name" · Contact "Phone or email" · Supplies span2 "e.g. Pipes, valves".
- **TechnicianModal** (560): Employee Number "EMP-0000" · Name · Position span2 "e.g. HVAC Technician".
- **UserModal** (420, 1-col): Name · Username "e.g. m.santos" · Initial Password "At least 8 characters" · Role select.
- **PurchaseOrderModal** (660): Supplier select → ItemCartEditor ("Add Items to Order" / "Items on this Order") → Notes (Optional). CTA "Create Purchase Order (N items)".
- **MultiItemMrfModal** (660): blue info banner "Filed under {technician} …" → ItemCartEditor ("Add Items to Request" / "Items in this Request") → Project Name + External Ref. No. (Optional) 2-col → Description/Notes textarea. CTA "File MRF (N items)". Keep draft persistence + confirm-close as-is.
- **AdjustStockModal** (420): product summary box (name / mono code / system count) → Corrected Count (live ± delta helper colored success/danger) → Reason select (Miscount / Damaged / Lost / Found / Return / Data correction) → Note (optional). CTA "Record adjustment".
ItemCartEditor styling: select + 82px qty + Add pill; cart list bordered radius 8, `#F9FAFB` header, rows with mono qty + small red remove button.

## PDF Report Template (`PDF Report Template.dc.html`)
Replaces the bare `pdfReport.ts` layout for ALL exports (maps to its title/summary/sections API):
- Repeating letterhead: 26px D-mark, company name 11/800, address 8.5 muted; right: report type 9px 0.14em tracked + mono ref no; 2px `#FF6B2C` rule below.
- Title 23/800 + summary; meta strip (GENERATED / PERIOD / PREPARED BY / WAREHOUSE — 8.5px tracked labels, mono/700 values) between hairlines; KPI row with hairline column separators (Low Stock value `#B54708`, Out of Stock `#B42318`).
- Table: 8.5px tracked headers over 1.5px `#101828` rule (repeat per page), 10.5px rows, mono right-aligned numerics, colored small-caps status text, `#F0F2F5` hairlines; tfoot totals over 1.5px rule.
- Footnote 9px muted; Prepared/Checked/Approved signature rules; repeating footer (generated stamp · "Internal use only").
Implement in `pdf-lib` inside `generateReportPdf` (colors above as rgb; Helvetica ≈ Nunito is fine in print).

## State Management
No new state beyond: `collapsed: boolean` for the sidebar (persist in localStorage), and existing modal/tab/filter state. Permissions matrix state, RBAC gating, queries — all unchanged.

## Assets
- `public/images/drim-d-transparent.png` — existing repo logo (already in the codebase).
- Icons: prototypes use Material Symbols Outlined; in the codebase keep the existing `@mui/icons-material` outlined equivalents (grid_view→GridViewOutlined, etc. — same set already imported in `SideNav.tsx`).

## Files in this bundle
- `DRIM App.dc.html` — full app prototype: shell + all 14 screens, RBAC-aware per role (role/accent/startCollapsed are adjustable props), all modals, animations. **Primary reference.**
- `Layout Shell.dc.html` — shell-only iteration (superseded by DRIM App, kept for reference).
- `PDF Report Template.dc.html` + `doc-page.js` — print-ready report letterhead (open and print to see pagination).
- `public/images/drim-d-transparent.png` — logo used by the prototypes.

## Where to apply changes (repo mapping)
- Tokens: `src/theme/tokens.ts` + `designTokens.ts` + `modernTokens.ts` → consolidate; update `src/theme/index.ts` (drop MuiPaper shadow, radius 12 cards, new palettes).
- Shell: `src/components/AppShell.tsx`, `SideNav.tsx` (+ collapse state/toggle), `ChromeBar.tsx` (remove ⌘K hint), `PageChrome.tsx`.
- Primitives: `DataTable.tsx`, `StatusChip.tsx`, `StockMeter.tsx`, `EmptyState.tsx`, `Skeleton.tsx`, `Toast.tsx`, `ViewOnlyBanner.tsx`, `EntityModal.tsx`.
- Screens: `src/components/screens/*.tsx` (all 15) — styling only; keep every `useCan`/permission branch intact.
- Modals: `src/components/modals/*.tsx` — restyle only; field sets already match this spec.
- PDF: `src/lib/pdfReport.ts`.
- Login (`src/app/(auth)/*`): DO NOT TOUCH.
