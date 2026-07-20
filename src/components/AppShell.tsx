"use client";

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

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <ChromeBar userName={userName} role={role} activeSegment={activeSegment} />
      <SideNav role={role} badges={badges} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: t.bg,
          mt: "46px",
          ml: "198px",
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
