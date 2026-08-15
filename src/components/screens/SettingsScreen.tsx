"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, InputBase, Typography, Alert } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { patchJson } from "@/lib/mutate";
import { queryKeys } from "@/lib/queryKeys";
import { TableSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useTheme, type Palette } from "@mui/material/styles";
import type { SettingsData } from "@/lib/data/settings";
import { ACCENT_HOVER, motion } from "@/theme/tokens";

export function SettingsScreen({ initialData }: { initialData?: SettingsData }) {
  const { data } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => fetchJson<SettingsData>("/api/settings"),
    initialData,
  });
  const t = useTheme().palette;

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
      <CompanyProfilePanel company={data.company} t={t} />

      <Box
        sx={{
          flex: "1 1 320px",
          minWidth: 320,
          bgcolor: t.surface,
          border: "1px solid",
          borderColor: t.line,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
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

function CompanyProfilePanel({
  company,
  t,
}: {
  company: SettingsData["company"];
  t: Palette;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState(company.name);
  const [warehouseLocation, setLocation] = useState(company.warehouseLocation);
  const [currency, setCurrency] = useState(company.currency);
  const [error, setError] = useState("");

  // Re-sync if the server sends a newer profile (another Owner saved it).
  useEffect(() => {
    setName(company.name);
    setLocation(company.warehouseLocation);
    setCurrency(company.currency);
  }, [company.name, company.warehouseLocation, company.currency]);

  const save = useMutation({
    mutationFn: () =>
      patchJson<{ ok: true }>("/api/settings", { name, warehouseLocation, currency }),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast("Company profile saved.");
    },
    onError: (e: Error) => setError(e.message),
  });

  const unchanged =
    name === company.name &&
    warehouseLocation === company.warehouseLocation &&
    currency === company.currency;
  const incomplete = !name.trim() || !warehouseLocation.trim() || !currency.trim();

  return (
    <Box
      sx={{
        flex: "1 1 320px",
        minWidth: 320,
        bgcolor: t.surface,
        border: "1px solid",
        borderColor: t.line,
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 1.75, py: 1.25, borderBottom: "1px solid", borderColor: t.line }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Company Profile</Typography>
      </Box>
      <Box sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <EditableField label="Company Name" value={name} onChange={setName} t={t} />
        <EditableField
          label="Warehouse Location"
          value={warehouseLocation}
          onChange={setLocation}
          t={t}
        />
        <EditableField label="Currency" value={currency} onChange={setCurrency} t={t} />

        <Typography sx={{ fontSize: 11, color: t.muted2 }}>
          These appear in the header of every generated PDF report.
        </Typography>

        <ButtonBase
          onClick={() => save.mutate()}
          disabled={save.isPending || unchanged || incomplete}
          sx={{
            alignSelf: "flex-start",
            border: "none",
            bgcolor: t.primary.main,
            color: "#fff",
            opacity: save.isPending || unchanged || incomplete ? 0.5 : 1,
            borderRadius: "8px",
            px: 1.75,
            py: 1,
            fontSize: 12,
            fontWeight: 600,
            transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, transform ${motion.duration.press}ms ${motion.easing.standard}`,
            "&:hover": save.isPending || unchanged || incomplete ? undefined : { bgcolor: ACCENT_HOVER },
            "&:active": save.isPending || unchanged || incomplete ? undefined : { transform: "scale(0.98)" },
            "&:focus-visible": { outline: `2px solid ${t.primary.main}`, outlineOffset: "2px" },
          }}
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </ButtonBase>
      </Box>
    </Box>
  );
}

function EditableField({
  label,
  value,
  onChange,
  t,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  t: Palette;
}) {
  return (
    <Box>
      <FieldLabel t={t}>{label}</FieldLabel>
      <InputBase
        value={value}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        inputProps={{ "aria-label": label, maxLength: 300 }}
        sx={{
          border: "1px solid",
          borderColor: t.border,
          borderRadius: "8px",
          px: 1.25,
          py: 1,
          fontSize: 12.5,
          mt: 0.5,
          bgcolor: t.surface,
          transition: `border-color ${motion.duration.color}ms ${motion.easing.standard}`,
          "&.Mui-focused": { borderColor: t.primary.main },
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
  t: Palette;
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
