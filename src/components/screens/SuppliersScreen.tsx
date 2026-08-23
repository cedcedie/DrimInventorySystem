"use client";

import { useState } from "react";
import { Box } from "@mui/material";
import { usePaginatedQuery } from "@/lib/usePaginatedQuery";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell, Pagination } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { useTheme } from "@mui/material/styles";
import { SupplierModal } from "@/components/modals/SupplierModal";
import { PageChrome } from "@/components/PageChrome";
import { EmptyState } from "@/components/EmptyState";
import { useCan } from "@/components/PermissionsProvider";
import type { SuppliersData } from "@/lib/data/suppliers";

const COLS = "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.3fr) 110px 90px";

export function SuppliersScreen({
  initialData,
}: {
  initialData?: SuppliersData;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const canCreate = useCan("suppliers", "canCreate");

  const { data, setPage } = usePaginatedQuery<SuppliersData>({
    queryKey: (p) => queryKeys.suppliers({ page: p }),
    url: (p) => `/api/suppliers?page=${p}`,
    initialData,
  });
  const t = useTheme().palette;

  return (
    <Box>
      <PageChrome
        title="Suppliers"
        addLabel={canCreate ? "Add Supplier" : undefined}
        onAdd={canCreate ? () => setModalOpen(true) : undefined}
      />

      {!data ? (
        <TableSkeleton label="Loading supplier registry…" columns={5} rows={5} />
      ) : (
        <TableShell minWidth={680}>
          <TableHeaderRow
            columns={COLS}
            headers={["Supplier", "Contact", "Supplies", "Last Delivery", "Deliveries"]}
          />
          {data.rows.map((r) => (
            <TableRow key={r.id} columns={COLS}>
              <TableCell label="Supplier" bold>{r.name}</TableCell>
              <TableCell label="Contact" color={t.text2}>{r.contact}</TableCell>
              <TableCell label="Supplies" color={t.muted} sx={{ whiteSpace: "normal" }}>
                {r.supplies}
              </TableCell>
              <TableCell label="Last Delivery" color={t.text2}>
                {r.lastDelivery ? formatDate(new Date(r.lastDelivery)) : "—"}
              </TableCell>
              <TableCell label="Deliveries" mono>{r.deliveryCount}</TableCell>
            </TableRow>
          ))}
          {data.rows.length === 0 && (
            <EmptyState
              message="No suppliers in the registry yet."
              actionLabel={canCreate ? "Add Supplier" : undefined}
              onAction={canCreate ? () => setModalOpen(true) : undefined}
            />
          )}
          {data.rows.length > 0 && (
            <Pagination
              info={`${data.total} supplier${data.total === 1 ? "" : "s"}`}
              page={data.page}
              totalPages={data.totalPages}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            />
          )}
        </TableShell>
      )}

      {canCreate && <SupplierModal open={modalOpen} onClose={() => setModalOpen(false)} />}
    </Box>
  );
}
