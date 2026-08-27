"use client";

import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { SearchByPanel } from "@/components/SearchByPanel";
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
  const [refNo, setRefNo] = useState("");
  const [product, setProduct] = useState("");
  const [note, setNote] = useState("");
  const [user, setUser] = useState("");
  // The inputs stay instant (local state) — only the actual server fetch
  // waits for typing to pause, so it's not a full request per keystroke.
  const debouncedRefNo = useDebouncedValue(refNo, 300);
  const debouncedProduct = useDebouncedValue(product, 300);
  const debouncedNote = useDebouncedValue(note, 300);
  const debouncedUser = useDebouncedValue(user, 300);
  const hasFilter = Boolean(debouncedRefNo || debouncedProduct || debouncedNote || debouncedUser);
  const { data, page, setPage } = usePaginatedQuery<StockAdjustmentsData>({
    queryKey: (p) =>
      queryKeys.adjustments({ page: p, refNo: debouncedRefNo, product: debouncedProduct, note: debouncedNote, user: debouncedUser }),
    url: (p) =>
      `/api/stock-adjustments?page=${p}&refNo=${encodeURIComponent(debouncedRefNo)}&product=${encodeURIComponent(debouncedProduct)}&note=${encodeURIComponent(debouncedNote)}&user=${encodeURIComponent(debouncedUser)}`,
    initialData,
    live: liveCool,
  });

  // Reset to page 1 once a filter actually changes (i.e. once a new fetch
  // is about to happen) — not on every keystroke.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only page-reset on a real filter change, not every render
  }, [debouncedRefNo, debouncedProduct, debouncedNote, debouncedUser]);

  const t = useTheme().palette;

  return (
    <Box>
      <PageChrome title="Stock Adjustments" />
      <SearchByPanel
        fields={[
          { key: "refNo", label: "Adj. #", value: refNo, onChange: setRefNo },
          { key: "product", label: "Product", value: product, onChange: setProduct },
          { key: "note", label: "Note", value: note, onChange: setNote },
          { key: "user", label: "By", value: user, onChange: setUser },
        ]}
      />

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
              {hasFilter
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
