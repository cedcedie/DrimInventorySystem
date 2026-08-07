"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, InputBase, Typography, Alert } from "@mui/material";
import { useTheme, type Palette } from "@mui/material/styles";
import { fetchJson } from "@/lib/api";
import { patchJson } from "@/lib/mutate";
import { queryKeys } from "@/lib/queryKeys";
import { TableSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { ROLE_LABELS } from "@/lib/navConfig";
import type { Role } from "@/generated/prisma";

type ProfileData = {
  id: string;
  username: string;
  name: string;
  role: Role;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  technician: { empNo: string; position: string } | null;
};

export function ProfileScreen({ initialData }: { initialData?: ProfileData }) {
  const t = useTheme().palette;
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => fetchJson<ProfileData>("/api/me"),
    initialData,
  });

  if (!data) {
    return (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ flex: "1 1 320px", minWidth: 320 }}>
          <TableSkeleton label="Loading your account…" columns={1} rows={4} />
        </Box>
        <Box sx={{ flex: "1 1 320px", minWidth: 320 }}>
          <TableSkeleton label="Loading password form…" columns={1} rows={3} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
      <IdentityPanel data={data} t={t} showToast={showToast} queryClient={queryClient} />
      <PasswordPanel t={t} showToast={showToast} />
    </Box>
  );
}

function IdentityPanel({
  data,
  t,
  showToast,
  queryClient,
}: {
  data: ProfileData;
  t: Palette;
  showToast: (m: string) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [name, setName] = useState(data.name);
  const [error, setError] = useState("");

  const save = useMutation({
    mutationFn: () => patchJson<{ id: string; name: string }>("/api/me", { name }),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      showToast("Display name updated.");
    },
    onError: (e: Error) => setError(e.message),
  });

  const unchanged = name.trim() === data.name;

  return (
    <Panel title="My Account" t={t}>
      {error && (
        <Alert severity="error" sx={{ mb: 0.5 }}>
          {error}
        </Alert>
      )}

      <Box>
        <FieldLabel t={t}>Display Name</FieldLabel>
        <InputBase
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          inputProps={{ maxLength: 120, "aria-label": "Display name" }}
          sx={inputSx(t)}
        />
      </Box>

      <ReadOnlyField label="Username" value={data.username} hint="Cannot be changed" t={t} />
      <ReadOnlyField
        label="Role"
        value={ROLE_LABELS[data.role]}
        hint="Only an Owner can change this"
        t={t}
      />
      {data.technician && (
        <ReadOnlyField
          label="Technician Record"
          value={`${data.technician.empNo} · ${data.technician.position}`}
          t={t}
        />
      )}

      <ButtonBase
        onClick={() => save.mutate()}
        disabled={save.isPending || unchanged || !name.trim()}
        sx={buttonSx(t, save.isPending || unchanged || !name.trim())}
      >
        {save.isPending ? "Saving…" : "Save changes"}
      </ButtonBase>
    </Panel>
  );
}

function PasswordPanel({ t, showToast }: { t: Palette; showToast: (m: string) => void }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState("");

  const change = useMutation({
    mutationFn: () =>
      patchJson<{ ok: true }>("/api/me/password", {
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    onSuccess: () => {
      setError("");
      setCurrent("");
      setNew("");
      setConfirm("");
      showToast("Password changed.");
    },
    onError: (e: Error) => setError(e.message),
  });

  const incomplete = !currentPassword || !newPassword || !confirmPassword;

  return (
    <Panel title="Change Password" t={t}>
      {error && (
        <Alert severity="error" sx={{ mb: 0.5 }}>
          {error}
        </Alert>
      )}

      <Box>
        <FieldLabel t={t}>Current Password</FieldLabel>
        <InputBase
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
          fullWidth
          inputProps={{ "aria-label": "Current password", autoComplete: "current-password" }}
          sx={inputSx(t)}
        />
      </Box>

      <Box>
        <FieldLabel t={t}>New Password</FieldLabel>
        <InputBase
          type="password"
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
          fullWidth
          inputProps={{ "aria-label": "New password", autoComplete: "new-password" }}
          sx={inputSx(t)}
        />
        <Typography sx={{ fontSize: 11, color: t.muted2, mt: 0.5 }}>
          At least 8 characters.
        </Typography>
      </Box>

      <Box>
        <FieldLabel t={t}>Confirm New Password</FieldLabel>
        <InputBase
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirm(e.target.value)}
          fullWidth
          inputProps={{ "aria-label": "Confirm new password", autoComplete: "new-password" }}
          sx={inputSx(t)}
        />
      </Box>

      <ButtonBase
        onClick={() => change.mutate()}
        disabled={change.isPending || incomplete}
        sx={buttonSx(t, change.isPending || incomplete)}
      >
        {change.isPending ? "Changing…" : "Change password"}
      </ButtonBase>
    </Panel>
  );
}

function Panel({
  title,
  t,
  children,
}: {
  title: string;
  t: Palette;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        flex: "1 1 320px",
        minWidth: 320,
        bgcolor: t.surface,
        border: "1px solid",
        borderColor: t.line,
      }}
    >
      <Box sx={{ px: 1.75, py: 1.25, borderBottom: "1px solid", borderColor: t.line }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{title}</Typography>
      </Box>
      <Box sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 1.5 }}>{children}</Box>
    </Box>
  );
}

function ReadOnlyField({
  label,
  value,
  hint,
  t,
}: {
  label: string;
  value: string;
  hint?: string;
  t: Palette;
}) {
  return (
    <Box>
      <FieldLabel t={t}>{label}</FieldLabel>
      <InputBase
        value={value}
        readOnly
        fullWidth
        inputProps={{ "aria-label": label, "aria-readonly": true }}
        sx={{ ...inputSx(t), bgcolor: t.hover, color: t.text2 }}
      />
      {hint && (
        <Typography sx={{ fontSize: 11, color: t.muted2, mt: 0.5 }}>{hint}</Typography>
      )}
    </Box>
  );
}

function FieldLabel({ children, t }: { children: React.ReactNode; t: Palette }) {
  return (
    <Typography
      component="label"
      sx={{
        display: "block",
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: t.muted,
      }}
    >
      {children}
    </Typography>
  );
}

function inputSx(t: Palette) {
  return {
    border: "1px solid",
    borderColor: t.border,
    borderRadius: "2px",
    px: 1.25,
    py: 1,
    fontSize: 12.5,
    mt: 0.5,
    bgcolor: t.surface,
    "&.Mui-focused": { borderColor: t.primary.main },
  };
}

function buttonSx(t: Palette, disabled: boolean) {
  return {
    alignSelf: "flex-start",
    border: "none",
    bgcolor: t.primary.main,
    color: "#fff",
    opacity: disabled ? 0.5 : 1,
    borderRadius: "2px",
    px: 1.75,
    py: 1,
    fontSize: 12,
    fontWeight: 600,
    "&:focus-visible": { outline: `2px solid ${t.primary.main}`, outlineOffset: "2px" },
  };
}
