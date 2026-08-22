"use client";

import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

/** Bar under a stock count showing position vs. minimum level. Full at 2× the
 * minimum — beyond that the exact ratio stops mattering operationally. */
export function StockMeter({ stocks, minLevel }: { stocks: number; minLevel: number }) {
  const t = useTheme().palette;

  const color =
    stocks === 0 ? t.stock.out : stocks <= minLevel ? t.stock.low : t.stock.healthy;

  // No minimum set: show a full bar rather than implying a nonexistent threshold.
  const ceiling = minLevel > 0 ? minLevel * 2 : Math.max(stocks, 1);
  const pct = Math.min(100, Math.round((stocks / ceiling) * 100));

  return (
    <Box
      aria-hidden
      sx={{
        mt: 0.5,
        height: 2,
        width: "100%",
        bgcolor: t.line2,
        overflow: "hidden",
      }}
    >
      <Box sx={{ height: "100%", width: `${pct}%`, bgcolor: color }} />
    </Box>
  );
}
