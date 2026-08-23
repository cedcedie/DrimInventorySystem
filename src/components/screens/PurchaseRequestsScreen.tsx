"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Box } from "@mui/material";
import { usePaginatedQuery } from "@/lib/usePaginatedQuery";
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

  const { data, dataUpdatedAt, page, setPage } = usePaginatedQuery<PurchaseRequestsData>({
    queryKey: (p) => queryKeys.purchaseRequests({ page: p }),
    url: (p) => `/api/purchase-requests?page=${p}`,
    initialData,
    live: liveWarm,
  });

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
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
        <LastUpdated dataUpdatedAt={dataUpdatedAt} />
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
              message="No purchase requests yet — file one when stock needs reordering."
              actionLabel={canCreate ? "New Purchase Request" : undefined}
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
