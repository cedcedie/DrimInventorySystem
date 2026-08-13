"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, Typography } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell, RowActionButton } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { useTheme } from "@mui/material/styles";
import { deleteJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { TechnicianModal, type TechnicianFormRow } from "@/components/modals/TechnicianModal";
import { MrfDetailModal } from "@/components/modals/MrfDetailModal";
import { PageChrome } from "@/components/PageChrome";
import { EmptyState } from "@/components/EmptyState";
import { useCan } from "@/components/PermissionsProvider";
import type { Role } from "@/generated/prisma";
import type { TechniciansData } from "@/lib/data/technicians";

const COLS = "minmax(0,1.1fr) 110px minmax(0,1fr) minmax(0,1.4fr)";

export function TechniciansScreen({
  role,
  initialData,
}: {
  role: Role;
  initialData?: TechniciansData;
}) {
  const { data } = useQuery({
    queryKey: queryKeys.technicians,
    queryFn: () => fetchJson<TechniciansData>("/api/technicians"),
    initialData,
  });
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<TechnicianFormRow | null>(null);
  const [detailMrfId, setDetailMrfId] = useState<string | null>(null);
  const canCreate = useCan("technicians", "canCreate");
  const canEdit = useCan("technicians", "canEdit");
  const canDelete = useCan("technicians", "canDelete");
  const canManage = canEdit || canDelete;
  void role;
  const t = useTheme().palette;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/technicians/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast("Technician removed from roster.");
      setPickedId(null);
    },
  });

  const picked = data?.rows.find((r) => r.id === pickedId) ?? data?.rows[0];

  if (!data) {
    return <TableSkeleton label="Loading technician roster…" columns={4} rows={5} />;
  }

  return (
    <Box>
      <PageChrome
        title="Technicians"
        addLabel={canCreate ? "Add Technician" : undefined}
        onAdd={
          canCreate
            ? () => {
                setEditingTechnician(null);
                setModalOpen(true);
              }
            : undefined
        }
      />

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: "2 1 420px", minWidth: 420 }}>
          <TableShell minWidth={canManage ? 680 : 560}>
            <TableHeaderRow
              columns={canManage ? COLS + " 128px" : COLS}
              headers={[
                "Name",
                "Employee No.",
                "Position",
                "Recent Transaction",
                ...(canManage ? ["Actions"] : []),
              ]}
            />
            {data.rows.map((r) => (
              <TableRow
                key={r.id}
                columns={canManage ? COLS + " 128px" : COLS}
                onClick={() => setPickedId(r.id)}
                selected={picked?.id === r.id}
              >
                <TableCell bold>{r.name}</TableCell>
                <TableCell mono>{r.empNo}</TableCell>
                <TableCell color={t.text2}>{r.position}</TableCell>
                <TableCell color={t.muted} sx={{ whiteSpace: "normal" }}>
                  {r.recentMrfs.length > 0
                    ? r.recentMrfs.length === 1
                      ? `${r.recentMrfs[0].refNo} · ${r.recentMrfs[0].itemSummary} × ${r.recentMrfs[0].qty}`
                      : `${r.recentMrfs[0].refNo} · ${r.recentMrfs[0].itemSummary} × ${r.recentMrfs[0].qty} (+${r.recentMrfs.length - 1} more)`
                    : "No recent activity"}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.75 }}>
                      {canEdit && (
                        <RowActionButton
                          kind="edit"
                          label={`Edit ${r.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTechnician(r);
                            setModalOpen(true);
                          }}
                        />
                      )}
                      {canDelete && (
                        <RowActionButton
                          kind="delete"
                          label={`Delete ${r.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(r.id);
                          }}
                        />
                      )}
                    </Box>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {data.rows.length === 0 && (
              <EmptyState
                message="No technicians on roster yet."
                actionLabel={canCreate ? "Add Technician" : undefined}
                onAction={
                  canCreate
                    ? () => {
                        setEditingTechnician(null);
                        setModalOpen(true);
                      }
                    : undefined
                }
              />
            )}
          </TableShell>
        </Box>

        <Box sx={{ flex: "1 1 250px", minWidth: 250, bgcolor: t.surface, border: "1px solid", borderColor: t.line }}>
          <Box sx={{ px: 1.75, py: 1.25, borderBottom: "1px solid", borderColor: t.line }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Technician Profile</Typography>
          </Box>
          {picked ? (
            <Box sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 1.375 }}>
              <ProfileField label="Name" value={picked.name} bold />
              <ProfileField label="Employee Number" value={picked.empNo} mono />
              <ProfileField label="Position" value={picked.position} />
              <Box>
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.6px",
                    color: t.muted2,
                    mb: 0.5,
                  }}
                >
                  Recent Transactions
                </Typography>
                {picked.recentMrfs.length === 0 ? (
                  <Typography sx={{ fontSize: 12.5, color: t.muted }}>No recent activity</Typography>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {picked.recentMrfs.map((mrf) => (
                      <ButtonBase
                        key={mrf.id}
                        onClick={() => setDetailMrfId(mrf.id)}
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          width: "100%",
                          px: 1,
                          py: 0.75,
                          border: "1px solid",
                          borderColor: t.line,
                          borderRadius: "3px",
                          textAlign: "left",
                          "&:hover": { bgcolor: t.line2 },
                        }}
                      >
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: t.primary.main, fontFamily: "'IBM Plex Mono', monospace" }}>
                          {mrf.refNo}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: t.text2 }}>
                          {mrf.itemSummary} × {mrf.qty}
                        </Typography>
                        <Typography sx={{ fontSize: 10.5, color: t.muted2 }}>
                          {formatDate(new Date(mrf.date))}
                        </Typography>
                      </ButtonBase>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ p: 1.75, fontSize: 12.5, color: t.muted }}>No technician selected.</Box>
          )}
        </Box>
      </Box>

      {(canCreate || canEdit) && (
        <TechnicianModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          technician={editingTechnician}
        />
      )}
      <MrfDetailModal
        mrfId={detailMrfId}
        open={Boolean(detailMrfId)}
        onClose={() => setDetailMrfId(null)}
      />
    </Box>
  );
}

function ProfileField({
  label,
  value,
  bold,
  mono,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
}) {
  const t = useTheme().palette;

  return (
    <Box>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          color: t.muted2,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: bold ? 13 : 12.5,
          fontWeight: bold ? 600 : 400,
          fontFamily: mono ? "'IBM Plex Mono', monospace" : undefined,
          mt: 0.25,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
