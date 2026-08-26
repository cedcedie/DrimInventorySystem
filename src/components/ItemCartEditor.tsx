"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography, IconButton, Tooltip, ButtonBase } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, ACCENT_HOVER, motion } from "@/theme/tokens";

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

const RESULT_CAP = 5;

/**
 * Category-grouped product picker + running cart, shared by the multi-item
 * Stock In, MRF, Purchase Order, and Purchase Request modals. The parent owns
 * `items` and its submit shape; this stays a pure editor with no knowledge of
 * MRFs, batches, etc.
 *
 * Search-filtered list rather than a native <Select> with every product
 * mounted — catalogs can run into the hundreds, which breaks mobile scanning
 * and rendering cost. Typing narrows by name/code; closed view groups by
 * category, capped at 5 per group.
 */
export function ItemCartEditor({
  products,
  items,
  onItemsChange,
  addSectionLabel,
  cartLabel,
  emptyProductError,
  recentProducts,
}: {
  products: CartProductOption[] | undefined;
  items: CartItem[];
  onItemsChange: (next: CartItem[]) => void;
  /** Heading over the "pick a product + qty" section. */
  addSectionLabel: string;
  /** Heading over the cart list. */
  cartLabel: string;
  /** Shown when Add is clicked with nothing selected. */
  emptyProductError: string;
  /** This user's most recently used products — shown above the category
   * browse view (empty query) as a "Recent" shortcut. Omit if the caller
   * has no such history to offer. */
  recentProducts?: CartProductOption[];
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  const [selectedProductId, setSelectedProductId] = useState("");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [itemQty, setItemQty] = useState("");
  const [error, setError] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = products?.find((p) => p.id === selectedProductId);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Flat capped search hits, or grouped-by-category browse view when query is empty.
  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !products) return null;
    return products
      .filter((p) => p.name.toLowerCase().includes(needle) || p.code.toLowerCase().includes(needle))
      .slice(0, RESULT_CAP);
  }, [products, query]);

  const browseGroups = useMemo(() => {
    if (!products) return [];
    const groups = new Map<string, CartProductOption[]>();
    for (const p of products) {
      const name = p.category?.name ?? "Uncategorized";
      const bucket = groups.get(name);
      if (bucket) bucket.push(p);
      else groups.set(name, [p]);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoryName, groupItems]) => ({
        categoryName,
        items: groupItems.slice(0, RESULT_CAP),
        totalCount: groupItems.length,
      }));
  }, [products]);

  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);

  const pickProduct = (product: CartProductOption) => {
    setSelectedProductId(product.id);
    setQuery(`${product.code} — ${product.name}`);
    setPickerOpen(false);
    setError("");
  };

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
    setQuery("");
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
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.25, color: t.text }}>
          {addSectionLabel}
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr auto" },
            gap: 1.25,
            alignItems: "end",
          }}
        >
          <FormField label="Select Item">
            <Box ref={pickerRef} sx={{ position: "relative" }}>
              <Box sx={{ position: "relative" }}>
                <SearchIcon
                  sx={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: t.muted2 }}
                />
                <Box
                  component="input"
                  value={query}
                  onFocus={() => setPickerOpen(true)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setQuery(e.target.value);
                    setSelectedProductId("");
                    setPickerOpen(true);
                  }}
                  placeholder="Search by code or name…"
                  sx={{ ...fieldInputSx(t), pl: 4 }}
                />
              </Box>

              {pickerOpen && (
                <Box
                  className="scroll-hidden"
                  sx={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    maxHeight: 280,
                    overflowY: "auto",
                    bgcolor: t.surface,
                    border: "1px solid",
                    borderColor: t.line,
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px rgba(16,24,40,0.10)",
                  }}
                >
                  {!products ? (
                    <Typography sx={{ fontSize: 12.5, color: t.muted, px: 1.5, py: 1.25 }}>
                      Loading products…
                    </Typography>
                  ) : searchResults ? (
                    searchResults.length === 0 ? (
                      <Typography sx={{ fontSize: 12.5, color: t.muted, px: 1.5, py: 1.25 }}>
                        No products match &ldquo;{query.trim()}&rdquo;.
                      </Typography>
                    ) : (
                      searchResults.map((p) => (
                        <ProductOption key={p.id} product={p} t={t} onClick={() => pickProduct(p)} />
                      ))
                    )
                  ) : (
                    <>
                      {recentProducts && recentProducts.length > 0 && (
                        <Box>
                          <Typography
                            sx={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: t.muted2,
                              px: 1.5,
                              pt: 1,
                              pb: 0.5,
                            }}
                          >
                            Recent
                          </Typography>
                          {recentProducts.map((p) => (
                            <ProductOption key={p.id} product={p} t={t} onClick={() => pickProduct(p)} />
                          ))}
                        </Box>
                      )}
                      {browseGroups.map((group) => (
                        <Box key={group.categoryName}>
                          <Typography
                            sx={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              color: t.muted2,
                              px: 1.5,
                              pt: 1,
                              pb: 0.5,
                            }}
                          >
                            {group.categoryName}
                          </Typography>
                          {group.items.map((p) => (
                            <ProductOption key={p.id} product={p} t={t} onClick={() => pickProduct(p)} />
                          ))}
                          {group.totalCount > RESULT_CAP && (
                            <Typography sx={{ fontSize: 11, color: t.muted2, px: 1.5, pb: 0.75 }}>
                              +{group.totalCount - RESULT_CAP} more — type to search
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </>
                  )}
                </Box>
              )}
            </Box>
          </FormField>
          <FormField label="Quantity">
            <Box
              component="input"
              type="number"
              value={itemQty}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemQty(e.target.value)}
              placeholder="0"
              min="1"
              sx={fieldInputSx(t)}
            />
          </FormField>
          <ButtonBase
            type="button"
            onClick={handleAddItem}
            sx={{
              bgcolor: ACCENT,
              color: "#fff",
              px: 2.5,
              py: 1,
              height: 38,
              borderRadius: "8px",
              fontSize: 13,
              fontWeight: 600,
              minWidth: 100,
              transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, transform ${motion.duration.press}ms ${motion.easing.standard}`,
              "&:hover": { bgcolor: ACCENT_HOVER },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            + Add
          </ButtonBase>
        </Box>
        {selectedProduct && (
          <Typography sx={{ fontSize: 11.5, color: t.muted, mt: 0.75 }}>
            Selected: {selectedProduct.code} — {selectedProduct.name} ({selectedProduct.unit})
          </Typography>
        )}
        {error && (
          <Typography sx={{ fontSize: 12, color: t.danger, mt: 1 }}>{error}</Typography>
        )}
      </Box>

      {items.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1,
              flexWrap: "wrap",
              gap: 0.5,
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: t.text }}>
              {cartLabel} ({items.length})
            </Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>
              Total: {totalItems} items
            </Typography>
          </Box>
          <Box className="scroll-hidden" sx={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.75 }}>
            {items.map((item, index) => (
              <Box
                key={index}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr auto", sm: "1fr auto auto" },
                  gap: { xs: 0.5, sm: 1.5 },
                  alignItems: "center",
                  px: 1.5,
                  py: 1,
                  border: "1px solid",
                  borderColor: t.line,
                  borderRadius: "8px",
                  bgcolor: t.surface,
                  transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}`,
                  "&:hover": { bgcolor: t.hover },
                }}
              >
                <Box sx={{ minWidth: 0, gridColumn: { xs: "1 / -1", sm: "auto" } }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.productName}
                  </Typography>
                  <Typography sx={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: ACCENT, fontWeight: 600 }}>
                    {item.productCode}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, justifySelf: { xs: "start", sm: "center" } }}>
                  <IconButton
                    size="small"
                    aria-label={`Decrease quantity for ${item.productName}`}
                    onClick={() => handleUpdateQty(index, item.qty - 1)}
                    sx={{ bgcolor: t.hover, width: 26, height: 26, "&:hover": { bgcolor: t.line2 } }}
                  >
                    <Typography sx={{ fontSize: 15, fontWeight: 700 }} aria-hidden>
                      −
                    </Typography>
                  </IconButton>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, minWidth: 54, textAlign: "center", color: t.text }}>
                    {item.qty} {item.unit}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label={`Increase quantity for ${item.productName}`}
                    onClick={() => handleUpdateQty(index, item.qty + 1)}
                    sx={{ bgcolor: t.hover, width: 26, height: 26, "&:hover": { bgcolor: t.line2 } }}
                  >
                    <Typography sx={{ fontSize: 15, fontWeight: 700 }} aria-hidden>
                      +
                    </Typography>
                  </IconButton>
                </Box>
                <Tooltip title="Remove item">
                  <IconButton
                    size="small"
                    aria-label={`Remove ${item.productName}`}
                    onClick={() => handleRemoveItem(index)}
                    sx={{ color: t.danger, justifySelf: "end", "&:hover": { bgcolor: t.hover } }}
                  >
                    <Typography sx={{ fontSize: 17 }}>×</Typography>
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

function ProductOption({
  product,
  t,
  onClick,
}: {
  product: CartProductOption;
  t: typeof lightTokens | typeof darkTokens;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: "flex",
        width: "100%",
        justifyContent: "flex-start",
        px: 1.5,
        py: 0.85,
        fontSize: 12.5,
        color: t.text,
        transition: `background-color 120ms ease`,
        "&:hover": { bgcolor: t.rowSel, color: ACCENT },
      }}
    >
      <Box component="span" sx={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, mr: 1 }}>
        {product.code}
      </Box>
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {product.name}
      </Box>
    </ButtonBase>
  );
}
