"use client";

import { Box, Skeleton, Typography } from "@mui/material";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";

/** Table-shaped skeleton with a status line, so a slow fetch reads as
 * "loading this specific thing" rather than a generic spinner. */
export function TableSkeleton({
  label,
  columns = 6,
  rows = 6,
}: {
  label: string;
  columns?: number;
  rows?: number;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const gridCols = `repeat(${columns}, minmax(0, 1fr))`;

  return (
    <Box sx={{ bgcolor: t.surface, border: "1px solid", borderColor: t.line }}>
      <Box
        sx={{
          px: 1.75,
          py: 1.125,
          borderBottom: "1px solid",
          borderColor: t.line,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Skeleton variant="circular" width={12} height={12} sx={{ bgcolor: t.line2 }} />
        <Typography sx={{ fontSize: 12, color: t.muted }}>{label}</Typography>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: gridCols, bgcolor: t.bg2, borderBottom: "1px solid", borderColor: t.line }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Box key={i} sx={{ px: 1.5, py: 0.875 }}>
            <Skeleton width="60%" height={10} sx={{ bgcolor: t.line2 }} />
          </Box>
        ))}
      </Box>
      {Array.from({ length: rows }).map((_, r) => (
        <Box
          key={r}
          sx={{
            display: "grid",
            gridTemplateColumns: gridCols,
            borderBottom: "1px solid",
            borderColor: t.line2,
          }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Box key={c} sx={{ px: 1.5, py: 1 }}>
              <Skeleton width={c === 0 ? "80%" : "50%"} height={12} sx={{ bgcolor: t.line2 }} />
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

export function KpiSkeleton({ count = 4 }: { count?: number }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: 1.5,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Box
          key={i}
          sx={{
            bgcolor: t.surface,
            border: "1px solid",
            borderColor: t.line,
            borderTop: "3px solid",
            borderTopColor: t.line2,
            px: 1.75,
            py: 1.5,
          }}
        >
          <Skeleton width="70%" height={11} sx={{ bgcolor: t.line2 }} />
          <Skeleton width="45%" height={24} sx={{ bgcolor: t.line2, mt: 0.5 }} />
          <Skeleton width="55%" height={11} sx={{ bgcolor: t.line2, mt: 0.25 }} />
        </Box>
      ))}
    </Box>
  );
}
