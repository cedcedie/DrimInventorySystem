"use client";

import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

/** Uploaded picture if set, else initials on a neutral circle. Shared by the
 * header, Users list, and Activity Feed so a picture shows everywhere the
 * same way — served from the same blob route as ProfileScreen's own picture. */
export function UserAvatar({
  avatarKey,
  name,
  size = 26,
}: {
  avatarKey: string | null | undefined;
  name: string;
  size?: number;
}) {
  const t = useTheme().palette;
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (avatarKey) {
    return (
      <Box
        component="img"
        src={`/api/blobs/${avatarKey}`}
        alt=""
        sx={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: "1px solid",
          borderColor: t.border,
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: t.hover,
        color: t.muted,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(10, size * 0.42),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initial}
    </Box>
  );
}
