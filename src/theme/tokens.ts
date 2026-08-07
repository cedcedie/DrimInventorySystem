// DreamsPOS-style palette — orange primary, white chrome, soft gray canvas.
/** Soft off-white chrome/surfaces (slate-50). */
export const CHROME_COLOR = "#F8FAFC";
export const ACCENT = "#FE9F43";
export const ACCENT_HOVER = "#F98C24";
export const ACCENT_SOFT = "#FFF6EE";
export const NAVY = "#092C4C";

// Solid KPI card colors (dashboard summary row).
export const KPI_COLORS = {
  orange: "#FE9F43",
  navy: "#092C4C",
  teal: "#0E9384",
  blue: "#155EEF",
} as const;

export const DENSITY_ROW_PADDING = {
  compact: 8,
  comfortable: 12,
} as const;

export const lightTokens = {
  bg: "#F7F7F7",
  bg2: "#FAFBFE",
  surface: "#F8FAFC",
  text: "#212B36",
  hover: "#F3F4F6",
  rowSel: "#FFF6EE",
  warn: "#AB6709",
  danger: "#D0302F",
  success: "#1E9E5A",
  line: "#E8E8E8",
  line2: "#F1F1F1",
  border: "#D9DEE3",
  text2: "#495057",
  muted: "#646B72",
  muted2: "#8B909A",
  muted3: "#B5BBC1",
};

export const darkTokens = {
  bg: "#12161b",
  bg2: "#191f26",
  surface: "#1e252d",
  line: "#2c3641",
  line2: "#27303a",
  border: "#3d4854",
  hover: "#232c35",
  rowSel: "#33301F",
  text: "#e6ebf0",
  text2: "#c3ccd5",
  muted: "#8f9aa6",
  muted2: "#75808c",
  muted3: "#5f6a76",
  warn: "#dfb86b",
  danger: "#e79a97",
  success: "#8fd3a5",
};

// Chips [border, bg, text] — DreamsPOS uses solid rounded badges with white text.
export const lightChips = {
  success: ["#28C76F", "#28C76F", "#ffffff"],
  danger: ["#EF3826", "#EF3826", "#ffffff"],
  warn: ["#FE9F43", "#FE9F43", "#ffffff"],
  neutral: ["#94A3B8", "#94A3B8", "#ffffff"],
  info: ["#155EEF", "#155EEF", "#ffffff"],
} as const;

export const darkChips = {
  success: ["#28C76F", "#28C76F", "#ffffff"],
  danger: ["#EF3826", "#EF3826", "#ffffff"],
  warn: ["#FE9F43", "#FE9F43", "#ffffff"],
  neutral: ["#64748B", "#64748B", "#ffffff"],
  info: ["#155EEF", "#155EEF", "#ffffff"],
} as const;
