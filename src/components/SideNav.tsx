"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Box, Typography } from "@mui/material";
import type { Role } from "@prisma/client";
import { MODULE_ACCESS } from "@/lib/rbac";
import { NAV_GROUPS, screenTitleForRole } from "@/lib/navConfig";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";

export function SideNav({
  role,
  badges,
}: {
  role: Role;
  badges: Record<string, string>;
}) {
  const access = MODULE_ACCESS[role] ?? [];
  const pathname = usePathname();
  const activeSegment = pathname?.split("/").filter(Boolean)[0] ?? "";
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const router = useRouter();
  // isPending flips true the instant a nav click fires, before any network
  // activity starts — that's the immediate feedback that was missing.
  const [isPending, startTransition] = useTransition();
  const [pendingSegment, setPendingSegment] = useState<string | null>(null);

  // Once the URL actually catches up to the click, drop the pending flag —
  // covers the transition finishing after isPending itself already settled.
  useEffect(() => {
    setPendingSegment(null);
  }, [pathname]);

  const go = (segment: string) => {
    if (segment === activeSegment) return;
    setPendingSegment(segment);
    startTransition(() => {
      router.push(`/${segment}`);
    });
  };

  return (
    <Box
      sx={{
        position: "fixed",
        top: "46px",
        left: 0,
        width: 198,
        bottom: 0,
        bgcolor: t.bg2,
        borderRight: "1px solid",
        borderColor: t.line,
        overflowY: "auto",
        py: 1.5,
      }}
    >
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => access.includes(item.segment));
        if (!items.length) return null;
        return (
          <Box key={group.label}>
            <Typography
              sx={{
                px: 2,
                pt: 1.25,
                pb: 0.5,
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.9px",
                color: t.muted2,
              }}
            >
              {group.label}
            </Typography>
            {items.map((item) => {
              const active = item.segment === activeSegment;
              const pending = isPending && pendingSegment === item.segment;
              const label = screenTitleForRole(item.segment, role);
              const badge = badges[item.segment] ?? "";
              return (
                <Box
                  key={item.segment}
                  onClick={() => go(item.segment)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    textDecoration: "none",
                    px: "13px",
                    py: "7px",
                    pr: 2,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? ACCENT : t.text2,
                    bgcolor: active ? t.surface : pending ? t.hover : "transparent",
                    borderLeft: "3px solid",
                    borderLeftColor: active ? ACCENT : pending ? t.muted3 : "transparent",
                    opacity: pending ? 0.7 : 1,
                    transition: "opacity 0.1s ease, background-color 0.1s ease",
                    "&:hover": { bgcolor: active ? t.surface : t.hover },
                  }}
                >
                  <span>{label}</span>
                  {badge && !pending && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: 10,
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: t.muted3,
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
  );
}
