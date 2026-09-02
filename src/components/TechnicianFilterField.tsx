"use client";

import { useQuery } from "@tanstack/react-query";
import { Autocomplete, TextField } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { fetchJson } from "@/lib/api";
import { SEARCH_FIELD_HEIGHT } from "@/components/SearchByPanel";
import type { TechnicianCatalogItem } from "@/lib/data/technicians";

/**
 * Drop-in replacement for a plain text "Technician" SearchByPanel field —
 * instead of a blind text box, clicking it lists every technician on the
 * roster (per the client's ask: "dun sa technician, maglist down nlng lahat
 * ng 'user' para mas madali"). Typing still narrows it, same as before; this
 * only adds the browse-by-click affordance on top. Mirrors ItemFilterField.
 *
 * The filter value stays a plain string (the technician's name), so the
 * existing server-side `contains` filter and every screen's query/URL
 * wiring needs no change — this only swaps what renders the field.
 */
export function TechnicianFilterField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTheme().palette;
  const { data: technicians } = useQuery({
    queryKey: ["technician-catalog"],
    queryFn: () => fetchJson<TechnicianCatalogItem[]>("/api/technicians/catalog"),
    staleTime: 5 * 60_000,
  });

  return (
    <Autocomplete
      freeSolo
      options={technicians ?? []}
      loading={!technicians}
      getOptionLabel={(option) => (typeof option === "string" ? option : option.name)}
      inputValue={value}
      onInputChange={(_, next) => onChange(next)}
      onChange={(_, next) => {
        if (next && typeof next !== "string") onChange(next.name);
      }}
      isOptionEqualToValue={(option, val) =>
        (typeof option === "string" ? option : option.name) === (typeof val === "string" ? val : val.name)
      }
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          sx={{
            "& .MuiOutlinedInput-root": {
              height: SEARCH_FIELD_HEIGHT,
              fontSize: 13,
              bgcolor: t.mode === "dark" ? "background.default" : "#F9FAFB",
              "& fieldset": { borderColor: t.border },
            },
          }}
        />
      )}
      slotProps={{
        paper: {
          sx: {
            bgcolor: t.surface,
            border: "1px solid",
            borderColor: t.line,
            boxShadow: "0 4px 12px rgba(16,24,40,0.10)",
          },
        },
        listbox: { className: "scroll-hidden", sx: { maxHeight: 320 } },
      }}
    />
  );
}
