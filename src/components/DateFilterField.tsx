"use client";

import { InputBase } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { SEARCH_FIELD_HEIGHT } from "@/components/SearchByPanel";

/**
 * Drop-in replacement for a plain text "Date" SearchByPanel field — a native
 * date input instead of a blind text box, so clicking it opens the browser's
 * own calendar picker (per the client's ask: "if cinlick yung date maglabas
 * nlng ng 'calendar' to click"). Typing still works the same as before.
 *
 * Emits `yyyy-mm-dd` (the native input's format), which the existing
 * server-side date-range filter already parses fine via `new Date(q)` — no
 * change needed there, this only swaps what renders the field.
 */
export function DateFilterField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTheme().palette;

  return (
    <InputBase
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth
      sx={{
        height: SEARCH_FIELD_HEIGHT,
        boxSizing: "border-box",
        border: "1px solid",
        borderColor: t.border,
        borderRadius: "8px",
        px: 1.125,
        fontSize: 13,
        bgcolor: t.mode === "dark" ? "background.default" : "#F9FAFB",
        "& input::-webkit-calendar-picker-indicator": {
          filter: t.mode === "dark" ? "invert(1)" : "none",
          cursor: "pointer",
        },
      }}
    />
  );
}
