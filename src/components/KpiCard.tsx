"use client";

import { Box, Typography } from "@mui/material";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";

export function KpiCard({
  label,
  value,
  sub,
  barColor,
}: {
  label: string;
  value: string;
  sub: string;
  barColor: string;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box
      sx={{
        bgcolor: t.surface,
        border: "1px solid",
        borderColor: t.line,
        borderTop: "3px solid",
        borderTopColor: barColor,
        px: 1.75,
        py: 1.5,
      }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          color: t.muted,
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 700, mt: 0.5 }}>{value}</Typography>
      <Typography sx={{ fontSize: 11, color: t.muted2, mt: 0.125 }}>{sub}</Typography>
    </Box>
  );
}
