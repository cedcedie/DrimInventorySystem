"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, MenuItem, ListSubheader, Select, Typography, Alert, IconButton, Tooltip, ButtonBase } from "@mui/material";
import { EntityModal, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { colors, borderRadius, shadows } from "@/theme/designTokens";
import { postJson } from "@/lib/mutate";
import { fetchJson } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { groupByCategory } from "@/lib/groupByCategory";
import type { StockFormOptions } from "@/lib/data/stock";

interface CartItem {
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  qty: number;
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

  const groupedProducts = options ? groupByCategory(options.products) : [];

  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      postJson<{ refNo: string }>("/api/stock-in", {
        supplierId,
        items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-in"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(`Stock In ${data.refNo} recorded.`);
      resetForm();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const resetForm = () => {
    setSupplierId("");
    setItems([]);
    setSelectedProductId("");
    setItemQty("");
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

  const handleAddItem = () => {
    if (!selectedProductId || !itemQty || Number(itemQty) <= 0) {
      setError("Select an item and enter a positive quantity.");
      return;
    }

    const product = options?.products.find((p) => p.id === selectedProductId);
    if (!product) return;

    const existingIndex = items.findIndex((item) => item.productId === selectedProductId);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        qty: updated[existingIndex].qty + Number(itemQty),
      };
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          unit: product.unit,
          qty: Number(itemQty),
        },
      ]);
    }

    setSelectedProductId("");
    setItemQty("");
    setError("");
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const updated = [...items];
    updated[index] = { ...updated[index], qty: newQty };
    setItems(updated);
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

  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);

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

        {/* Add item section */}
        <Box
          sx={{
            mt: 2.5,
            mb: 3,
            p: 2.5,
            bgcolor: t.surface,
            border: `2px solid ${mode === "dark" ? colors.neutral[700] : colors.neutral[200]}`,
            borderRadius: borderRadius.lg,
          }}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 2, color: t.text }}>Add Items to Delivery</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 1.5, alignItems: "end" }}>
            <FormField label="Select Item">
              <Select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                size="small"
                displayEmpty
                sx={{ fontSize: 13, bgcolor: mode === "dark" ? colors.neutral[900] : colors.neutral[0] }}
              >
                <MenuItem value="" sx={{ fontSize: 13 }}>
                  Choose product…
                </MenuItem>
                {groupedProducts.flatMap((group) => [
                  <ListSubheader key={group.categoryName} sx={{ fontSize: 11.5, fontWeight: 700, lineHeight: "28px" }}>
                    {group.categoryName}
                  </ListSubheader>,
                  ...group.items.map((p) => (
                    <MenuItem key={p.id} value={p.id} sx={{ fontSize: 13 }}>
                      {p.code} — {p.name}
                    </MenuItem>
                  )),
                ])}
              </Select>
            </FormField>
            <FormField label="Quantity">
              <Box
                component="input"
                type="number"
                value={itemQty}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemQty(e.target.value)}
                placeholder="0"
                min="1"
                sx={{
                  ...fieldInputSx(t),
                  bgcolor: mode === "dark" ? colors.neutral[900] : colors.neutral[0],
                }}
              />
            </FormField>
            <ButtonBase
              type="button"
              onClick={handleAddItem}
              sx={{
                bgcolor: colors.brand.primary,
                color: colors.neutral[0],
                px: 2.5,
                py: 1.25,
                borderRadius: borderRadius.md,
                fontSize: 13,
                fontWeight: 600,
                minWidth: 100,
                transition: "all 150ms ease",
                "&:hover": {
                  bgcolor: colors.brand.primaryDark,
                },
              }}
            >
              + Add
            </ButtonBase>
          </Box>
        </Box>

        {/* Items cart */}
        {items.length > 0 && (
          <Box
            sx={{
              mb: 3,
              border: `2px solid ${mode === "dark" ? colors.neutral[700] : colors.neutral[200]}`,
              borderRadius: borderRadius.lg,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                bgcolor: mode === "dark" ? colors.neutral[800] : colors.neutral[100],
                px: 2.5,
                py: 1.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                Items in this Delivery ({items.length})
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: colors.brand.primary }}>
                Total: {totalItems} items
              </Typography>
            </Box>
            <Box sx={{ maxHeight: 280, overflowY: "auto" }}>
              {items.map((item, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "auto 2fr 1fr auto",
                    gap: 2,
                    alignItems: "center",
                    p: 2,
                    borderBottom: index < items.length - 1 ? `1px solid ${t.line}` : "none",
                    bgcolor: t.surface,
                    transition: "background-color 150ms ease",
                    "&:hover": {
                      bgcolor: mode === "dark" ? colors.neutral[800] : colors.neutral[50],
                    },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: colors.neutral[400],
                      minWidth: 32,
                      textAlign: "center",
                    }}
                  >
                    {index + 1}
                  </Typography>
                  <Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: t.text, mb: 0.25 }}>
                      {item.productName}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 11.5,
                        fontFamily: "monospace",
                        color: colors.brand.primary,
                        fontWeight: 600,
                      }}
                    >
                      {item.productCode}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <IconButton
                      size="small"
                      aria-label={`Decrease quantity for ${item.productName}`}
                      onClick={() => handleUpdateQty(index, item.qty - 1)}
                      sx={{
                        bgcolor: mode === "dark" ? colors.neutral[700] : colors.neutral[200],
                        width: 28,
                        height: 28,
                        "&:hover": {
                          bgcolor: mode === "dark" ? colors.neutral[600] : colors.neutral[300],
                        },
                      }}
                    >
                      <Typography sx={{ fontSize: 16, fontWeight: 700 }} aria-hidden>
                        −
                      </Typography>
                    </IconButton>
                    <Typography
                      sx={{
                        fontSize: 15,
                        fontWeight: 700,
                        minWidth: 60,
                        textAlign: "center",
                        color: t.text,
                      }}
                    >
                      {item.qty} {item.unit}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label={`Increase quantity for ${item.productName}`}
                      onClick={() => handleUpdateQty(index, item.qty + 1)}
                      sx={{
                        bgcolor: mode === "dark" ? colors.neutral[700] : colors.neutral[200],
                        width: 28,
                        height: 28,
                        "&:hover": {
                          bgcolor: mode === "dark" ? colors.neutral[600] : colors.neutral[300],
                        },
                      }}
                    >
                      <Typography sx={{ fontSize: 16, fontWeight: 700 }} aria-hidden>
                        +
                      </Typography>
                    </IconButton>
                  </Box>
                  <Tooltip title="Remove item">
                    <IconButton
                      size="small"
                      aria-label={`Remove ${item.productName} from delivery`}
                      onClick={() => handleRemoveItem(index)}
                      sx={{
                        color: colors.status.error,
                        "&:hover": {
                          bgcolor: `${colors.status.error}15`,
                        },
                      }}
                    >
                      <Typography sx={{ fontSize: 18 }}>×</Typography>
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1.5, borderRadius: borderRadius.md }}>
            {error}
          </Alert>
        )}

        {/* Actions */}
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
            {mutation.isPending ? "Saving…" : `Save Stock In (${items.length} items)`}
          </ButtonBase>
        </Box>
      </Box>
    </EntityModal>
  );
}
