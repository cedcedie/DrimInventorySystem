"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, ButtonBase, Drawer, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import SwapVertOutlinedIcon from "@mui/icons-material/SwapVertOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import PlaylistAddCheckOutlinedIcon from "@mui/icons-material/PlaylistAddCheckOutlined";
import FirstPageOutlinedIcon from "@mui/icons-material/FirstPageOutlined";
import LastPageOutlinedIcon from "@mui/icons-material/LastPageOutlined";
import { signOut } from "next-auth/react";
import type { Role } from "@/generated/prisma";
import { MODULE_ACCESS } from "@/lib/rbac";
import { NAV_GROUPS, screenTitleForRole } from "@/lib/navConfig";
import { isConfigurableModule } from "@/lib/permissionDefaults";
import { usePermissions } from "@/components/PermissionsProvider";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, ACCENT_SOFT, motion } from "@/theme/tokens";

export const SIDENAV_WIDTH = 252;
export const SIDENAV_WIDTH_COLLAPSED = 76;

const SEGMENT_ICONS: Record<string, React.ElementType> = {
  dashboard: GridViewOutlinedIcon,
  inventory: Inventory2OutlinedIcon,
  products: SellOutlinedIcon,
  suppliers: LocalShippingOutlinedIcon,
  purchaseRequests: PlaylistAddCheckOutlinedIcon,
  purchaseOrders: ShoppingCartOutlinedIcon,
  adjustments: TuneOutlinedIcon,
  stock: SwapVertOutlinedIcon,
  technicians: EngineeringOutlinedIcon,
  users: PeopleAltOutlinedIcon,
  reports: DescriptionOutlinedIcon,
  permissions: AdminPanelSettingsOutlinedIcon,
  activity: HistoryOutlinedIcon,
  settings: SettingsOutlinedIcon,
};

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <Box
      component={Link}
      href="/dashboard"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: collapsed ? 0 : 2.5,
        justifyContent: collapsed ? "center" : "flex-start",
        height: 64,
        flexShrink: 0,
        textDecoration: "none",
      }}
    >
      <Box
        component="img"
        src="/images/drim-d-transparent.png"
        alt="DRIM"
        sx={{ width: 32, height: 32, flexShrink: 0 }}
      />
      {!collapsed && (
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: "text.primary", letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>
          DRIM{" "}
          <Box component="span" sx={{ color: ACCENT }}>
            IMS
          </Box>
        </Typography>
      )}
    </Box>
  );
}

