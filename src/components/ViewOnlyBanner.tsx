"use client";

import { Box, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";

/** Explains why an action isn't available, rather than just omitting the
 * button — a plain missing button reads as "is this broken?" more often
 * than it reads as "I lack permission," especially on a shared device used
 * by several roles in a hurry. Deliberately more visible than a caption:
 * full-width, icon-led, distinct tone from ordinary muted text. */
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
        border: "1px solid",
        borderColor: mode === "dark" ? "rgba(254,159,67,0.35)" : "#FBD9AE",
        bgcolor: mode === "dark" ? "rgba(254,159,67,0.08)" : "#FFF6EE",
        borderRadius: "4px",
      }}
    >
      <LockOutlinedIcon sx={{ fontSize: 16, color: t.warn, flexShrink: 0 }} />
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: t.text }}>{text}</Typography>
    </Box>
  );
}
