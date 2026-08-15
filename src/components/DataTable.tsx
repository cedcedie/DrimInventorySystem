"use client";

import { Box, ButtonBase, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, motion } from "@/theme/tokens";

export function TableShell({
  minWidth,
  dimmed,
  children,
}: {
  minWidth?: number | string;
  /** True while a background refetch (filter/page change) is in flight —
   * keeps existing rows visible but subtly dims them instead of showing a skeleton. */
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
        overflowX: "auto",
        opacity: dimmed ? 0.55 : 1,
        transition: `opacity ${motion.duration.color}ms ${motion.easing.standard}`,
      }}
    >
      <Box sx={{ minWidth }}>{children}</Box>
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
        display: "grid",
        gridTemplateColumns: columns,
        bgcolor: t.bg2,
        borderBottom: "1px solid",
        borderColor: t.line,
      }}
    >
      {headers.map((h) => (
        <Box
          key={h}
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
        display: "grid",
        gridTemplateColumns: columns,
        borderBottom: "1px solid",
        borderColor: t.line2,
        alignItems: "center",
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

export function TableCell({
  mono,
  bold,
  color,
  children,
  sx,
}: {
  mono?: boolean;
  bold?: boolean;
  color?: string;
  children: React.ReactNode;
  sx?: object;
}) {
  return (
    <Box
      sx={{
        px: 1.75,
        py: "var(--row-pad, 12px)",
        fontSize: mono ? 12.5 : 13.5,
        fontWeight: bold ? 700 : 500,
        fontFamily: mono ? "'IBM Plex Mono', monospace" : undefined,
        color,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/** DreamsPOS-style bordered square icon button for row actions (edit / delete). */
export function RowActionButton({
  kind,
  label,
  onClick,
  disabled,
}: {
  kind: "edit" | "delete" | "adjust";
  /** Accessible label, e.g. "Edit Copper Tube". Shown as tooltip via title. */
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
