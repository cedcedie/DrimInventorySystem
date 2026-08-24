"use client";

import NextLink from "next/link";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { formatDateTime } from "@/lib/format";
import { TableShell } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { UserAvatar } from "@/components/UserAvatar";
import { ROLE_LABELS } from "@/lib/navConfig";
import type { Role } from "@/generated/prisma";

export interface ActivityFeedRow {
  id: string;
  dt: string;
  user: string;
  role: Role;
  avatarKey: string | null;
  action: string;
  ref: string;
}

/** Compact preview of the shared Activity Log. Sensitive entries (account/permission/
 * company-config changes) are excluded server-side for non-Owner/Admin viewers. */
export function ActivityFeedWidget({ rows }: { rows: ActivityFeedRow[] }) {
  const t = useTheme().palette;

  return (
    <TableShell>
      <Box
        sx={{
          px: 1.75,
          py: 1.375,
          borderBottom: "1px solid",
          borderColor: t.line,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Activity Feed</Typography>
        <Typography sx={{ fontSize: 11, color: t.muted2 }}>What&apos;s happening across DRIM</Typography>
        <Box
          component={NextLink}
          href="/activity"
          sx={{ ml: "auto", fontSize: 11.5, fontWeight: 600, color: t.primary.main, textDecoration: "none" }}
        >
          View all
        </Box>
      </Box>

      {rows.length === 0 ? (
        <EmptyState message="Nothing recorded yet — actions across the system will show up here." />
      ) : (
        <Box className="scroll-hidden" sx={{ maxHeight: 320, overflowY: "auto" }}>
          {rows.map((row, i) => (
            <Box
              key={row.id}
              sx={{
                px: 1.75,
                py: 1.1,
                borderBottom: i === rows.length - 1 ? "none" : "1px solid",
                borderColor: t.line2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.875 }}>
                <UserAvatar avatarKey={row.avatarKey} name={row.user} size={22} />
                <Typography sx={{ fontSize: 12.5, whiteSpace: "normal" }}>
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {row.user}
                  </Box>
                  <Box component="span" sx={{ color: t.muted, mx: 0.5 }}>
                    ({ROLE_LABELS[row.role]})
                  </Box>
                  {row.action}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 1, mt: 0.375, alignItems: "center" }}>
                <Typography sx={{ fontSize: 11, fontFamily: "monospace", color: t.primary.main }}>
                  {row.ref}
                </Typography>
                <Typography sx={{ fontSize: 10.5, color: t.muted2 }}>
                  {formatDateTime(new Date(row.dt))}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </TableShell>
  );
}
