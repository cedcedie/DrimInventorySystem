"use client";

import { Box, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";

/** Explains why an action is unavailable rather than silently omitting the button
 * (a missing button reads as broken more often than as a permission issue). */
export function ViewOnlyBanner({ text }: { text: string }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box
      role="status"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.875,
        px: 1.5,
        py: 1,
        mb: 1.5,
        width: "100%",
        bgcolor: mode === "dark" ? "rgba(245,158,11,0.14)" : "#FEF4E6",
        borderRadius: "8px",
      }}
    >
      <LockOutlinedIcon sx={{ fontSize: 16, color: t.warn, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: t.text }}>{text}</Typography>
    </Box>
  );
}
