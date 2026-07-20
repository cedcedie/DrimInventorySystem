"use client";

import { Box, ButtonBase, Typography } from "@mui/material";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";

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
        overflowX: "auto",
        opacity: dimmed ? 0.55 : 1,
        transition: "opacity 0.12s ease",
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
            px: 1.5,
            py: 0.875,
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.6px",
            color: t.muted,
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
      onClick={onClick}
      sx={{
        display: "grid",
        gridTemplateColumns: columns,
        borderBottom: "1px solid",
        borderColor: t.line2,
        alignItems: "center",
        cursor: onClick ? "pointer" : "default",
        bgcolor: selected ? t.rowSel : "transparent",
        "&:hover": onClick || selected !== undefined ? { bgcolor: t.rowSel } : { bgcolor: t.hover },
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
        px: 1.5,
        py: "var(--row-pad, 8px)",
        fontSize: mono ? 11 : 12.5,
        fontWeight: bold ? 700 : 400,
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

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: 0.875,
        bgcolor: t.bg2,
        borderTop: "1px solid",
        borderColor: t.line,
        position: "sticky",
        left: 0,
      }}
    >
      <Typography sx={{ fontSize: 11.5, color: t.muted }}>{info}</Typography>
      <Box sx={{ ml: "auto", display: "flex", gap: 0.75 }}>
        <ButtonBase
          aria-label="Previous page"
          onClick={onPrev}
          disabled={page <= 1}
          sx={{
            border: "1px solid",
            borderColor: t.border,
            bgcolor: t.surface,
            borderRadius: "2px",
            px: 1.5,
            py: 0.5,
            fontSize: 11.5,
            fontWeight: 600,
            color: page > 1 ? t.text2 : t.muted3,
            "&:hover": page > 1 ? { borderColor: ACCENT } : undefined,
          }}
        >
          ‹ Prev
        </ButtonBase>
        <ButtonBase
          aria-label="Next page"
          onClick={onNext}
          disabled={page >= totalPages}
          sx={{
            border: "1px solid",
            borderColor: t.border,
            bgcolor: t.surface,
            borderRadius: "2px",
            px: 1.5,
            py: 0.5,
            fontSize: 11.5,
            fontWeight: 600,
            color: page < totalPages ? t.text2 : t.muted3,
            "&:hover": page < totalPages ? { borderColor: ACCENT } : undefined,
          }}
        >
          Next ›
        </ButtonBase>
      </Box>
    </Box>
  );
}
