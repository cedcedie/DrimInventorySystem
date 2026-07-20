"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Box,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatDateTime } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell, Pagination } from "@/components/DataTable";
import { StatusChip } from "@/components/StatusChip";
import { TableSkeleton } from "@/components/Skeleton";
import { useTheme } from "@mui/material/styles";
import { ROLE_LABELS } from "@/lib/navConfig";
import { UserModal } from "@/components/modals/UserModal";
import type { Role, UserStatus } from "@prisma/client";
import type { UsersData } from "@/lib/data/users";

interface UserRow {
  id: string;
  name: string;
  role: Role;
  status: UserStatus;
  recentActivity: string;
}

interface HistoryRow {
  dt: string;
  action: string;
  ref: string;
}

const COLS = "minmax(0,1.1fr) 160px minmax(0,1.6fr) 90px";
const HIST_COLS = "130px minmax(0,1fr) 96px";

export function UsersScreen({ initialData }: { initialData?: UsersData }) {
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.users({ page }),
    queryFn: () => fetchJson<UsersData>(`/api/users?page=${page}`),
    initialData: page === 1 ? initialData : undefined,
    placeholderData: keepPreviousData,
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: selectedUser ? queryKeys.userHistory(selectedUser.id) : ["users", "none", "history"],
    queryFn: () => fetchJson<{ rows: HistoryRow[] }>(`/api/users/${selectedUser!.id}/history`),
    enabled: !!selectedUser,
  });

  const t = useTheme().palette;

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: t.muted }}>
          Accounts and role assignments · select a user to view their full activity history
        </Typography>
        <ButtonBase
          onClick={() => setAddUserOpen(true)}
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
          + Add User
        </ButtonBase>
      </Box>

      {!data ? (
        <TableSkeleton label="Loading user accounts…" columns={4} rows={6} />
      ) : (
        <TableShell minWidth={600} dimmed={isFetching}>
          <TableHeaderRow columns={COLS} headers={["Name", "Role", "Recent Activity", "Status"]} />
          {data.rows.map((r) => (
            <TableRow key={r.id} columns={COLS} onClick={() => setSelectedUser(r)}>
              <TableCell bold>{r.name}</TableCell>
              <TableCell color={t.text2}>{ROLE_LABELS[r.role]}</TableCell>
              <TableCell color={t.muted} sx={{ whiteSpace: "normal" }}>
                {r.recentActivity}
              </TableCell>
              <TableCell>
                <StatusChip label={r.status === "ACTIVE" ? "Active" : "Inactive"} />
              </TableCell>
            </TableRow>
          ))}
          {data.rows.length === 0 && (
            <Box sx={{ px: 1.75, py: 3, fontSize: 12.5, color: t.muted, textAlign: "center" }}>
              No user accounts yet.
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
      )}

      <Dialog
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        maxWidth={false}
        aria-labelledby="user-history-modal-title"
        slotProps={{ paper: { sx: { width: 660, maxWidth: "92vw", bgcolor: t.surface } } }}
      >
        <DialogTitle
          id="user-history-modal-title"
          sx={{
            display: "flex",
            alignItems: "center",
            fontSize: "14.5px",
            fontWeight: 700,
            py: 1.75,
            px: 2.25,
            borderBottom: "1px solid",
            borderColor: t.line,
          }}
        >
          Activity History — {selectedUser?.name}
          <IconButton
            aria-label="Close dialog"
            onClick={() => setSelectedUser(null)}
            size="small"
            sx={{ ml: "auto", color: t.muted2 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <Box sx={{ pb: 0.75 }}>
          <TableHeaderRow columns={HIST_COLS} headers={["Date & Time", "Action", "Reference"]} />
          {historyLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              {historyData?.rows.map((h, i) => (
                <TableRow key={i} columns={HIST_COLS}>
                  <TableCell color={t.text2}>{formatDateTime(new Date(h.dt))}</TableCell>
                  <TableCell sx={{ whiteSpace: "normal" }}>{h.action}</TableCell>
                  <TableCell mono>{h.ref}</TableCell>
                </TableRow>
              ))}
              {historyData?.rows.length === 0 && (
                <Box sx={{ px: 2.25, py: 2.5, fontSize: 12.5, color: t.muted }}>
                  No recorded activity for this user yet.
                </Box>
              )}
            </>
          )}
        </Box>
      </Dialog>

      <UserModal open={addUserOpen} onClose={() => setAddUserOpen(false)} />
    </Box>
  );
}
