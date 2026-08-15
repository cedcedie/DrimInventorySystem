"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, MenuItem, Select, Alert, ButtonBase } from "@mui/material";
import { EntityModal, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, colors, borderRadius, shadows } from "@/theme/tokens";
import { postJson } from "@/lib/mutate";
import { fetchJson } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { ItemCartEditor, type CartItem } from "@/components/ItemCartEditor";
import type { StockFormOptions } from "@/lib/data/stock";

export function PurchaseOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: options } = useQuery({
    queryKey: ["stock-options"],
    queryFn: () => fetchJson<StockFormOptions>("/api/stock/options"),
    enabled: open,
  });

  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      postJson<{ refNo: string }>("/api/purchase-orders", {
        supplierId,
        items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
        notes: notes.trim() || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(`Purchase Order ${data.refNo} created.`);
      resetForm();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const resetForm = () => {
    setSupplierId("");
    setItems([]);
    setNotes("");
    setError("");
  };

  const handleClose = () => {
    if (items.length > 0 || supplierId || notes) {
      const confirmed = window.confirm("Discard this Purchase Order? This can't be undone.");
      if (confirmed) resetForm();
      return confirmed;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!supplierId) {
      setError("Select a supplier.");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one item to order.");
      return;
    }

    mutation.mutate();
  };

  return (
    <EntityModal
      open={open}
      onClose={onClose}
      confirmClose={handleClose}
      title="New Purchase Order"
      width={660}
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
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

        <Box sx={{ mt: 2.5 }}>
          <ItemCartEditor
            products={options?.products}
            items={items}
            onItemsChange={setItems}
            addSectionLabel="Add Items to Order"
            cartLabel="Items on this Order"
            emptyProductError="Select an item and enter a positive quantity."
          />
        </Box>

        <FormField label="Notes (Optional)">
          <Box
            component="input"
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
            placeholder="Delivery instructions, expected date, etc."
            maxLength={500}
            sx={fieldInputSx(t)}
          />
        </FormField>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5, borderRadius: borderRadius.md }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end", mt: 3 }}>
          <ButtonBase
            type="button"
            onClick={() => {
              if (handleClose()) onClose();
            }}
            sx={{
              px: 2.5,
              py: 1.25,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: borderRadius.md,
              border: `2px solid ${mode === "dark" ? colors.neutral[700] : colors.neutral[300]}`,
              color: t.text,
              transition: "all 150ms ease",
              "&:hover": {
                bgcolor: mode === "dark" ? colors.neutral[800] : colors.neutral[100],
              },
            }}
          >
            Cancel
          </ButtonBase>
          <ButtonBase
            type="submit"
            disabled={mutation.isPending || items.length === 0}
            sx={{
              px: 3,
              py: 1.25,
              fontSize: 13,
              fontWeight: 600,
              borderRadius: borderRadius.md,
              bgcolor: colors.brand.primary,
              color: colors.neutral[0],
              boxShadow: shadows.sm,
              transition: "all 150ms ease",
              "&:hover": {
                bgcolor: colors.brand.primaryDark,
                boxShadow: shadows.md,
              },
              "&.Mui-disabled": {
                opacity: 0.5,
              },
            }}
          >
            {mutation.isPending ? "Creating…" : `Create Purchase Order (${items.length} items)`}
          </ButtonBase>
        </Box>
      </Box>
    </EntityModal>
  );
}
