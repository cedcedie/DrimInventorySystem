"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, MenuItem, Select, Typography, Alert } from "@mui/material";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { EntityModal, ModalFormActions, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, motion } from "@/theme/tokens";
import { queryKeys } from "@/lib/queryKeys";
import { postJson, patchJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";

export interface ProductFormRow {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  unit: string;
  stocks: number;
  minLevel: number;
  supplierId: string | null;
  imageKey: string | null;
}

const UNITS = ["Pcs", "Meter"];

export function ProductModal({
  open,
  onClose,
  product,
  categories,
  suppliers,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductFormRow | null;
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const isEdit = !!product;

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("Pcs");
  const [stocks, setStocks] = useState("0");
  const [minLevel, setMinLevel] = useState("0");
  const [supplierId, setSupplierId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // One object URL per selected file, revoked on change/unmount — avoids minting a
  // new (leaked) blob URL on every render.
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  useEffect(() => {
    if (open) {
      setCode(product?.code ?? "");
      setName(product?.name ?? "");
      setCategoryId(product?.categoryId ?? categories[0]?.id ?? "");
      setUnit(product?.unit ?? "Pcs");
      setStocks(String(product?.stocks ?? 0));
      setMinLevel(String(product?.minLevel ?? 0));
      setSupplierId(product?.supplierId ?? "");
      setImageFile(null);
      setError("");
    }
  }, [open, product, categories]);

  const mutation = useMutation({
    mutationFn: async () => {
      let imageKey = product?.imageKey ?? null;
      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(data.error ?? "Upload failed");
        }
        const data = await res.json();
        imageKey = data.imageKey;
      }

      const payload = {
        code,
        name,
        categoryId,
        unit,
        minLevel: Number(minLevel),
        supplierId: supplierId || null,
        imageKey,
      };

      if (isEdit) {
        // No `stocks` on edit — count only moves via Stock In/Out or a recorded adjustment.
        return patchJson(`/api/products/${product!.id}`, payload);
      }
      return postJson("/api/products", { ...payload, stocks: Number(stocks) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(isEdit ? "Item updated." : "Product added to catalog.");
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!code.trim() || !name.trim() || !categoryId) {
      setError("Product code, name, and category are required.");
      return;
    }
    mutation.mutate();
  };

  return (
    <EntityModal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Item — ${product!.name}` : "Add Product"}
      width={560}
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2.25 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          <FormField label="Product Code">
            <Box
              component="input"
              value={code}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
              sx={fieldInputSx(t, true)}
            />
          </FormField>
          <FormField label="Product Name">
            <Box
              component="input"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              sx={fieldInputSx(t)}
            />
          </FormField>
          <FormField label="Category">
            <Select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              size="small"
              sx={{ fontSize: 12.5, bgcolor: t.surface }}
            >
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12.5 }}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormField>
          <FormField label="Unit">
            <Select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              size="small"
              sx={{ fontSize: 12.5, bgcolor: t.surface }}
            >
              {UNITS.map((u) => (
                <MenuItem key={u} value={u} sx={{ fontSize: 12.5 }}>
                  {u}
                </MenuItem>
              ))}
            </Select>
          </FormField>
          <FormField label={isEdit ? "Stocks (on hand)" : "Opening Stock"}>
            <Box
              component="input"
              type="number"
              value={stocks}
              readOnly={isEdit}
              title={isEdit ? "Use Adjust Stock to correct the count" : undefined}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStocks(e.target.value)}
              sx={{
                ...fieldInputSx(t),
                ...(isEdit && { bgcolor: t.hover, color: t.muted, cursor: "not-allowed" }),
              }}
            />
            {isEdit && (
              <Box sx={{ fontSize: 10.5, color: t.muted2, mt: 0.5 }}>
                Changes through Stock In/Out or Adjust Stock
              </Box>
            )}
          </FormField>
          <FormField label="Min. Stock Level">
            <Box
              component="input"
              type="number"
              value={minLevel}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinLevel(e.target.value)}
              sx={fieldInputSx(t)}
            />
          </FormField>
          <FormField label="Preferred Supplier">
            <Select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              size="small"
              displayEmpty
              sx={{ fontSize: 12.5, bgcolor: t.surface }}
            >
              <MenuItem value="" sx={{ fontSize: 12.5 }}>
                —
              </MenuItem>
              {suppliers.map((s) => (
                <MenuItem key={s.id} value={s.id} sx={{ fontSize: 12.5 }}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormField>
          <FormField label="Product Image" span2>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
              {(imageFile || product?.imageKey) && (
                <Box
                  component="img"
                  src={imagePreviewUrl ?? `/api/blobs/${product?.imageKey}`}
                  alt=""
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: t.border,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              )}
              <ButtonBase
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  border: "1px solid",
                  borderColor: t.border,
                  borderRadius: "8px",
                  px: 1.5,
                  py: 0.875,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: t.text,
                  bgcolor: t.surface,
                  transition: `border-color ${motion.duration.color}ms ${motion.easing.standard}, color ${motion.duration.color}ms ${motion.easing.standard}`,
                  "&:hover": { borderColor: ACCENT, color: ACCENT },
                }}
              >
                <UploadFileOutlinedIcon sx={{ fontSize: 16 }} />
                {imageFile || product?.imageKey ? "Change image" : "Upload image"}
              </ButtonBase>
              <Typography sx={{ fontSize: 12, color: t.muted2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {imageFile ? imageFile.name : product?.imageKey ? "Current image" : "No file chosen"}
              </Typography>
              <Box
                component="input"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setImageFile(e.target.files?.[0] ?? null)
                }
                sx={{ display: "none" }}
              />
            </Box>
          </FormField>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions
          onCancel={onClose}
          submitLabel={isEdit ? "Save Changes" : "Add Product"}
          disabled={mutation.isPending}
        />
      </Box>
    </EntityModal>
  );
}
