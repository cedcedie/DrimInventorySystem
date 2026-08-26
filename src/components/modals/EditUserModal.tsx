"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Box, ButtonBase, MenuItem, Select, Alert, Typography } from "@mui/material";
import { EntityModal, ModalFormActions, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { ACCENT, motion, lightTokens, darkTokens } from "@/theme/tokens";
import { patchJson, postJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { useUnsavedChangesGuard } from "@/lib/useUnsavedChangesGuard";
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
  const { data: session } = useSession();
  const canResetPassword = session?.user?.role === "OWNER" || session?.user?.role === "ADMIN";

  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("WAREHOUSE_STAFF");
  const [status, setStatus] = useState<UserStatus>("ACTIVE");
  const [error, setError] = useState("");

  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setRole(user.role);
      setStatus(user.status);
      setError("");
      setResetOpen(false);
      setNewPassword("");
      setResetError("");
    }
  }, [user]);

  const isDirty =
    Boolean(user) &&
    (name !== user!.name || role !== user!.role || status !== user!.status || newPassword !== "");
  const confirmClose = useUnsavedChangesGuard(isDirty);

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

  const resetMutation = useMutation({
    mutationFn: () => postJson(`/api/users/${user!.id}/reset-password`, { newPassword }),
    onSuccess: () => {
      showToast(`Password reset for ${user!.name}.`);
      setResetOpen(false);
      setNewPassword("");
    },
    onError: (e: Error) => setResetError(e.message),
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

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    if (newPassword.length < 8) {
      setResetError("New password must be at least 8 characters.");
      return;
    }
    resetMutation.mutate();
  };

  return (
    <EntityModal open={!!user} onClose={onClose} confirmClose={confirmClose} title="Edit Account" width={420}>
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
          Username can&apos;t be changed here. Each user can change their own password from My
          Account{canResetPassword ? " — or reset it below if they forgot it." : "."}
        </Typography>

        {canResetPassword && (
          <Box sx={{ mt: 1.25, border: "1px solid", borderColor: t.line, borderRadius: "8px", p: 1.25 }}>
            {!resetOpen ? (
              <ButtonBase
                onClick={() => setResetOpen(true)}
                sx={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: ACCENT,
                  transition: `opacity ${motion.duration.color}ms ${motion.easing.standard}`,
                  "&:hover": { opacity: 0.8 },
                }}
              >
                Reset password…
              </ButtonBase>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography sx={{ fontSize: 11.5, color: t.muted2 }}>
                  Sets a new password for {user?.name} immediately — no confirmation from them needed.
                </Typography>
                <Box
                  component="input"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                  placeholder="New password (min. 8 characters)"
                  sx={fieldInputSx(t)}
                />
                {resetError && (
                  <Alert severity="error" sx={{ fontSize: 12 }}>
                    {resetError}
                  </Alert>
                )}
                <Box sx={{ display: "flex", gap: 1 }}>
                  <ButtonBase
                    onClick={handleResetSubmit}
                    disabled={resetMutation.isPending}
                    sx={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                      bgcolor: ACCENT,
                      borderRadius: "6px",
                      px: 1.25,
                      py: 0.625,
                      opacity: resetMutation.isPending ? 0.6 : 1,
                    }}
                  >
                    Set new password
                  </ButtonBase>
                  <ButtonBase
                    onClick={() => {
                      setResetOpen(false);
                      setNewPassword("");
                      setResetError("");
                    }}
                    sx={{ fontSize: 12, fontWeight: 600, color: t.muted, px: 1.25, py: 0.625 }}
                  >
                    Cancel
                  </ButtonBase>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        )}

        <ModalFormActions
          onCancel={() => {
            if (confirmClose()) onClose();
          }}
          submitLabel="Save changes"
          disabled={mutation.isPending}
        />
      </Box>
    </EntityModal>
  );
}
