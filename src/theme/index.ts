import { createTheme, type ThemeOptions } from "@mui/material/styles";
import { ACCENT, darkTokens, lightTokens } from "./tokens";

/** The four states a product's stock level can be in. Named for the domain
 * rather than by severity so a screen asks for `stock.low`, not `warning`,
 * and both modes stay in step from one place. */
interface StockPalette {
  healthy: string;
  low: string;
  out: string;
  pending: string;
}

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
    stock: StockPalette;
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
    stock?: StockPalette;
  }
}

const shared: ThemeOptions = {
  shape: { borderRadius: 2 },
  typography: {
    fontFamily: "'Heebo', sans-serif",
    button: { textTransform: "none" },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 2 } },
    },
    MuiCard: {
      styleOverrides: { root: { boxShadow: "none" } },
    },
    MuiAppBar: {
      styleOverrides: { root: { boxShadow: "none" } },
    },
  },
};

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
    stock: {
      healthy: lightTokens.success,
      low: lightTokens.warn,
      out: lightTokens.danger,
      pending: ACCENT,
    },
  },
});

export const darkTheme = createTheme({
  ...shared,
  palette: {
    mode: "dark",
    primary: { main: ACCENT },
    background: { default: darkTokens.bg, paper: darkTokens.surface },
    text: { primary: darkTokens.text, secondary: darkTokens.text2 },
    warning: { main: darkTokens.warn },
    error: { main: darkTokens.danger },
    success: { main: darkTokens.success },
    surface: darkTokens.surface,
    border: darkTokens.border,
    hover: darkTokens.hover,
    rowSel: darkTokens.rowSel,
    muted: darkTokens.muted,
    muted2: darkTokens.muted2,
    muted3: darkTokens.muted3,
    text2: darkTokens.text2,
    line: darkTokens.line,
    line2: darkTokens.line2,
    stock: {
      healthy: darkTokens.success,
      low: darkTokens.warn,
      out: darkTokens.danger,
      pending: "#8fbde8",
    },
  },
});
