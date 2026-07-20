"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, MenuItem, Select, Alert } from "@mui/material";
import { EntityModal, ModalFormActions, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { postJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { ROLE_LABELS } from "@/lib/navConfig";
import type { Role } from "@prisma/client";

const ROLE_OPTIONS: Role[] = ["OWNER", "ADMIN", "WAREHOUSE_STAFF", "TECHNICIAN"];

export function UserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("WAREHOUSE_STAFF");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => postJson("/api/users", { name, username, password, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast("User account created.");
      setName("");
      setUsername("");
      setPassword("");
      setRole("WAREHOUSE_STAFF");
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !username.trim() || !password) {
      setError("Name, username, and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    mutation.mutate();
  };

  return (
    <EntityModal open={open} onClose={onClose} title="Add User" width={420}>
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2.25 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <FormField label="Name">
            <Box
              component="input"
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Full name"
              sx={fieldInputSx(t)}
            />
          </FormField>
          <FormField label="Username">
            <Box
              component="input"
              value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              placeholder="e.g. m.santos"
              sx={fieldInputSx(t)}
            />
          </FormField>
          <FormField label="Initial Password">
            <Box
              component="input"
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              sx={fieldInputSx(t)}
            />
          </FormField>
          <FormField label="Role">
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              size="small"
              sx={{ fontSize: 12.5, bgcolor: t.surface }}
            >
              {ROLE_OPTIONS.map((r) => (
                <MenuItem key={r} value={r} sx={{ fontSize: 12.5 }}>
                  {ROLE_LABELS[r]}
                </MenuItem>
              ))}
            </Select>
          </FormField>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions onCancel={onClose} submitLabel="Save User" disabled={mutation.isPending} />
      </Box>
    </EntityModal>
  );
}
