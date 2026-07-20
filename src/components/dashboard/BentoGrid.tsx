"use client";

import { Box } from "@mui/material";
import type { ReactNode } from "react";

export function BentoGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
        gap: 1.5,
      }}
    >
      {children}
    </Box>
  );
}
