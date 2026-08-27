"use client";

import { Box, InputBase, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";

export type SearchByField = {
  key: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
};

/** "SEARCH BY" panel — one labeled, independently-optional input per field.
 * Filled fields combine with AND logic server-side (see each data/*.ts
 * fetcher); an empty field is simply ignored, not treated as "match all". */
export function SearchByPanel({ fields }: { fields: SearchByField[] }) {
  const t = useTheme().palette;

  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: t.muted, mb: 0.75 }}>
        SEARCH BY
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: `repeat(${fields.length}, minmax(140px, 1fr))`,
          gap: 1,
          "@media (max-width: 720px)": { gridTemplateColumns: "repeat(2, minmax(140px, 1fr))" },
        }}
      >
        {fields.map((f) => (
          <Box key={f.key}>
            <Typography sx={{ fontSize: 10.5, color: t.muted, mb: 0.375 }}>{f.label}</Typography>
            <InputBase
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              placeholder={f.placeholder ?? f.label}
              fullWidth
              sx={{
                border: "1px solid",
                borderColor: t.border,
                borderRadius: "8px",
                px: 1.125,
                py: 0.625,
                fontSize: 13,
                bgcolor: t.mode === "dark" ? "background.default" : "#F9FAFB",
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
