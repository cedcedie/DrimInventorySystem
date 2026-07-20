"use client";

import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  sub,
  accent,
  trend,
  icon,
  span = 1,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  trend?: { direction: "up" | "down"; value: string };
  icon?: ReactNode;
  span?: 1 | 2;
}) {
  const t = useTheme().palette;
  return (
    <Box
      sx={{
        gridColumn: { xs: "span 1", sm: span === 2 ? "span 2" : "span 1" },
        border: "1px solid",
        borderColor: t.line,
        borderTop: "3px solid",
        borderTopColor: accent ?? t.primary.main,
        bgcolor: t.surface,
        px: 1.75,
        py: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        minWidth: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.6px",
            textTransform: "uppercase",
            color: t.muted,
          }}
        >
          {label}
        </Typography>
        {icon}
      </Box>
      <Typography sx={{ fontSize: span === 2 ? 30 : 24, fontWeight: 700, color: t.text.primary, lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        {sub && <Typography sx={{ fontSize: 11, color: t.muted2 }}>{sub}</Typography>}
        {trend && (
          <Typography
            sx={{
              fontSize: 11.5,
              fontWeight: 600,
              color: trend.direction === "up" ? t.success.main : t.error.main,
            }}
          >
            {trend.direction === "up" ? "↑" : "↓"} {trend.value}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
