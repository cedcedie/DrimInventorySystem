"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Box } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { liveCool } from "@/lib/liveQuery";
import { formatDateTime } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell, Pagination } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { PageChrome } from "@/components/PageChrome";
import { useTheme } from "@mui/material/styles";
import type { StockAdjustmentsData } from "@/lib/data/adjustments";

const COLS = "100px 130px minmax(0,1.2fr) 72px 72px 72px minmax(0,1fr) 96px";

export function AdjustmentsScreen({ initialData }: { initialData?: StockAdjustmentsData }) {
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: queryKeys.adjustments({ page }),
    queryFn: () => fetchJson<StockAdjustmentsData>(`/api/stock-adjustments?page=${page}`),
    initialData: page === 1 ? initialData : undefined,
    placeholderData: keepPreviousData,
    ...liveCool,
  });
  const t = useTheme().palette;

  if (!data) {
    return <TableSkeleton label="Loading stock adjustments…" columns={8} rows={8} />;
  }

  return (
    <Box>
      <PageChrome title="Stock Adjustments" />
      <TableShell minWidth={820}>
        <TableHeaderRow
          columns={COLS}
          headers={["Adj. #", "Date", "Product", "Before", "After", "Delta", "Reason", "By"]}
        />
        {data.rows.map((row) => (
          <TableRow key={row.id} columns={COLS}>
            <TableCell label="Adj. #" mono color={t.primary.main}>
              {row.refNo}
            </TableCell>
            <TableCell label="Date" color={t.text2}>{formatDateTime(new Date(row.dt))}</TableCell>
            <TableCell label="Product">
              {row.product}
              <Box component="span" sx={{ display: "block", fontSize: 10, color: t.muted2, fontFamily: "'IBM Plex Mono', monospace" }}>
                {row.code}
              </Box>
            </TableCell>
            <TableCell label="Before">{row.qtyBefore}</TableCell>
            <TableCell label="After" bold>{row.qtyAfter}</TableCell>
            <TableCell label="Delta" bold color={row.delta >= 0 ? t.success.main : t.warning.main}>
              {row.delta >= 0 ? `+${row.delta}` : row.delta}
            </TableCell>
            <TableCell label="Reason" color={t.text2}>{row.reason}</TableCell>
            <TableCell label="By" color={t.text2}>{row.user}</TableCell>
          </TableRow>
        ))}
        {data.rows.length === 0 && (
          <Box sx={{ px: 1.75, py: 3, fontSize: 12.5, color: t.muted, textAlign: "center" }}>
            No stock adjustments recorded yet. Use Adjust Stock on the Inventory screen when counts need correction.
          </Box>
        )}
        {data.totalPages > 1 && (
          <Pagination
            info={`Showing ${data.rows.length ? (page - 1) * 15 + 1 : 0}–${
              (page - 1) * 15 + data.rows.length
            } of ${data.total} · Page ${page} of ${data.totalPages}`}
            page={page}
            totalPages={data.totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(data.totalPages, p + 1))}
          />
        )}
      </TableShell>
    </Box>
  );
}
