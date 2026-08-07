"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, MenuItem, Select, Alert } from "@mui/material";
import { EntityModal, ModalFormActions, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";
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

  const [mrfItemId, setMrfItemId] = useState("");
  const [qty, setQty] = useState("");
  const [error, setError] = useState("");

  const selectedMrfItem = options?.pendingMrfItems.find((m) => m.id === mrfItemId);

  const mutation = useMutation({
    mutationFn: () => postJson<{ refNo: string }>("/api/stock-out", { mrfItemId, qty }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-out"] });
      queryClient.invalidateQueries({ queryKey: ["stock-options"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["mrf"] });
      showToast(`Stock Out ${data.refNo} released.`);
      setMrfItemId("");
      setQty("");
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!mrfItemId || !qty || Number(qty) <= 0) {
      setError("Select an MRF item and enter a positive quantity.");
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
    <EntityModal open={open} onClose={onClose} title="New Stock Out" width={560}>
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2.25 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
          <FormField label="MRF Item to Fulfill" span2>
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
                  {item.mrfRefNo} · {item.productName} · Need: {item.qtyRemaining} {item.unit}
                </MenuItem>
              ))}
            </Select>
          </FormField>
          {selectedMrfItem && (
            <>
              <FormField label="MRF Number">
                <Box sx={{ fontSize: 12.5, py: 1, color: ACCENT, fontFamily: "monospace", fontWeight: 600 }}>
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
              <FormField label="Already Fulfilled">
                <Box sx={{ 
                  fontSize: 12.5, 
                  py: 1, 
                  color: selectedMrfItem.qtyFulfilled > 0 ? ACCENT : t.text2,
                  fontWeight: selectedMrfItem.qtyFulfilled > 0 ? 600 : 400,
                }}>
                  {selectedMrfItem.qtyFulfilled} {selectedMrfItem.unit}
                </Box>
              </FormField>
              <FormField label="Remaining to Fulfill">
                <Box sx={{ fontSize: 12.5, py: 1, color: t.text, fontWeight: 700 }}>
                  {selectedMrfItem.qtyRemaining} {selectedMrfItem.unit}
                </Box>
              </FormField>
              <FormField label="Available in Stock">
                <Box sx={{ 
                  fontSize: 12.5, 
                  py: 1, 
                  color: selectedMrfItem.availableStock >= selectedMrfItem.qtyRemaining ? t.success : t.warn,
                  fontWeight: 600,
                }}>
                  {selectedMrfItem.availableStock} {selectedMrfItem.unit}
                </Box>
              </FormField>
            </>
          )}
          <FormField label="Quantity to Release">
            <Box
              component="input"
              type="number"
              value={qty}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQty(e.target.value)}
              placeholder={selectedMrfItem ? String(selectedMrfItem.qtyRemaining) : "0"}
              max={selectedMrfItem?.qtyRemaining}
              sx={fieldInputSx(t)}
            />
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
