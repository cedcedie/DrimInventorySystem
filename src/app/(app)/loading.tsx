"use client";

import { Box, Typography } from "@mui/material";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";

/** Route transition placeholder — matches real brand chrome (no yellow "DR" badge). */
export default function AppLoading() {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: t.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
      }}
    >
      <Box
        component="img"
        src="/images/drim-d-transparent.png"
        alt=""
        sx={{ width: 40, height: 40 }}
      />
      <Box
        sx={{
          width: 20,
          height: 20,
          border: "2px solid",
          borderColor: t.line2,
          borderTopColor: ACCENT,
          borderRadius: "50%",
          animation: "drim-spin 0.7s linear infinite",
          "@keyframes drim-spin": {
            from: { transform: "rotate(0deg)" },
            to: { transform: "rotate(360deg)" },
          },
        }}
      />
      <Typography sx={{ fontSize: 12.5, color: t.muted }}>Loading…</Typography>
    </Box>
  );
}
