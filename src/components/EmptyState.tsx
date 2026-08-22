"use client";

import { Box, ButtonBase, Typography } from "@mui/material";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, ACCENT_SOFT, motion } from "@/theme/tokens";

export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box
      sx={{
        px: 2,
        py: 4.5,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.25,
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: "12px",
          bgcolor: mode === "dark" ? t.bg2 : ACCENT_SOFT,
          display: "grid",
          placeItems: "center",
          color: ACCENT,
          mb: 0.5,
        }}
      >
        <InboxOutlinedIcon sx={{ fontSize: 24 }} />
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: t.text, maxWidth: 320 }}>
        {message}
      </Typography>
      {actionLabel && onAction && (
        <ButtonBase
          onClick={onAction}
          sx={{
            mt: 0.5,
            color: ACCENT,
            fontSize: 13.5,
            fontWeight: 700,
            textDecoration: "underline",
            transition: `opacity ${motion.duration.color}ms ${motion.easing.standard}`,
            "&:hover": { opacity: 0.85 },
          }}
        >
          {actionLabel}
        </ButtonBase>
      )}
    </Box>
  );
}
