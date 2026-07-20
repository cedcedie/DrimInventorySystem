import { createTheme, type ThemeOptions } from "@mui/material/styles";
import { ACCENT, darkTokens, lightTokens } from "./tokens";

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
    text: { primary: lightTokens.text },
    warning: { main: lightTokens.warn },
    error: { main: lightTokens.danger },
    success: { main: lightTokens.success },
  },
});

export const darkTheme = createTheme({
  ...shared,
  palette: {
    mode: "dark",
    primary: { main: ACCENT },
    background: { default: darkTokens.bg, paper: darkTokens.surface },
    text: { primary: darkTokens.text, secondary: darkTokens.text2 },
  },
});
