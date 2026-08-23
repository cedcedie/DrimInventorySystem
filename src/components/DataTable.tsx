"use client";

import { useRef, useState, useEffect } from "react";
import { Box, ButtonBase, Tooltip, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, motion } from "@/theme/tokens";

/** Below this breakpoint, tables become stacked cards instead of horizontally-
 * scrollable grids (no swipe needed on phone); TableHeaderRow hides and
 * TableRow/TableCell switch to a labeled block layout via TableCell's `label`. */
const CARD_MODE_BP = "sm";

export function TableShell({
  minWidth,
  dimmed,
  children,
}: {
  minWidth?: number | string;
  /** True during a background refetch — dims existing rows instead of showing a skeleton. */
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box
      sx={{
        bgcolor: t.surface,
        border: "1px solid",
        borderColor: t.line,
        borderRadius: "12px",
        boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
        overflow: "hidden",
        overflowX: { xs: "hidden", [CARD_MODE_BP]: "auto" },
        opacity: dimmed ? 0.55 : 1,
        transition: `opacity ${motion.duration.color}ms ${motion.easing.standard}`,
      }}
    >
      <Box sx={{ minWidth: { xs: 0, [CARD_MODE_BP]: minWidth } }}>{children}</Box>
    </Box>
  );
}

export function TableHeaderRow({
  columns,
  headers,
}: {
  columns: string;
  headers: string[];
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box
      sx={{
        display: { xs: "none", [CARD_MODE_BP]: "grid" },
        gridTemplateColumns: columns,
        bgcolor: t.bg2,
        borderBottom: "1px solid",
        borderColor: t.line,
      }}
    >
      {headers.map((h, i) => (
        <Box
          // Positional, not content-keyed — headers are a fixed-order array and
          // more than one column (checkbox/actions) can legitimately share an
          // empty-string label, which collided as a duplicate key before.
          key={i}
          sx={{
            px: 1.75,
            py: 1.375,
            fontSize: 13,
            fontWeight: 700,
            color: t.text,
          }}
        >
          {h}
        </Box>
      ))}
    </Box>
  );
}

