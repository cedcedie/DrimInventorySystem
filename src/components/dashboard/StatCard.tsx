"use client";

import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, lightChips, darkChips, motion } from "@/theme/tokens";
import type { ChipTone } from "@/components/StatusChip";

/**
 * Dashboard KPI card: white surface, 34px tinted icon chip (tone bg + tone
 * text), label 13/700 muted, value 28px mono 600, optional 12px muted-2 sub.
 */
export function StatCard({
  label,
  value,
  sub,
  tone = "warn",
  icon,
  index = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  /** Status tone driving the icon chip's soft tint — reuses the same
   * success/warn/danger/info/neutral scale as StatusChip. */
  tone?: ChipTone;
  icon?: ReactNode;
  /** Position in the KPI row — staggers the entrance animation 50ms each. */
  index?: number;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const chips = mode === "dark" ? darkChips : lightChips;
  const [, chipBg, chipFg] = chips[tone];

  return (
    <Box
      sx={{
        bgcolor: t.surface,
        border: "1px solid",
        borderColor: t.line,
        borderRadius: "12px",
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
        px: 2,
        py: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        minWidth: 0,
        animation: `drim-kpi-enter 240ms ${motion.easing.standard} both`,
        animationDelay: `${index * 50}ms`,
        "@keyframes drim-kpi-enter": {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: t.muted, lineHeight: 1.3 }}>
          {label}
        </Typography>
        {icon && (
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "8px",
              bgcolor: chipBg,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              "& svg": { fontSize: 18, color: chipFg },
            }}
          >
            {icon}
          </Box>
        )}
      </Box>
      <Typography
        sx={{
          fontSize: 28,
          fontWeight: 600,
          lineHeight: 1.15,
          color: t.text,
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: 12, color: t.muted2, lineHeight: 1.3 }}>{sub}</Typography>
      )}
    </Box>
  );
}
