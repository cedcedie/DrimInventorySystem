"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Box, ButtonBase, Typography, Alert } from "@mui/material";
import { EntityModal } from "@/components/EntityModal";
import { StatusChip } from "@/components/StatusChip";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, motion } from "@/theme/tokens";
import { fetchJson } from "@/lib/api";
import { patchJson, postJson } from "@/lib/mutate";
import { formatDate, formatDateTime } from "@/lib/format";
import { queryKeys } from "@/lib/queryKeys";
import { liveHot } from "@/lib/liveQuery";
import { useToast } from "@/components/Toast";
import { useCan } from "@/components/PermissionsProvider";
import {
  mrfCancelButtonLabel,
  mrfCancelConfirmMessage,
  mrfCancelToast,
  mrfStatusLabel,
} from "@/lib/mrfLifecycle";

export type MrfDetail = {
  id: string;
  refNo: string;
  externalRefNo: string | null;
  project: string;
  description: string | null;
  status: "PENDING" | "PARTIAL" | "FULFILLED" | "CANCELLED";
  createdAt: string;
  technician: { name: string; empNo: string; position: string };
  totalRequested: number;
  totalFulfilled: number;
  items: Array<{
    id: string;
    productName: string;
    productCode: string;
    unit: string;
    availableStock: number;
    qtyRequested: number;
    qtyFulfilled: number;
    qtyRemaining: number;
  }>;
  releases: Array<{
    id: string;
    refNo: string;
    qty: number;
    productName: string;
    productCode: string;
    byUser: string;
    createdAt: string;
  }>;
};

