"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Alert, ButtonBase, Checkbox, FormControlLabel } from "@mui/material";
import { EntityModal, FormField, fieldInputSx } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";
import { fetchJson } from "@/lib/api";
import { postJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { ROLE_LABELS } from "@/lib/navConfig";
import type { Role } from "@/generated/prisma";

const ROLES: Role[] = ["OWNER", "ADMIN", "WAREHOUSE_STAFF", "TECHNICIAN"];

interface UserOption {
  id: string;
  name: string;
  role: Role;
}

export function SendNotificationModal({
  open,
  onClose,
  /** Pre-checked recipients, from the Users screen's "Notify" action — more can still be added. */
  initialUserIds,
}: {
  open: boolean;
  onClose: () => void;
  initialUserIds?: string[];
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Not gated on `open` — warms the recipient picker before the modal is
  // ever opened instead of showing "Loading…" every time.
  const { data: options } = useQuery({
    queryKey: ["users-options"],
    queryFn: () => fetchJson<{ users: UserOption[] }>("/api/users/options"),
    select: (d) => d.users,
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setUserIds(initialUserIds ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      postJson<{ recipientCount: number }>("/api/notifications/send", { title, body, userIds, roles }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(`Sent to ${data.recipientCount} recipient${data.recipientCount === 1 ? "" : "s"}.`);
      resetForm();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const resetForm = () => {
    setTitle("");
    setBody("");
    setUserIds([]);
    setRoles([]);
    setError("");
  };

  const toggleUser = (id: string) => {
    setUserIds((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));
  };

  const toggleRole = (role: Role) => {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const isDirty = Boolean(title) || Boolean(body) || userIds.length > 0 || roles.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !body.trim()) {
      setError("Title and message are required.");
      return;
    }
    if (userIds.length === 0 && roles.length === 0) {
      setError("Pick at least one recipient.");
      return;
    }

    mutation.mutate();
  };

  return (
    <EntityModal
      open={open}
      onClose={() => {
        resetForm();
        onClose();
      }}
      isDirty={isDirty}
      dirtyMessage="Discard this notification? This can't be undone."
      title="Send Notification"
      width={560}
    >
      {(requestClose) => (
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
        <FormField label="Title">
          <Box
            component="input"
            value={title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
            placeholder="What's this about?"
            maxLength={120}
            sx={fieldInputSx(t)}
          />
        </FormField>

        <Box sx={{ mt: 1.5 }}>
          <FormField label="Message">
            <Box
              component="textarea"
              value={body}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
              placeholder="Type your message…"
              rows={4}
              maxLength={1000}
              sx={{ ...fieldInputSx(t), fontFamily: "inherit", resize: "vertical" }}
            />
          </FormField>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: t.muted, mb: 0.75 }}>
            Send to entire role
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {ROLES.map((role) => (
              <FormControlLabel
                key={role}
                control={
                  <Checkbox
                    size="small"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                }
                label={<Typography sx={{ fontSize: 12.5 }}>{ROLE_LABELS[role]}</Typography>}
                sx={{ mr: 1.5 }}
              />
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: t.muted, mb: 0.75 }}>
            Or pick specific people
          </Typography>
          <Box
            className="scroll-hidden"
            sx={{
              maxHeight: 180,
              overflowY: "auto",
              border: "1px solid",
              borderColor: t.line,
              borderRadius: "8px",
            }}
          >
            {options?.map((u) => (
              <FormControlLabel
                key={u.id}
                control={
                  <Checkbox size="small" checked={userIds.includes(u.id)} onChange={() => toggleUser(u.id)} />
                }
                label={
                  <Typography sx={{ fontSize: 12.5 }}>
                    {u.name} <Box component="span" sx={{ color: t.muted2 }}>({ROLE_LABELS[u.role]})</Box>
                  </Typography>
                }
                sx={{ display: "flex", px: 1, py: 0.25, m: 0 }}
              />
            ))}
            {options?.length === 0 && (
              <Typography sx={{ fontSize: 12, color: t.muted, p: 1.5 }}>No accounts found.</Typography>
            )}
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end", mt: 3 }}>
          <ButtonBase
            type="button"
            onClick={requestClose}
            sx={{
              px: 2.25,
              py: 1.125,
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid",
              borderColor: t.border,
              color: t.text2,
            }}
          >
            Cancel
          </ButtonBase>
          <ButtonBase
            type="submit"
            disabled={mutation.isPending}
            sx={{
              px: 2.5,
              py: 1.125,
              fontSize: 13,
              fontWeight: 600,
              bgcolor: ACCENT,
              color: "#fff",
              "&.Mui-disabled": { opacity: 0.6 },
            }}
          >
            {mutation.isPending ? "Sending…" : "Send"}
          </ButtonBase>
        </Box>
      </Box>
      )}
    </EntityModal>
  );
}
