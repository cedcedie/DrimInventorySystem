"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, ButtonBase, Typography } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { useTheme } from "@mui/material/styles";
import { SupplierModal } from "@/components/modals/SupplierModal";
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
  const isOwner = role === "OWNER";

  const { data } = useQuery({
    queryKey: queryKeys.suppliers,
    queryFn: () => fetchJson<SuppliersData>("/api/suppliers"),
    initialData,
  });
  const t = useTheme().palette;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: t.muted }}>
          Accredited suppliers and their delivery history.
        </Typography>
        {isOwner && (
          <ButtonBase
            onClick={() => setModalOpen(true)}
            sx={{
              ml: "auto",
              border: "none",
              bgcolor: t.primary.main,
              color: "#fff",
              borderRadius: "2px",
              px: 1.625,
              py: 1,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            + Add Supplier
          </ButtonBase>
        )}
      </Box>

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
            <Box sx={{ px: 1.75, py: 3, fontSize: 12.5, color: t.muted, textAlign: "center" }}>
              No suppliers in the registry yet.
            </Box>
          )}
        </TableShell>
      )}

      {isOwner && <SupplierModal open={modalOpen} onClose={() => setModalOpen(false)} />}
    </Box>
  );
}
