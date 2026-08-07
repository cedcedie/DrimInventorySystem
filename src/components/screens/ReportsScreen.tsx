"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, InputBase, MenuItem, Select, Typography, Alert } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { KpiSkeleton } from "@/components/Skeleton";
import { useTheme, type Palette } from "@mui/material/styles";
import { useToast } from "@/components/Toast";
import { useCan } from "@/components/PermissionsProvider";
import type { Role } from "@prisma/client";
import type { DashboardData } from "@/lib/data/dashboard";

const REPORT_TYPES = [
  { title: "Stock Report", desc: "Current stock levels, amounts, and totals across all categories." },
  { title: "Transaction Report", desc: "All Stock-In and Stock-Out transactions in the date range." },
  { title: "Low Stock Report", desc: "Items at or below their minimum stock level, plus out-of-stock items." },
  { title: "Supplier Report", desc: "Stock-In volume grouped by supplier for the date range." },
] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function ReportsScreen({
  role,
  initialData,
}: {
  role: Role;
  initialData?: DashboardData;
}) {
  const canReport = useCan("reports", "canExport");
  void role;
  const { data } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => fetchJson<DashboardData>("/api/dashboard"),
    initialData,
  });
  const t = useTheme().palette;
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [selectedType, setSelectedType] = useState<(typeof REPORT_TYPES)[number]["title"]>("Stock Report");
  const [format, setFormat] = useState<"pdf" | "excel">("pdf");
  const [lastExport, setLastExport] = useState<{ refNo: string; rows: string } | null>(null);
  const [error, setError] = useState("");

  const exportMutation = useMutation({
    // The route streams the PDF back as bytes rather than storing it and
    // returning a link, so this reads a blob and saves it via a temporary
    // object URL instead of parsing JSON.
    mutationFn: async () => {
      const res = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedType, from, to, format }),
      });

      if (!res.ok) {
        const message = await res
          .json()
          .then((b) => b.error as string)
          .catch(() => "Report export failed");
        throw new Error(message);
      }

      const refNo = res.headers.get("X-Report-Ref") ?? "Report";
      const rows = res.headers.get("X-Report-Rows") ?? "0";
      const blob = await res.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${refNo}.${format === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      return { refNo, rows };
    },
    onSuccess: (result) => {
      setLastExport(result);
      setError("");
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(`${result.refNo} downloaded.`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const metaFor = (title: string): string => {
    if (!data) return "";
    if (title === "Low Stock Report") {
      return `${data.kpis.lowStockCount + data.kpis.outOfStockCount} items flagged`;
    }
    if (title === "Stock Report") return `${data.kpis.totalProducts} products`;
    return "";
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          gap: 1.25,
          flexWrap: "wrap",
          mb: 1.75,
          bgcolor: t.surface,
          border: "1px solid",
          borderColor: t.line,
          px: 1.75,
          py: 1.5,
        }}
      >
        <DateField label="Date Range — From" value={from} onChange={setFrom} t={t} />
        <DateField label="To" value={to} onChange={setTo} t={t} />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
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
            Report Type
          </Typography>
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as typeof selectedType)}
            size="small"
            sx={{ fontSize: 12, bgcolor: t.surface, minWidth: 180 }}
          >
            {REPORT_TYPES.map((rp) => (
              <MenuItem key={rp.title} value={rp.title} sx={{ fontSize: 12.5 }}>
                {rp.title}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
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
            Format
          </Typography>
          <Select
            value={format}
            onChange={(e) => setFormat(e.target.value as "pdf" | "excel")}
            size="small"
            sx={{ fontSize: 12, bgcolor: t.surface, minWidth: 120 }}
          >
            <MenuItem value="pdf" sx={{ fontSize: 12.5 }}>PDF</MenuItem>
            <MenuItem value="excel" sx={{ fontSize: 12.5 }}>Excel (.xlsx)</MenuItem>
          </Select>
        </Box>
        {canReport ? (
          <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
            <ButtonBase
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              sx={{
                border: "none",
                bgcolor: t.primary.main,
                color: "#fff",
                borderRadius: "2px",
                px: 1.625,
                py: 1,
                fontSize: 12,
                fontWeight: 600,
                "&.Mui-disabled": { opacity: 0.6 },
              }}
            >
              {exportMutation.isPending ? "Generating…" : `Export ${format === "pdf" ? "PDF" : "Excel"}`}
            </ButtonBase>
          </Box>
        ) : (
          <Box
            sx={{
              ml: "auto",
              fontSize: 11,
              color: t.muted2,
              border: "1px dashed",
              borderColor: t.border,
              px: 1.375,
              py: 0.75,
            }}
          >
            Generate Report requires Admin role
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1.75 }}>
          {error}
        </Alert>
      )}
      {lastExport && (
        <Alert severity="success" sx={{ mb: 1.75 }}>
          {lastExport.refNo} downloaded — {lastExport.rows} rows. Check your downloads folder.
        </Alert>
      )}

      {!data ? (
        <KpiSkeleton count={4} />
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 1.5,
          }}
        >
          {REPORT_TYPES.map((rp) => (
            <Box
              key={rp.title}
              onClick={() => setSelectedType(rp.title)}
              sx={{
                bgcolor: t.surface,
                border: "1px solid",
                borderColor: selectedType === rp.title ? t.primary.main : t.line,
                borderTop: "3px solid",
                borderTopColor: t.primary.main,
                px: 2,
                py: 1.75,
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
                cursor: "pointer",
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{rp.title}</Typography>
              <Typography sx={{ fontSize: 12, color: t.muted, lineHeight: 1.5 }}>
                {rp.desc}
              </Typography>
              {metaFor(rp.title) && (
                <Typography
                  sx={{
                    fontSize: 11,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: t.primary.main,
                    mt: 0.5,
                  }}
                >
                  {metaFor(rp.title)}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function DateField({
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
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
        {label}
      </Typography>
      <InputBase
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{
          border: "1px solid",
          borderColor: t.border,
          borderRadius: "2px",
          px: 1.125,
          py: 0.75,
          fontSize: 12,
        }}
      />
    </Box>
  );
}