export function SideNav({
  role,
  badges,
  accessSegments,
  mobileOpen = false,
  onMobileClose,
  collapsed = false,
  hydrated = true,
  onToggleCollapsed,
}: {
  role: Role;
  badges: Record<string, string>;
  /** Effective-permission segments from the server; falls back to the static role map. */
  accessSegments?: string[];
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Owned by AppShell so ChromeBar/main canvas react to the same collapse width. */
  collapsed?: boolean;
  /** False until the persisted preference loads from localStorage — avoids a layout flash. */
  hydrated?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const access = accessSegments ?? MODULE_ACCESS[role] ?? [];
  const { permissions } = usePermissions();
  const pathname = usePathname();
  const activeSegment = pathname?.split("/").filter(Boolean)[0] ?? "";
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [pendingSegment, setPendingSegment] = useState<string | null>(null);

  useEffect(() => {
    setPendingSegment(null);
  }, [pathname]);

  const canShowSegment = (segment: string) => {
    if (isConfigurableModule(segment)) {
      if (permissions[segment]?.canView) return true;
      if (segment === "stock" && role === "TECHNICIAN" && permissions.mrf?.canView) return true;
      return false;
    }
    return access.includes(segment);
  };

  // Collapse only applies to the desktop rail — mobile Drawer is always full-width.
  const effectiveCollapsed = !isMobile && collapsed && hydrated;

  const navContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Logo collapsed={effectiveCollapsed} />
      <Box className="scroll-hidden" sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", px: effectiveCollapsed ? 1 : 1.5, pb: 1 }}>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => canShowSegment(item.segment));
          if (!items.length) return null;
          return (
            <Box key={group.label} sx={{ mb: 0.5 }}>
              {effectiveCollapsed ? (
                <Box sx={{ height: "1px", bgcolor: t.line, mx: 0.5, my: 1.25 }} />
              ) : (
                <Typography
                  sx={{
                    px: 1.25,
                    pt: 2,
                    pb: 0.75,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: t.muted2,
                    whiteSpace: "nowrap",
                  }}
                >
                  {group.label}
                </Typography>
              )}
              {items.map((item) => {
                const active = item.segment === activeSegment;
                const pending = pendingSegment === item.segment;
                const label = screenTitleForRole(item.segment, role);
                const badge = badges[item.segment] ?? "";
                const Icon = SEGMENT_ICONS[item.segment] ?? GridViewOutlinedIcon;
                const row = (
                  <Box
                    key={item.segment}
                    component={Link}
                    href={`/${item.segment}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => {
                      onMobileClose?.();
                      if (item.segment !== activeSegment) setPendingSegment(item.segment);
                    }}
                    sx={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: effectiveCollapsed ? "center" : "flex-start",
                      gap: 1.25,
                      textDecoration: "none",
                      px: effectiveCollapsed ? 0 : 1.25,
                      py: "9px",
                      mb: "2px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: active ? 700 : 500,
                      color: active ? ACCENT : t.text2,
                      bgcolor: active
                        ? mode === "dark"
                          ? t.rowSel
                          : ACCENT_SOFT
                        : pending
                        ? t.hover
                        : "transparent",
                      opacity: pending ? 0.7 : 1,
                      transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, color ${motion.duration.color}ms ${motion.easing.standard}, opacity ${motion.duration.color}ms ${motion.easing.standard}`,
                      "&:hover": {
                        bgcolor: active ? (mode === "dark" ? t.rowSel : ACCENT_SOFT) : t.hover,
                        color: active ? ACCENT : t.text,
                      },
                      "&:focus-visible": {
                        outline: `2px solid ${ACCENT}`,
                        outlineOffset: "-2px",
                      },
                      "&::before": active
                        ? {
                            content: '""',
                            position: "absolute",
                            left: -6,
                            top: 8,
                            bottom: 8,
                            width: 3,
                            borderRadius: 999,
                            bgcolor: ACCENT,
                          }
                        : undefined,
                    }}
                  >
                    <Icon sx={{ fontSize: 19, color: active ? ACCENT : t.muted, flexShrink: 0 }} />
                    {!effectiveCollapsed && (
                      <>
                        <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {label}
                        </Box>
                        {badge && !pending && (
                          <Box
                            component="span"
                            sx={{
                              fontSize: 11,
                              fontWeight: 700,
                              fontFamily: "'IBM Plex Mono', monospace",
                              color: active ? ACCENT : t.muted2,
                              bgcolor: t.hover,
                              borderRadius: 999,
                              px: 0.75,
                              py: "1px",
                            }}
                          >
                            {badge}
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                );
                return effectiveCollapsed ? (
                  <Tooltip key={item.segment} title={label} placement="right">
                    {row}
                  </Tooltip>
                ) : (
                  row
                );
              })}
            </Box>
          );
        })}
      </Box>

      {!isMobile && (
        <Box sx={{ px: effectiveCollapsed ? 1 : 1.5, py: 1, borderTop: "1px solid", borderColor: t.line }}>
          <ButtonBase
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: effectiveCollapsed ? "center" : "flex-start",
              gap: 1.25,
              width: "100%",
              px: effectiveCollapsed ? 0 : 1.25,
              py: "9px",
              borderRadius: "8px",
              fontSize: 13,
              fontWeight: 600,
              color: t.muted,
              "&:hover": { bgcolor: t.hover, color: t.text },
            }}
          >
            {collapsed ? <LastPageOutlinedIcon sx={{ fontSize: 19 }} /> : <FirstPageOutlinedIcon sx={{ fontSize: 19 }} />}
            {!effectiveCollapsed && "Collapse"}
          </ButtonBase>
        </Box>
      )}

      <Box sx={{ px: effectiveCollapsed ? 1 : 1.5, py: 1.5, borderTop: "1px solid", borderColor: t.line }}>
        <ButtonBase
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Logout"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: effectiveCollapsed ? "center" : "flex-start",
            gap: 1.25,
            width: "100%",
            px: effectiveCollapsed ? 0 : 1.25,
            py: "9px",
            borderRadius: "8px",
            fontSize: 14,
            fontWeight: 600,
            color: t.text2,
            "&:hover": { bgcolor: t.hover, color: "#D0302F" },
          }}
        >
          <LogoutOutlinedIcon sx={{ fontSize: 19 }} />
          {!effectiveCollapsed && "Logout"}
        </ButtonBase>
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          "& .MuiDrawer-paper": {
            width: SIDENAV_WIDTH,
            bgcolor: t.surface,
            borderRight: "1px solid",
            borderColor: t.line,
            boxSizing: "border-box",
            boxShadow: "none",
          },
        }}
      >
        {navContent}
      </Drawer>
    );
  }

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        width: effectiveCollapsed ? SIDENAV_WIDTH_COLLAPSED : SIDENAV_WIDTH,
        bottom: 0,
        bgcolor: t.surface,
        borderRight: "1px solid",
        borderColor: t.line,
        zIndex: 1202,
        transition: hydrated ? `width ${motion.duration.sidebar}ms ${motion.easing.standard}` : undefined,
        overflow: "hidden",
      }}
    >
      {navContent}
    </Box>
  );
}
