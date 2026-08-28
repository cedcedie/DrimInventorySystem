"use client";

import { Box, InputBase, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

/** Every field's control (text box, Select, Download button) shares this exact
 * height so the whole row lines up — MUI's Select and Button don't match a
 * plain InputBase's height by default, which is what caused the visible
 * misalignment (boxes/select/button all sitting at slightly different heights). */
export const SEARCH_FIELD_HEIGHT = 36;

export type SearchByField = {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Swaps the default text input for custom content (e.g. a category Select)
   * while keeping the same label + grid-cell styling as every other field. */
  render?: () => React.ReactNode;
};

/** "SEARCH BY" panel — one labeled, independently-optional input per field.
 * Filled fields combine with AND logic server-side (see each data/*.ts
 * fetcher); an empty field is simply ignored, not treated as "match all".
 *
 * `trailing` (e.g. the Download export button) sits on the same line as the
 * input boxes, right-aligned — not floating in its own row above/below. */
export function SearchByPanel({ fields, trailing }: { fields: SearchByField[]; trailing?: React.ReactNode }) {
  const t = useTheme().palette;

  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: t.muted, mb: 0.75 }}>
        SEARCH BY
      </Typography>
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, flexWrap: "wrap" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: `repeat(${fields.length}, minmax(140px, 1fr))`,
            gap: 1,
            flex: "1 1 auto",
            "@media (max-width: 720px)": { gridTemplateColumns: "repeat(2, minmax(140px, 1fr))" },
          }}
        >
          {fields.map((f) => (
            <Box key={f.key}>
              <Typography sx={{ fontSize: 10.5, color: t.muted, mb: 0.375 }}>{f.label}</Typography>
              {f.render ? (
                f.render()
              ) : (
                <InputBase
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
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
                  }}
                />
              )}
            </Box>
          ))}
        </Box>
        {trailing && <Box sx={{ flexShrink: 0 }}>{trailing}</Box>}
      </Box>
    </Box>
  );
}
