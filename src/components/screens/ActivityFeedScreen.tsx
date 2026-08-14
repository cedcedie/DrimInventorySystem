"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { liveCool } from "@/lib/liveQuery";
import { formatDateTime } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell, Pagination } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@mui/material/styles";
import { ROLE_LABELS } from "@/lib/navConfig";
import type { ActivityFeedData } from "@/lib/data/activityFeed";

const COLS = "130px minmax(0,1fr) 140px minmax(0,2fr) 96px";

/** System-wide operational feed, every role — see ActivityFeedWidget for
 * the dashboard-embedded compact version this links out from. */
export function ActivityFeedScreen({ initialData }: { initialData?: ActivityFeedData }) {
  const [page, setPage] = useState(1);
  const { data, isFetching } = useQuery({
    queryKey: queryKeys.activityFeed({ page }),
    queryFn: () => fetchJson<ActivityFeedData>(`/api/activity-feed?page=${page}`),
    initialData: page === 1 ? initialData : undefined,
    placeholderData: keepPreviousData,
    ...liveCool,
  });
  const t = useTheme().palette;

  if (!data) {
    return <TableSkeleton label="Loading activity feed…" columns={5} rows={9} />;
  }

  return (
    <TableShell minWidth={680} dimmed={isFetching}>
      <TableHeaderRow columns={COLS} headers={["Date & Time", "User", "Role", "Action", "Reference"]} />
      {data.rows.map((a) => (
        <TableRow key={a.id} columns={COLS}>
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
        <EmptyState message="Nothing recorded yet — actions across the system will show up here." />
      )}
      {data.totalPages > 1 && (
        <Pagination
          info={`Showing ${data.rows.length ? (page - 1) * 20 + 1 : 0}–${
            (page - 1) * 20 + data.rows.length
          } of ${data.total} · Page ${page} of ${data.totalPages}`}
          page={page}
          totalPages={data.totalPages}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(data.totalPages, p + 1))}
        />
      )}
    </TableShell>
  );
}
