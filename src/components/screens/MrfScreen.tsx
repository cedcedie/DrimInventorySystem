"use client";

import { useState, useEffect } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import { usePaginatedQuery } from "@/lib/usePaginatedQuery";
import { queryKeys } from "@/lib/queryKeys";
import { liveHot } from "@/lib/liveQuery";
import { formatDate } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell, Pagination } from "@/components/DataTable";
import { StatusChip } from "@/components/StatusChip";
import { TableSkeleton } from "@/components/Skeleton";
import { useTheme } from "@mui/material/styles";
import { MultiItemMrfModal } from "@/components/modals/MultiItemMrfModal";
import { MrfDetailModal } from "@/components/modals/MrfDetailModal";
import type { MrfListData } from "@/lib/data/mrf";
import { mrfStatusLabel } from "@/lib/mrfLifecycle";
import { ACCENT_HOVER, motion } from "@/theme/tokens";

const COLS = "100px 100px minmax(0,1.2fr) 90px minmax(0,1.2fr) 100px";
const FILE_HIGHLIGHT_KEY = "drim-mrf-filed";

export function MrfScreen({
  technicianName,
  empNo,
  position,
}: {
  technicianName: string;
  empNo: string;
  position: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [detailMrfId, setDetailMrfId] = useState<string | null>(null);
  const [highlightRef, setHighlightRef] = useState<string | null>(null);
  const t = useTheme().palette;

  useEffect(() => {
    const filed = sessionStorage.getItem(FILE_HIGHLIGHT_KEY);
    if (filed) {
      setHighlightRef(filed);
      sessionStorage.removeItem(FILE_HIGHLIGHT_KEY);
    }
  }, []);

  const { data, setPage } = usePaginatedQuery<MrfListData>({
    queryKey: (p) => queryKeys.mrf({ page: p }),
    url: (p) => `/api/mrf?page=${p}`,
    live: liveHot,
  });

  const recent = data?.rows[0];

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
      {/* minWidth must match TableShell's minWidth={660} below, else the Status column clips instead of scrolling */}
      <Box sx={{ flex: "1.8 1 420px", minWidth: { xs: "100%", sm: 660 } }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
          <Typography sx={{ fontSize: 12, color: t.muted }}>
            Material Request Forms filed under your profile
          </Typography>
          <ButtonBase
            onClick={() => setModalOpen(true)}
            sx={{
              ml: "auto",
              border: "none",
              bgcolor: t.primary.main,
              color: "#fff",
              borderRadius: "8px",
              px: 1.625,
              py: 1,
              fontSize: 12,
              fontWeight: 600,
              transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, transform ${motion.duration.press}ms ${motion.easing.standard}`,
              "&:hover": { bgcolor: ACCENT_HOVER },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            + File MRF
          </ButtonBase>
        </Box>

        {!data ? (
          <TableSkeleton label="Loading your material requests…" columns={6} rows={4} />
        ) : (
          <TableShell minWidth={660}>
            <TableHeaderRow columns={COLS} headers={["Request # (MRF)", "Date", "Item(s)", "Requested (released)", "Project", "Status"]} />
            {data.rows.map((r) => (
              <TableRow
                key={r.id}
                columns={COLS}
                selected={highlightRef === r.mrf}
                onClick={() => setDetailMrfId(r.id)}
              >
                <TableCell label="Request # (MRF)" mono color={t.primary.main}>
                  {r.mrf}
                </TableCell>
                <TableCell label="Date" color={t.text2}>{formatDate(new Date(r.date))}</TableCell>
                <TableCell label="Item(s)">
                  {r.item}
                  {r.itemCount > 1 && (
                    <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: t.muted, fontWeight: 600 }}>
                      ({r.itemCount})
                    </Box>
                  )}
                </TableCell>
                <TableCell label="Requested (released)" bold>
                  {r.qtyFulfilled > 0 ? (
                    <Box component="span">
                      {r.qty} <Box component="span" sx={{ color: t.primary.main }}>({r.qtyFulfilled})</Box>
                    </Box>
                  ) : (
                    r.qty
                  )}
                </TableCell>
                <TableCell label="Project" color={t.text2}>{r.project}</TableCell>
                <TableCell label="Status">
                  <StatusChip label={mrfStatusLabel(r.status, r.qtyFulfilled)} />
                </TableCell>
              </TableRow>
            ))}
            {data.rows.length === 0 && (
              <Box sx={{ px: 1.75, py: 3, fontSize: 12.5, color: t.muted, textAlign: "center" }}>
                No material requests filed yet.
              </Box>
            )}
            {data.rows.length > 0 && (
              <Pagination
                info={`${data.total} request${data.total === 1 ? "" : "s"}`}
                page={data.page}
                totalPages={data.totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              />
            )}
          </TableShell>
        )}
      </Box>

      <Box
        sx={{
          flex: "1 1 250px",
          minWidth: { xs: "100%", sm: 250 },
          bgcolor: t.surface,
          border: "1px solid",
          borderColor: t.line,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <Box sx={{ px: 1.75, py: 1.25, borderBottom: "1px solid", borderColor: t.line }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>My Profile</Typography>
        </Box>
        <Box sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 1.375 }}>
          <ProfileField label="Name" value={technicianName} bold />
          <ProfileField label="Employee Number" value={empNo} mono />
          <ProfileField label="Position" value={position} />
          <ProfileField
            label="Recent Transaction"
            value={
              recent
                ? `${recent.mrf} · ${recent.item} × ${recent.qty} — ${mrfStatusLabel(
                    recent.status,
                    recent.qtyFulfilled
                  ).toLowerCase()} ${formatDate(new Date(recent.date))}`
                : "No recent activity"
            }
          />
        </Box>
      </Box>

      <MultiItemMrfModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        technicianLabel={`${technicianName} (${empNo})`}
      />
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
