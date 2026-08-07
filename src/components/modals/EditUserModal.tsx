"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, MenuItem, Select, Alert, Typography } from "@mui/material";
import { EntityModal, ModalFormActions, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { patchJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { ROLE_LABELS } from "@/lib/navConfig";
import type { Role, UserStatus } from "@/generated/prisma";

const ROLE_OPTIONS: Role[] = ["OWNER", "ADMIN", "WAREHOUSE_STAFF", "TECHNICIAN"];

export type EditableUser = {
  id: string;
  name: string;
  role: Role;
  status: UserStatus;
};

export function EditUserModal({
  user,
  onClose,
}: {
  user: EditableUser | null;
  onClose: () => void;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("WAREHOUSE_STAFF");
  const [status, setStatus] = useState<UserStatus>("ACTIVE");
  const [error, setError] = useState("");

  // Re-seed the form whenever a different user is opened.
  useEffect(() => {
    if (user) {
      setName(user.name);
      setRole(user.role);
      setStatus(user.status);
      setError("");
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: () => patchJson(`/api/users/${user!.id}`, { name, role, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast("Account updated.");
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    mutation.mutate();
  };

  return (
    <EntityModal open={!!user} onClose={onClose} title="Edit Account" width={420}>
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
          <FormField label="Status">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatus)}
              size="small"
              sx={{ fontSize: 12.5, bgcolor: t.surface }}
            >
              <MenuItem value="ACTIVE" sx={{ fontSize: 12.5 }}>
                Active
              </MenuItem>
              <MenuItem value="INACTIVE" sx={{ fontSize: 12.5 }}>
                Inactive — cannot sign in
              </MenuItem>
            </Select>
          </FormField>
        </Box>

        <Typography sx={{ fontSize: 11, color: t.muted2, mt: 1.5 }}>
          Username and password can&apos;t be changed here. Each user sets their own password from
          My Account.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions
          onCancel={onClose}
          submitLabel="Save changes"
          disabled={mutation.isPending}
        />
      </Box>
    </EntityModal>
  );
}
