import Link from "next/link";
import { Box, Typography, ButtonBase } from "@mui/material";
import { ACCENT, ACCENT_HOVER } from "@/theme/tokens";

export default function NotFound() {
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
      <Typography sx={{ fontSize: 64, fontWeight: 800, color: ACCENT, lineHeight: 1 }}>404</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 700, color: "#212B36" }}>
        This page doesn&apos;t exist
      </Typography>
      <Typography sx={{ fontSize: 14, color: "#646B72", maxWidth: 380 }}>
        The link may be outdated, or you may not have access to this part of the DRIM panel.
      </Typography>
      <ButtonBase
        component={Link}
        href="/dashboard"
        sx={{
          mt: 1.5,
          bgcolor: ACCENT,
          color: "#fff",
          borderRadius: "8px",
          px: 2.5,
          py: 1.125,
          fontSize: 14,
          fontWeight: 700,
          transition: "background-color 0.15s ease",
          "&:hover": { bgcolor: ACCENT_HOVER },
        }}
      >
        Back to Dashboard
      </ButtonBase>
    </Box>
  );
}
