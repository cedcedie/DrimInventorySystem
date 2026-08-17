"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Box } from "@mui/material";
import type { Role } from "@/generated/prisma";
import { ChromeBar } from "@/components/ChromeBar";
import { SideNav, SIDENAV_WIDTH, SIDENAV_WIDTH_COLLAPSED } from "@/components/SideNav";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, motion } from "@/theme/tokens";
import { warmShellRoutes } from "@/lib/warmPrefetch";

const COLLAPSE_STORAGE_KEY = "drim-sidenav-collapsed";

export function AppShell({
  userName,
  role,
  badges,
  accessSegments,
  children,
}: {
  userName: string;
  role: Role;
  badges: Record<string, string>;
  /** Nav segments this user may see, computed server-side from effective permissions. */
  accessSegments?: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeSegment = pathname?.split("/").filter(Boolean)[0] ?? "";
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const segments = accessSegments ?? [];

  useEffect(() => {
    if (!segments.length) return;
    warmShellRoutes(router, queryClient, segments);
    // Only on first shell mount / when access set changes — not every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: warm once per access list
  }, [segments.join("|")]);

  // Persisted across sessions — read once on mount so SSR/first paint stays
  // uncollapsed (avoids a layout flash) and then snaps to the saved state.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSE_STORAGE_KEY);
      if (saved === "1") setCollapsed(true);
    } catch {
      // localStorage unavailable — default to expanded, non-fatal.
    }
    setHydrated(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const railWidth = hydrated && collapsed ? SIDENAV_WIDTH_COLLAPSED : SIDENAV_WIDTH;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <ChromeBar
        userName={userName}
        role={role}
        activeSegment={activeSegment}
        onMenuClick={() => setMobileOpen(true)}
        railWidth={railWidth}
      />
      <SideNav
        role={role}
        badges={badges}
        accessSegments={accessSegments}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        hydrated={hydrated}
        onToggleCollapsed={toggleCollapsed}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: t.bg,
          mt: "64px",
          ml: { xs: 0, md: `${railWidth}px` },
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          transition: hydrated ? `margin-left ${motion.duration.sidebar}ms ${motion.easing.standard}` : undefined,
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            animation: "drim-page-enter 240ms cubic-bezier(0.2, 0, 0, 1)",
            "@keyframes drim-page-enter": {
              from: { opacity: 0, transform: "translateY(8px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          {children}
        </Box>
        <Box
          sx={{
            px: { xs: 1.5, sm: 2.5, md: 3 },
            py: 1.5,
            borderTop: "1px solid",
            borderColor: t.line,
            fontSize: 12.5,
            color: t.muted,
            bgcolor: t.surface,
          }}
        >
          {new Date().getFullYear()} © DRIM Inventory Management System
        </Box>
      </Box>
    </Box>
  );
}
