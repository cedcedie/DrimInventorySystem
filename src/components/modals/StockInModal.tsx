"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, MenuItem, Select, Alert, ButtonBase, Typography } from "@mui/material";
import { EntityModal, FormField, ModalFormActions } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, motion } from "@/theme/tokens";
import { postJson } from "@/lib/mutate";
import { fetchJson } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { ItemCartEditor, type CartItem } from "@/components/ItemCartEditor";
import type { StockFormOptions } from "@/lib/data/stock";

interface OpenPurchaseOrder {
  id: string;
  refNo: string;
  items: {
    productId: string;
    productName: string;
    productCode: string;
    unit: string;
    qtyRemaining: number;
  }[];
}

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

  const [supplierId, setSupplierId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [error, setError] = useState("");

  const { data: openPOs } = useQuery({
    queryKey: ["purchase-orders-open", supplierId],
    queryFn: () =>
      fetchJson<{ purchaseOrders: OpenPurchaseOrder[] }>(
        `/api/purchase-orders/open?supplierId=${supplierId}`
      ),
    enabled: open && Boolean(supplierId),
    select: (data) => data.purchaseOrders,
  });

  // Supplier changed — any previously chosen PO belonged to the old supplier.
  useEffect(() => {
    setPurchaseOrderId("");
  }, [supplierId]);

  const selectedPO = openPOs?.find((po) => po.id === purchaseOrderId);

  const fillFromPO = () => {
    if (!selectedPO) return;
    setItems(
      selectedPO.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        unit: item.unit,
        qty: item.qtyRemaining,
      }))
    );
  };

  const mutation = useMutation({
    mutationFn: () =>
      postJson<{ refNo: string }>("/api/stock-in", {
        supplierId,
        items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
        purchaseOrderId: purchaseOrderId || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-in"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      if (purchaseOrderId) queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      showToast(`Stock In ${data.refNo} recorded.`);
      resetForm();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const resetForm = () => {
    setSupplierId("");
    setPurchaseOrderId("");
    setItems([]);
    setError("");
  };

  const handleClose = () => {
    if (items.length > 0 || supplierId) {
      const confirmed = window.confirm("Discard this delivery? This can't be undone.");
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
      setError("Add at least one item to this delivery.");
      return;
    }

    mutation.mutate();
  };

  return (
    <EntityModal open={open} onClose={onClose} confirmClose={handleClose} title="New Stock In" width={660}>
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

        {supplierId && openPOs && openPOs.length > 0 && (
          <Box
            sx={{
              mt: 1.5,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr auto" },
              gap: 1.25,
              alignItems: "end",
            }}
          >
            <FormField label="Link to Purchase Order (Optional)">
              <Select
                value={purchaseOrderId}
                onChange={(e) => setPurchaseOrderId(e.target.value)}
                size="small"
                displayEmpty
                sx={{ fontSize: 12.5, bgcolor: t.surface }}
              >
                <MenuItem value="" sx={{ fontSize: 12.5 }}>
                  Not against a PO
                </MenuItem>
                {openPOs.map((po) => (
                  <MenuItem key={po.id} value={po.id} sx={{ fontSize: 12.5 }}>
                    {po.refNo} — {po.items.length} item(s) expected
                  </MenuItem>
                ))}
              </Select>
            </FormField>
            {selectedPO && (
              <ButtonBase
                type="button"
                onClick={fillFromPO}
                sx={{
                  px: 1.75,
                  py: 1,
                  height: 38,
                  fontSize: 12,
                  fontWeight: 600,
                  color: ACCENT,
                  border: "1px solid",
                  borderColor: ACCENT,
                  borderRadius: "8px",
                  whiteSpace: "nowrap",
                  transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}`,
                  "&:hover": { bgcolor: t.rowSel },
                }}
              >
                Fill from PO
              </ButtonBase>
            )}
          </Box>
        )}
        {purchaseOrderId && (
          <Typography sx={{ fontSize: 11, color: t.muted, mt: 0.5 }}>
            Received qty on this delivery will be applied toward {selectedPO?.refNo}&apos;s open lines.
          </Typography>
        )}

        <Box sx={{ mt: 2.5 }}>
          <ItemCartEditor
            products={options?.products}
            items={items}
            onItemsChange={setItems}
            addSectionLabel="Add Items to Delivery"
            cartLabel="Items in this Delivery"
            emptyProductError="Select an item and enter a positive quantity."
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions
          onCancel={() => {
            if (handleClose()) onClose();
          }}
          submitLabel={mutation.isPending ? "Saving…" : `Save Stock In (${items.length} items)`}
          disabled={mutation.isPending || items.length === 0}
        />
      </Box>
    </EntityModal>
  );
}
