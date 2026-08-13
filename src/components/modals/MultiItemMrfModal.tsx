"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, MenuItem, ListSubheader, Select, Typography, Alert, IconButton, Tooltip, ButtonBase } from "@mui/material";
import { EntityModal, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { colors, borderRadius, shadows } from "@/theme/designTokens";
import { postJson } from "@/lib/mutate";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/components/Toast";
import { groupByCategory } from "@/lib/groupByCategory";
import { useFormDraft } from "@/lib/useFormDraft";

interface ProductOption {
  id: string;
  name: string;
  code: string;
  unit: string;
  category: { name: string } | null;
}

interface MrfItem {
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  qty: number;
}

export function MultiItemMrfModal({
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

  const groupedProducts = products ? groupByCategory(products) : [];

  // Form state
  const [items, setItems] = useState<MrfItem[]>([]);
  const [project, setProject] = useState("");
  const [externalRefNo, setExternalRefNo] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  // Add item state
  const [selectedProductId, setSelectedProductId] = useState("");
  const [itemQty, setItemQty] = useState("");

  // Draft persistence — a technician filing this from a job site can lose signal or
  // background the tab mid-fill; without this, the whole request (items typed one at a
  // time) would be silently destroyed. Restored on open, cleared on successful submit.
  type Draft = { items: MrfItem[]; project: string; externalRefNo: string; description: string };
  const draft = useFormDraft<Draft>(
    "drim-mrf-draft",
    { items, project, externalRefNo, description },
    (v) => v.items.length === 0 && !v.project && !v.externalRefNo && !v.description
  );
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!open || restoredRef.current) return;
    restoredRef.current = true;
    const saved = draft.load();
    if (saved && (saved.items.length > 0 || saved.project || saved.externalRefNo || saved.description)) {
      setItems(saved.items);
      setProject(saved.project);
      setExternalRefNo(saved.externalRefNo);
      setDescription(saved.description);
      showToast("Restored your unfinished material request.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) restoredRef.current = false;
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      postJson<{ refNo: string }>("/api/mrf/multi", {
        items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
        project,
        externalRefNo: externalRefNo.trim() || undefined,
        description: description.trim() || undefined,
      }),
    onSuccess: (data) => {
      sessionStorage.setItem("drim-mrf-filed", data.refNo);
      draft.clear();
      queryClient.invalidateQueries({ queryKey: queryKeys.mrf });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.openMrfs });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(`Request ${data.refNo} filed — sent to warehouse for fulfillment.`);
      resetForm();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const resetForm = () => {
    setItems([]);
    setProject("");
    setExternalRefNo("");
    setDescription("");
    setSelectedProductId("");
    setItemQty("");
    setError("");
  };

  const handleClose = () => {
    if (items.length > 0 || project || externalRefNo || description) {
      const confirmed = window.confirm("Discard this material request? This can't be undone.");
      if (confirmed) {
        draft.clear();
        resetForm();
      }
      return confirmed;
    }
    return true;
  };

  const handleAddItem = () => {
    if (!selectedProductId || !itemQty || Number(itemQty) <= 0) {
      setError("Select an item and enter a positive quantity.");
      return;
    }

    const product = products?.find((p) => p.id === selectedProductId);
    if (!product) return;

    // Check if item already exists
    const existingIndex = items.findIndex((item) => item.productId === selectedProductId);
    if (existingIndex >= 0) {
      // Update quantity
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        qty: updated[existingIndex].qty + Number(itemQty),
      };
      setItems(updated);
    } else {
      // Add new item
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

    if (items.length === 0) {
      setError("Add at least one item to the request.");
      return;
    }

    if (!project.trim()) {
      setError("Project name is required.");
      return;
    }

    mutation.mutate();
  };

  const totalItems = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <EntityModal
      open={open}
      onClose={onClose}
      confirmClose={handleClose}
      title="File Material Request Form (MRF)"
      width={660}
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
        {/* Header info */}
        <Box
          sx={{
            mb: 3,
            p: 2,
            bgcolor: mode === "dark" ? colors.neutral[800] : colors.blue[50],
            border: `1px solid ${mode === "dark" ? colors.neutral[700] : colors.blue[100]}`,
            borderRadius: borderRadius.md,
          }}
        >
          <Typography
            sx={{
              fontSize: 13,
              color: mode === "dark" ? colors.neutral[300] : colors.blue[900],
              lineHeight: 1.6,
            }}
          >
            Filed under <strong>{technicianLabel}</strong>. Add multiple items to this request. Warehouse will
            fulfill each item separately.
          </Typography>
        </Box>

        {/* Add item section */}
        <Box
          sx={{
            mb: 3,
            p: 2.5,
            bgcolor: t.surface,
            border: `2px solid ${mode === "dark" ? colors.neutral[700] : colors.neutral[200]}`,
            borderRadius: borderRadius.lg,
          }}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 2, color: t.text }}>Add Items to Request</Typography>
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
                Items in this Request ({items.length})
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
                      aria-label={`Remove ${item.productName} from request`}
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

        {/* MRF details */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
          <FormField label="Project Name">
            <Box
              component="input"
              value={project}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProject(e.target.value)}
              placeholder="e.g. Northgate Cold Storage"
              sx={{
                ...fieldInputSx(t),
                bgcolor: mode === "dark" ? colors.neutral[900] : colors.neutral[0],
              }}
            />
          </FormField>
          <FormField label="External Ref. No. (Optional)">
            <Box
              component="input"
              value={externalRefNo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExternalRefNo(e.target.value)}
              placeholder="e.g. PO-2024-001"
              sx={{
                ...fieldInputSx(t),
                bgcolor: mode === "dark" ? colors.neutral[900] : colors.neutral[0],
              }}
            />
          </FormField>
        </Box>

        <FormField label="Description / Notes (Optional)">
          <Box
            component="textarea"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            placeholder="Add any additional information or special instructions..."
            rows={3}
            sx={{
              ...fieldInputSx(t),
              bgcolor: mode === "dark" ? colors.neutral[900] : colors.neutral[0],
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </FormField>

        {error && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: borderRadius.md }}>
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
            {mutation.isPending ? "Filing MRF…" : `File MRF (${items.length} items)`}
          </ButtonBase>
        </Box>
      </Box>
    </EntityModal>
  );
}
