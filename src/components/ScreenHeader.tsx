"use client";

import { Box, Typography } from "@mui/material";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";

export function ScreenHeader({
  title,
  subtitle,
  permSummary,
}: {
  title: string;
  subtitle: string;
  permSummary: string;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box
      sx={{
        bgcolor: t.surface,
        borderBottom: "1px solid",
        borderColor: t.line,
        px: 2.75,
        py: 1.625,
        display: "flex",
        alignItems: "center",
        gap: 1.75,
      }}
    >
      <Box>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{title}</Typography>
        <Typography sx={{ fontSize: 11.5, color: t.muted2 }}>{subtitle}</Typography>
      </Box>
      <Box
        sx={{
          ml: "auto",
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          fontSize: 11,
          color: t.muted,
        }}
      >
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            bgcolor: t.success,
            flexShrink: 0,
          }}
        />
        Permissions:{" "}
        <Box component="span" sx={{ fontWeight: 600, color: t.text }}>
          {permSummary}
        </Box>
      </Box>
    </Box>
  );
}
