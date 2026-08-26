"use client";

import { useQuery } from "@tanstack/react-query";
import { Box, ButtonBase } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import AddIcon from "@mui/icons-material/Add";
import Link from "next/link";
import type { Role } from "@/generated/prisma";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, ACCENT_HOVER, motion } from "@/theme/tokens";
import { ROLE_LABELS } from "@/lib/navConfig";
import { SIDENAV_WIDTH } from "@/components/SideNav";
import { useCan } from "@/components/PermissionsProvider";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { UserAvatar } from "@/components/UserAvatar";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

export function ChromeBar({
  userName,
  role,
  activeSegment,
  onMenuClick,
  railWidth,
}: {
  userName: string;
  role: Role;
  activeSegment: string;
  onMenuClick?: () => void;
  /** Desktop sidebar width (collapses 252→76) — keeps bar's left offset in sync with the rail. */
  railWidth?: number;
}) {
  const { mode, toggleMode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const canAddProducts = useCan("products", "canCreate");
  void activeSegment;

  // Shares queryKeys.profile with ProfileScreen, so uploading/removing a
  // picture there updates this header immediately via cache invalidation.
  const { data: profile } = useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => fetchJson<{ avatarKey: string | null }>("/api/me"),
    staleTime: 60_000,
  });

  const iconButtonSx = {
    width: 38,
    height: 38,
    borderRadius: "8px",
    border: "1px solid",
    borderColor: t.line,
    color: t.muted,
    bgcolor: t.surface,
    transition: `border-color ${motion.duration.color}ms ${motion.easing.standard}, color ${motion.duration.color}ms ${motion.easing.standard}`,
    "&:hover": { borderColor: ACCENT, color: ACCENT },
  } as const;

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: { xs: 0, md: `${railWidth ?? SIDENAV_WIDTH}px` },
        right: 0,
        height: 64,
        bgcolor: t.surface,
        borderBottom: "1px solid",
        borderColor: t.line,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2.5,
        zIndex: 1201,
        transition: `left ${motion.duration.sidebar}ms ${motion.easing.standard}`,
      }}
    >
      <ButtonBase
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        sx={{
          display: { xs: "grid", md: "none" },
          placeItems: "center",
          width: 38,
          height: 38,
          color: t.muted,
          borderRadius: "8px",
          "&:hover": { color: t.text },
        }}
      >
        <MenuIcon fontSize="small" />
      </ButtonBase>

      <GlobalSearch />

      <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1.25 }}>
        {canAddProducts && (
          <ButtonBase
            component={Link}
            href="/products?add=1"
            sx={{
              display: { xs: "none", sm: "inline-flex" },
              alignItems: "center",
              gap: 0.5,
              bgcolor: ACCENT,
              color: "#fff",
              borderRadius: "8px",
              px: 1.75,
              height: 38,
              fontSize: 13.5,
              fontWeight: 700,
              transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, transform ${motion.duration.press}ms ${motion.easing.standard}`,
              "&:hover": { bgcolor: ACCENT_HOVER },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            <AddIcon sx={{ fontSize: 17 }} />
            Add New
          </ButtonBase>
        )}

        <ButtonBase onClick={toggleMode} title="Toggle dark mode" sx={iconButtonSx}>
          {mode === "dark" ? (
            <LightModeOutlinedIcon sx={{ fontSize: 19 }} />
          ) : (
            <DarkModeOutlinedIcon sx={{ fontSize: 19 }} />
          )}
        </ButtonBase>

        <NotificationBell buttonSx={iconButtonSx} />

        <Box
          component={Link}
          href="/profile"
          title="My account"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            pl: 0.5,
            color: "inherit",
            textDecoration: "none",
          }}
        >
          <UserAvatar avatarKey={profile?.avatarKey} name={userName} size={38} />
          <Box sx={{ lineHeight: 1.25, display: { xs: "none", lg: "block" } }}>
            <Box sx={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{userName}</Box>
            <Box sx={{ fontSize: 11.5, color: t.muted }}>{ROLE_LABELS[role]}</Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
