"use client";

import { Box } from "@mui/material";
import type { ReactNode } from "react";

/** KPI card row: auto-fit minmax(210px) on desktop. Below sm, 210px doesn't fit
 * one column on a phone, so xs/sm use an explicit column count instead of auto-fit. */
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