export function MrfDetailModal({
  mrfId,
  open,
  onClose,
  onFulfill,
}: {
  mrfId: string | null;
  open: boolean;
  onClose: () => void;
  onFulfill?: (mrfItemId: string) => void;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const canWarehouseCancel = useCan("stock", "canEdit");
  const canTechFile = useCan("mrf", "canCreate");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmCancel(false);
      setConfirmBulk(false);
    }
  }, [open, mrfId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["mrf-detail", mrfId],
    queryFn: () => fetchJson<MrfDetail>(`/api/mrf/${mrfId}`),
    enabled: open && Boolean(mrfId),
    ...liveHot,
  });

  const invalidateMrf = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.openMrfs });
    queryClient.invalidateQueries({ queryKey: ["mrf"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    queryClient.invalidateQueries({ queryKey: ["mrf-detail", mrfId] });
    queryClient.invalidateQueries({ queryKey: ["activity"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.stockOptions });
    queryClient.invalidateQueries({ queryKey: ["stock-out"] });
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  };

  const cancelMutation = useMutation({
    mutationFn: () =>
      patchJson<{ refNo: string; anyReleased?: boolean }>(`/api/mrf/${mrfId}`, { action: "cancel" }),
    onSuccess: (res) => {
      invalidateMrf();
      showToast(mrfCancelToast(res.refNo, Boolean(res.anyReleased)));
      onClose();
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const bulkLines =
    data?.items
      .map((item) => ({
        mrfItemId: item.id,
        qty: Math.min(item.qtyRemaining, item.availableStock),
        productName: item.productName,
      }))
      .filter((l) => l.qty > 0) ?? [];

  const bulkMutation = useMutation({
    mutationFn: () =>
      postJson<{ mrfRefNo: string; refNos: string[]; count: number }>("/api/stock-out/bulk", {
        mrfId,
        items: bulkLines.map(({ mrfItemId, qty }) => ({ mrfItemId, qty })),
      }),
    onSuccess: (res) => {
      invalidateMrf();
      showToast(
        `Released ${res.count} line(s) against ${res.mrfRefNo} (${res.refNos.join(", ")}).`
      );
      setConfirmBulk(false);
      onClose();
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const anyReleased = Boolean(data && data.totalFulfilled > 0);

  const canCancel =
    data &&
    data.status !== "CANCELLED" &&
    data.status !== "FULFILLED" &&
    (canWarehouseCancel || (canTechFile && data.status === "PENDING" && !anyReleased));

  const canBulkFulfill =
    Boolean(onFulfill) &&
    data &&
    data.status !== "CANCELLED" &&
    data.status !== "FULFILLED" &&
    bulkLines.length > 0;

  const statusLabel = data ? mrfStatusLabel(data.status, data.totalFulfilled) : "Pending";

  return (
    <EntityModal
      open={open}
      onClose={onClose}
      title={data ? `Request ${data.refNo}` : "Material Request"}
      width={660}
    >
      <Box sx={{ p: 2.25 }}>
        {isLoading && (
          <Typography sx={{ fontSize: 13, color: t.muted }}>Loading request details…</Typography>
        )}
        {error && (
          <Alert severity="error">{error instanceof Error ? error.message : "Failed to load MRF"}</Alert>
        )}
        {data && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
              <Meta label="Status" value={<StatusChip label={statusLabel} />} />
              <Meta label="Filed" value={formatDate(new Date(data.createdAt))} />
              <Meta label="Technician" value={`${data.technician.name} (${data.technician.empNo})`} />
              <Meta label="Project" value={data.project} />
              {data.externalRefNo && <Meta label="External ref" value={data.externalRefNo} mono />}
              <Meta
                label="Progress"
                value={`${data.totalFulfilled} / ${data.totalRequested} qty released`}
              />
            </Box>

            {data.description && (
              <Box>
                <Label>Notes</Label>
                <Typography sx={{ fontSize: 13, color: t.text2, whiteSpace: "pre-wrap" }}>
                  {data.description}
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
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: 1,
                      px: 1.5,
                      py: 1.1,
                      borderBottom: i === data.items.length - 1 ? "none" : "1px solid",
                      borderColor: t.line2,
                    }}
                  >
                    <Box sx={{ flex: "1 1 160px", minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.productName}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: t.muted2, fontFamily: "'IBM Plex Mono', monospace" }}>
                        {item.productCode}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, ml: { xs: 0, sm: "auto" } }}>
                      <Typography sx={{ fontSize: 12, color: t.text2, whiteSpace: "nowrap" }}>
                        Need {item.qtyRemaining}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: t.muted, whiteSpace: "nowrap" }}>
                        Done {item.qtyFulfilled}
                      </Typography>
                      {onFulfill && (
                        <Typography
                          sx={{
                            fontSize: 12,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            color: item.availableStock >= item.qtyRemaining ? t.success : t.warn,
                          }}
                        >
                          Stock {item.availableStock}
                        </Typography>
                      )}
                      {onFulfill && item.qtyRemaining > 0 && data.status !== "CANCELLED" && (
                        <ButtonBase
                          onClick={() => {
                            onClose();
                            onFulfill(item.id);
                          }}
                          sx={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: ACCENT,
                            px: 1,
                            py: 0.5,
                            border: "1px solid",
                            borderColor: ACCENT,
                            borderRadius: "8px",
                            transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, color ${motion.duration.color}ms ${motion.easing.standard}`,
                            "&:hover": { bgcolor: ACCENT, color: "#fff" },
                          }}
                        >
                          Fulfill
                        </ButtonBase>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            <Box>
              <Label>{onFulfill ? "Release slips (SO)" : "Releases"}</Label>
              {data.releases.length === 0 ? (
                <Typography sx={{ fontSize: 12.5, color: t.muted }}>No releases yet.</Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  {data.releases.map((so) => (
                    <Box
                      key={so.id}
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
                        {so.refNo}
                      </Box>
                      <span>
                        {so.qty} × {so.productName}
                      </span>
                      <Box component="span" sx={{ color: t.muted }}>
                        by {so.byUser} · {formatDateTime(new Date(so.createdAt))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 0.5 }}>
              {confirmBulk && canBulkFulfill && (
                <Alert severity="info" sx={{ fontSize: 13 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>
                    Fulfill remaining on {data.refNo}?
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: t.text2, mb: 1 }}>
                    Releases {bulkLines.length} line(s) using on-hand stock (skips lines with 0
                    available). Creates one SO slip per line.
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2, fontSize: 12.5, color: t.text2 }}>
                    {bulkLines.map((l) => (
                      <li key={l.mrfItemId}>
                        {l.productName} × {l.qty}
                      </li>
                    ))}
                  </Box>
                  <Box sx={{ display: "flex", gap: 1, mt: 1.25 }}>
                    <ButtonBase
                      onClick={() => bulkMutation.mutate()}
                      disabled={bulkMutation.isPending}
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#fff",
                        bgcolor: ACCENT,
                      }}
                    >
                      {bulkMutation.isPending ? "Releasing…" : "Yes, fulfill remaining"}
                    </ButtonBase>
                    <ButtonBase
                      onClick={() => setConfirmBulk(false)}
                      disabled={bulkMutation.isPending}
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        fontSize: 12,
                        fontWeight: 600,
                        bgcolor: t.line2,
                        color: t.text,
                      }}
                    >
                      Back
                    </ButtonBase>
                  </Box>
                </Alert>
              )}
              {confirmCancel && canCancel && (
                <Alert severity="warning" sx={{ fontSize: 13 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.75 }}>
                    {mrfCancelConfirmMessage(data.refNo, anyReleased)}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                    <ButtonBase
                      onClick={() => cancelMutation.mutate()}
                      disabled={cancelMutation.isPending}
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#fff",
                        bgcolor: t.warn,
                      }}
                    >
                      {cancelMutation.isPending
                        ? anyReleased
                          ? "Closing…"
                          : "Cancelling…"
                        : `Yes, ${mrfCancelButtonLabel(anyReleased).toLowerCase()}`}
                    </ButtonBase>
                    <ButtonBase
                      onClick={() => setConfirmCancel(false)}
                      disabled={cancelMutation.isPending}
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        fontSize: 12,
                        fontWeight: 600,
                        bgcolor: t.line2,
                        color: t.text,
                      }}
                    >
                      Back
                    </ButtonBase>
                  </Box>
                </Alert>
              )}
              <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, flexWrap: "wrap" }}>
                {canBulkFulfill && !confirmBulk && !confirmCancel && (
                  <ButtonBase
                    onClick={() => setConfirmBulk(true)}
                    disabled={bulkMutation.isPending}
                    sx={{
                      px: 1.75,
                      py: 1,
                      fontSize: 12,
                      fontWeight: 600,
                      color: ACCENT,
                      border: "1px solid",
                      borderColor: ACCENT,
                    }}
                  >
                    Fulfill remaining
                  </ButtonBase>
                )}
                {canCancel && !confirmCancel && !confirmBulk && (
                  <ButtonBase
                    onClick={() => setConfirmCancel(true)}
                    disabled={cancelMutation.isPending}
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
                    {mrfCancelButtonLabel(anyReleased)}
                  </ButtonBase>
                )}
                <ButtonBase
                  component="a"
                  href={`/api/mrf/${data.id}/pdf`}
                  target="_blank"
                  rel="noopener"
                  sx={{
                    px: 1.75,
                    py: 1,
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.text,
                    border: "1px solid",
                    borderColor: t.line,
                  }}
                >
                  Download PDF
                </ButtonBase>
                <ButtonBase
                  onClick={onClose}
                  sx={{
                    px: 1.75,
                    py: 1,
                    fontSize: 12,
                    fontWeight: 600,
                    bgcolor: t.line2,
                    color: t.text,
                  }}
                >
                  {canCancel || canBulkFulfill ? "Done" : "Close"}
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

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  return (
    <Box sx={{ minWidth: 120 }}>
      <Label>{label}</Label>
      {typeof value === "string" ? (
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            fontFamily: mono ? "monospace" : undefined,
            color: t.text,
          }}
        >
          {value}
        </Typography>
      ) : (
        value
      )}
    </Box>
  );
}
