"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Box, Typography, ButtonBase } from "@mui/material";
import { ACCENT, ACCENT_HOVER } from "@/theme/tokens";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        px: 3,
        textAlign: "center",
        bgcolor: "#fff",
      }}
    >
      <Typography sx={{ fontSize: 20, fontWeight: 700, color: "#212B36" }}>
        Something went wrong
      </Typography>
      <Typography sx={{ fontSize: 14, color: "#646B72", maxWidth: 420 }}>
        This page hit an unexpected error. Your data is safe — nothing was saved partway. Try again,
        or head back to the dashboard.
      </Typography>
      {error.digest && (
        <Typography sx={{ fontSize: 11, color: "#9AA1A9", fontFamily: "'IBM Plex Mono', monospace" }}>
          Ref: {error.digest}
        </Typography>
      )}
      <Box sx={{ display: "flex", gap: 1.25, mt: 1 }}>
        <ButtonBase
          onClick={reset}
          sx={{
            bgcolor: ACCENT,
            color: "#fff",
            borderRadius: "8px",
            px: 2.25,
            py: 1.125,
            fontSize: 14,
            fontWeight: 700,
            transition: "background-color 0.15s ease",
            "&:hover": { bgcolor: ACCENT_HOVER },
          }}
        >
          Try again
        </ButtonBase>
        <ButtonBase
          onClick={() => {
            window.location.href = "/dashboard";
          }}
          sx={{
            border: "1px solid #E8E8E8",
            color: "#212B36",
            borderRadius: "8px",
            px: 2.25,
            py: 1.125,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Back to Dashboard
        </ButtonBase>
      </Box>
    </Box>
  );
}
