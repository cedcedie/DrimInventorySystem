"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, Typography } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { TableShell, TableHeaderRow, TableRow, TableCell } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { useTheme } from "@mui/material/styles";
import { deleteJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { TechnicianModal, type TechnicianFormRow } from "@/components/modals/TechnicianModal";
import type { Role } from "@prisma/client";
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
  const isOwner = role === "OWNER";
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
      {isOwner && (
        <Box sx={{ display: "flex", mb: 1.5 }}>
          <ButtonBase
            onClick={() => {
              setEditingTechnician(null);
              setModalOpen(true);
            }}
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
            + Add Technician
          </ButtonBase>
        </Box>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: "2 1 420px", minWidth: 420 }}>
          <TableShell minWidth={isOwner ? 680 : 560}>
            <TableHeaderRow
              columns={isOwner ? COLS + " 128px" : COLS}
              headers={[
                "Name",
                "Employee No.",
                "Position",
                "Recent Transaction",
                ...(isOwner ? ["Actions"] : []),
              ]}
            />
            {data.rows.map((r) => (
              <TableRow
                key={r.id}
                columns={isOwner ? COLS + " 128px" : COLS}
                onClick={() => setPickedId(r.id)}
                selected={picked?.id === r.id}
              >
                <TableCell bold>{r.name}</TableCell>
                <TableCell mono>{r.empNo}</TableCell>
                <TableCell color={t.text2}>{r.position}</TableCell>
                <TableCell color={t.muted} sx={{ whiteSpace: "normal" }}>
                  {r.recent}
                </TableCell>
                {isOwner && (
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.75 }}>
                      <ButtonBase
                        aria-label={`Edit ${r.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTechnician(r);
                          setModalOpen(true);
                        }}
                        sx={{
                          border: "1px solid",
                          borderColor: t.border,
                          bgcolor: t.surface,
                          borderRadius: "2px",
                          px: 1.25,
                          py: 0.5,
                          fontSize: 11,
                          fontWeight: 600,
                          color: t.text2,
                        }}
                      >
                        Edit
                      </ButtonBase>
                      <ButtonBase
                        aria-label={`Delete ${r.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(r.id);
                        }}
                        sx={{
                          border: "1px solid",
                          borderColor: t.error.main,
                          bgcolor: t.surface,
                          borderRadius: "2px",
                          px: 1.25,
                          py: 0.5,
                          fontSize: 11,
                          fontWeight: 600,
                          color: t.error.main,
                        }}
                      >
                        Delete
                      </ButtonBase>
                    </Box>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {data.rows.length === 0 && (
              <Box sx={{ px: 1.75, py: 3, fontSize: 12.5, color: t.muted, textAlign: "center" }}>
                No technicians on roster yet.
              </Box>
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
              <ProfileField label="Recent Transaction" value={picked.recent} />
            </Box>
          ) : (
            <Box sx={{ p: 1.75, fontSize: 12.5, color: t.muted }}>No technician selected.</Box>
          )}
        </Box>
      </Box>

      {isOwner && (
        <TechnicianModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          technician={editingTechnician}
        />
      )}
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
