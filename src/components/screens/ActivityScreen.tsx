"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Box, Typography } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { liveCool } from "@/lib/liveQuery";
import { formatDateTime } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell, Pagination } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { EntityModal } from "@/components/EntityModal";
import { useTheme, type Palette } from "@mui/material/styles";
import { ROLE_LABELS } from "@/lib/navConfig";
import type { ActivityData } from "@/lib/data/activity";

const COLS = "130px minmax(0,1fr) 140px minmax(0,2fr) 96px";

type ActivityRow = ActivityData["rows"][number];

export function ActivityScreen({ initialData }: { initialData?: ActivityData }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ActivityRow | null>(null);
  const { data, isFetching } = useQuery({
    queryKey: queryKeys.activity({ page }),
    queryFn: () => fetchJson<ActivityData>(`/api/activity?page=${page}`),
    initialData: page === 1 ? initialData : undefined,
    placeholderData: keepPreviousData,
    ...liveCool,
  });
  const t = useTheme().palette;

  if (!data) {
    return <TableSkeleton label="Loading activity log…" columns={5} rows={9} />;
  }

  return (
    <>
      <TableShell minWidth={680} dimmed={isFetching}>
        <TableHeaderRow
          columns={COLS}
          headers={["Date & Time", "User", "Role", "Action", "Reference"]}
        />
        {data.rows.map((a) => (
          <TableRow key={a.id} columns={COLS} onClick={() => setSelected(a)}>
            <TableCell color={t.text2}>{formatDateTime(new Date(a.dt))}</TableCell>
            <TableCell bold>{a.user}</TableCell>
            <TableCell color={t.muted}>{ROLE_LABELS[a.role]}</TableCell>
            <TableCell sx={{ whiteSpace: "normal" }}>{a.action}</TableCell>
            <TableCell mono color={t.primary.main}>
              {a.ref}
            </TableCell>
          </TableRow>
        ))}
        {data.rows.length === 0 && (
          <Box sx={{ px: 1.75, py: 3, fontSize: 12.5, color: t.muted, textAlign: "center" }}>
            No activity recorded yet.
          </Box>
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

      <EntityModal open={!!selected} onClose={() => setSelected(null)} title="Activity Details" width={420}>
        {selected && (
          <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <DetailRow label="Date & Time" value={formatDateTime(new Date(selected.dt))} t={t} />
            <DetailRow label="User" value={`${selected.user} (${ROLE_LABELS[selected.role]})`} t={t} />
            <DetailRow label="Reference" value={selected.ref} t={t} mono />
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
                Action
              </Typography>
              <Typography sx={{ fontSize: 13, color: t.text.primary, whiteSpace: "pre-wrap" }}>
                {selected.action}
              </Typography>
            </Box>
          </Box>
        )}
      </EntityModal>
    </>
  );
}

function DetailRow({
  label,
  value,
  t,
  mono,
}: {
  label: string;
  value: string;
  t: Palette;
  mono?: boolean;
}) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          color: t.muted2,
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: t.text.primary, fontFamily: mono ? "monospace" : undefined }}>
        {value}
      </Typography>
    </Box>
  );
}
