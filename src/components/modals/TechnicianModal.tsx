"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Alert } from "@mui/material";
import { EntityModal, ModalFormActions, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { postJson, patchJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";

export interface TechnicianFormRow {
  id: string;
  empNo: string;
  name: string;
  position: string;
}

export function TechnicianModal({
  open,
  onClose,
  technician,
}: {
  open: boolean;
  onClose: () => void;
  technician: TechnicianFormRow | null;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const isEdit = !!technician;

  const [empNo, setEmpNo] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setEmpNo(technician?.empNo ?? "");
      setName(technician?.name ?? "");
      setPosition(technician?.position ?? "");
      setError("");
    }
  }, [open, technician]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { empNo, name, position };
      if (isEdit) return patchJson(`/api/technicians/${technician!.id}`, payload);
      return postJson("/api/technicians", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["technicians"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(isEdit ? "Technician updated." : "Technician added to roster.");
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!empNo.trim() || !name.trim() || !position.trim()) {
      setError("Employee number, name, and position are required.");
      return;
    }
    mutation.mutate();
  };

  return (
    <EntityModal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Technician — ${technician!.name}` : "Add Technician"}
      width={560}
    >
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2.25 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
          <FormField label="Employee Number">
            <Box
              component="input"
              value={empNo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmpNo(e.target.value)}
              placeholder="EMP-0000"
              sx={fieldInputSx(t, true)}
            />
          </FormField>
          <FormField label="Name">
            <Box
              component="input"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Full name"
              sx={fieldInputSx(t)}
            />
          </FormField>
          <FormField label="Position" span2>
            <Box
              component="input"
              value={position}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPosition(e.target.value)}
              placeholder="e.g. HVAC Technician"
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
          onCancel={onClose}
          submitLabel={isEdit ? "Save Changes" : "Add Technician"}
          disabled={mutation.isPending}
        />
      </Box>
    </EntityModal>
  );
}
