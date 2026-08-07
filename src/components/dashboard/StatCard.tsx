"use client";

import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

/**
 * DreamsPOS-style solid summary card: colored background, white text,
 * icon in a translucent rounded square on the left.
 */
export function StatCard({
  label,
  value,
  sub,
  color = "#FE9F43",
  icon,
  span = 1,
}: {
  label: string;
  value: string | number;
  sub?: string;
  /** Solid background color of the card. */
  color?: string;
  icon?: ReactNode;
  span?: 1 | 2;
}) {
  return (
    <Box
      sx={{
        gridColumn: { xs: "span 1", sm: span === 2 ? "span 2" : "span 1" },
        bgcolor: color,
        color: "#fff",
        borderRadius: "8px",
        px: 2.25,
        py: 2,
        display: "flex",
        alignItems: "center",
        gap: 1.75,
        minWidth: 0,
        boxShadow: "0 4px 14px rgba(16, 24, 40, 0.08)",
      }}
    >
      {icon && (
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: "8px",
            bgcolor: "rgba(255,255,255,0.2)",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            "& svg": { fontSize: 24, color: "#fff" },
          }}
        >
          {icon}
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 12.5,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.3,
          }}
        >
          {label}
        </Typography>
        <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.25 }}>{value}</Typography>
        {sub && (
          <Typography sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.75)", lineHeight: 1.3 }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
