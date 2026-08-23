"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Box } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { liveWarm } from "@/lib/liveQuery";
import { formatDate } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell, Pagination } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { StatusChip } from "@/components/StatusChip";
import { useTheme } from "@mui/material/styles";
import { PurchaseOrderModal } from "@/components/modals/PurchaseOrderModal";
import { PurchaseOrderDetailModal } from "@/components/modals/PurchaseOrderDetailModal";
import { PageChrome } from "@/components/PageChrome";
import { EmptyState } from "@/components/EmptyState";
import { LastUpdated } from "@/components/LastUpdated";
import { useCan } from "@/components/PermissionsProvider";
import { purchaseOrderStatusLabel } from "@/lib/purchaseOrderLifecycle";
import type { PurchaseOrdersData } from "@/lib/data/purchaseOrders";

const COLS = "106px 96px minmax(0,1fr) 76px 100px 90px 100px";

export function PurchaseOrdersScreen({ initialData }: { initialData?: PurchaseOrdersData }) {
  return (
    <Suspense fallback={<TableSkeleton label="Loading purchase orders…" columns={7} rows={6} />}>
      <PurchaseOrdersScreenInner initialData={initialData} />
    </Suspense>
  );
}

function PurchaseOrdersScreenInner({ initialData }: { initialData?: PurchaseOrdersData }) {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const canCreate = useCan("purchaseOrders", "canCreate");
  const t = useTheme().palette;

  const { data, isFetching, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.purchaseOrders({ page }),
    queryFn: () => fetchJson<PurchaseOrdersData>(`/api/purchase-orders?page=${page}`),
    initialData: page === 1 ? initialData : undefined,
    placeholderData: keepPreviousData,
    ...liveWarm,
  });

  // Deep link from Activity Log: "?ref=PO-0123" opens that order's detail
  // once page 1 loads and contains it (older orders on later pages won't match).
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref || !data) return;
    const match = data.rows.find((r) => r.refNo === ref);
    if (match) setDetailId(match.id);
  }, [searchParams, data]);

  return (
    <Box>
      <PageChrome
        title="Purchase Orders"
        addLabel={canCreate ? "New Purchase Order" : undefined}
        onAdd={canCreate ? () => setModalOpen(true) : undefined}
      />
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
        <LastUpdated dataUpdatedAt={dataUpdatedAt} />
      </Box>

      {!data ? (
        <TableSkeleton label="Loading purchase orders…" columns={7} rows={6} />
      ) : (
        <TableShell minWidth={780} dimmed={isFetching}>
          <TableHeaderRow
            columns={COLS}
            headers={["Order #", "Date", "Supplier", "Items", "Ordered", "Received", "Status"]}
          />
          {data.rows.map((r) => (
            <TableRow key={r.id} columns={COLS} onClick={() => setDetailId(r.id)}>
              <TableCell label="Order #" mono color={t.primary.main}>
                {r.refNo}
              </TableCell>
              <TableCell label="Date" color={t.text2}>{formatDate(new Date(r.createdAt))}</TableCell>
              <TableCell label="Supplier">{r.supplier}</TableCell>
              <TableCell label="Items">{r.itemCount}</TableCell>
              <TableCell label="Ordered" bold>{r.totalOrdered}</TableCell>
              <TableCell label="Received" color={r.totalReceived >= r.totalOrdered ? t.success.main : t.text2}>
                {r.totalReceived}
              </TableCell>
              <TableCell label="Status">
                <StatusChip label={purchaseOrderStatusLabel(r.status)} />
              </TableCell>
            </TableRow>
          ))}
          {data.rows.length === 0 && (
            <EmptyState
              message="No purchase orders yet — create one to track what's on order."
              actionLabel={canCreate ? "New Purchase Order" : undefined}
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

      {canCreate && <PurchaseOrderModal open={modalOpen} onClose={() => setModalOpen(false)} />}
      <PurchaseOrderDetailModal poId={detailId} open={Boolean(detailId)} onClose={() => setDetailId(null)} />
    </Box>
  );
}
