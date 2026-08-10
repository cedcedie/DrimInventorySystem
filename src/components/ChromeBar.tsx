"use client";

import { Box, ButtonBase } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import AddIcon from "@mui/icons-material/Add";
import Link from "next/link";
import type { Role } from "@/generated/prisma";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, ACCENT_HOVER, NAVY } from "@/theme/tokens";
import { ROLE_LABELS } from "@/lib/navConfig";
import { SIDENAV_WIDTH } from "@/components/SideNav";
import { useCan } from "@/components/PermissionsProvider";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";

function initialsOf(name: string): string {
  return name
    .split(/[.\s]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ChromeBar({
  userName,
  role,
  activeSegment,
  onMenuClick,
}: {
  userName: string;
  role: Role;
  activeSegment: string;
  /** Opens the mobile nav drawer; the button is hidden at `md` and up. */
  onMenuClick?: () => void;
}) {
  const { mode, toggleMode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const canAddProducts = useCan("products", "canCreate");
  void activeSegment;
  void role;

  const iconButtonSx = {
    width: 38,
    height: 38,
    borderRadius: "8px",
    border: "1px solid",
    borderColor: t.line,
    color: t.muted,
    bgcolor: t.surface,
    "&:hover": { borderColor: ACCENT, color: ACCENT },
  } as const;

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: { xs: 0, md: `${SIDENAV_WIDTH}px` },
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
            href="/products"
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
              "&:hover": { bgcolor: ACCENT_HOVER },
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

        {/* Profile */}
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
            "&:hover .chrome-avatar": { bgcolor: ACCENT },
          }}
        >
          <Box
            className="chrome-avatar"
            sx={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              bgcolor: NAVY,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 13,
              fontWeight: 700,
              transition: "background-color 0.12s ease",
            }}
          >
            {initialsOf(userName)}
          </Box>
          <Box sx={{ lineHeight: 1.25, display: { xs: "none", lg: "block" } }}>
            <Box sx={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{userName}</Box>
            <Box sx={{ fontSize: 11.5, color: t.muted }}>{ROLE_LABELS[role]}</Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
