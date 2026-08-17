"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, MenuItem, Select, Typography, Alert } from "@mui/material";
import { EntityModal, ModalFormActions, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { postJson } from "@/lib/mutate";
import { fetchJson } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface ProductOption {
  id: string;
  name: string;
  code: string;
}

export function MrfModal({
  open,
  onClose,
  technicianLabel,
}: {
  open: boolean;
  onClose: () => void;
  technicianLabel: string;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: products } = useQuery({
    queryKey: ["mrf-products"],
    queryFn: () => fetchJson<{ products: ProductOption[] }>("/api/stock/options"),
    enabled: open,
    select: (data) => data.products,
  });

  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [project, setProject] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => postJson<{ refNo: string }>("/api/mrf", { productId, qty, project }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mrf"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(`${data.refNo} filed — sent to warehouse.`);
      setProductId("");
      setQty("");
      setProject("");
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!productId || !qty || Number(qty) <= 0 || !project.trim()) {
      setError("Item, a positive quantity, and project are required.");
      return;
    }
    mutation.mutate();
  };

  return (
    <EntityModal open={open} onClose={onClose} title="File Material Request Form (MRF)" width={560}>
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2.25 }}>
        <Typography sx={{ fontSize: 12, color: t.muted, mb: 1.5 }}>
          Filed under <b>{technicianLabel}</b>. Warehouse fulfills it as a Stock Out.
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
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
              {products?.map((p) => (
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
          <FormField label="Project" span2>
            <Box
              component="input"
              value={project}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProject(e.target.value)}
              placeholder="e.g. Northgate Cold Storage"
              sx={fieldInputSx(t)}
            />
          </FormField>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions onCancel={onClose} submitLabel="File MRF" disabled={mutation.isPending} />
      </Box>
    </EntityModal>
  );
}
