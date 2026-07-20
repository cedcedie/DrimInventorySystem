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

export function StockInModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: options } = useQuery({
    queryKey: ["stock-options"],
    queryFn: () => fetchJson<StockFormOptions>("/api/stock/options"),
    enabled: open,
  });

  const [productId, setProductId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [qty, setQty] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => postJson<{ refNo: string }>("/api/stock-in", { productId, supplierId, qty }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-in"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(`Stock In ${data.refNo} recorded.`);
      setProductId("");
      setSupplierId("");
      setQty("");
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!productId || !supplierId || !qty || Number(qty) <= 0) {
      setError("Product, supplier, and a positive quantity are required.");
      return;
    }
    mutation.mutate();
  };

  return (
    <EntityModal open={open} onClose={onClose} title="New Stock In" width={560}>
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2.25 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
          <FormField label="Supplier" span2>
            <Select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              size="small"
              displayEmpty
              sx={{ fontSize: 12.5, bgcolor: t.surface }}
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
          </FormField>
          <FormField label="Item">
            <Select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              size="small"
              displayEmpty
              sx={{ fontSize: 12.5, bgcolor: t.surface }}
            >
              <MenuItem value="" sx={{ fontSize: 12.5 }}>
                Select item
              </MenuItem>
              {options?.products.map((p) => (
                <MenuItem key={p.id} value={p.id} sx={{ fontSize: 12.5 }}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormField>
          <FormField label="Quantity">
            <Box
              component="input"
              type="number"
              value={qty}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQty(e.target.value)}
              placeholder="0"
              sx={fieldInputSx(t)}
            />
          </FormField>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions onCancel={onClose} submitLabel="Save Stock In" disabled={mutation.isPending} />
      </Box>
    </EntityModal>
  );
}
