"use client";

import { Box } from "@mui/material";
import type { ReactNode } from "react";

/** KPI card row — auto-fit minmax(210px) per the README's Dashboard spec on
 * desktop, so cards reflow responsively instead of a fixed 2/4-column grid.
 * Below sm, 210px doesn't fit even one column with room to spare on a phone
 * viewport, so xs/sm each get an explicit column count instead of relying on
 * auto-fit to find a width that isn't there — auto-fit would otherwise keep
 * every card at its minmax floor and force the row wider than the screen. */
export function BentoGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(auto-fit, minmax(210px, 1fr))",
        },
        gap: 1.5,
      }}
    >
      {children}
    </Box>
  );
}
