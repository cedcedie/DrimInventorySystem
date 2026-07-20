import { Box } from "@mui/material";

export function ScreenBody({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ px: 2.75, py: 2.25, flex: 1 }}>
      {children}
    </Box>
  );
}
