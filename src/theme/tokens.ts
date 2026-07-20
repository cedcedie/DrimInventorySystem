export const CHROME_COLOR = "#22303e"; // Steel (alt Graphite #232323)
export const ACCENT = "#1663a8";

export const DENSITY_ROW_PADDING = {
  compact: 6,
  comfortable: 11,
} as const;

export const lightTokens = {
  bg: "#eceef0",
  bg2: "#f5f6f7",
  surface: "#ffffff",
  text: "#232a33",
  hover: "#e9ecef",
  rowSel: "#eef3f9",
  warn: "#8a5b0f",
  danger: "#a13230",
  success: "#2f8a4c",
  // Derived — not explicit in the README's light palette table (only dark mode
  // lists these); picked as light-mode-consistent neutrals against bg/bg2/text.
  line: "#dde1e5",
  line2: "#e6e9ec",
  border: "#cdd2d8",
  text2: "#4b5563",
  muted: "#6b7684",
  muted2: "#8a93a0",
  muted3: "#a7afb8",
};

export const darkTokens = {
  bg: "#12161b",
  bg2: "#191f26",
  surface: "#1e252d",
  line: "#2c3641",
  line2: "#27303a",
  border: "#3d4854",
  hover: "#232c35",
  rowSel: "#243342",
  text: "#e6ebf0",
  text2: "#c3ccd5",
  muted: "#8f9aa6",
  muted2: "#75808c",
  muted3: "#5f6a76",
  warn: "#dfb86b",
  danger: "#e79a97",
  success: "#8fd3a5",
};

// Chips [border, bg, text]
export const lightChips = {
  success: ["#bfdcc8", "#eaf4ed", "#256b39"],
  danger: ["#e3bcbb", "#fbeceb", "#a13230"],
  warn: ["#e4cda1", "#f9f1e0", "#8a5b0f"],
  neutral: ["#cdd2d8", "#f5f6f7", "#232a33"],
  info: ["#b6cde4", "#e8f0f8", "#1663a8"],
} as const;

export const darkChips = {
  success: ["#3c6b4c", "rgba(76,175,110,0.14)", "#8fd3a5"],
  danger: ["#7a4341", "rgba(216,106,102,0.14)", "#e79a97"],
  warn: ["#7a6234", "rgba(214,166,80,0.14)", "#dfb86b"],
  neutral: ["#4a545f", "rgba(140,150,160,0.14)", "#9aa5b0"],
  info: ["#3d5c7d", "rgba(90,150,210,0.14)", "#8fbde8"],
} as const;
