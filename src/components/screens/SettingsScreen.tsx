"use client";

import { useQuery } from "@tanstack/react-query";
import { Box, ButtonBase, InputBase, Select, MenuItem, Typography } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { TableSkeleton } from "@/components/Skeleton";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";
import type { SettingsData } from "@/lib/data/settings";

export function SettingsScreen({ initialData }: { initialData?: SettingsData }) {
  const { data } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => fetchJson<SettingsData>("/api/settings"),
    initialData,
  });
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  if (!data) {
    return (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        <Box sx={{ flex: "1 1 320px", minWidth: 320 }}>
          <TableSkeleton label="Loading company profile…" columns={1} rows={3} />
        </Box>
        <Box sx={{ flex: "1 1 320px", minWidth: 320 }}>
          <TableSkeleton label="Loading permission matrix…" columns={2} rows={4} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
      <Box sx={{ flex: "1 1 320px", minWidth: 320, bgcolor: t.surface, border: "1px solid", borderColor: t.line }}>
        <Box sx={{ px: 1.75, py: 1.25, borderBottom: "1px solid", borderColor: t.line }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Company Profile</Typography>
        </Box>
        <Box sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Field label="Company Name" value={data.company.name} t={t} />
          <Field label="Warehouse Location" value={data.company.warehouseLocation} t={t} />
          <Box>
            <FieldLabel t={t}>Currency</FieldLabel>
            <Select
              value={data.company.currency}
              size="small"
              disabled
              fullWidth
              sx={{ fontSize: 12.5, bgcolor: t.surface, mt: 0.5 }}
            >
              <MenuItem value={data.company.currency}>{data.company.currency}</MenuItem>
            </Select>
          </Box>
          <ButtonBase
            disabled
            sx={{
              alignSelf: "flex-start",
              border: "none",
              bgcolor: ACCENT,
              color: "#fff",
              opacity: 0.5,
              borderRadius: "2px",
              px: 1.75,
              py: 1,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Save Changes
          </ButtonBase>
        </Box>
      </Box>

      <Box sx={{ flex: "1 1 320px", minWidth: 320, bgcolor: t.surface, border: "1px solid", borderColor: t.line }}>
        <Box sx={{ px: 1.75, py: 1.25, borderBottom: "1px solid", borderColor: t.line }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Role Permission Matrix</Typography>
        </Box>
        <Box sx={{ py: 0.75 }}>
          {data.permRows.map((p) => (
            <Box
              key={p.role}
              sx={{
                display: "grid",
                gridTemplateColumns: "150px minmax(0,1fr)",
                borderBottom: "1px solid",
                borderColor: t.line2,
                px: 1.75,
                py: 1.125,
                gap: 1.25,
              }}
            >
              <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{p.role}</Typography>
              <Typography sx={{ fontSize: 12, color: t.text2, lineHeight: 1.5 }}>
                {p.perms}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function Field({
  label,
  value,
  t,
}: {
  label: string;
  value: string;
  t: typeof lightTokens | typeof darkTokens;
}) {
  return (
    <Box>
      <FieldLabel t={t}>{label}</FieldLabel>
      <InputBase
        value={value}
        readOnly
        fullWidth
        sx={{
          border: "1px solid",
          borderColor: t.border,
          borderRadius: "2px",
          px: 1.25,
          py: 1,
          fontSize: 12.5,
          mt: 0.5,
          bgcolor: t.surface,
        }}
      />
    </Box>
  );
}

function FieldLabel({
  children,
  t,
}: {
  children: React.ReactNode;
  t: typeof lightTokens | typeof darkTokens;
}) {
  return (
    <Typography
      component="label"
      sx={{
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: t.muted,
      }}
    >
      {children}
    </Typography>
  );
}
