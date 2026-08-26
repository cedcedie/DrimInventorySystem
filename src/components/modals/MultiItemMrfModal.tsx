"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Alert } from "@mui/material";
import { EntityModal, FormField, ModalFormActions, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { postJson } from "@/lib/mutate";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/components/Toast";
import { useFormDraft } from "@/lib/useFormDraft";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";
import { ItemCartEditor, type CartItem, type CartProductOption } from "@/components/ItemCartEditor";

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

  // Not gated on `open` — fetching only once the modal opens meant the
  // product picker always showed "Loading…" first. This mounts once with
  // the page, so warming it early means the list is usually already there.
  const { data: optionsData } = useQuery({
    queryKey: ["mrf-products"],
    queryFn: () =>
      fetchJson<{ products: CartProductOption[]; recentProducts: CartProductOption[] }>(
        "/api/stock/options"
      ),
  });
  const products = optionsData?.products;
  const recentProducts = optionsData?.recentProducts;

  const [items, setItems] = useState<CartItem[]>([]);
  const [project, setProject] = useState("");
  const [externalRefNo, setExternalRefNo] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  // A technician filing from a job site can lose signal mid-fill; persist a draft so
  // it isn't silently lost. Restored on open, cleared on successful submit.
  type Draft = { items: CartItem[]; project: string; externalRefNo: string; description: string };
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
      queryClient.invalidateQueries({ queryKey: ["mrf"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.openMrfs() });
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
    setError("");
  };

  const isDirty = items.length > 0 || Boolean(project) || Boolean(externalRefNo) || Boolean(description);
  const confirmClose = useUnsavedChangesGuard(
    isDirty,
    "Discard this material request? This can't be undone."
  );
  const handleClose = () => {
    const ok = confirmClose();
    if (ok) {
      draft.clear();
      resetForm();
    }
    return ok;
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

  return (
    <EntityModal
      open={open}
      onClose={onClose}
      confirmClose={handleClose}
      title="File Material Request Form (MRF)"
      width={660}
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 12.5, color: t.muted, mb: 2, lineHeight: 1.6 }}>
          Filed under <strong>{technicianLabel}</strong>. Add multiple items to this request — warehouse
          will fulfill each item separately.
        </Typography>

        <ItemCartEditor
          products={products}
          recentProducts={recentProducts}
          items={items}
          onItemsChange={setItems}
          addSectionLabel="Add Items to Request"
          cartLabel="Items in this Request"
          emptyProductError="Select an item and enter a positive quantity."
        />

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mb: 2 }}>
          <FormField label="Project Name">
            <Box
              component="input"
              value={project}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProject(e.target.value)}
              placeholder="e.g. Northgate Cold Storage"
              sx={fieldInputSx(t)}
            />
          </FormField>
          <FormField label="External Ref. No. (Optional)">
            <Box
              component="input"
              value={externalRefNo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExternalRefNo(e.target.value)}
              placeholder="e.g. PO-2024-001"
              sx={fieldInputSx(t)}
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
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </FormField>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions
          onCancel={() => {
            if (handleClose()) onClose();
          }}
          submitLabel={mutation.isPending ? "Filing MRF…" : `File MRF (${items.length} items)`}
          disabled={mutation.isPending || items.length === 0}
        />
      </Box>
    </EntityModal>
  );
}
