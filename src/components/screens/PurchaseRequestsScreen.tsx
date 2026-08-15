"use client";

import { useState } from "react";
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
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const canCreate = useCan("purchaseRequests", "canCreate");
  const t = useTheme().palette;

  const { data, isFetching, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.purchaseRequests({ page }),
    queryFn: () => fetchJson<PurchaseRequestsData>(`/api/purchase-requests?page=${page}`),
    initialData: page === 1 ? initialData : undefined,
    placeholderData: keepPreviousData,
    ...liveWarm,
  });

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
        <TableShell minWidth={780} dimmed={isFetching}>
          <TableHeaderRow
            columns={COLS}
            headers={["Request #", "Filed", "Supplier", "Requested by", "Items", "Status", "PO / Notes"]}
          />
          {data.rows.map((r) => (
            <TableRow key={r.id} columns={COLS} onClick={() => setDetailId(r.id)}>
              <TableCell mono color={t.primary.main}>
                {r.refNo}
              </TableCell>
              <TableCell color={t.text2}>{formatDate(new Date(r.createdAt))}</TableCell>
              <TableCell color={t.text2}>{r.supplier ?? "Not specified"}</TableCell>
              <TableCell>{r.byUser}</TableCell>
              <TableCell bold>{r.itemCount}</TableCell>
              <TableCell>
                <StatusChip label={purchaseRequestStatusLabel(r.status)} />
              </TableCell>
              <TableCell mono color={t.text2}>
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
