"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, MenuItem, Select, Alert, Typography } from "@mui/material";
import { EntityModal, ModalFormActions, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { postJson } from "@/lib/mutate";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/components/Toast";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";

const REASONS = [
  { value: "MISCOUNT", label: "Miscount — physical count differs" },
  { value: "DAMAGED", label: "Damaged — unusable stock" },
  { value: "LOST", label: "Lost — missing, unexplained" },
  { value: "FOUND", label: "Found — stock not in the system" },
  { value: "RETURN", label: "Returned unused from a project" },
  { value: "CORRECTION", label: "Data correction — entry mistake" },
] as const;

export type AdjustableProduct = {
  id: string;
  name: string;
  code: string;
  unit: string;
  stocks: number;
};

export function AdjustStockModal({
  product,
  onClose,
  initialNote,
}: {
  product: AdjustableProduct | null;
  onClose: () => void;
  /** Pre-fills note and defaults reason to Correction, when opened from a specific SI/SO slip. */
  initialNote?: string;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [qtyAfter, setQtyAfter] = useState("");
  const [reason, setReason] = useState<string>("MISCOUNT");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (product) {
      setQtyAfter(String(product.stocks));
      setReason(initialNote ? "CORRECTION" : "MISCOUNT");
      setNote(initialNote ?? "");
      setError("");
    }
  }, [product, initialNote]);

  const isDirty =
    Boolean(product) &&
    (qtyAfter !== String(product!.stocks) ||
      reason !== (initialNote ? "CORRECTION" : "MISCOUNT") ||
      note !== (initialNote ?? ""));
  const confirmClose = useUnsavedChangesGuard(isDirty);

  const mutation = useMutation({
    mutationFn: () =>
      postJson<{ refNo: string; delta: number }>("/api/stock-adjustments", {
        productId: product!.id,
        qtyAfter: Number(qtyAfter),
        reason,
        note: note.trim() || undefined,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      const sign = result.delta > 0 ? "+" : "";
      showToast(`${result.refNo} recorded — ${sign}${result.delta} ${product?.unit ?? ""}`.trim());
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const next = Number(qtyAfter);
    if (!Number.isFinite(next) || next < 0) {
      setError("Enter the corrected count as a whole number.");
      return;
    }
    if (product && next === product.stocks) {
      setError("That matches the current count — nothing to adjust.");
      return;
    }
    mutation.mutate();
  };

  const delta = product && qtyAfter !== "" ? Number(qtyAfter) - product.stocks : 0;
  const deltaValid = Number.isFinite(delta) && delta !== 0;

  return (
    <EntityModal open={!!product} onClose={onClose} confirmClose={confirmClose} title="Adjust Stock" width={420}>
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2.25 }}>
        {product && (
          <Box
            sx={{
              border: "1px solid",
              borderColor: t.line,
              bgcolor: t.bg2,
              px: 1.5,
              py: 1.25,
              mb: 1.75,
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{product.name}</Typography>
            <Typography
              sx={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: t.muted }}
            >
              {product.code}
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: t.text2, mt: 0.75 }}>
              System count: <strong>{product.stocks}</strong> {product.unit}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <FormField label="Corrected Count">
            <Box
              component="input"
              type="number"
              min="0"
              value={qtyAfter}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQtyAfter(e.target.value)}
              placeholder="What you actually counted"
              sx={fieldInputSx(t)}
            />
            {deltaValid && (
              <Box
                sx={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  mt: 0.5,
                  color: delta > 0 ? t.success : t.danger,
                }}
              >
                {delta > 0 ? "+" : ""}
                {delta} {product?.unit} against the system count
              </Box>
            )}
          </FormField>

          <FormField label="Reason">
            <Select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              size="small"
              sx={{ fontSize: 12.5, bgcolor: t.surface }}
            >
              {REASONS.map((r) => (
                <MenuItem key={r.value} value={r.value} sx={{ fontSize: 12.5 }}>
                  {r.label}
                </MenuItem>
              ))}
            </Select>
          </FormField>

          <FormField label="Note (optional)">
            <Box
              component="input"
              value={note}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
              placeholder="Anything worth recording for the audit trail"
              maxLength={300}
              sx={fieldInputSx(t)}
            />
          </FormField>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions
          onCancel={onClose}
          submitLabel="Record adjustment"
          disabled={mutation.isPending}
        />
      </Box>
    </EntityModal>
  );
}
