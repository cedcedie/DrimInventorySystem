"use client";

import { useEffect, useState } from "react";
import { Box, InputBase } from "@mui/material";
import { usePaginatedQuery } from "@/lib/usePaginatedQuery";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
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
  const [q, setQ] = useState("");
  // The input stays instant (local state) — only the actual server fetch
  // waits for typing to pause, so it's not a full request per keystroke.
  const debouncedQ = useDebouncedValue(q, 300);
  const { data, page, setPage } = usePaginatedQuery<StockAdjustmentsData>({
    queryKey: (p) => queryKeys.adjustments({ page: p, q: debouncedQ }),
    url: (p) => `/api/stock-adjustments?page=${p}&q=${encodeURIComponent(debouncedQ)}`,
    initialData,
    live: liveCool,
  });

  // Reset to page 1 once the search actually changes (i.e. once a new fetch
  // is about to happen) — not on every keystroke.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only page-reset on a real search change, not every render
  }, [debouncedQ]);

  const t = useTheme().palette;

  return (
    <Box>
      <PageChrome title="Stock Adjustments" />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          mb: 1.5,
          px: 1.5,
          py: 1.25,
          bgcolor: t.surface,
          border: "1px solid",
          borderColor: t.line,
          borderRadius: "12px",
        }}
      >
        <InputBase
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search product, adj. #, note, or who made it…"
          sx={{
            width: "100%",
            maxWidth: 360,
            border: "1px solid",
            borderColor: t.border,
            borderRadius: "8px",
            px: 1.375,
            py: 0.75,
            fontSize: 13,
            bgcolor: t.mode === "dark" ? "background.default" : "#F9FAFB",
          }}
        />
      </Box>

      {!data ? (
        <TableSkeleton label="Loading stock adjustments…" columns={8} rows={8} />
      ) : (
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
              {q
                ? "No adjustments match your search."
                : "No stock adjustments recorded yet. Use Adjust Stock on the Inventory screen when counts need correction."}
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
      )}
    </Box>
  );
}
