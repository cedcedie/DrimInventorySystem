"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Typography, ButtonBase } from "@mui/material";
import { SearchByPanel } from "@/components/SearchByPanel";
import { ExportButton } from "@/components/ExportButton";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { usePaginatedQuery } from "@/lib/usePaginatedQuery";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { queryKeys } from "@/lib/queryKeys";
import { liveCool } from "@/lib/liveQuery";
import { formatDateTime } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell, Pagination } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { EntityModal } from "@/components/EntityModal";
import { useTheme, type Palette } from "@mui/material/styles";
import { ACCENT, motion } from "@/theme/tokens";
import { ROLE_LABELS } from "@/lib/navConfig";
import type { ActivityData } from "@/lib/data/activity";

const COLS = "130px minmax(0,1fr) 140px minmax(0,2fr) 96px";

type ActivityRow = ActivityData["rows"][number];

/** Only these ref prefixes have a reliable, unambiguous format — everything
 * else (product codes, usernames, raw IDs) has no shared convention, so
 * linking those risks landing on the wrong record or nowhere at all. */
function activityLinkFor(ref: string): string | null {
  if (ref.startsWith("MRF-")) return `/stock?ref=${encodeURIComponent(ref)}`;
  if (ref.startsWith("SI-")) return `/stock?tab=si&ref=${encodeURIComponent(ref)}`;
  if (ref.startsWith("SO-")) return `/stock?tab=so&ref=${encodeURIComponent(ref)}`;
  if (ref.startsWith("PO-")) return `/purchaseOrders?ref=${encodeURIComponent(ref)}`;
  if (ref.startsWith("PR-")) return `/purchaseRequests?ref=${encodeURIComponent(ref)}`;
  return null;
}

export function ActivityScreen({ initialData }: { initialData?: ActivityData }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ActivityRow | null>(null);
  const [user, setUser] = useState("");
  const [action, setAction] = useState("");
  const [ref, setRef] = useState("");
  // The inputs stay instant (local state) — only the actual server fetch
  // waits for typing to pause, so it's not a full request per keystroke.
  const debouncedUser = useDebouncedValue(user, 300);
  const debouncedAction = useDebouncedValue(action, 300);
  const debouncedRef = useDebouncedValue(ref, 300);
  const hasFilter = Boolean(debouncedUser || debouncedAction || debouncedRef);
  const { data, page, setPage } = usePaginatedQuery<ActivityData>({
    queryKey: (p) => queryKeys.activity({ page: p, user: debouncedUser, action: debouncedAction, ref: debouncedRef }),
    url: (p) =>
      `/api/activity?page=${p}&user=${encodeURIComponent(debouncedUser)}&action=${encodeURIComponent(debouncedAction)}&ref=${encodeURIComponent(debouncedRef)}`,
    initialData,
    live: liveCool,
  });

  // Reset to page 1 once a filter actually changes (i.e. once a new fetch
  // is about to happen) — not on every keystroke.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only page-reset on a real filter change, not every render
  }, [debouncedUser, debouncedAction, debouncedRef]);

  const t = useTheme().palette;

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
        <ExportButton
          buildUrl={(format) =>
            `/api/activity/export?format=${format}&user=${encodeURIComponent(debouncedUser)}&action=${encodeURIComponent(debouncedAction)}&ref=${encodeURIComponent(debouncedRef)}`
          }
        />
      </Box>
      <SearchByPanel
        fields={[
          { key: "user", label: "User", value: user, onChange: setUser },
          { key: "action", label: "Action", value: action, onChange: setAction },
          { key: "ref", label: "Reference", value: ref, onChange: setRef },
        ]}
      />

      {!data ? (
        <TableSkeleton label="Loading activity log…" columns={5} rows={9} />
      ) : (
      <TableShell minWidth={680}>
        <TableHeaderRow
          columns={COLS}
          headers={["Date & Time", "User", "Role", "Action", "Reference"]}
        />
        {data.rows.map((a) => (
          <TableRow key={a.id} columns={COLS} onClick={() => setSelected(a)}>
            <TableCell label="Date & Time" color={t.text2}>{formatDateTime(new Date(a.dt))}</TableCell>
            <TableCell label="User" bold>{a.user}</TableCell>
            <TableCell label="Role" color={t.muted}>{ROLE_LABELS[a.role]}</TableCell>
            <TableCell label="Action" sx={{ whiteSpace: "normal" }}>{a.action}</TableCell>
            <TableCell label="Reference" mono color={t.primary.main}>
              {a.ref}
            </TableCell>
          </TableRow>
        ))}
        {data.rows.length === 0 && (
          <Box sx={{ px: 1.75, py: 3, fontSize: 12.5, color: t.muted, textAlign: "center" }}>
            {hasFilter ? "No activity matches your search." : "No activity recorded yet."}
          </Box>
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

      <EntityModal open={!!selected} onClose={() => setSelected(null)} title="Activity Details" width={420}>
        {selected && (
          <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <DetailRow label="Date & Time" value={formatDateTime(new Date(selected.dt))} t={t} />
            <DetailRow label="User" value={`${selected.user} (${ROLE_LABELS[selected.role]})`} t={t} />
            <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 1 }}>
              <DetailRow label="Reference" value={selected.ref} t={t} mono />
              {activityLinkFor(selected.ref) && (
                <ButtonBase
                  onClick={() => router.push(activityLinkFor(selected.ref)!)}
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    fontSize: 12,
                    fontWeight: 700,
                    color: ACCENT,
                    pb: 0.25,
                    transition: `opacity ${motion.duration.color}ms ${motion.easing.standard}`,
                    "&:hover": { opacity: 0.8 },
                  }}
                >
                  Go to record <OpenInNewOutlinedIcon sx={{ fontSize: 14 }} />
                </ButtonBase>
              )}
            </Box>
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
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: t.text.primary, fontFamily: mono ? "'IBM Plex Mono', monospace" : undefined }}>
        {value}
      </Typography>
    </Box>
  );
}
