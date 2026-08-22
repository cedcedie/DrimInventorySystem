"use client";

import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

/** Shows how stale the displayed data is (polling cycle is 6-45s), ticking
 * every few seconds without re-rendering the table. */
export function LastUpdated({ dataUpdatedAt }: { dataUpdatedAt: number | undefined }) {
  const t = useTheme().palette;
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  if (!dataUpdatedAt) return null;

  const seconds = Math.max(0, Math.round((Date.now() - dataUpdatedAt) / 1000));
  const label = seconds < 5 ? "just now" : seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Box
        sx={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          bgcolor: seconds < 30 ? t.success.main : t.muted2,
          flexShrink: 0,
        }}
      />
      <Typography sx={{ fontSize: 10.5, color: t.muted2, whiteSpace: "nowrap" }}>
        Updated {label}
      </Typography>
    </Box>
  );
}
