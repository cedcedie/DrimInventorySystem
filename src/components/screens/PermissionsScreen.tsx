"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Checkbox, Tabs, Tab, ButtonBase, MenuItem, Select } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { fetchJson } from "@/lib/api";
import { postJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { useTheme } from "@mui/material/styles";
import { ACCENT, ACCENT_SOFT } from "@/theme/tokens";
import { ROLE_LABELS } from "@/lib/navConfig";
import type { Role } from "@prisma/client";

interface PermissionSet {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

interface RolePermission extends PermissionSet {
  roleId: string;
  roleName: string;
  module: string;
}

interface RolePermissionsData {
  roles: Array<{ id: string; name: string; label: string }>;
  permissions: RolePermission[];
}

interface UserOverride extends PermissionSet {
  module: string;
}

interface UserRow {
  id: string;
  name: string;
  username: string;
  role: Role;
  permissions: UserOverride[];
}

const MODULES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "inventory", label: "Inventory" },
  { id: "products", label: "Products" },
  { id: "stock", label: "Stock In/Out" },
  { id: "mrf", label: "Material Requests" },
  { id: "suppliers", label: "Suppliers" },
  { id: "technicians", label: "Technicians" },
  { id: "users", label: "Users" },
  { id: "reports", label: "Reports" },
];

const PERMISSIONS = [
  { id: "canView", label: "View", Icon: VisibilityOutlinedIcon },
  { id: "canCreate", label: "Create", Icon: AddCircleOutlineIcon },
  { id: "canEdit", label: "Edit", Icon: EditOutlinedIcon },
  { id: "canDelete", label: "Delete", Icon: DeleteOutlineIcon },
  { id: "canExport", label: "Export", Icon: FileDownloadOutlinedIcon },
] as const;

const GRID = "minmax(150px, 200px) repeat(5, 1fr) 110px";
const GRID_ROLE = "minmax(150px, 200px) repeat(5, 1fr)";

export function PermissionsScreen() {
  const t = useTheme().palette;
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<"role" | "user">("role");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const refreshAccess = () => {
    // Layout + PermissionsProvider read from the server cache — force a
    // soft refresh so nav/buttons pick up the new matrix without a full reload.
    router.refresh();
  };

  const { data: roleData, isLoading: rolesLoading } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: () => fetchJson<RolePermissionsData>("/api/permissions/roles"),
  });

  const { data: userData, isLoading: usersLoading } = useQuery({
    queryKey: ["user-permissions"],
    queryFn: () => fetchJson<{ users: UserRow[] }>("/api/permissions/users"),
    enabled: mode === "user",
  });

  const roleMutation = useMutation({
    mutationFn: (payload: { roleId: string; module: string; permissions: PermissionSet }) =>
      postJson("/api/permissions/update", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
      refreshAccess();
      showToast("Role permissions updated");
    },
  });

  const userMutation = useMutation({
    mutationFn: (payload: { userId: string; module: string; permissions: PermissionSet | null }) =>
      postJson("/api/permissions/user-update", payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
      refreshAccess();
      showToast(
        variables.permissions === null
          ? "Override removed — back to role default"
          : "User override saved"
      );
    },
  });

  const roleDefaultFor = (roleName: string, module: string): PermissionSet => {
    const row = roleData?.permissions.find((p) => p.roleName === roleName && p.module === module);
    return (
      row ?? { canView: false, canCreate: false, canEdit: false, canDelete: false, canExport: false }
    );
  };

  const modeButton = (value: "role" | "user", label: string, desc: string) => {
    const active = mode === value;
    return (
      <ButtonBase
        onClick={() => setMode(value)}
        sx={{
          flex: 1,
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 0.25,
          px: 2,
          py: 1.5,
          borderRadius: "8px",
          border: "1px solid",
          borderColor: active ? ACCENT : t.line,
          bgcolor: active ? (t.mode === "dark" ? t.rowSel : ACCENT_SOFT) : t.surface,
          textAlign: "left",
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: active ? ACCENT : t.text.primary }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 12, color: t.muted }}>{desc}</Typography>
      </ButtonBase>
    );
  };

  return (
    <Box sx={{ px: 3, py: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Mode switcher */}
      <Box sx={{ display: "flex", gap: 1.5, maxWidth: 640 }}>
        {modeButton("role", "Role Permissions", "Defaults that apply to everyone with the role")}
        {modeButton("user", "User Permissions", "Per-user overrides that beat the role default")}
      </Box>

      {mode === "role" ? (
        rolesLoading || !roleData ? (
          <Typography sx={{ fontSize: 14, color: t.muted }}>Loading permissions...</Typography>
        ) : (
          <RoleMatrix
            data={roleData}
            selectedRole={selectedRole}
            onSelectRole={setSelectedRole}
            pending={roleMutation.isPending}
            onToggle={(roleId, module, perm, value) => {
              const current = roleData.permissions.find(
                (p) => p.roleId === roleId && p.module === module
              );
              if (!current) return;
              roleMutation.mutate({
                roleId,
                module,
                permissions: {
                  canView: perm === "canView" ? value : current.canView,
                  canCreate: perm === "canCreate" ? value : current.canCreate,
                  canEdit: perm === "canEdit" ? value : current.canEdit,
                  canDelete: perm === "canDelete" ? value : current.canDelete,
                  canExport: perm === "canExport" ? value : current.canExport,
                },
              });
            }}
          />
        )
      ) : usersLoading || !userData || !roleData ? (
        <Typography sx={{ fontSize: 14, color: t.muted }}>Loading users...</Typography>
      ) : (
        <UserMatrix
          users={userData.users}
          selectedUserId={selectedUserId || userData.users[0]?.id || ""}
          onSelectUser={setSelectedUserId}
          roleDefaultFor={roleDefaultFor}
          pending={userMutation.isPending}
          onToggle={(user, module, perm, value) => {
            const override = user.permissions.find((p) => p.module === module);
            const effective = override ?? roleDefaultFor(user.role, module);
            userMutation.mutate({
              userId: user.id,
              module,
              permissions: {
                canView: perm === "canView" ? value : effective.canView,
                canCreate: perm === "canCreate" ? value : effective.canCreate,
                canEdit: perm === "canEdit" ? value : effective.canEdit,
                canDelete: perm === "canDelete" ? value : effective.canDelete,
                canExport: perm === "canExport" ? value : effective.canExport,
              },
            });
          }}
          onReset={(user, module) =>
            userMutation.mutate({ userId: user.id, module, permissions: null })
          }
        />
      )}
    </Box>
  );
}

