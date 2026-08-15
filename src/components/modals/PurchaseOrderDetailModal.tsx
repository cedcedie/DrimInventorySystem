"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, Typography, Alert } from "@mui/material";
import { EntityModal } from "@/components/EntityModal";
import { StatusChip } from "@/components/StatusChip";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";
import { fetchJson } from "@/lib/api";
import { patchJson } from "@/lib/mutate";
import { formatDate, formatDateTime } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { useCan } from "@/components/PermissionsProvider";
import { purchaseOrderStatusLabel } from "@/lib/purchaseOrderLifecycle";
import type { PurchaseOrderDetail } from "@/lib/data/purchaseOrders";

export function PurchaseOrderDetailModal({
  poId,
  open,
  onClose,
}: {
  poId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const canEdit = useCan("purchaseOrders", "canEdit");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["purchase-order-detail", poId],
    queryFn: () => fetchJson<PurchaseOrderDetail>(`/api/purchase-orders/${poId}`),
    enabled: open && Boolean(poId),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      patchJson<{ status: string }>(`/api/purchase-orders/${poId}`, { status: "CANCELLED" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-order-detail", poId] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast("Purchase Order cancelled.");
      setConfirmCancel(false);
      onClose();
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const statusLabel = data ? purchaseOrderStatusLabel(data.status) : "";
  const canCancel = data && data.status !== "CANCELLED" && data.status !== "RECEIVED" && canEdit;

  return (
    <EntityModal open={open} onClose={onClose} title={data ? `Order ${data.refNo}` : "Purchase Order"} width={660}>
      <Box sx={{ p: 2.25 }}>
        {isLoading && <Typography sx={{ fontSize: 13, color: t.muted }}>Loading order details…</Typography>}
        {error && (
          <Alert severity="error">{error instanceof Error ? error.message : "Failed to load order"}</Alert>
        )}
        {data && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
              <Meta label="Status" value={<StatusChip label={statusLabel} />} />
              <Meta label="Created" value={formatDate(new Date(data.createdAt))} />
              <Meta label="Supplier" value={data.supplier.name} />
              <Meta label="Supplier Contact" value={data.supplier.contact} />
              <Meta label="Created by" value={data.byUser} />
              <Meta label="Progress" value={`${data.totalReceived} / ${data.totalOrdered} qty received`} />
            </Box>

            {data.notes && (
              <Box>
                <Label>Notes</Label>
                <Typography sx={{ fontSize: 13, color: t.text2, whiteSpace: "pre-wrap" }}>
                  {data.notes}
                </Typography>
              </Box>
            )}

            <Box>
              <Label>Line items</Label>
              <Box sx={{ border: "1px solid", borderColor: t.line, borderRadius: "8px", overflow: "hidden" }}>
                {data.items.map((item, i) => (
                  <Box
                    key={item.id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 90px 90px",
                      gap: 1,
                      px: 1.5,
                      py: 1.1,
                      alignItems: "center",
                      borderBottom: i === data.items.length - 1 ? "none" : "1px solid",
                      borderColor: t.line2,
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{item.productName}</Typography>
                      <Typography sx={{ fontSize: 11, color: t.muted2, fontFamily: "'IBM Plex Mono', monospace" }}>
                        {item.productCode}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 12, color: t.text2 }}>Ordered {item.qtyOrdered}</Typography>
                    <Typography sx={{ fontSize: 12, color: t.muted }}>Received {item.qtyReceived}</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: item.qtyRemaining > 0 ? t.warn : t.success }}>
                      {item.qtyRemaining > 0 ? `${item.qtyRemaining} left` : "Complete"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box>
              <Label>Deliveries received</Label>
              {data.deliveries.length === 0 ? (
                <Typography sx={{ fontSize: 12.5, color: t.muted }}>
                  No deliveries received against this order yet.
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  {data.deliveries.map((d) => (
                    <Box
                      key={d.id}
                      sx={{
                        display: "flex",
                        gap: 1.5,
                        flexWrap: "wrap",
                        fontSize: 12.5,
                        px: 1.25,
                        py: 0.85,
                        bgcolor: t.bg,
                        border: "1px solid",
                        borderColor: t.line2,
                        borderRadius: "8px",
                      }}
                    >
                      <Box component="span" sx={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ACCENT }}>
                        {d.refNo}
                      </Box>
                      <span>{d.qty} total qty</span>
                      <Box component="span" sx={{ color: t.muted }}>
                        {formatDateTime(new Date(d.createdAt))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 0.5 }}>
              {confirmCancel && canCancel && (
                <Alert severity="warning" sx={{ fontSize: 13 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.75 }}>
                    Cancel {data.refNo}? This can&apos;t be undone.
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                    <ButtonBase
                      onClick={() => cancelMutation.mutate()}
                      disabled={cancelMutation.isPending}
                      sx={{ px: 1.5, py: 0.75, fontSize: 12, fontWeight: 700, color: "#fff", bgcolor: t.warn }}
                    >
                      {cancelMutation.isPending ? "Cancelling…" : "Yes, cancel"}
                    </ButtonBase>
                    <ButtonBase
                      onClick={() => setConfirmCancel(false)}
                      disabled={cancelMutation.isPending}
                      sx={{ px: 1.5, py: 0.75, fontSize: 12, fontWeight: 600, bgcolor: t.line2, color: t.text }}
                    >
                      Back
                    </ButtonBase>
                  </Box>
                </Alert>
              )}
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, flexWrap: "wrap" }}>
                {canCancel && !confirmCancel && (
                  <ButtonBase
                    onClick={() => setConfirmCancel(true)}
                    sx={{
                      px: 1.75,
                      py: 1,
                      fontSize: 12,
                      fontWeight: 600,
                      color: t.warn,
                      border: "1px solid",
                      borderColor: t.warn,
                    }}
                  >
                    Cancel order
                  </ButtonBase>
                )}
                <ButtonBase
                  onClick={onClose}
                  sx={{ px: 1.75, py: 1, fontSize: 12, fontWeight: 600, bgcolor: t.line2, color: t.text }}
                >
                  Close
                </ButtonBase>
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </EntityModal>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  return (
    <Typography
      sx={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
        color: t.muted2,
        mb: 0.75,
      }}
    >
      {children}
    </Typography>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  return (
    <Box sx={{ minWidth: 120 }}>
      <Label>{label}</Label>
      {typeof value === "string" ? (
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: t.text }}>{value}</Typography>
      ) : (
        value
      )}
    </Box>
  );
}
