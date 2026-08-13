"use client";

import { useState } from "react";
import { Box, MenuItem, ListSubheader, Select, Typography, IconButton, Tooltip, ButtonBase } from "@mui/material";
import { FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { colors, borderRadius } from "@/theme/designTokens";
import { groupByCategory } from "@/lib/groupByCategory";

export interface CartProductOption {
  id: string;
  name: string;
  code: string;
  unit: string;
  category: { name: string } | null;
}

export interface CartItem {
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  qty: number;
}

/**
 * Category-grouped product picker + running cart, shared by the multi-item
 * Stock In and MRF filing modals. Owns the "pick a product, enter a qty, Add"
 * interaction and the cart's add/remove/adjust-qty logic; the parent owns
 * `items` itself (and whatever it submits them as) so this stays a pure
 * editor with no knowledge of MRFs, batches, or any submit shape.
 */
export function ItemCartEditor({
  products,
  items,
  onItemsChange,
  addSectionLabel,
  cartLabel,
  emptyProductError,
}: {
  products: CartProductOption[] | undefined;
  items: CartItem[];
  onItemsChange: (next: CartItem[]) => void;
  /** Heading over the "pick a product + qty" section, e.g. "Add Items to Request". */
  addSectionLabel: string;
  /** Heading over the cart list, e.g. "Items in this Request". */
  cartLabel: string;
  /** Shown via onError when Add is clicked with nothing selected. */
  emptyProductError: string;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  const [selectedProductId, setSelectedProductId] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [error, setError] = useState("");

  const groupedProducts = products ? groupByCategory(products) : [];
  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);

  const handleAddItem = () => {
    if (!selectedProductId || !itemQty || Number(itemQty) <= 0) {
      setError(emptyProductError);
      return;
    }

    const product = products?.find((p) => p.id === selectedProductId);
    if (!product) return;

    const existingIndex = items.findIndex((item) => item.productId === selectedProductId);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        qty: updated[existingIndex].qty + Number(itemQty),
      };
      onItemsChange(updated);
    } else {
      onItemsChange([
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
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const updated = [...items];
    updated[index] = { ...updated[index], qty: newQty };
    onItemsChange(updated);
  };

  return (
    <>
      <Box
        sx={{
          mb: 3,
          p: 2.5,
          bgcolor: t.surface,
          border: `2px solid ${mode === "dark" ? colors.neutral[700] : colors.neutral[200]}`,
          borderRadius: borderRadius.lg,
        }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 2, color: t.text }}>{addSectionLabel}</Typography>
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
        {error && (
          <Typography sx={{ fontSize: 12, color: colors.status.error, mt: 1 }}>{error}</Typography>
        )}
      </Box>

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
              {cartLabel} ({items.length})
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
                    aria-label={`Remove ${item.productName}`}
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
    </>
  );
}
