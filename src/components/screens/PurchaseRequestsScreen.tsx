"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Box } from "@mui/material";
import { SearchByPanel } from "@/components/SearchByPanel";
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
  const [refNo, setRefNo] = useState("");
  const [supplier, setSupplier] = useState("");
  const [item, setItem] = useState("");
  const [filedBy, setFiledBy] = useState("");
  // The inputs stay instant (local state) — only the actual server fetch
  // waits for typing to pause, so it's not a full request per keystroke.
  const debouncedRefNo = useDebouncedValue(refNo, 300);
  const debouncedSupplier = useDebouncedValue(supplier, 300);
  const debouncedItem = useDebouncedValue(item, 300);
  const debouncedFiledBy = useDebouncedValue(filedBy, 300);
  const hasFilter = Boolean(debouncedRefNo || debouncedSupplier || debouncedItem || debouncedFiledBy);

  const { data, dataUpdatedAt, page, setPage } = usePaginatedQuery<PurchaseRequestsData>({
    queryKey: (p) =>
      queryKeys.purchaseRequests({ page: p, refNo: debouncedRefNo, supplier: debouncedSupplier, item: debouncedItem, filedBy: debouncedFiledBy }),
    url: (p) =>
      `/api/purchase-requests?page=${p}&refNo=${encodeURIComponent(debouncedRefNo)}&supplier=${encodeURIComponent(debouncedSupplier)}&item=${encodeURIComponent(debouncedItem)}&filedBy=${encodeURIComponent(debouncedFiledBy)}`,
    initialData,
    live: liveWarm,
  });

  // Reset to page 1 once a filter actually changes (i.e. once a new fetch
  // is about to happen) — not on every keystroke.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only page-reset on a real filter change, not every render
  }, [debouncedRefNo, debouncedSupplier, debouncedItem, debouncedFiledBy]);

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
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 480px" }}>
          <SearchByPanel
            fields={[
              { key: "refNo", label: "Request #", value: refNo, onChange: setRefNo },
              { key: "supplier", label: "Supplier", value: supplier, onChange: setSupplier },
              { key: "item", label: "Item", value: item, onChange: setItem },
              { key: "filedBy", label: "Filed By", value: filedBy, onChange: setFiledBy },
            ]}
          />
        </Box>
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
              message={hasFilter ? "No purchase requests match your search." : "No purchase requests yet — file one when stock needs reordering."}
              actionLabel={canCreate && !hasFilter ? "New Purchase Request" : undefined}
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
              onChange={setPage}
            />
          )}
        </TableShell>
      )}

      {canCreate && <PurchaseRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />}
      <PurchaseRequestDetailModal prId={detailId} open={Boolean(detailId)} onClose={() => setDetailId(null)} />
    </Box>
  );
}
