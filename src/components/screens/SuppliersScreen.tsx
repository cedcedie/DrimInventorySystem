"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { useTheme } from "@mui/material/styles";
import { SupplierModal } from "@/components/modals/SupplierModal";
import { PageChrome } from "@/components/PageChrome";
import { EmptyState } from "@/components/EmptyState";
import { useCan } from "@/components/PermissionsProvider";
import type { Role } from "@prisma/client";
import type { SuppliersData } from "@/lib/data/suppliers";

const COLS = "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.3fr) 110px 90px";

export function SuppliersScreen({
  role,
  initialData,
}: {
  role: Role;
  initialData?: SuppliersData;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const canCreate = useCan("suppliers", "canCreate");
  void role;

  const { data } = useQuery({
    queryKey: queryKeys.suppliers,
    queryFn: () => fetchJson<SuppliersData>("/api/suppliers"),
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
              <TableCell bold>{r.name}</TableCell>
              <TableCell color={t.text2}>{r.contact}</TableCell>
              <TableCell color={t.muted} sx={{ whiteSpace: "normal" }}>
                {r.supplies}
              </TableCell>
              <TableCell color={t.text2}>
                {r.lastDelivery ? formatDate(new Date(r.lastDelivery)) : "—"}
              </TableCell>
              <TableCell mono>{r.deliveryCount}</TableCell>
            </TableRow>
          ))}
          {data.rows.length === 0 && (
            <EmptyState
              message="No suppliers in the registry yet."
              actionLabel={canCreate ? "Add Supplier" : undefined}
              onAction={canCreate ? () => setModalOpen(true) : undefined}
            />
          )}
        </TableShell>
      )}

      {canCreate && <SupplierModal open={modalOpen} onClose={() => setModalOpen(false)} />}
    </Box>
  );
}
