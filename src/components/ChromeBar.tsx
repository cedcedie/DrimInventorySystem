"use client";

import { Box, ButtonBase } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";
import { useColorMode } from "@/theme/ThemeRegistry";
import { CHROME_COLOR, ACCENT } from "@/theme/tokens";
import { ROLE_LABELS, screenTitleForRole } from "@/lib/navConfig";

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
  const screenTitle = screenTitleForRole(activeSegment, role);

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 46,
        bgcolor: CHROME_COLOR,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        px: 2,
        zIndex: 1201,
      }}
    >
      <ButtonBase
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        sx={{
          display: { xs: "grid", md: "none" },
          placeItems: "center",
          width: 30,
          height: 30,
          color: "#aeb7c2",
          borderRadius: "2px",
          "&:hover": { color: "#fff" },
        }}
      >
        <MenuIcon fontSize="small" />
      </ButtonBase>

      <Box sx={{ display: "flex", alignItems: "center", gap: "9px" }}>
        <Box
          sx={{
            width: 24,
            height: 24,
            bgcolor: ACCENT,
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 11,
          }}
        >
          DR
        </Box>
        <Box sx={{ fontSize: "13.5px", fontWeight: 700, letterSpacing: "0.4px" }}>
          DRIM{" "}
          <Box component="span" sx={{ fontWeight: 400, color: "#93a1b0" }}>
            Inventory System
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          fontSize: "11.5px",
          color: "#93a1b0",
          borderLeft: "1px solid #3a4855",
          pl: "14px",
        }}
      >
        Warehouse Module ·{" "}
        <Box component="span" sx={{ color: "#c9d2db" }}>
          {screenTitle}
        </Box>
      </Box>

      <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderLeft: "1px solid #3a4855",
            pl: "12px",
          }}
        >
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              bgcolor: "#3a4855",
              display: "grid",
              placeItems: "center",
              fontSize: "10.5px",
              fontWeight: 700,
            }}
          >
            {initialsOf(userName)}
          </Box>
          <Box sx={{ lineHeight: 1.2 }}>
            <Box sx={{ fontSize: 12, fontWeight: 600 }}>{userName}</Box>
            <Box sx={{ fontSize: 10, color: "#93a1b0" }}>{ROLE_LABELS[role]}</Box>
          </Box>
        </Box>

        <ButtonBase
          onClick={toggleMode}
          title="Toggle dark mode"
          sx={{
            border: "1px solid #3a4855",
            color: "#aeb7c2",
            borderRadius: "2px",
            px: "10px",
            py: "5px",
            fontSize: 11,
            fontWeight: 600,
            "&:hover": { color: "#fff", borderColor: "#5a6a7a" },
          }}
        >
          {mode === "dark" ? "Light mode" : "Dark mode"}
        </ButtonBase>

        <ButtonBase
          onClick={() => signOut({ callbackUrl: "/login" })}
          sx={{
            border: "1px solid #3a4855",
            color: "#aeb7c2",
            borderRadius: "2px",
            px: "10px",
            py: "5px",
            fontSize: 11,
            "&:hover": { color: "#fff", borderColor: "#5a6a7a" },
          }}
        >
          Log out
        </ButtonBase>
      </Box>
    </Box>
  );
}
