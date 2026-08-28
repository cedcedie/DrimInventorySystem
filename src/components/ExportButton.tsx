"use client";

import { useState } from "react";
import { Button, Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import GridOnOutlinedIcon from "@mui/icons-material/GridOnOutlined";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { useTheme } from "@mui/material/styles";
import { SEARCH_FIELD_HEIGHT } from "@/components/SearchByPanel";

/** "Download what's currently showing" button — a PDF/Excel choice menu next
 * to a SEARCH BY panel. `buildUrl` gets the chosen format and returns the
 * export endpoint URL with the screen's current filter values already on it,
 * so the download always matches what's on screen, not the full table. */
export function ExportButton({ buildUrl }: { buildUrl: (format: "pdf" | "excel") => string }) {
  const t = useTheme().palette;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const download = (format: "pdf" | "excel") => {
    // A plain navigation, not fetch+blob — the route replies with
    // Content-Disposition: attachment, so the browser just saves the file.
    window.location.href = buildUrl(format);
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        onClick={(e) => setAnchorEl(e.currentTarget)}
        startIcon={<FileDownloadOutlinedIcon />}
        endIcon={<ArrowDropDownIcon />}
        size="small"
        sx={{
          height: SEARCH_FIELD_HEIGHT,
          boxSizing: "border-box",
          textTransform: "none",
          fontSize: 12.5,
          fontWeight: 600,
          color: t.text2,
          border: "1px solid",
          borderColor: t.border,
          borderRadius: "8px",
          px: 1.5,
          "&:hover": { borderColor: t.primary.main, color: t.primary.main, bgcolor: "transparent" },
        }}
      >
        Download
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => download("pdf")} sx={{ fontSize: 13 }}>
          <ListItemIcon>
            <PictureAsPdfOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Download as PDF</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => download("excel")} sx={{ fontSize: 13 }}>
          <ListItemIcon>
            <GridOnOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Download as Excel</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
