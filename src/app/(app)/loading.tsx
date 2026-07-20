"use client";

import { Box, Typography } from "@mui/material";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, CHROME_COLOR, ACCENT } from "@/theme/tokens";

export default function AppLoading() {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: t.bg }}>
      <Box
        sx={{
          height: 46,
          bgcolor: CHROME_COLOR,
          display: "flex",
          alignItems: "center",
          gap: "9px",
          px: 2,
        }}
      >
        <Box
          sx={{
            width: 24,
            height: 24,
            bgcolor: ACCENT,
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 11,
            color: "#fff",
          }}
        >
          DR
        </Box>
        <Typography sx={{ fontSize: "13.5px", fontWeight: 700, color: "#fff" }}>
          DRIM Inventory System
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          py: 10,
        }}
      >
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
        <Typography sx={{ fontSize: 12.5, color: t.muted }}>
          Verifying your session and permissions…
        </Typography>
      </Box>
    </Box>
  );
}
