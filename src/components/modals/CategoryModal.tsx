"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Alert } from "@mui/material";
import { EntityModal, ModalFormActions, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { postJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";

export function CategoryModal({
  open,
  onClose,
  existingNames,
}: {
  open: boolean;
  onClose: () => void;
  existingNames: string[];
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const confirmClose = useUnsavedChangesGuard(name.trim() !== "");

  const mutation = useMutation({
    mutationFn: () => postJson<{ name: string }>("/api/categories", { name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(`Category "${data.name}" added.`);
      setName("");
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }
    mutation.mutate();
  };

  return (
    <EntityModal open={open} onClose={onClose} confirmClose={confirmClose} title="Choose / Add Category" width={420}>
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2.25 }}>
        <Typography sx={{ fontSize: 12, color: t.muted, mb: 1.25 }}>
          Existing: {existingNames.join(" · ")}
        </Typography>
        <FormField label="New Category Name">
          <Box
            component="input"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            placeholder="e.g. Fittings"
            sx={fieldInputSx(t)}
          />
        </FormField>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions onCancel={onClose} submitLabel="Add Category" disabled={mutation.isPending} />
      </Box>
    </EntityModal>
  );
}
