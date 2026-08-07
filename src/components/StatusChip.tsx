"use client";

import { Box } from "@mui/material";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightChips, darkChips } from "@/theme/tokens";

export type ChipTone = "success" | "danger" | "warn" | "neutral" | "info";

const TONE_BY_LABEL: Record<string, ChipTone> = {
  "In Stock": "success",
  Active: "success",
  Fulfilled: "success",
  "Stock-In": "success",
  "Unavailable": "danger",
  "Out of Stock": "danger",
  "Stock-Out": "danger",
  Cancelled: "danger",
  "Low Stock": "warn",
  Pending: "warn",
  Partial: "info",
  PARTIAL: "info",
  Inactive: "neutral",
  Return: "info",
};

export function toneForLabel(label: string): ChipTone {
  return TONE_BY_LABEL[label] ?? "info";
}

export function StatusChip({ label, tone }: { label: string; tone?: ChipTone }) {
  const { mode } = useColorMode();
  const chips = mode === "dark" ? darkChips : lightChips;
  const resolvedTone = tone ?? toneForLabel(label);
  const [border, bg, fg] = chips[resolvedTone];

  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: "4px",
        border: "1px solid",
        borderColor: border,
        bgcolor: bg,
        color: fg,
        whiteSpace: "nowrap",
        letterSpacing: "0.2px",
      }}
    >
      {label}
    </Box>
  );
}
