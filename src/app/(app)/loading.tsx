"use client";

import { Box } from "@mui/material";
import { TableSkeleton } from "@/components/Skeleton";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";

/** In-layout route transition — keeps the shell visible, only the main pane loads. */
export default function AppLoading() {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box sx={{ flex: 1, p: 3, bgcolor: t.bg }}>
      <TableSkeleton label="Loading page…" rows={8} />
    </Box>
  );
}
