"use client";

import { Dialog, Box, Typography, ButtonBase } from "@mui/material";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, motion } from "@/theme/tokens";

/** Small MUI confirm/cancel prompt — replaces the browser's native
 * `window.confirm()`, which renders as a jarring, unstyled OS dialog
 * (prefixed with the site's URL) that looks out of place next to
 * everything else in the app. */
export function ConfirmDialog({
  open,
  message,
  confirmLabel = "Discard",
  cancelLabel = "Keep Editing",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      // Sits on top of the modal it's guarding — a higher z-index than the
      // default Dialog stacking order needs isn't required since MUI already
      // stacks a newer Dialog above an older one; this just needs its own
      // backdrop to be visually distinct from the modal behind it.
      slotProps={{
        backdrop: { sx: { bgcolor: "rgba(16,24,40,0.35)" } },
        paper: {
          sx: {
            width: 340,
            maxWidth: "90vw",
            bgcolor: t.surface,
            borderRadius: "12px",
            border: `1px solid ${t.line}`,
            boxShadow: "0 16px 40px rgba(16,24,40,0.2)",
            p: 2.25,
          },
        },
      }}
    >
      <Typography sx={{ fontSize: 13, color: t.text, lineHeight: 1.5 }}>{message}</Typography>
      <Box sx={{ display: "flex", gap: 1, mt: 2.25, justifyContent: "flex-end" }}>
        <ButtonBase
          onClick={onCancel}
          sx={{
            border: "1px solid",
            borderColor: t.border,
            bgcolor: t.surface,
            borderRadius: "8px",
            px: 1.75,
            py: 1,
            fontSize: 12,
            fontWeight: 600,
            color: t.text2,
            transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}`,
          }}
        >
          {cancelLabel}
        </ButtonBase>
        <ButtonBase
          onClick={onConfirm}
          sx={{
            border: "none",
            bgcolor: "#D92D20",
            color: "#fff",
            borderRadius: "8px",
            px: 1.75,
            py: 1,
            fontSize: 12,
            fontWeight: 600,
            transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}`,
          }}
        >
          {confirmLabel}
        </ButtonBase>
      </Box>
    </Dialog>
  );
}
