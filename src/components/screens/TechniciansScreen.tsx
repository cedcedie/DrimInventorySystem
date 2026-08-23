"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, Typography, useMediaQuery } from "@mui/material";
import { usePaginatedQuery } from "@/lib/usePaginatedQuery";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell, RowActionButton, Pagination } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { useTheme, type Palette } from "@mui/material/styles";
import { EntityModal } from "@/components/EntityModal";
import { deleteJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { TechnicianModal, type TechnicianFormRow } from "@/components/modals/TechnicianModal";
import { MrfDetailModal } from "@/components/modals/MrfDetailModal";
import { PageChrome } from "@/components/PageChrome";
import { EmptyState } from "@/components/EmptyState";
import { useCan } from "@/components/PermissionsProvider";
import type { TechniciansData } from "@/lib/data/technicians";
import { motion } from "@/theme/tokens";

const COLS = "minmax(0,1.1fr) 110px minmax(0,1fr) minmax(0,1.4fr)";

export function TechniciansScreen({
  initialData,
}: {
  initialData?: TechniciansData;
}) {
  const { data, setPage } = usePaginatedQuery<TechniciansData>({
    queryKey: (p) => queryKeys.technicians({ page: p }),
    url: (p) => `/api/technicians?page=${p}`,
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
  const theme = useTheme();
  const t = theme.palette;
  // Same as StockScreen's Release detail panel: below `sm` a tap opens a modal instead of an inline panel.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
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
        {/* minWidth must be >= TableShell's own minWidth, else the table's overflow-x never triggers and the Actions column clips */}
        <Box sx={{ flex: "2 1 420px", minWidth: { xs: "100%", sm: canManage ? 680 : 560 } }}>
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
                onClick={() => {
                  setPickedId(r.id);
                  if (isMobile) setMobileDetailOpen(true);
                }}
                selected={picked?.id === r.id}
              >
                <TableCell label="Name" bold>{r.name}</TableCell>
                <TableCell label="Employee No." mono>{r.empNo}</TableCell>
                <TableCell label="Position" color={t.text2}>{r.position}</TableCell>
                <TableCell label="Recent Transaction" color={t.muted} sx={{ whiteSpace: "normal" }}>
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
            {data.rows.length > 0 && (
              <Pagination
                info={`${data.total} technician${data.total === 1 ? "" : "s"}`}
                page={data.page}
                totalPages={data.totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              />
            )}
          </TableShell>
        </Box>

        {/* Desktop/tablet inline side panel; below `sm` a modal replaces it (see mobileDetailOpen) */}
        <Box
          sx={{
            display: { xs: "none", sm: "block" },
            flex: "1 1 250px",
            minWidth: 250,
            bgcolor: t.surface,
            border: "1px solid",
            borderColor: t.line,
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <Box sx={{ px: 1.75, py: 1.25, borderBottom: "1px solid", borderColor: t.line }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Technician Profile</Typography>
          </Box>
          <TechnicianProfileBody picked={picked} onOpenMrf={setDetailMrfId} t={t} />
        </Box>
      </Box>

      <EntityModal
        open={isMobile && mobileDetailOpen}
        onClose={() => setMobileDetailOpen(false)}
        title={picked ? picked.name : "Technician Profile"}
        width={420}
      >
        <TechnicianProfileBody
          picked={picked}
          onOpenMrf={(id) => {
            setMobileDetailOpen(false);
            setDetailMrfId(id);
          }}
          t={t}
          padded
        />
      </EntityModal>

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

function TechnicianProfileBody({
  picked,
  onOpenMrf,
  t,
  padded,
}: {
  picked: TechniciansData["rows"][number] | undefined;
  onOpenMrf: (mrfId: string) => void;
  t: Palette;
  /** Modal body needs its own padding; the inline panel gets it from the surrounding card. */
  padded?: boolean;
}) {
  if (!picked) {
    return <Box sx={{ p: 1.75, fontSize: 12.5, color: t.muted }}>No technician selected.</Box>;
  }

  return (
    <Box sx={{ p: padded ? 2.25 : 1.75, display: "flex", flexDirection: "column", gap: 1.375 }}>
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
                onClick={() => onOpenMrf(mrf.id)}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  width: "100%",
                  px: 1,
                  py: 0.75,
                  border: "1px solid",
                  borderColor: t.line,
                  borderRadius: "8px",
                  textAlign: "left",
                  transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}`,
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
