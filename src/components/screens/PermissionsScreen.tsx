"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Checkbox, Tabs, Tab, ButtonBase, MenuItem, Select, Collapse, useMediaQuery } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { fetchJson } from "@/lib/api";
import { postJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { usePermissions } from "@/components/PermissionsProvider";
import { useTheme } from "@mui/material/styles";
import { ACCENT, ACCENT_SOFT, motion } from "@/theme/tokens";
import { ROLE_LABELS } from "@/lib/navConfig";
import type { Role } from "@/generated/prisma";

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
  { id: "purchaseRequests", label: "Purchase Requests" },
  { id: "purchaseOrders", label: "Purchase Orders" },
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

/** Create/Edit/Delete/Export are meaningless without View — both enforcement
 * layers (the page-level redirect and the API's requireModuleAccess) check
 * canView first and block everything else if it's off, so "Edit without
 * View" would silently do nothing. Checking any of those also checks View,
 * so the matrix can never save that dead combination in the first place. */
function withViewImplied(perm: string, value: boolean, base: PermissionSet): PermissionSet {
  return {
    canView: perm === "canView" ? value : value || base.canView,
    canCreate: perm === "canCreate" ? value : base.canCreate,
    canEdit: perm === "canEdit" ? value : base.canEdit,
    canDelete: perm === "canDelete" ? value : base.canDelete,
    canExport: perm === "canExport" ? value : base.canExport,
  };
}

const GRID = "minmax(150px, 200px) repeat(5, 1fr) 110px";
const GRID_ROLE = "minmax(150px, 200px) repeat(5, 1fr)";

// Checkbox style per README spec: 18px box, radius 4, #98A2B3 border, orange when checked.
function permCheckboxSx() {
  return {
    p: 0,
    "& .MuiSvgIcon-root": {
      width: 18,
      height: 18,
      borderRadius: "4px",
      color: "transparent",
      border: "1.5px solid #98A2B3",
      boxSizing: "border-box",
      transition: `border-color ${motion.duration.color}ms ${motion.easing.standard}, background-color ${motion.duration.color}ms ${motion.easing.standard}`,
    },
    "&:hover .MuiSvgIcon-root": { borderColor: ACCENT },
    "&.Mui-checked .MuiSvgIcon-root": {
      color: "#fff",
      bgcolor: ACCENT,
      borderColor: ACCENT,
    },
  } as const;
}

export function PermissionsScreen() {
  const t = useTheme().palette;
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: session } = useSession();
  const { patchModule } = usePermissions();
  const [mode, setMode] = useState<"role" | "user">("role");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const refreshAccess = () => {
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

  const applyLiveIfCurrentRole = (roleId: string, module: string, permissions: PermissionSet) => {
    const roleMeta = roleData?.roles.find((r) => r.id === roleId);
    if (roleMeta && session?.user?.role === roleMeta.name) {
      patchModule(module, permissions);
    }
  };

  const applyLiveIfCurrentUser = (
    userId: string,
    module: string,
    permissions: PermissionSet | null,
    roleName?: Role
  ) => {
    if (session?.user?.id !== userId) return;
    if (permissions) {
      patchModule(module, permissions);
      return;
    }
    // Reset override → fall back to role default currently shown in the matrix.
    if (roleName) {
      const fallback = roleDefaultFor(roleName, module);
      patchModule(module, fallback);
    }
  };

  const roleMutation = useMutation({
    mutationFn: (payload: { roleId: string; module: string; permissions: PermissionSet }) =>
      postJson("/api/permissions/update", payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["role-permissions"] });
      const previous = queryClient.getQueryData<RolePermissionsData>(["role-permissions"]);
      queryClient.setQueryData<RolePermissionsData>(["role-permissions"], (old) => {
        if (!old) return old;
        return {
          ...old,
          permissions: old.permissions.map((p) =>
            p.roleId === payload.roleId && p.module === payload.module
              ? { ...p, ...payload.permissions }
              : p
          ),
        };
      });
      applyLiveIfCurrentRole(payload.roleId, payload.module, payload.permissions);
      return { previous };
    },
    onError: (err, payload, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["role-permissions"], ctx.previous);
      const prevRow = ctx?.previous?.permissions.find(
        (p) => p.roleId === payload.roleId && p.module === payload.module
      );
      if (prevRow) {
        applyLiveIfCurrentRole(payload.roleId, payload.module, prevRow);
      }
      showToast(err instanceof Error ? err.message : "Could not update role permissions", "error");
    },
    onSuccess: () => {
      showToast("Role permissions updated");
      refreshAccess();
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      void queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
    },
  });

  const roleDefaultFor = (roleName: string, module: string): PermissionSet => {
    const row = roleData?.permissions.find((p) => p.roleName === roleName && p.module === module);
    return (
      row ?? { canView: false, canCreate: false, canEdit: false, canDelete: false, canExport: false }
    );
  };

  const userMutation = useMutation({
    mutationFn: (payload: { userId: string; module: string; permissions: PermissionSet | null }) =>
      postJson("/api/permissions/user-update", payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["user-permissions"] });
      const previous = queryClient.getQueryData<{ users: UserRow[] }>(["user-permissions"]);
      const target = previous?.users.find((u) => u.id === payload.userId);
      queryClient.setQueryData<{ users: UserRow[] }>(["user-permissions"], (old) => {
        if (!old) return old;
        return {
          users: old.users.map((u) => {
            if (u.id !== payload.userId) return u;
            const others = u.permissions.filter((p) => p.module !== payload.module);
            if (payload.permissions === null) {
              return { ...u, permissions: others };
            }
            return {
              ...u,
              permissions: [...others, { module: payload.module, ...payload.permissions }],
            };
          }),
        };
      });
      applyLiveIfCurrentUser(payload.userId, payload.module, payload.permissions, target?.role);
      return { previous };
    },
    onError: (err, payload, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["user-permissions"], ctx.previous);
      showToast(err instanceof Error ? err.message : "Could not update user permissions", "error");
      refreshAccess();
      void payload;
    },
    onSuccess: (_data, variables) => {
      showToast(
        variables.permissions === null
          ? "Override removed — back to role default"
          : "User override saved"
      );
      refreshAccess();
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
    },
  });

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
    <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, py: { xs: 1.75, sm: 2.5 }, display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, maxWidth: 640 }}>
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
            pending={false}
            onToggle={(roleId, module, perm, value) => {
              const current = roleData.permissions.find(
                (p) => p.roleId === roleId && p.module === module
              );
              if (!current) return;
              roleMutation.mutate({
                roleId,
                module,
                permissions: withViewImplied(perm, value, current),
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
          pending={false}
          onToggle={(user, module, perm, value) => {
            const override = user.permissions.find((p) => p.module === module);
            const effective = override ?? roleDefaultFor(user.role, module);
            userMutation.mutate({
              userId: user.id,
              module,
              permissions: withViewImplied(perm, value, effective),
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
  const theme = useTheme();
  // Below `sm` the 6-column matrix can't fit without unusably small checkboxes; use expandable cards instead.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
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
      <Box sx={{ px: { xs: 1, sm: 2 }, borderBottom: "1px solid", borderColor: t.line }}>
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

      {isMobile ? (
        <Box>
          {MODULES.map((module, index) => {
            const perms = rolePermissions.find((p) => p.module === module.id);
            const grantedCount = PERMISSIONS.filter((perm) => perms?.[perm.id]).length;
            return (
              <PermissionModuleCard
                key={module.id}
                moduleLabel={module.label}
                summary={`${grantedCount}/${PERMISSIONS.length} granted`}
                isLast={index === MODULES.length - 1}
              >
                {PERMISSIONS.map((perm) => (
                  <PermissionToggleRow
                    key={perm.id}
                    icon={perm.Icon}
                    label={perm.label}
                    checked={(perms?.[perm.id] as boolean) ?? false}
                    disabled={pending}
                    ariaLabel={`${module.label} — ${perm.label}`}
                    onChange={(checked) => onToggle(activeRole, module.id, perm.id, checked)}
                  />
                ))}
              </PermissionModuleCard>
            );
          })}
        </Box>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 620 }}>
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
                        sx={permCheckboxSx()}
                      />
                    </Box>
                  ))}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}

/** Tap-to-expand module row for the mobile permissions layout. */
function PermissionModuleCard({
  moduleLabel,
  summary,
  isLast,
  trailingBadge,
  children,
}: {
  moduleLabel: string;
  summary: string;
  isLast: boolean;
  /** Optional "Custom" chip shown next to the summary (User mode only). */
  trailingBadge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTheme().palette;
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ borderBottom: isLast ? "none" : "1px solid", borderColor: t.line }}>
      <ButtonBase
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          px: 2,
          py: 1.5,
          textAlign: "left",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: t.text.primary }}>
            {moduleLabel}
          </Typography>
          {trailingBadge}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
          <Typography sx={{ fontSize: 12, color: t.muted }}>{summary}</Typography>
          <ExpandMoreIcon
            sx={{
              fontSize: 20,
              color: t.muted,
              transition: `transform ${motion.duration.dropdown}ms ${motion.easing.standard}`,
              transform: open ? "rotate(180deg)" : "none",
            }}
          />
        </Box>
      </ButtonBase>
      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 1.5, display: "flex", flexDirection: "column", gap: 0.25 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

/** Full-width permission row for the mobile card; the whole row toggles the checkbox. */
function PermissionToggleRow({
  icon: Icon,
  label,
  checked,
  disabled,
  ariaLabel,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  checked: boolean;
  disabled: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}) {
  const t = useTheme().palette;

  return (
    <ButtonBase
      onClick={() => onChange(!checked)}
      disabled={disabled}
      sx={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        py: 1,
        px: 1,
        borderRadius: "8px",
        minHeight: 44,
        "&:hover": { bgcolor: t.hover },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Icon sx={{ fontSize: 17, color: t.text2 }} />
        <Typography sx={{ fontSize: 13.5, color: t.text.primary }}>{label}</Typography>
      </Box>
      <Checkbox
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
        disabled={disabled}
        slotProps={{ input: { "aria-label": ariaLabel } }}
        sx={permCheckboxSx()}
      />
    </ButtonBase>
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
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
          sx={{ minWidth: { xs: "100%", sm: 260 }, fontSize: 13.5, borderRadius: "8px" }}
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

      {isMobile ? (
        <Box>
          {user &&
            MODULES.map((module, index) => {
              const override = user.permissions.find((p) => p.module === module.id);
              const effective = override ?? roleDefaultFor(user.role, module.id);
              const isCustom = Boolean(override);
              const grantedCount = PERMISSIONS.filter((perm) => effective[perm.id]).length;

              return (
                <PermissionModuleCard
                  key={module.id}
                  moduleLabel={module.label}
                  summary={`${grantedCount}/${PERMISSIONS.length} granted`}
                  isLast={index === MODULES.length - 1}
                  trailingBadge={
                    isCustom ? (
                      <Box
                        component="span"
                        sx={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: ACCENT,
                          bgcolor: t.mode === "dark" ? t.rowSel : ACCENT_SOFT,
                          borderRadius: "999px",
                          px: 0.875,
                          py: 0.25,
                        }}
                      >
                        Custom
                      </Box>
                    ) : undefined
                  }
                >
                  {PERMISSIONS.map((perm) => (
                    <PermissionToggleRow
                      key={perm.id}
                      icon={perm.Icon}
                      label={perm.label}
                      checked={effective[perm.id]}
                      disabled={pending}
                      ariaLabel={`${user.name}: ${module.label} — ${perm.label}`}
                      onChange={(checked) => onToggle(user, module.id, perm.id, checked)}
                    />
                  ))}
                  <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 0.5 }}>
                    {isCustom ? (
                      <ButtonBase
                        onClick={() => onReset(user, module.id)}
                        disabled={pending}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          fontSize: 12,
                          fontWeight: 600,
                          color: t.muted,
                          border: "1px solid",
                          borderColor: t.line,
                          borderRadius: "8px",
                          px: 1.25,
                          py: 0.625,
                          "&:hover": { borderColor: ACCENT, color: ACCENT },
                        }}
                      >
                        <RestartAltIcon sx={{ fontSize: 15 }} />
                        Reset to role default
                      </ButtonBase>
                    ) : (
                      <Typography sx={{ fontSize: 11.5, color: t.muted2 }}>
                        Following {ROLE_LABELS[user.role]} role default
                      </Typography>
                    )}
                  </Box>
                </PermissionModuleCard>
              );
            })}
        </Box>
      ) : (
        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: 700 }}>
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
                          sx={permCheckboxSx()}
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
        </Box>
      )}
    </Box>
  );
}
