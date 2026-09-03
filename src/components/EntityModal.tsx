"use client";

import { useState } from "react";
import { Dialog, DialogTitle, IconButton, Box, ButtonBase, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, motion } from "@/theme/tokens";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export type ModalWidth = 420 | 560 | 660;

export function EntityModal({
  open,
  onClose,
  title,
  width,
  children,
  isDirty,
  dirtyMessage = "Discard your changes? This can't be undone.",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width: ModalWidth;
  /** Plain content, or a render function receiving `requestClose` — the same
   * guarded-close handler the X button/backdrop/Esc use — for a form's own
   * footer Cancel button to route through instead of calling onClose directly. */
  children: React.ReactNode | ((requestClose: () => void) => React.ReactNode);
  /** True whenever the form has unsaved edits — every close attempt (X, backdrop, Esc) prompts first instead of closing immediately. */
  isDirty?: boolean;
  /** Custom wording for that prompt, e.g. "Discard this Purchase Order? This can't be undone." */
  dirtyMessage?: string;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClose = () => {
    if (isDirty) {
      setConfirmOpen(true);
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      aria-labelledby="entity-modal-title"
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: "rgba(16,24,40,0.5)",
            transition: `opacity ${motion.duration.exit}ms ${motion.easing.standard} !important`,
          },
        },
        paper: {
          sx: {
            width,
            maxWidth: "92vw",
            // Caps against viewport so long content scrolls internally instead of overflowing.
            maxHeight: "88vh",
            display: "flex",
            flexDirection: "column",
            bgcolor: t.surface,
            borderRadius: "12px",
            border: `1px solid ${t.line}`,
            boxShadow: "0 16px 40px rgba(16,24,40,0.16)",
            overflow: "hidden",
            transition: `transform ${motion.duration.enter}ms ${motion.easing.entrance}, opacity ${motion.duration.enter}ms ${motion.easing.entrance} !important`,
          },
        },
      }}
    >
      <DialogTitle
        id="entity-modal-title"
        sx={{
          display: "flex",
          alignItems: "center",
          fontSize: "14.5px",
          fontWeight: 700,
          py: 1.75,
          px: 2.25,
          borderBottom: "1px solid",
          borderColor: t.line,
          flexShrink: 0,
        }}
      >
        {title}
        <IconButton aria-label="Close dialog" onClick={handleClose} size="small" sx={{ ml: "auto", color: t.muted2 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Box className="scroll-hidden" sx={{ overflowY: "auto", minHeight: 0 }}>
        {typeof children === "function" ? children(handleClose) : children}
      </Box>
      <ConfirmDialog
        open={confirmOpen}
        message={dirtyMessage}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onClose();
        }}
      />
    </Dialog>
  );
}

export function ModalFormActions({
  onCancel,
  submitLabel,
  disabled,
}: {
  onCancel: () => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box sx={{ display: "flex", gap: 1, mt: 2, justifyContent: "flex-end" }}>
      <ButtonBase
        type="button"
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
          transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, transform ${motion.duration.press}ms ${motion.easing.standard}`,
          "&:active": { transform: "scale(0.98)" },
        }}
      >
        Cancel
      </ButtonBase>
      <ButtonBase
        type="submit"
        disabled={disabled}
        sx={{
          border: "none",
          bgcolor: ACCENT,
          color: "#fff",
          borderRadius: "8px",
          px: 2,
          py: 1,
          fontSize: 12,
          fontWeight: 600,
          transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, transform ${motion.duration.press}ms ${motion.easing.standard}`,
          "&:active": { transform: "scale(0.98)" },
          "&.Mui-disabled": { opacity: 0.6 },
        }}
      >
        {submitLabel}
      </ButtonBase>
    </Box>
  );
}

export function FormField({
  label,
  children,
  span2,
}: {
  label: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, gridColumn: span2 ? "span 2" : undefined }}>
      <Typography
        component="label"
        sx={{
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: t.muted,
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

export const fieldInputSx = (t: typeof lightTokens | typeof darkTokens, mono?: boolean) => ({
  border: "1px solid",
  borderColor: t.border,
  borderRadius: "8px",
  px: 1.25,
  py: 1,
  fontSize: 12.5,
  fontFamily: mono ? "'IBM Plex Mono', monospace" : undefined,
  bgcolor: t.surface,
  color: t.text,
  width: "100%",
  boxSizing: "border-box" as const,
  transition: `border-color ${motion.duration.color}ms ${motion.easing.standard}`,
  "&:focus": { outline: "none", borderColor: ACCENT },
  // Browsers draw their own up/down spinner on type="number" inputs —
  // inconsistent across browsers and visually out of place next to every
  // other MUI-styled control in the app. Hidden here so every field using
  // this shared sx (text or number) gets consistent, spinner-free styling.
  "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": {
    WebkitAppearance: "none",
    margin: 0,
  },
  '&[type="number"]': {
    MozAppearance: "textfield",
  },
});
