"use client";

import { Box, Typography } from "@mui/material";
import Link from "next/link";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";

export function ScreenHeader({
  title,
  subtitle,
  permSummary,
}: {
  title: string;
  subtitle: string;
  permSummary?: string;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  void permSummary;
  const isDashboard = title === "Dashboard";

  return (
    <Box sx={{ px: 3, pt: 2.5, pb: 0.5 }}>
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: t.text, lineHeight: 1.3 }}>
        {title}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
        {isDashboard ? (
          <Typography sx={{ fontSize: 13, color: t.muted }}>{subtitle}</Typography>
        ) : (
          <>
            <Box
              component={Link}
              href="/dashboard"
              sx={{
                fontSize: 13,
                color: t.muted,
                textDecoration: "none",
                "&:hover": { color: t.text },
              }}
            >
              Dashboard
            </Box>
            <Typography sx={{ fontSize: 13, color: t.muted3 }}>›</Typography>
            <Typography sx={{ fontSize: 13, color: t.muted }}>{title}</Typography>
          </>
        )}
      </Box>
    </Box>
  );
}
