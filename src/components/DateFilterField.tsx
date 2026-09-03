"use client";

import dayjs, { type Dayjs } from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useTheme } from "@mui/material/styles";
import { SEARCH_FIELD_HEIGHT } from "@/components/SearchByPanel";

/**
 * Drop-in replacement for a plain text "Date" SearchByPanel field — MUI's own
 * `DatePicker` (not a native `<input type="date">`, which only ever looks
 * like whatever the OS/browser draws — no theming, no library UI) so clicking
 * it opens the same calendar affordance the rest of the app already uses.
 *
 * Emits `yyyy-mm-dd`, which the existing server-side date-range filter
 * already parses fine via `new Date(q)` — no change needed there, this only
 * swaps what renders the field.
 */
export function DateFilterField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTheme().palette;
  const parsed: Dayjs | null = value && dayjs(value).isValid() ? dayjs(value) : null;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DatePicker
        value={parsed}
        onChange={(next) => onChange(next && next.isValid() ? next.format("YYYY-MM-DD") : "")}
        format="MMM D, YYYY"
        slotProps={{
          textField: {
            size: "small",
            fullWidth: true,
            sx: {
              "& .MuiOutlinedInput-root": {
                height: SEARCH_FIELD_HEIGHT,
                fontSize: 13,
                bgcolor: t.mode === "dark" ? "background.default" : "#F9FAFB",
                "& fieldset": { borderColor: t.border },
              },
            },
          },
          field: { clearable: true },
        }}
      />
    </LocalizationProvider>
  );
}
