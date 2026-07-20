"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Box } from "@mui/material";
import type { Role } from "@prisma/client";
import { ChromeBar } from "@/components/ChromeBar";
import { SideNav } from "@/components/SideNav";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";

export function AppShell({
  userName,
  role,
  badges,
  children,
}: {
  userName: string;
  role: Role;
  badges: Record<string, string>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeSegment = pathname?.split("/").filter(Boolean)[0] ?? "";
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const [mobileOpen, setMobileOpen] = useState(false);

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
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: t.bg,
          mt: "46px",
          ml: { xs: 0, md: "198px" },
          minHeight: "calc(100vh - 46px)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
