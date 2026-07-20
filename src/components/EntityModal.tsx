"use client";

import { Dialog, DialogTitle, IconButton, Box, ButtonBase, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";

export type ModalWidth = 420 | 560 | 660;

export function EntityModal({
  open,
  onClose,
  title,
  width,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width: ModalWidth;
  children: React.ReactNode;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      aria-labelledby="entity-modal-title"
      slotProps={{ paper: { sx: { width, maxWidth: "92vw", bgcolor: t.surface } } }}
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
        }}
      >
        {title}
        <IconButton aria-label="Close dialog" onClick={onClose} size="small" sx={{ ml: "auto", color: t.muted2 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      {children}
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
          borderRadius: "2px",
          px: 1.75,
          py: 1,
          fontSize: 12,
          fontWeight: 600,
          color: t.text2,
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
          borderRadius: "2px",
          px: 2,
          py: 1,
          fontSize: 12,
          fontWeight: 600,
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
  borderRadius: "2px",
  px: 1.25,
  py: 1,
  fontSize: 12.5,
  fontFamily: mono ? "'IBM Plex Mono', monospace" : undefined,
  bgcolor: t.surface,
  color: t.text,
  width: "100%",
  boxSizing: "border-box" as const,
});
