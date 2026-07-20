"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, MenuItem, Select, Alert } from "@mui/material";
import { EntityModal, ModalFormActions, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { postJson } from "@/lib/mutate";
import { fetchJson } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { StockFormOptions } from "@/lib/data/stock";

export function StockOutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: options } = useQuery({
    queryKey: ["stock-options"],
    queryFn: () => fetchJson<StockFormOptions>("/api/stock/options"),
    enabled: open,
  });

  const [mrfId, setMrfId] = useState("");
  const [qty, setQty] = useState("");
  const [error, setError] = useState("");

  const selectedMrf = options?.pendingMrfs.find((m) => m.id === mrfId);
  const selectedProduct = options?.products.find((p) => p.id === selectedMrf?.productId);

  const mutation = useMutation({
    mutationFn: () => postJson<{ refNo: string }>("/api/stock-out", { mrfId, qty }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-out"] });
      queryClient.invalidateQueries({ queryKey: ["stock-options"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(`Stock Out ${data.refNo} released.`);
      setMrfId("");
      setQty("");
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!mrfId || !qty || Number(qty) <= 0) {
      setError("An MRF and a positive quantity are required.");
      return;
    }
    if (selectedProduct && Number(qty) > selectedProduct.stocks) {
      setError(`Only ${selectedProduct.stocks} available`);
      return;
    }
    mutation.mutate();
  };

  return (
    <EntityModal open={open} onClose={onClose} title="New Stock Out" width={560}>
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2.25 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
          <FormField label="MRF Number" span2>
            <Select
              value={mrfId}
              onChange={(e) => {
                setMrfId(e.target.value);
                setError("");
              }}
              size="small"
              displayEmpty
              sx={{ fontSize: 12.5, bgcolor: t.surface }}
            >
              <MenuItem value="" sx={{ fontSize: 12.5 }}>
                Select a pending MRF
              </MenuItem>
              {options?.pendingMrfs.map((m) => (
                <MenuItem key={m.id} value={m.id} sx={{ fontSize: 12.5 }}>
                  {m.refNo} · {m.technicianName} · {m.productName} × {m.qty}
                </MenuItem>
              ))}
            </Select>
          </FormField>
          {selectedMrf && (
            <>
              <FormField label="Technician Name">
                <Box sx={{ fontSize: 12.5, py: 1, color: t.text2 }}>{selectedMrf.technicianName}</Box>
              </FormField>
              <FormField label="Project">
                <Box sx={{ fontSize: 12.5, py: 1, color: t.text2 }}>{selectedMrf.project}</Box>
              </FormField>
              <FormField label="Item">
                <Box sx={{ fontSize: 12.5, py: 1, color: t.text2 }}>{selectedMrf.productName}</Box>
              </FormField>
            </>
          )}
          <FormField label="Quantity">
            <Box
              component="input"
              type="number"
              value={qty}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQty(e.target.value)}
              placeholder={selectedMrf ? String(selectedMrf.qty) : "0"}
              sx={fieldInputSx(t)}
            />
            {selectedProduct && (
              <Box sx={{ fontSize: 11, color: t.muted, mt: 0.5 }}>{selectedProduct.stocks} available</Box>
            )}
          </FormField>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions onCancel={onClose} submitLabel="Save Stock Out" disabled={mutation.isPending} />
      </Box>
    </EntityModal>
  );
}