function MatrixHeader({ grid, withStatus }: { grid: string; withStatus?: boolean }) {
  const t = useTheme().palette;
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: grid,
        bgcolor: "background.default",
        borderBottom: "1px solid",
        borderColor: t.line,
      }}
    >
      <Box sx={{ px: 2, py: 1.5, fontSize: 13, fontWeight: 700 }}>Module</Box>
      {PERMISSIONS.map(({ id, label, Icon }) => (
        <Box
          key={id}
          sx={{
            px: 1,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <Icon sx={{ fontSize: 16, color: t.text2 }} />
          {label}
        </Box>
      ))}
      {withStatus && <Box sx={{ px: 1, py: 1.5, fontSize: 13, fontWeight: 700 }}>Source</Box>}
    </Box>
  );
}

function RoleMatrix({
  data,
  selectedRole,
  onSelectRole,
  pending,
  onToggle,
}: {
  data: RolePermissionsData;
  selectedRole: string;
  onSelectRole: (id: string) => void;
  pending: boolean;
  onToggle: (roleId: string, module: string, perm: string, value: boolean) => void;
}) {
  const t = useTheme().palette;
  const activeRole = selectedRole || data.roles[0]?.id;
  const rolePermissions = data.permissions.filter((p) => p.roleId === activeRole);

  return (
    <Box
      sx={{
        bgcolor: t.surface,
        border: "1px solid",
        borderColor: t.line,
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 2, borderBottom: "1px solid", borderColor: t.line }}>
        <Tabs
          value={activeRole}
          onChange={(_, v) => onSelectRole(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            "& .MuiTab-root": {
              fontSize: 14,
              fontWeight: 600,
              textTransform: "none",
              minHeight: 48,
              color: t.muted,
              "&.Mui-selected": { color: ACCENT },
            },
            "& .MuiTabs-indicator": { backgroundColor: ACCENT, height: 3 },
          }}
        >
          {data.roles.map((role) => (
            <Tab key={role.id} label={role.label} value={role.id} />
          ))}
        </Tabs>
      </Box>

      <MatrixHeader grid={GRID_ROLE} />

      {MODULES.map((module, index) => {
        const perms = rolePermissions.find((p) => p.module === module.id);
        return (
          <Box
            key={module.id}
            sx={{
              display: "grid",
              gridTemplateColumns: GRID_ROLE,
              borderBottom: index < MODULES.length - 1 ? "1px solid" : "none",
              borderColor: t.line,
              alignItems: "center",
              "&:hover": { bgcolor: t.hover },
            }}
          >
            <Box sx={{ px: 2, py: 0.75, fontSize: 14, fontWeight: 600 }}>{module.label}</Box>
            {PERMISSIONS.map((perm) => (
              <Box key={perm.id} sx={{ display: "flex", justifyContent: "center" }}>
                <Checkbox
                  checked={(perms?.[perm.id] as boolean) ?? false}
                  onChange={(e) => onToggle(activeRole, module.id, perm.id, e.target.checked)}
                  disabled={pending}
                  slotProps={{ input: { "aria-label": `${module.label} — ${perm.label}` } }}
                  sx={{ color: t.muted3, "&.Mui-checked": { color: ACCENT } }}
                />
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );
}

function UserMatrix({
  users,
  selectedUserId,
  onSelectUser,
  roleDefaultFor,
  pending,
  onToggle,
  onReset,
}: {
  users: UserRow[];
  selectedUserId: string;
  onSelectUser: (id: string) => void;
  roleDefaultFor: (roleName: string, module: string) => PermissionSet;
  pending: boolean;
  onToggle: (user: UserRow, module: string, perm: string, value: boolean) => void;
  onReset: (user: UserRow, module: string) => void;
}) {
  const t = useTheme().palette;
  const user = users.find((u) => u.id === selectedUserId);

  return (
    <Box
      sx={{
        bgcolor: t.surface,
        border: "1px solid",
        borderColor: t.line,
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {/* User picker */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: "1px solid",
          borderColor: t.line,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Account</Typography>
        <Select
          size="small"
          value={selectedUserId}
          onChange={(e) => onSelectUser(e.target.value)}
          sx={{ minWidth: 260, fontSize: 13.5, borderRadius: "8px" }}
        >
          {users.map((u) => (
            <MenuItem key={u.id} value={u.id} sx={{ fontSize: 13.5 }}>
              {u.name} — {ROLE_LABELS[u.role]}
            </MenuItem>
          ))}
        </Select>
        {user && (
          <Typography sx={{ fontSize: 12.5, color: t.muted }}>
            Unchanged rows follow the {ROLE_LABELS[user.role]} role defaults.
          </Typography>
        )}
      </Box>

      <MatrixHeader grid={GRID} withStatus />

      {user &&
        MODULES.map((module, index) => {
          const override = user.permissions.find((p) => p.module === module.id);
          const effective = override ?? roleDefaultFor(user.role, module.id);
          const isCustom = Boolean(override);

          return (
            <Box
              key={module.id}
              sx={{
                display: "grid",
                gridTemplateColumns: GRID,
                borderBottom: index < MODULES.length - 1 ? "1px solid" : "none",
                borderColor: t.line,
                alignItems: "center",
                bgcolor: isCustom ? (t.mode === "dark" ? t.rowSel : ACCENT_SOFT) : "transparent",
                "&:hover": { bgcolor: isCustom ? undefined : t.hover },
              }}
            >
              <Box sx={{ px: 2, py: 0.75, fontSize: 14, fontWeight: 600 }}>{module.label}</Box>
              {PERMISSIONS.map((perm) => (
                <Box key={perm.id} sx={{ display: "flex", justifyContent: "center" }}>
                  <Checkbox
                    checked={effective[perm.id]}
                    onChange={(e) => onToggle(user, module.id, perm.id, e.target.checked)}
                    disabled={pending}
                    slotProps={{
                      input: { "aria-label": `${user.name}: ${module.label} — ${perm.label}` },
                    }}
                    sx={{ color: t.muted3, "&.Mui-checked": { color: ACCENT } }}
                  />
                </Box>
              ))}
              <Box sx={{ px: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
                {isCustom ? (
                  <>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ACCENT }}>
                      Custom
                    </Typography>
                    <ButtonBase
                      title="Reset to role default"
                      aria-label={`Reset ${module.label} to role default`}
                      onClick={() => onReset(user, module.id)}
                      disabled={pending}
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: "6px",
                        border: "1px solid",
                        borderColor: t.line,
                        color: t.muted,
                        "&:hover": { borderColor: ACCENT, color: ACCENT },
                      }}
                    >
                      <RestartAltIcon sx={{ fontSize: 15 }} />
                    </ButtonBase>
                  </>
                ) : (
                  <Typography sx={{ fontSize: 11.5, color: t.muted2 }}>Role default</Typography>
                )}
              </Box>
            </Box>
          );
        })}
    </Box>
  );
}
