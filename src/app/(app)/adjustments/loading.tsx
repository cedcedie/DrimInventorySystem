"use client";

import { Box } from "@mui/material";
import { TableSkeleton } from "@/components/Skeleton";

export default function AdjustmentsLoading() {
  return (
    <Box sx={{ flex: 1, p: 3 }}>
      <TableSkeleton label="Loading stock adjustments…" columns={8} rows={8} />
    </Box>
  );
}
