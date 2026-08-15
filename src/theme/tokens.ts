// DRIM IMS — Design Tokens (single source of truth)
// Consolidated from tokens.ts + designTokens.ts + modernTokens.ts per the
// 2026-08 UI refresh handoff. Brand: DRIM logo orange #FF6B2C.
// Orange is a FILL color only (buttons, active-nav pill, focus ring,
// indicators) — never orange text on white; accent text uses primaryText.

export const ACCENT = "#FF6B2C";
export const ACCENT_HOVER = "#E55A1F";
export const ACCENT_ACTIVE = "#D14E16";
export const ACCENT_SOFT = "#FFF3EC";
/** Accent-toned text color (never render ACCENT itself as text on a light bg). */
export const ACCENT_TEXT = "#D14E16";
export const ACCENT_TEXT_DARK = "#FF9B6B";
export const NAVY = "#092C4C";

// Solid KPI card colors (dashboard summary row) — tone-mapped per the
// README's Dashboard section (Pending MRFs=warn, Out of Stock=danger,
// Low Stock=info, Products Tracked=success); kept as a flat palette too
// for any direct color needs.
export const KPI_COLORS = {
  orange: ACCENT,
  navy: NAVY,
  teal: "#12805C",
  blue: "#175CD3",
} as const;

export const DENSITY_ROW_PADDING = {
  compact: 8,
  comfortable: 12,
} as const;

export const lightTokens = {
  bg: "#F6F7F9",
  bg2: "#F9FAFB",
  surface: "#FFFFFF",
  surface2: "#F9FAFB",
  text: "#101828",
  hover: "#F0F2F5",
  rowSel: ACCENT_SOFT,
  warn: "#B54708",
  danger: "#B42318",
  success: "#12805C",
  line: "#E4E7EC",
  line2: "#F0F2F5",
  border: "#E4E7EC",
  borderStrong: "#D0D5DD",
  divider: "#F0F2F5",
  text2: "#475467",
  muted: "#667085",
  muted2: "#98A2B3",
  muted3: "#98A2B3",
};

export const darkTokens = {
  bg: "#0D1117",
  bg2: "#1C232C",
  surface: "#161B22",
  surface2: "#1C232C",
  line: "#2A323D",
  line2: "#232B35",
  border: "#2A323D",
  borderStrong: "#3A4553",
  divider: "#232B35",
  hover: "#1C232C",
  rowSel: "rgba(255,107,44,0.14)",
  text: "#E9EEF4",
  text2: "#B4BECA",
  muted: "#7D8896",
  muted2: "#5E6875",
  muted3: "#5E6875",
  warn: "#E5A44E",
  danger: "#E8837B",
  success: "#57C99B",
};

// Status chips — soft tinted badges. [border, bg, text] kept for StatusChip's
// existing 3-tuple usage; border == bg for these (no separate chip border,
// per the README's flat soft-pill treatment) except where noted.
export const lightChips = {
  success: ["#E8F6F0", "#E8F6F0", "#12805C"],
  danger: ["#FEEDEB", "#FEEDEB", "#B42318"],
  warn: ["#FEF4E6", "#FEF4E6", "#B54708"],
  info: ["#EAF1FE", "#EAF1FE", "#175CD3"],
  partial: ["#F1EBFC", "#F1EBFC", "#6941C6"],
  neutral: ["#F0F2F5", "#F0F2F5", "#475467"],
} as const;

export const darkChips = {
  success: ["rgba(18,183,127,0.14)", "rgba(18,183,127,0.14)", "#57C99B"],
  danger: ["rgba(239,68,68,0.14)", "rgba(239,68,68,0.14)", "#E8837B"],
  warn: ["rgba(245,158,11,0.14)", "rgba(245,158,11,0.14)", "#E5A44E"],
  info: ["rgba(59,130,246,0.14)", "rgba(59,130,246,0.14)", "#7DA9F0"],
  partial: ["rgba(139,92,246,0.16)", "rgba(139,92,246,0.16)", "#B49BEF"],
  neutral: ["#232B35", "#232B35", "#B4BECA"],
} as const;

// ---------------------------------------------------------------------------
// Merged from designTokens.ts — spacing/radius/colors/shadows used by the
// item-cart family (ItemCartEditor, StockInModal, PurchaseOrderModal,
// MultiItemMrfModal). Only the fields those components actually read are
// kept populated with real values; the rest of the old neutral/blue/status
// scales are preserved as-is since they're still referenced by index.

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(16,24,40,0.04)",
  md: "0 4px 12px rgba(16,24,40,0.10)",
  lg: "0 16px 40px rgba(16,24,40,0.16)",
  xl: "0 20px 40px rgba(0, 0, 0, 0.15)",
  inner: "inset 0 2px 4px rgba(0, 0, 0, 0.06)",
} as const;

export const colors = {
  brand: {
    primary: ACCENT,
    primaryHover: ACCENT_HOVER,
    primaryActive: ACCENT_ACTIVE,
    primaryLight: ACCENT_SOFT,
    primaryDark: ACCENT_HOVER,
  },
  neutral: {
    0: "#FFFFFF",
    50: "#F9FAFB",
    100: "#F0F2F5",
    200: "#E4E7EC",
    300: "#D0D5DD",
    400: "#98A2B3",
    500: "#667085",
    600: "#475467",
    700: "#344054",
    800: "#1D2939",
    900: "#101828",
    950: "#0D1117",
  },
  blue: {
    50: "#EAF1FE",
    100: "#D6E4FD",
    800: "#175CD3",
    900: "#164FA8",
  },
  status: {
    success: "#12805C",
    warning: "#B54708",
    error: "#B42318",
  },
  // Stock-status domain palette — healthy/low/out/pending/partial states for
  // product inventory levels, used by the MUI palette's `stock` extension.
  stock: {
    healthy: { main: "#12805C" },
    low: { main: "#B54708" },
    out: { main: "#B42318" },
    pending: { main: "#175CD3" },
    partial: { main: "#6941C6" },
  },
} as const;

// Typography — Nunito for UI text, IBM Plex Mono for ref numbers, SKUs,
// quantities, KPI values, badges (see README "Type" section).
export const typography = {
  display: {
    family: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    weight: { regular: 600, bold: 800 },
  },
  body: {
    family: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  },
  mono: {
    family: "'IBM Plex Mono', 'Consolas', 'Monaco', monospace",
    weight: { medium: 500, semibold: 600 },
  },
} as const;

// Micro-animation standard (see README "Micro-animation standard").
export const motion = {
  easing: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    entrance: "cubic-bezier(0.32, 0.72, 0, 1)",
  },
  duration: {
    press: 120,
    color: 160,
    dropdown: 200,
    sidebar: 200,
    enter: 240,
    exit: 160,
  },
} as const;