export function TableRow({
  columns,
  onClick,
  selected,
  children,
}: {
  columns: string;
  onClick?: () => void;
  selected?: boolean;
  children: React.ReactNode;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      sx={{
        display: { xs: "flex", [CARD_MODE_BP]: "grid" },
        flexDirection: "column",
        gap: { xs: 0.625, [CARD_MODE_BP]: 0 },
        gridTemplateColumns: columns,
        px: { xs: 1.5, [CARD_MODE_BP]: 0 },
        py: { xs: 1.25, [CARD_MODE_BP]: 0 },
        borderBottom: "1px solid",
        borderColor: t.line2,
        alignItems: { xs: "stretch", [CARD_MODE_BP]: "center" },
        cursor: onClick ? "pointer" : "default",
        bgcolor: selected ? t.rowSel : "transparent",
        transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}`,
        "&:last-of-type": { borderBottom: "none" },
        "&:hover": onClick || selected !== undefined ? { bgcolor: t.rowSel } : { bgcolor: t.hover },
        "&:focus-visible": onClick
          ? {
              outline: `2px solid ${ACCENT}`,
              outlineOffset: -2,
            }
          : undefined,
      }}
    >
      {children}
    </Box>
  );
}

/** True once the ref'd element's text is wider than its box. Measured eagerly on
 * mount/change + ResizeObserver rather than on hover: MuiTooltip reads `title` when
 * its enterDelay timer fires, so measuring inside the hover handler itself arrives
 * one render too late and the tooltip silently never opens. */
function useTruncationCheck(value: unknown): [boolean, React.RefObject<HTMLSpanElement | null>] {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setTruncated(false);
      return;
    }
    // Tolerance for sub-pixel font rounding, which can falsely flag non-truncated text.
    const measure = () => setTruncated(el.scrollWidth > el.clientWidth + 4);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return [truncated, ref];
}

export function TableCell({
  label,
  mono,
  bold,
  color,
  children,
  sx,
}: {
  /** Uppercase tag shown before the value in stacked/card mode. Omit for self-explanatory cells. */
  label?: string;
  mono?: boolean;
  bold?: boolean;
  color?: string;
  children: React.ReactNode;
  sx?: object;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  // Only tooltip plain-string cells that are actually clipped — avoids noise on
  // non-text children (e.g. StatusChip) and on values that already fit.
  const isPlainText = typeof children === "string" || typeof children === "number";
  const [truncated, valueRef] = useTruncationCheck(isPlainText ? children : undefined);

  const plainTextValue = (
    <Box
      component="span"
      ref={valueRef}
      sx={{
        display: { xs: "inline", [CARD_MODE_BP]: "block" },
        overflow: "inherit",
        textOverflow: "inherit",
        whiteSpace: "inherit",
      }}
    >
      {children}
    </Box>
  );

  return (
    <Box
      sx={{
        display: { xs: label ? "flex" : "block", [CARD_MODE_BP]: "block" },
        alignItems: { xs: "baseline", [CARD_MODE_BP]: "normal" },
        gap: { xs: 0.75, [CARD_MODE_BP]: 0 },
        px: { xs: 0, [CARD_MODE_BP]: 1.75 },
        py: { xs: 0, [CARD_MODE_BP]: "var(--row-pad, 12px)" },
        fontSize: mono ? 12.5 : 13.5,
        fontWeight: bold ? 700 : 500,
        fontFamily: mono ? "'IBM Plex Mono', monospace" : undefined,
        color,
        overflow: { xs: "visible", [CARD_MODE_BP]: "hidden" },
        textOverflow: { xs: "clip", [CARD_MODE_BP]: "ellipsis" },
        whiteSpace: { xs: "normal", [CARD_MODE_BP]: "nowrap" },
        ...sx,
      }}
    >
      {label && (
        <Box
          component="span"
          sx={{
            display: { xs: "inline-block", [CARD_MODE_BP]: "none" },
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            color: t.muted2,
            flexShrink: 0,
          }}
        >
          {label}
        </Box>
      )}
      {isPlainText ? (
        <Tooltip title={truncated ? String(children) : ""} arrow placement="top">
          {plainTextValue}
        </Tooltip>
      ) : (
        children
      )}
    </Box>
  );
}

export function RowActionButton({
  kind,
  label,
  onClick,
  disabled,
}: {
  kind: "edit" | "delete" | "adjust";
  /** Accessible label, e.g. "Edit Copper Tube". Also shown as title tooltip. */
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const isDelete = kind === "delete";

  return (
    <ButtonBase
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      sx={{
        width: 30,
        height: 30,
        borderRadius: "6px",
        border: "1px solid",
        borderColor: t.line,
        bgcolor: t.surface,
        color: isDelete ? "#B42318" : t.muted,
        opacity: disabled ? 0.5 : 1,
        transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, border-color ${motion.duration.color}ms ${motion.easing.standard}, color ${motion.duration.color}ms ${motion.easing.standard}`,
        "&:hover": isDelete
          ? { borderColor: "#B42318", bgcolor: "#FEEDEB" }
          : { borderColor: ACCENT, color: ACCENT },
      }}
    >
      {kind === "delete" ? (
        <DeleteOutlineIcon sx={{ fontSize: 16 }} />
      ) : kind === "adjust" ? (
        <TuneOutlinedIcon sx={{ fontSize: 16 }} />
      ) : (
        <EditOutlinedIcon sx={{ fontSize: 16 }} />
      )}
    </ButtonBase>
  );
}

export function Pagination({
  info,
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  info: string;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  const navButtonSx = (enabled: boolean) =>
    ({
      width: 30,
      height: 30,
      borderRadius: "50%",
      border: "1px solid",
      borderColor: t.line,
      bgcolor: t.surface,
      color: enabled ? t.text2 : t.muted3,
      "&:hover": enabled ? { borderColor: ACCENT, color: ACCENT } : undefined,
    }) as const;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.75,
        py: 1.25,
        borderTop: "1px solid",
        borderColor: t.line,
        position: "sticky",
        left: 0,
        bgcolor: t.surface,
      }}
    >
      <Typography sx={{ fontSize: 12.5, color: t.muted }}>{info}</Typography>
      <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
        <ButtonBase aria-label="Previous page" onClick={onPrev} disabled={page <= 1} sx={navButtonSx(page > 1)}>
          <ChevronLeftIcon sx={{ fontSize: 18 }} />
        </ButtonBase>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            bgcolor: ACCENT,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          {page}
        </Box>
        <Typography sx={{ fontSize: 12.5, color: t.muted }}>of {totalPages}</Typography>
        <ButtonBase
          aria-label="Next page"
          onClick={onNext}
          disabled={page >= totalPages}
          sx={navButtonSx(page < totalPages)}
        >
          <ChevronRightIcon sx={{ fontSize: 18 }} />
        </ButtonBase>
      </Box>
    </Box>
  );
}
