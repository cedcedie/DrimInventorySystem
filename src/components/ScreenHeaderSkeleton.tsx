"use client";

import { Box, Skeleton } from "@mui/material";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";

export function ScreenHeaderSkeleton() {
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
      }}
    >
      <Skeleton width={160} height={20} sx={{ bgcolor: t.line2 }} />
      <Skeleton width={240} height={13} sx={{ bgcolor: t.line2, mt: 0.5 }} />
    </Box>
  );
}
