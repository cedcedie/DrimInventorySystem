"use client";

import { Box } from "@mui/material";
import type { ReactNode } from "react";

/** KPI card row — auto-fit minmax(210px) per the README's Dashboard spec,
 * so cards reflow responsively instead of a fixed 2/4-column grid. */
export function BentoGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: 1.5,
      }}
    >
      {children}
    </Box>
  );
}
