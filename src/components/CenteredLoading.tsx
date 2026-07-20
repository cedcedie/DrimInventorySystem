"use client";

import { Box, Typography } from "@mui/material";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";

export function CenteredLoading({ description }: { description: string }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
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
          width: 22,
          height: 22,
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
      <Typography sx={{ fontSize: 12.5, color: t.muted }}>{description}</Typography>
    </Box>
  );
}
