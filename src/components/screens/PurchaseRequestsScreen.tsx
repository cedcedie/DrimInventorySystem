"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Box, InputBase } from "@mui/material";
import { usePaginatedQuery } from "@/lib/usePaginatedQuery";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { queryKeys } from "@/lib/queryKeys";
import { liveWarm } from "@/lib/liveQuery";
import { formatDate } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell, Pagination } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { StatusChip } from "@/components/StatusChip";
import { useTheme } from "@mui/material/styles";
import { PurchaseRequestModal } from "@/components/modals/PurchaseRequestModal";
import { PurchaseRequestDetailModal } from "@/components/modals/PurchaseRequestDetailModal";
import { PageChrome } from "@/components/PageChrome";
import { EmptyState } from "@/components/EmptyState";
import { LastUpdated } from "@/components/LastUpdated";
import { useCan } from "@/components/PermissionsProvider";
import { purchaseRequestStatusLabel } from "@/lib/purchaseRequestLifecycle";
import type { PurchaseRequestsData } from "@/lib/data/purchaseRequests";

const COLS = "106px 96px minmax(0,1fr) minmax(0,1fr) 76px 100px 100px";

export function PurchaseRequestsScreen({ initialData }: { initialData?: PurchaseRequestsData }) {
  return (
    <Suspense fallback={<TableSkeleton label="Loading purchase requests…" columns={7} rows={6} />}>
      <PurchaseRequestsScreenInner initialData={initialData} />
    </Suspense>
  );
}

function PurchaseRequestsScreenInner({ initialData }: { initialData?: PurchaseRequestsData }) {
  const searchParams = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const canCreate = useCan("purchaseRequests", "canCreate");
  const t = useTheme().palette;
  const [q, setQ] = useState("");
  // The input stays instant (local state) — only the actual server fetch
  // waits for typing to pause, so it's not a full request per keystroke.
  const debouncedQ = useDebouncedValue(q, 300);

  const { data, dataUpdatedAt, page, setPage } = usePaginatedQuery<PurchaseRequestsData>({
    queryKey: (p) => queryKeys.purchaseRequests({ page: p, q: debouncedQ }),
    url: (p) => `/api/purchase-requests?page=${p}&q=${encodeURIComponent(debouncedQ)}`,
    initialData,
    live: liveWarm,
  });

  // Reset to page 1 once the search actually changes (i.e. once a new fetch
  // is about to happen) — not on every keystroke.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only page-reset on a real search change, not every render
  }, [debouncedQ]);

  // Deep link from Activity Log: "?ref=PR-0123" opens that request's detail
  // once page 1 loads and contains it (older requests on later pages won't match).
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref || !data) return;
    const match = data.rows.find((r) => r.refNo === ref);
    if (match) setDetailId(match.id);
  }, [searchParams, data]);

  return (
    <Box>
      <PageChrome
        title="Purchase Requests"
        addLabel={canCreate ? "New Purchase Request" : undefined}
        onAdd={canCreate ? () => setModalOpen(true) : undefined}
      />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
        <InputBase
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search request #, supplier, item, or who filed it…"
          sx={{
            flex: "1 1 260px",
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
        <Box sx={{ ml: "auto" }}>
          <LastUpdated dataUpdatedAt={dataUpdatedAt} />
        </Box>
      </Box>

      {!data ? (
        <TableSkeleton label="Loading purchase requests…" columns={7} rows={6} />
      ) : (
        <TableShell minWidth={780}>
          <TableHeaderRow
            columns={COLS}
            headers={["Request #", "Filed", "Supplier", "Requested by", "Items", "Status", "PO / Notes"]}
          />
          {data.rows.map((r) => (
            <TableRow key={r.id} columns={COLS} onClick={() => setDetailId(r.id)}>
              <TableCell label="Request #" mono color={t.primary.main}>
                {r.refNo}
              </TableCell>
              <TableCell label="Filed" color={t.text2}>{formatDate(new Date(r.createdAt))}</TableCell>
              <TableCell label="Supplier" color={t.text2}>{r.supplier ?? "Not specified"}</TableCell>
              <TableCell label="Requested by">{r.byUser}</TableCell>
              <TableCell label="Items" bold>{r.itemCount}</TableCell>
              <TableCell label="Status">
                <StatusChip label={purchaseRequestStatusLabel(r.status)} />
              </TableCell>
              <TableCell label="PO / Notes" mono color={t.text2}>
                {r.purchaseOrderRefNo ?? "—"}
              </TableCell>
            </TableRow>
          ))}
          {data.rows.length === 0 && (
            <EmptyState
              message={q ? "No purchase requests match your search." : "No purchase requests yet — file one when stock needs reordering."}
              actionLabel={canCreate && !q ? "New Purchase Request" : undefined}
              onAction={canCreate ? () => setModalOpen(true) : undefined}
            />
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

      {canCreate && <PurchaseRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />}
      <PurchaseRequestDetailModal prId={detailId} open={Boolean(detailId)} onClose={() => setDetailId(null)} />
    </Box>
  );
}
