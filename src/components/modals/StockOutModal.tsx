"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, MenuItem, Select, Alert } from "@mui/material";
import { EntityModal, ModalFormActions, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";
import { postJson } from "@/lib/mutate";
import { fetchJson } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { queryKeys } from "@/lib/queryKeys";
import { liveHot } from "@/lib/liveQuery";
import type { StockFormOptions } from "@/lib/data/stock";

export function StockOutModal({
  open,
  onClose,
  initialMrfItemId,
}: {
  open: boolean;
  onClose: () => void;
  initialMrfItemId?: string;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: options } = useQuery({
    queryKey: queryKeys.stockOptions,
    queryFn: () => fetchJson<StockFormOptions>("/api/stock/options"),
    enabled: open,
    ...liveHot,
  });

  const [mrfItemId, setMrfItemId] = useState("");
  const [qty, setQty] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setMrfItemId("");
      setQty("");
      setError("");
      return;
    }
    if (initialMrfItemId) {
      setMrfItemId(initialMrfItemId);
    }
  }, [open, initialMrfItemId]);

  const selectedMrfItem = options?.pendingMrfItems.find((m) => m.id === mrfItemId);

  // No auto-fill to full remaining qty — prevents releasing everything via a stray Enter.
  const qtyNum = Number(qty);
  const maxQty = selectedMrfItem
    ? Math.min(selectedMrfItem.qtyRemaining, selectedMrfItem.availableStock)
    : undefined;
  const qtyExceedsMax = Boolean(qty && selectedMrfItem && qtyNum > maxQty!);

  const mutation = useMutation({
    mutationFn: () => postJson<{ refNo: string }>("/api/stock-out", { mrfItemId, qty }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-out"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.stockOptions });
      queryClient.invalidateQueries({ queryKey: queryKeys.openMrfs });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["mrf"] });
      const mrfRef = selectedMrfItem?.mrfRefNo;
      showToast(
        mrfRef
          ? `Release slip ${data.refNo} recorded against request ${mrfRef}.`
          : `Release slip ${data.refNo} recorded.`
      );
      setMrfItemId("");
      setQty("");
      onClose();
    },
    onError: (e: Error) => {
      // A same-item race (another worker fulfilled this line first) rejects the
      // transaction with stale numbers on screen — refetch to show current state.
      queryClient.invalidateQueries({ queryKey: queryKeys.stockOptions });
      queryClient.invalidateQueries({ queryKey: queryKeys.openMrfs });
      setError(`${e.message} — numbers below have been refreshed to reflect the current state.`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!mrfItemId || !qty || Number(qty) <= 0) {
      setError("Select an MRF line item and enter a positive quantity.");
      return;
    }
    if (selectedMrfItem) {
      if (Number(qty) > selectedMrfItem.qtyRemaining) {
        setError(`Only ${selectedMrfItem.qtyRemaining} remaining to fulfill for this item`);
        return;
      }
      if (Number(qty) > selectedMrfItem.availableStock) {
        setError(`Only ${selectedMrfItem.availableStock} available in stock`);
        return;
      }
    }
    mutation.mutate();
  };

  return (
    <EntityModal open={open} onClose={onClose} title="Fulfill MRF — Stock Out" width={560}>
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2.25 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          <FormField label="MRF line item" span2>
            <Select
              value={mrfItemId}
              onChange={(e) => {
                setMrfItemId(e.target.value);
                setQty("");
                setError("");
              }}
              size="small"
              displayEmpty
              sx={{ fontSize: 12.5, bgcolor: t.surface }}
            >
              <MenuItem value="" sx={{ fontSize: 12.5 }}>
                Select a pending MRF item
              </MenuItem>
              {options?.pendingMrfItems.map((item) => (
                <MenuItem key={item.id} value={item.id} sx={{ fontSize: 12.5 }}>
                  {item.mrfRefNo} · {item.productName} · need {item.qtyRemaining} {item.unit}
                </MenuItem>
              ))}
            </Select>
          </FormField>
          {selectedMrfItem && (
            <>
              <FormField label="Request # (MRF)">
                <Box sx={{ fontSize: 12.5, py: 1, color: ACCENT, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
                  {selectedMrfItem.mrfRefNo}
                </Box>
              </FormField>
              <FormField label="Technician">
                <Box sx={{ fontSize: 12.5, py: 1, color: t.text2 }}>{selectedMrfItem.technicianName}</Box>
              </FormField>
              <FormField label="Project">
                <Box sx={{ fontSize: 12.5, py: 1, color: t.text2 }}>{selectedMrfItem.project}</Box>
              </FormField>
              <FormField label="Item">
                <Box sx={{ fontSize: 12.5, py: 1, color: t.text, fontWeight: 600 }}>
                  {selectedMrfItem.productName}
                </Box>
              </FormField>
              <FormField label="Requested">
                <Box sx={{ fontSize: 12.5, py: 1, color: t.text2 }}>
                  {selectedMrfItem.qtyRequested} {selectedMrfItem.unit}
                </Box>
              </FormField>
              <FormField label="Already released">
                <Box
                  sx={{
                    fontSize: 12.5,
                    py: 1,
                    color: selectedMrfItem.qtyFulfilled > 0 ? ACCENT : t.text2,
                    fontWeight: selectedMrfItem.qtyFulfilled > 0 ? 600 : 400,
                  }}
                >
                  {selectedMrfItem.qtyFulfilled} {selectedMrfItem.unit}
                </Box>
              </FormField>
              <FormField label="Remaining">
                <Box sx={{ fontSize: 12.5, py: 1, color: t.text, fontWeight: 700 }}>
                  {selectedMrfItem.qtyRemaining} {selectedMrfItem.unit}
                </Box>
              </FormField>
              <FormField label="Available in stock">
                <Box
                  sx={{
                    fontSize: 12.5,
                    py: 1,
                    color:
                      selectedMrfItem.availableStock >= selectedMrfItem.qtyRemaining
                        ? t.success
                        : t.warn,
                    fontWeight: 600,
                  }}
                >
                  {selectedMrfItem.availableStock} {selectedMrfItem.unit}
                </Box>
              </FormField>
            </>
          )}
          <FormField label="Quantity to release">
            <Box
              component="input"
              type="number"
              value={qty}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQty(e.target.value)}
              placeholder="0"
              max={maxQty}
              aria-invalid={qtyExceedsMax}
              sx={{
                ...fieldInputSx(t),
                ...(qtyExceedsMax && { borderColor: t.warn, color: t.warn }),
              }}
            />
            {selectedMrfItem && (
              <Box
                component="span"
                sx={{ fontSize: 11, mt: 0.375, color: qtyExceedsMax ? t.warn : t.muted }}
              >
                {qtyExceedsMax
                  ? `Max ${maxQty} ${selectedMrfItem.unit} — limited by ${
                      selectedMrfItem.qtyRemaining <= selectedMrfItem.availableStock
                        ? "remaining request qty"
                        : "available stock"
                    }`
                  : `Max ${maxQty} ${selectedMrfItem.unit} available to release`}
              </Box>
            )}
          </FormField>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions
          onCancel={onClose}
          submitLabel="Record release (SO)"
          disabled={mutation.isPending || qtyExceedsMax}
        />
      </Box>
    </EntityModal>
  );
}
