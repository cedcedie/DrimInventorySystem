"use client";

import { useQuery } from "@tanstack/react-query";
import { Autocomplete, TextField } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { fetchJson } from "@/lib/api";
import { SEARCH_FIELD_HEIGHT } from "@/components/SearchByPanel";
import type { ProductCatalogItem } from "@/lib/data/products";

/**
 * Drop-in replacement for a plain text "Item" SearchByPanel field — instead
 * of a blind text box, clicking it lists every active product grouped by
 * category (per the client's ask: "yung list nlng ng items ang lumabas pag
 * cinlick... naka category"). Typing still narrows it, same as before; this
 * only adds the browse-by-click affordance on top.
 *
 * The filter value stays a plain string (the product name), so the existing
 * server-side `contains` filter and every screen's query/URL wiring needs no
 * change — this only swaps what renders the field.
 */
export function ItemFilterField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTheme().palette;
  const { data: catalog } = useQuery({
    queryKey: ["product-catalog"],
    queryFn: () => fetchJson<ProductCatalogItem[]>("/api/products/catalog"),
    staleTime: 5 * 60_000,
  });

  return (
    <Autocomplete
      freeSolo
      options={catalog ?? []}
      loading={!catalog}
      groupBy={(option) => option.category}
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
