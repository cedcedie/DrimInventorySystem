"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, MenuItem, Select, Alert } from "@mui/material";
import { EntityModal, FormField, ModalFormActions, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { postJson } from "@/lib/mutate";
import { fetchJson } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { ItemCartEditor, type CartItem } from "@/components/ItemCartEditor";
import type { StockFormOptions } from "@/lib/data/stock";

export function PurchaseRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Not gated on `open` — warms the supplier/product picker before the modal
  // is ever opened instead of showing "Loading…" every time.
  const { data: options } = useQuery({
    queryKey: ["stock-options"],
    queryFn: () => fetchJson<StockFormOptions>("/api/stock/options"),
  });

  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      postJson<{ refNo: string }>("/api/purchase-requests", {
        supplierId: supplierId || undefined,
        items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
        notes: notes.trim() || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(`Purchase Request ${data.refNo} filed.`);
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
      const confirmed = window.confirm("Discard this Purchase Request? This can't be undone.");
      if (confirmed) resetForm();
      return confirmed;
    }
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (items.length === 0) {
      setError("Add at least one item to request.");
      return;
    }

    mutation.mutate();
  };

  return (
    <EntityModal
      open={open}
      onClose={onClose}
      confirmClose={handleClose}
      title="New Purchase Request"
      width={660}
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
        <FormField label="Supplier (Optional)" span2>
          <Select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            size="small"
            displayEmpty
            sx={{ fontSize: 12.5, bgcolor: t.surface }}
          >
            <MenuItem value="" sx={{ fontSize: 12.5 }}>
              Not sure yet — decide on approval
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
            addSectionLabel="Add Items to Request"
            cartLabel="Items on this Request"
            emptyProductError="Select an item and enter a positive quantity."
          />
        </Box>

        <FormField label="Notes (Optional)">
          <Box
            component="input"
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
            placeholder="Why this is needed, urgency, etc."
            maxLength={500}
            sx={fieldInputSx(t)}
          />
        </FormField>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions
          onCancel={() => {
            if (handleClose()) onClose();
          }}
          submitLabel={mutation.isPending ? "Filing…" : `File Request (${items.length} items)`}
          disabled={mutation.isPending || items.length === 0}
        />
      </Box>
    </EntityModal>
  );
}
