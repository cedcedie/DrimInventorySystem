"use client";

import { Tooltip, tooltipClasses, type TooltipProps } from "@mui/material";
import { styled } from "@mui/material/styles";

/** Card-styled tooltip (MUI's official `styled(Tooltip)` pattern) — matches the
 * app's surface/border/shadow language used by modals and dropdowns, instead of
 * the default dark barebones MUI tooltip. Use for any hover content richer than
 * a one-line label (multi-row lists, name + code + qty, etc.). */
export const RichTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: 280,
    padding: 0,
    backgroundColor: theme.palette.surface,
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.line}`,
    borderRadius: 10,
    boxShadow: "0 12px 32px rgba(16,24,40,0.18)",
  },
  [`& .${tooltipClasses.arrow}`]: {
    color: theme.palette.surface,
    "&::before": {
      border: `1px solid ${theme.palette.line}`,
    },
  },
}));
