"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Alert } from "@mui/material";
import { EntityModal, ModalFormActions, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { postJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";

export function SupplierModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [supplies, setSupplies] = useState("");
  const [error, setError] = useState("");
  const isDirty = Boolean(name || contact || supplies);

  const mutation = useMutation({
    mutationFn: () => postJson("/api/suppliers", { name, contact, supplies }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast("Supplier added to registry.");
      setName("");
      setContact("");
      setSupplies("");
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Supplier name is required.");
      return;
    }
    mutation.mutate();
  };

  return (
    <EntityModal open={open} onClose={onClose} isDirty={isDirty} title="Add Supplier" width={560}>
      {(requestClose) => (
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2.25 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          <FormField label="Supplier Name">
            <Box
              component="input"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Company name"
              sx={fieldInputSx(t)}
            />
          </FormField>
          <FormField label="Contact">
            <Box
              component="input"
              value={contact}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContact(e.target.value)}
              placeholder="Phone or email"
              sx={fieldInputSx(t)}
            />
          </FormField>
          <FormField label="Supplies" span2>
            <Box
              component="input"
              value={supplies}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplies(e.target.value)}
              placeholder="e.g. Pipes, valves"
              sx={fieldInputSx(t)}
            />
          </FormField>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions
          onCancel={requestClose}
          submitLabel="Save Supplier"
          disabled={mutation.isPending}
        />
      </Box>
      )}
    </EntityModal>
  );
}
