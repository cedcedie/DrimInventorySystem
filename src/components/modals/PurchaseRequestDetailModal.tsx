"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Box, ButtonBase, Typography, Alert, MenuItem, Select } from "@mui/material";
import { EntityModal } from "@/components/EntityModal";
import { StatusChip } from "@/components/StatusChip";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, ACCENT_HOVER, motion } from "@/theme/tokens";
import { fetchJson } from "@/lib/api";
import { postJson, deleteJson } from "@/lib/mutate";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { useCan } from "@/components/PermissionsProvider";
import { purchaseRequestStatusLabel } from "@/lib/purchaseRequestLifecycle";
import type { PurchaseRequestDetail } from "@/lib/data/purchaseRequests";
import type { StockFormOptions } from "@/lib/data/stock";

export function PurchaseRequestDetailModal({
  prId,
  open,
  onClose,
}: {
  prId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const canCreate = useCan("purchaseRequests", "canCreate");
  const { data: session } = useSession();
  const isOwnerOrAdmin = session?.user?.role === "OWNER" || session?.user?.role === "ADMIN";
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [decisionMode, setDecisionMode] = useState<"approve" | "reject" | null>(null);
  const [decisionSupplierId, setDecisionSupplierId] = useState("");
  const [decisionNote, setDecisionNote] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["purchase-request-detail", prId],
    queryFn: () => fetchJson<PurchaseRequestDetail>(`/api/purchase-requests/${prId}`),
    enabled: open && Boolean(prId),
  });

  const { data: options } = useQuery({
    queryKey: ["stock-options"],
    queryFn: () => fetchJson<StockFormOptions>("/api/stock/options"),
    enabled: open && decisionMode === "approve",
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
    queryClient.invalidateQueries({ queryKey: ["purchase-request-detail", prId] });
    queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    queryClient.invalidateQueries({ queryKey: ["activity"] });
  };

  const cancelMutation = useMutation({
    mutationFn: () => deleteJson<{ status: string }>(`/api/purchase-requests/${prId}`),
    onSuccess: () => {
      invalidateAll();
      showToast("Purchase Request cancelled.");
      setConfirmCancel(false);
      onClose();
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const decideMutation = useMutation({
    mutationFn: () =>
      postJson<{ status: string; purchaseOrder: { refNo: string } | null }>(
        `/api/purchase-requests/${prId}/decide`,
        decisionMode === "approve"
          ? { decision: "approve", supplierId: decisionSupplierId || undefined, note: decisionNote.trim() || undefined }
          : { decision: "reject", note: decisionNote.trim() }
      ),
    onSuccess: (result) => {
      invalidateAll();
      showToast(
        result.purchaseOrder
          ? `Approved — converted to Purchase Order ${result.purchaseOrder.refNo}.`
          : "Purchase Request rejected."
      );
      setDecisionMode(null);
      setDecisionNote("");
      setDecisionSupplierId("");
      onClose();
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const statusLabel = data ? purchaseRequestStatusLabel(data.status) : "";
  const canCancel = data && data.status === "PENDING" && (canCreate || isOwnerOrAdmin);
  const canDecide = data && data.status === "PENDING" && isOwnerOrAdmin;
  const needsSupplierToApprove = !data?.supplier;

  const startDecision = (mode: "approve" | "reject") => {
    setDecisionMode(mode);
    setDecisionSupplierId(data?.supplier?.id ?? "");
    setDecisionNote("");
  };

  return (
    <EntityModal
      open={open}
      onClose={onClose}
      title={data ? `Request ${data.refNo}` : "Purchase Request"}
      width={660}
    >
      <Box sx={{ p: 2.25 }}>
        {isLoading && <Typography sx={{ fontSize: 13, color: t.muted }}>Loading request details…</Typography>}
        {error && (
          <Alert severity="error">{error instanceof Error ? error.message : "Failed to load request"}</Alert>
        )}
        {data && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
              <Meta label="Status" value={<StatusChip label={statusLabel} />} />
              <Meta label="Filed" value={formatDate(new Date(data.createdAt))} />
              <Meta label="Supplier" value={data.supplier?.name ?? "Not specified"} />
              <Meta label="Requested by" value={data.byUser.name} />
              {data.decidedBy && (
                <Meta
                  label={data.status === "APPROVED" ? "Approved by" : "Rejected by"}
                  value={`${data.decidedBy}${data.decidedAt ? ` · ${formatDate(new Date(data.decidedAt))}` : ""}`}
                />
              )}
              {data.purchaseOrder && <Meta label="Purchase Order" value={data.purchaseOrder.refNo} />}
            </Box>

            {data.notes && (
              <Box>
                <Label>Notes</Label>
                <Typography sx={{ fontSize: 13, color: t.text2, whiteSpace: "pre-wrap" }}>
                  {data.notes}
                </Typography>
              </Box>
            )}

            {data.decisionNote && (
              <Box>
                <Label>{data.status === "REJECTED" ? "Rejection reason" : "Decision note"}</Label>
                <Typography sx={{ fontSize: 13, color: t.text2, whiteSpace: "pre-wrap" }}>
                  {data.decisionNote}
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
                      gridTemplateColumns: "1fr 100px",
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
                    <Typography sx={{ fontSize: 12, color: t.text2 }}>
                      {item.qtyRequested} {item.unit}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {decisionMode && (
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: decisionMode === "approve" ? t.success : t.warn,
                  borderRadius: "8px",
                  p: 1.75,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.25,
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                  {decisionMode === "approve" ? "Approve and create Purchase Order" : "Reject this request"}
                </Typography>

                {decisionMode === "approve" && (
                  <Box>
                    <Label>Supplier{needsSupplierToApprove ? " (required)" : ""}</Label>
                    <Select
                      value={decisionSupplierId}
                      onChange={(e) => setDecisionSupplierId(e.target.value)}
                      size="small"
                      displayEmpty
                      fullWidth
                      sx={{ fontSize: 12.5, bgcolor: t.surface, mt: 0.5 }}
                    >
                      <MenuItem value="" sx={{ fontSize: 12.5 }}>
                        Select supplier
                      </MenuItem>
                      {options?.suppliers.map((s) => (
                        <MenuItem key={s.id} value={s.id} sx={{ fontSize: 12.5 }}>
                          {s.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </Box>
                )}

                <Box>
                  <Label>{decisionMode === "reject" ? "Reason (required)" : "Note (optional)"}</Label>
                  <Box
                    component="textarea"
                    value={decisionNote}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDecisionNote(e.target.value)}
                    maxLength={500}
                    rows={2}
                    sx={{
                      width: "100%",
                      mt: 0.5,
                      border: "1px solid",
                      borderColor: t.border,
                      borderRadius: "8px",
                      px: 1.25,
                      py: 1,
                      fontSize: 12.5,
                      fontFamily: "inherit",
                      bgcolor: t.surface,
                      color: t.text,
                      resize: "vertical",
                    }}
                  />
                </Box>

                <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                  <ButtonBase
                    onClick={() => setDecisionMode(null)}
                    disabled={decideMutation.isPending}
                    sx={{ px: 1.5, py: 0.75, fontSize: 12, fontWeight: 600, bgcolor: t.line2, color: t.text, borderRadius: "8px" }}
                  >
                    Back
                  </ButtonBase>
                  <ButtonBase
                    onClick={() => decideMutation.mutate()}
                    disabled={
                      decideMutation.isPending ||
                      (decisionMode === "reject" && !decisionNote.trim()) ||
                      (decisionMode === "approve" && !decisionSupplierId)
                    }
                    sx={{
                      px: 1.75,
                      py: 0.75,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                      bgcolor: decisionMode === "approve" ? t.success : t.warn,
                      borderRadius: "8px",
                      transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}`,
                      "&.Mui-disabled": { opacity: 0.5 },
                    }}
                  >
                    {decideMutation.isPending
                      ? "Saving…"
                      : decisionMode === "approve"
                        ? "Confirm approval"
                        : "Confirm rejection"}
                  </ButtonBase>
                </Box>
              </Box>
            )}

            {confirmCancel && canCancel && (
              <Alert severity="warning" sx={{ fontSize: 13 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.75 }}>
                  Cancel {data.refNo}? This can&apos;t be undone.
                </Typography>
                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  <ButtonBase
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    sx={{ px: 1.5, py: 0.75, fontSize: 12, fontWeight: 700, color: "#fff", bgcolor: t.warn, borderRadius: "8px" }}
                  >
                    {cancelMutation.isPending ? "Cancelling…" : "Yes, cancel"}
                  </ButtonBase>
                  <ButtonBase
                    onClick={() => setConfirmCancel(false)}
                    disabled={cancelMutation.isPending}
                    sx={{ px: 1.5, py: 0.75, fontSize: 12, fontWeight: 600, bgcolor: t.line2, color: t.text, borderRadius: "8px" }}
                  >
                    Back
                  </ButtonBase>
                </Box>
              </Alert>
            )}

            {!decisionMode && !confirmCancel && (
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, flexWrap: "wrap" }}>
                {canDecide && (
                  <>
                    <ButtonBase
                      onClick={() => startDecision("reject")}
                      sx={{
                        px: 1.75,
                        py: 1,
                        fontSize: 12,
                        fontWeight: 600,
                        color: t.warn,
                        border: "1px solid",
                        borderColor: t.warn,
                        borderRadius: "8px",
                      }}
                    >
                      Reject
                    </ButtonBase>
                    <ButtonBase
                      onClick={() => startDecision("approve")}
                      sx={{
                        px: 1.75,
                        py: 1,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#fff",
                        bgcolor: ACCENT,
                        borderRadius: "8px",
                        transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}`,
                        "&:hover": { bgcolor: ACCENT_HOVER },
                      }}
                    >
                      Approve
                    </ButtonBase>
                  </>
                )}
                {canCancel && (
                  <ButtonBase
                    onClick={() => setConfirmCancel(true)}
                    sx={{
                      px: 1.75,
                      py: 1,
                      fontSize: 12,
                      fontWeight: 600,
                      color: t.muted,
                      border: "1px solid",
                      borderColor: t.border,
                      borderRadius: "8px",
                    }}
                  >
                    Cancel request
                  </ButtonBase>
                )}
                <ButtonBase
                  onClick={onClose}
                  sx={{ px: 1.75, py: 1, fontSize: 12, fontWeight: 600, bgcolor: t.line2, color: t.text, borderRadius: "8px" }}
                >
                  Close
                </ButtonBase>
              </Box>
            )}
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
