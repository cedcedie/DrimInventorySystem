"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Box } from "@mui/material";
import type { Role } from "@prisma/client";
import { ChromeBar } from "@/components/ChromeBar";
import { SideNav, SIDENAV_WIDTH } from "@/components/SideNav";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";
import { warmShellRoutes } from "@/lib/warmPrefetch";

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
  const segments = accessSegments ?? [];

  useEffect(() => {
    if (!segments.length) return;
    warmShellRoutes(router, queryClient, segments);
    // Only on first shell mount / when access set changes — not every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: warm once per access list
  }, [segments.join("|")]);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <ChromeBar
        userName={userName}
        role={role}
        activeSegment={activeSegment}
        onMenuClick={() => setMobileOpen(true)}
      />
      <SideNav
        role={role}
        badges={badges}
        accessSegments={accessSegments}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: t.bg,
          mt: "64px",
          ml: { xs: 0, md: `${SIDENAV_WIDTH}px` },
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</Box>
        <Box
          sx={{
            px: 3,
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
