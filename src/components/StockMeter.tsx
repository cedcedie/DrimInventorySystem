"use client";

import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

/** A 2px bar under a stock count showing where it sits against its minimum
 * level. Reads as "how close to reordering" at a glance, which the bare
 * number can't convey without the reader remembering each product's minimum.
 *
 * The bar is full at 2× the minimum — beyond that the exact ratio stops
 * mattering operationally, and a bar that never fills reads as broken. */
export function StockMeter({ stocks, minLevel }: { stocks: number; minLevel: number }) {
  const t = useTheme().palette;

  const color =
    stocks === 0 ? t.stock.out : stocks <= minLevel ? t.stock.low : t.stock.healthy;

  // With no minimum set there's nothing to measure against, so show a full
  // healthy bar rather than implying a threshold that doesn't exist.
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
