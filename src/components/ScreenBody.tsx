import { Box } from "@mui/material";

export function ScreenBody({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3 }, py: { xs: 1.75, sm: 2.5 }, flex: 1, minWidth: 0 }}>
      {children}
    </Box>
  );
}
