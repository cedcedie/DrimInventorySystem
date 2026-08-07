"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, ButtonBase, Drawer, Typography, useMediaQuery, useTheme } from "@mui/material";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import SwapVertOutlinedIcon from "@mui/icons-material/SwapVertOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import { signOut } from "next-auth/react";
import type { Role } from "@/generated/prisma";
import { MODULE_ACCESS } from "@/lib/rbac";
import { NAV_GROUPS, screenTitleForRole } from "@/lib/navConfig";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, ACCENT_SOFT } from "@/theme/tokens";

export const SIDENAV_WIDTH = 252;

const SEGMENT_ICONS: Record<string, React.ElementType> = {
  dashboard: GridViewOutlinedIcon,
  inventory: Inventory2OutlinedIcon,
  products: SellOutlinedIcon,
  suppliers: LocalShippingOutlinedIcon,
  stock: SwapVertOutlinedIcon,
  technicians: EngineeringOutlinedIcon,
  users: PeopleAltOutlinedIcon,
  reports: DescriptionOutlinedIcon,
  permissions: AdminPanelSettingsOutlinedIcon,
  activity: HistoryOutlinedIcon,
  settings: SettingsOutlinedIcon,
};

function Logo() {
  return (
    <Box
      component={Link}
      href="/dashboard"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 2.5,
        height: 64,
        flexShrink: 0,
        textDecoration: "none",
      }}
    >
      <Box
        component="img"
        src="/images/drim-d-transparent.png"
        alt="DRIM"
        sx={{ width: 36, height: 36 }}
      />
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: "text.primary", letterSpacing: "-0.3px" }}>
        DRIM{" "}
        <Box component="span" sx={{ color: ACCENT }}>
          IMS
        </Box>
      </Typography>
    </Box>
  );
}

export function SideNav({
  role,
  badges,
  accessSegments,
  mobileOpen = false,
  onMobileClose,
}: {
  role: Role;
  badges: Record<string, string>;
  /** Effective-permission segments from the server; falls back to the static role map. */
  accessSegments?: string[];
  /** Controls the temporary Drawer below the `md` breakpoint. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const access = accessSegments ?? MODULE_ACCESS[role] ?? [];
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

  const navContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Logo />
      <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, pb: 1 }}>
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => access.includes(item.segment));
          if (!items.length) return null;
          return (
            <Box key={group.label} sx={{ mb: 0.5 }}>
              <Typography
                sx={{
                  px: 1.25,
                  pt: 2,
                  pb: 0.75,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                  color: t.muted2,
                }}
              >
                {group.label}
              </Typography>
              {items.map((item) => {
                const active = item.segment === activeSegment;
                const pending = pendingSegment === item.segment;
                const label = screenTitleForRole(item.segment, role);
                const badge = badges[item.segment] ?? "";
                const Icon = SEGMENT_ICONS[item.segment] ?? GridViewOutlinedIcon;
                return (
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
                      display: "flex",
                      alignItems: "center",
                      gap: 1.25,
                      textDecoration: "none",
                      px: 1.25,
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
                      transition: "background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease",
                      "&:hover": {
                        bgcolor: active ? (mode === "dark" ? t.rowSel : ACCENT_SOFT) : t.hover,
                        color: active ? ACCENT : t.text,
                      },
                      "&:focus-visible": {
                        outline: `2px solid ${ACCENT}`,
                        outlineOffset: "-2px",
                      },
                    }}
                  >
                    <Icon sx={{ fontSize: 19, color: active ? ACCENT : t.muted }} />
                    <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {label}
                    </Box>
                    {badge && !pending && (
                      <Box
                        component="span"
                        sx={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: active ? ACCENT : t.muted2,
                        }}
                      >
                        {badge}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>

      {/* Logout pinned at bottom, matching the reference layout */}
      <Box sx={{ px: 1.5, py: 1.5, borderTop: "1px solid", borderColor: t.line }}>
        <ButtonBase
          onClick={() => signOut({ callbackUrl: "/login" })}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 1.25,
            width: "100%",
            px: 1.25,
            py: "9px",
            borderRadius: "8px",
            fontSize: 14,
            fontWeight: 600,
            color: t.text2,
            "&:hover": { bgcolor: t.hover, color: "#D0302F" },
          }}
        >
          <LogoutOutlinedIcon sx={{ fontSize: 19 }} />
          Logout
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
        width: SIDENAV_WIDTH,
        bottom: 0,
        bgcolor: t.surface,
        borderRight: "1px solid",
        borderColor: t.line,
        zIndex: 1202,
      }}
    >
      {navContent}
    </Box>
  );
}
