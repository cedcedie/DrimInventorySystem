"use client";

import { Box, ButtonBase, Typography } from "@mui/material";
import Link from "next/link";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import GridOnOutlinedIcon from "@mui/icons-material/GridOnOutlined";
import AddIcon from "@mui/icons-material/Add";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT, ACCENT_HOVER, motion } from "@/theme/tokens";

export function PageChrome({
  title,
  breadcrumb,
  addLabel,
  onAdd,
  onExportPdf,
  onExportExcel,
  children,
}: {
  title: string;
  /** Extra crumb after Dashboard › — defaults to title */
  breadcrumb?: string;
  addLabel?: string;
  onAdd?: () => void;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  children?: React.ReactNode;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  const crumb = breadcrumb ?? title;

  const iconBtn = {
    width: 36,
    height: 36,
    borderRadius: "8px",
    border: "1px solid",
    borderColor: t.line,
    bgcolor: t.surface,
    color: t.muted,
    transition: `border-color ${motion.duration.color}ms ${motion.easing.standard}, color ${motion.duration.color}ms ${motion.easing.standard}`,
    "&:hover": { borderColor: ACCENT, color: ACCENT },
  } as const;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        flexWrap: "wrap",
        mb: 2,
      }}
    >
      <Box>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: t.text, lineHeight: 1.3 }}>
          {title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
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
          <Typography sx={{ fontSize: 13, color: t.muted }}>{crumb}</Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto", flexWrap: "wrap" }}>
        {children}
        {onExportPdf && (
          <ButtonBase aria-label="Export PDF" title="Export PDF" onClick={onExportPdf} sx={iconBtn}>
            <PictureAsPdfOutlinedIcon sx={{ fontSize: 18, color: "#EF3826" }} />
          </ButtonBase>
        )}
        {onExportExcel && (
          <ButtonBase
            aria-label="Export Excel"
            title="Export Excel"
            onClick={onExportExcel}
            sx={iconBtn}
          >
            <GridOnOutlinedIcon sx={{ fontSize: 18, color: "#28C76F" }} />
          </ButtonBase>
        )}
        {addLabel && onAdd && (
          <ButtonBase
            onClick={onAdd}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              bgcolor: ACCENT,
              color: "#fff",
              borderRadius: "8px",
              px: 1.75,
              height: 38,
              fontSize: 13.5,
              fontWeight: 700,
              transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, transform ${motion.duration.press}ms ${motion.easing.standard}`,
              "&:hover": { bgcolor: ACCENT_HOVER },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            <AddIcon sx={{ fontSize: 17 }} />
            {addLabel}
          </ButtonBase>
        )}
      </Box>
    </Box>
  );
}
