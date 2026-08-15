"use client";

import { Box } from "@mui/material";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightChips, darkChips } from "@/theme/tokens";

export type ChipTone = "success" | "danger" | "warn" | "neutral" | "info";

const TONE_BY_LABEL: Record<string, ChipTone> = {
  "In Stock": "success",
  Active: "success",
  Fulfilled: "success",
  Received: "success",
  "Stock-In": "success",
  "Unavailable": "danger",
  "Out of Stock": "danger",
  "Stock-Out": "danger",
  Cancelled: "danger",
  "Closed remaining": "warn",
  "Low Stock": "warn",
  Pending: "warn",
  Sent: "warn",
  Partial: "info",
  PARTIAL: "info",
  "Partially Received": "info",
  Draft: "neutral",
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
  const [, bg, fg] = chips[resolvedTone];

  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: "999px",
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
