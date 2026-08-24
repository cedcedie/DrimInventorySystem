"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Box, Slider, Typography } from "@mui/material";
import { EntityModal, ModalFormActions } from "@/components/EntityModal";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens } from "@/theme/tokens";

const VIEWPORT = 260; // CSS px — the square crop window shown to the user
const OUTPUT = 480; // px — exported square size
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/** Lets the user pan/zoom a picked image into a square before it's uploaded —
 * shown only when the source image is large enough that cropping it down
 * makes sense (see CROP_THRESHOLD_PX in ProfileScreen). */
export function AvatarCropModal({
  open,
  file,
  onCancel,
  onConfirm,
  confirming,
  error,
}: {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  confirming?: boolean;
  error?: string;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // Image always covers the viewport (cover-fit), so valid offsets keep every
  // edge at or past the viewport edge — i.e. between (viewport - size) and 0.
  const clamp = (value: number, size: number) => Math.min(0, Math.max(VIEWPORT - size, value));

  // (Re)load whenever a new file comes in; reset pan/zoom for it. One object
  // URL per file, revoked on change/unmount.
  useEffect(() => {
    if (!file) {
      setNaturalSize(null);
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const base = VIEWPORT / Math.min(img.naturalWidth, img.naturalHeight);
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(MIN_ZOOM);
      setOffset({
        x: (VIEWPORT - img.naturalWidth * base) / 2,
        y: (VIEWPORT - img.naturalHeight * base) / 2,
      });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!naturalSize) {
    return null;
  }

  const baseScale = VIEWPORT / Math.min(naturalSize.w, naturalSize.h);
  const scale = baseScale * zoom;
  const dispW = naturalSize.w * scale;
  const dispH = naturalSize.h * scale;
  const effectiveOffset = { x: clamp(offset.x, dispW), y: clamp(offset.y, dispH) };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX - effectiveOffset.x, y: e.clientY - effectiveOffset.y };
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setOffset({
      x: clamp(e.clientX - dragRef.current.x, dispW),
      y: clamp(e.clientY - dragRef.current.y, dispH),
    });
  };
  const stopDrag = () => {
    dragRef.current = null;
  };

  const handleZoom = (_: Event, value: number | number[]) => {
    const nextZoom = Array.isArray(value) ? value[0] : value;
    setZoom(nextZoom);
    const nextScale = baseScale * nextZoom;
    const nextDispW = naturalSize.w * nextScale;
    const nextDispH = naturalSize.h * nextScale;
    setOffset({ x: clamp(effectiveOffset.x, nextDispW), y: clamp(effectiveOffset.y, nextDispH) });
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const sourceSize = VIEWPORT / scale;
    const sourceX = -effectiveOffset.x / scale;
    const sourceY = -effectiveOffset.y / scale;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob);
      },
      "image/webp",
      0.92
    );
  };

  return (
    <EntityModal open={open} onClose={onCancel} title="Crop Profile Picture" width={420}>
      <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Typography sx={{ fontSize: 12, color: t.muted }}>
          Drag to reposition, use the slider to zoom. This image is large — crop it down to the part
          you want as your profile picture.
        </Typography>

        <Box
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          sx={{
            width: VIEWPORT,
            height: VIEWPORT,
            mx: "auto",
            borderRadius: "50%",
            overflow: "hidden",
            border: "1px solid",
            borderColor: t.border,
            position: "relative",
            cursor: "grab",
            touchAction: "none",
            bgcolor: t.hover,
            "&:active": { cursor: "grabbing" },
          }}
        >
          <Box
            component="img"
            src={previewUrl ?? undefined}
            alt=""
            draggable={false}
            sx={{
              position: "absolute",
              left: effectiveOffset.x,
              top: effectiveOffset.y,
              width: dispW,
              height: dispH,
              maxWidth: "none",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        </Box>

        <Box sx={{ px: 1 }}>
          <Slider
            size="small"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={handleZoom}
            aria-label="Zoom"
          />
        </Box>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirm();
          }}
        >
          <ModalFormActions onCancel={onCancel} submitLabel={confirming ? "Uploading…" : "Use this crop"} disabled={confirming} />
        </form>
      </Box>
    </EntityModal>
  );
}
