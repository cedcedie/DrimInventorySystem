import { createTheme, type ThemeOptions } from "@mui/material/styles";
import { ACCENT, darkTokens, lightTokens } from "./tokens";
import { colors, borderRadius, shadows, typography } from "./designTokens";

/** Stock status palette - domain-named states for product inventory levels.
 * Includes partial status for multi-item MRF fulfillment. */
interface StockPalette {
  healthy: string;
  low: string;
  out: string;
  pending: string;
  partial: string;
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
  shape: { borderRadius: borderRadius.md },
  typography: {
    fontFamily: typography.body.family,
    button: { 
      textTransform: "none",
      fontWeight: typography.body.weight.semibold,
    },
    h1: {
      fontFamily: typography.display.family,
      fontWeight: typography.display.weight.bold,
    },
    h2: {
      fontFamily: typography.display.family,
      fontWeight: typography.display.weight.bold,
    },
    h3: {
      fontFamily: typography.display.family,
      fontWeight: typography.display.weight.regular,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { 
          backgroundImage: "none",
          boxShadow: shadows.md,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { 
        root: { 
          borderRadius: borderRadius.md,
          transition: 'all 150ms ease-out',
        },
      },
    },
    MuiCard: {
      styleOverrides: { 
        root: { 
          boxShadow: shadows.sm,
          borderRadius: borderRadius.lg,
        } 
      },
    },
    MuiAppBar: {
      styleOverrides: { 
        root: { 
          boxShadow: 'none',
          borderBottom: '1px solid',
        } 
      },
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
      healthy: colors.stock.healthy.main,
      low: colors.stock.low.main,
      out: colors.stock.out.main,
      pending: colors.stock.pending.main,
      partial: colors.stock.partial.main,
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
      healthy: colors.stock.healthy.main,
      low: colors.stock.low.main,
      out: colors.stock.out.main,
      pending: colors.stock.pending.main,
      partial: colors.stock.partial.main,
    },
  },
});
