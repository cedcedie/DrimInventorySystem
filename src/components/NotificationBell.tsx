"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Box, ButtonBase, Typography, Popover } from "@mui/material";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import Link from "next/link";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";
import { fetchJson } from "@/lib/api";
import { patchJson } from "@/lib/mutate";
import { queryKeys } from "@/lib/queryKeys";
import { formatDateTime } from "@/lib/format";
import { liveNotifications } from "@/lib/liveQuery";
import { SendNotificationModal } from "@/components/modals/SendNotificationModal";

type NotificationsPayload = {
  unreadCount: number;
  items: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    href: string;
    refNo: string | null;
    readAt: string | null;
    createdAt: string;
    senderName: string | null;
  }>;
};

export function NotificationBell({
  buttonSx,
}: {
  buttonSx: Record<string, unknown>;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canSend = session?.user?.role === "OWNER" || session?.user?.role === "ADMIN";
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const { data } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => fetchJson<NotificationsPayload>("/api/notifications"),
    ...liveNotifications,
  });

  const markRead = useMutation({
    mutationFn: (body: { action: "markRead" | "markAllRead"; id?: string }) =>
      patchJson<{ ok: boolean }>("/api/notifications", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });

  const unread = data?.unreadCount ?? 0;
  const open = Boolean(anchor);

  return (
    <>
      <ButtonBase
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ ...buttonSx, position: "relative" }}
      >
        <NotificationsNoneOutlinedIcon sx={{ fontSize: 20 }} />
        {unread > 0 && (
          <Box
            component="span"
            sx={{
              position: "absolute",
              top: 6,
              right: 6,
              minWidth: 16,
              height: 16,
              px: 0.4,
              borderRadius: 8,
              bgcolor: ACCENT,
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              lineHeight: "16px",
              textAlign: "center",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </Box>
        )}
      </ButtonBase>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: 360,
              maxWidth: "calc(100vw - 24px)",
              border: "1px solid",
              borderColor: t.line,
              boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
            },
          },
        }}
      >
        <Box
          sx={{
            px: 1.75,
            py: 1.25,
            borderBottom: "1px solid",
            borderColor: t.line,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 800 }}>Notifications</Typography>
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1.25 }}>
            {canSend && (
              <ButtonBase
                onClick={() => {
                  setComposeOpen(true);
                  setAnchor(null);
                }}
                sx={{ fontSize: 11.5, fontWeight: 700, color: ACCENT }}
              >
                Send
              </ButtonBase>
            )}
            {unread > 0 && (
              <ButtonBase
                onClick={() => markRead.mutate({ action: "markAllRead" })}
                sx={{ fontSize: 11.5, fontWeight: 700, color: ACCENT }}
              >
                Mark all read
              </ButtonBase>
            )}
          </Box>
        </Box>

        <Box className="scroll-hidden" sx={{ maxHeight: 380, overflowY: "auto" }}>
          {(data?.items.length ?? 0) === 0 ? (
            <Typography sx={{ p: 2, fontSize: 13, color: t.muted }}>
              No notifications yet. New MRFs and releases will show up here.
            </Typography>
          ) : (
            data!.items.map((n) => (
              <Box
                key={n.id}
                component={Link}
                href={n.href}
                onClick={() => {
                  if (!n.readAt) markRead.mutate({ action: "markRead", id: n.id });
                  setAnchor(null);
                }}
                sx={{
                  display: "block",
                  px: 1.75,
                  py: 1.25,
                  textDecoration: "none",
                  color: "inherit",
                  borderBottom: "1px solid",
                  borderColor: t.line2,
                  bgcolor: n.readAt ? "transparent" : mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(255,122,0,0.06)",
                  "&:hover": { bgcolor: t.hover },
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{n.title}</Typography>
                <Typography sx={{ fontSize: 12.5, color: t.text2, mt: 0.25 }}>{n.body}</Typography>
                <Typography sx={{ fontSize: 11, color: t.muted2, mt: 0.5 }}>
                  {n.senderName && (
                    <Box component="span" sx={{ fontWeight: 600, color: ACCENT }}>
                      From {n.senderName} ·{" "}
                    </Box>
                  )}
                  {formatDateTime(new Date(n.createdAt))}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      </Popover>

      {canSend && <SendNotificationModal open={composeOpen} onClose={() => setComposeOpen(false)} />}
    </>
  );
}
