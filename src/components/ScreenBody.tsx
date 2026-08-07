import { Box } from "@mui/material";

export function ScreenBody({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ px: 3, py: 2.5, flex: 1 }}>
      {children}
    </Box>
  );
}
