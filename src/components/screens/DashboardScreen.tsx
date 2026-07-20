"use client";

import { useQuery } from "@tanstack/react-query";
import { Box, Typography } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { peso, formatDateTime } from "@/lib/format";
import { KpiCard } from "@/components/KpiCard";
import { TableShell, TableHeaderRow, TableRow, TableCell } from "@/components/DataTable";
import { StatusChip } from "@/components/StatusChip";
import { KpiSkeleton, TableSkeleton } from "@/components/Skeleton";
import { useTheme } from "@mui/material/styles";
import type { DashboardData } from "@/lib/data/dashboard";

const TX_COLS = "126px 78px 88px minmax(0,1fr) 92px 96px";
const ALERT_COLS = "minmax(0,1.5fr) 1fr 40px 52px";

export function DashboardScreen({ initialData }: { initialData?: DashboardData }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => fetchJson<DashboardData>("/api/dashboard"),
    initialData,
  });
  const t = useTheme().palette;

  if (isLoading || !data) {
    return (
      <Box>
        <Box sx={{ mb: 2 }}>
          <KpiSkeleton />
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
          <Box sx={{ flex: "2.2 1 480px", minWidth: 480 }}>
            <TableSkeleton label="Loading recent transactions…" columns={6} rows={5} />
          </Box>
          <Box sx={{ flex: "1 1 280px", minWidth: 280, display: "flex", flexDirection: "column", gap: 2 }}>
            <TableSkeleton label="Loading low stock alerts…" columns={4} rows={2} />
            <TableSkeleton label="Loading out of stock alerts…" columns={4} rows={2} />
          </Box>
        </Box>
      </Box>
    );
  }

  const kpis = [
    {
      label: "Products Tracked",
      value: String(data.kpis.totalProducts),
      sub: `${data.kpis.categoryCount} categories`,
      bar: t.primary.main,
    },
    {
      label: "Stock Value",
      value: peso(Math.round(data.kpis.totalValue)),
      sub: "across all items",
      bar: t.primary.main,
    },
    {
      label: "Low Stock",
      value: String(data.kpis.lowStockCount),
      sub: "at or below min. level",
      bar: "#c07d16",
    },
    {
      label: "Out of Stock",
      value: String(data.kpis.outOfStockCount),
      sub: "needs replenishment",
      bar: "#a13230",
    },
  ];

  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 1.5,
          mb: 2,
        }}
      >
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} barColor={k.bar} />
        ))}
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: "2.2 1 480px", minWidth: 480 }}>
          <TableShell minWidth={680}>
            <Box
              sx={{
                px: 1.75,
                py: 1.375,
                borderBottom: "1px solid",
                borderColor: t.line,
                display: "flex",
                alignItems: "baseline",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                Recent Transactions
              </Typography>
              <Typography sx={{ fontSize: 11, color: t.muted2 }}>
                Stock-In / Stock-Out · linked to MRF# / Slip#
              </Typography>
            </Box>
            <TableHeaderRow
              columns={TX_COLS}
              headers={["Date & Time", "Ref. No", "Type", "Description", "User", "MRF# / Slip#"]}
            />
            {data.transactions.map((tx) => (
              <TableRow key={tx.ref} columns={TX_COLS}>
                <TableCell color={t.text2}>{formatDateTime(new Date(tx.dt))}</TableCell>
                <TableCell mono>{tx.ref}</TableCell>
                <TableCell>
                  <StatusChip label={tx.type} />
                </TableCell>
                <TableCell sx={{ whiteSpace: "normal", fontSize: 12.5 }}>{tx.desc}</TableCell>
                <TableCell color={t.text2}>{tx.user}</TableCell>
                <TableCell mono color={t.primary.main}>
                  {tx.link}
                </TableCell>
              </TableRow>
            ))}
            {data.transactions.length === 0 && (
              <Box sx={{ px: 1.75, py: 2, fontSize: 12.5, color: t.muted }}>
                No transactions recorded yet.
              </Box>
            )}
          </TableShell>
        </Box>

        <Box sx={{ flex: "1 1 280px", minWidth: 280, display: "flex", flexDirection: "column", gap: 2 }}>
          <AlertPanel
            title="Low Stock Alerts"
            dotColor="#c07d16"
            rows={data.lowAlerts}
            qtyColor={t.warning.main}
          />
          <AlertPanel
            title="Out of Stock Alerts"
            dotColor="#a13230"
            rows={data.outAlerts}
            qtyColor={t.error.main}
          />
        </Box>
      </Box>
    </Box>
  );
}

function AlertPanel({
  title,
  dotColor,
  rows,
  qtyColor,
}: {
  title: string;
  dotColor: string;
  rows: { product: string; category: string; qty: number; unit: string }[];
  qtyColor: string;
}) {
  const t = useTheme().palette;

  return (
    <TableShell>
      <Box
        sx={{
          px: 1.75,
          py: 1.25,
          borderBottom: "1px solid",
          borderColor: t.line,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box sx={{ width: 8, height: 8, bgcolor: dotColor }} />
        <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{title}</Typography>
      </Box>
      <TableHeaderRow columns={ALERT_COLS} headers={["Product", "Category", "Qty", "Unit"]} />
      {rows.map((a, i) => (
        <TableRow key={`${a.product}-${i}`} columns={ALERT_COLS}>
          <TableCell bold sx={{ whiteSpace: "normal" }}>
            {a.product}
          </TableCell>
          <TableCell color={t.muted}>{a.category}</TableCell>
          <TableCell bold color={qtyColor}>
            {a.qty}
          </TableCell>
          <TableCell color={t.muted}>{a.unit}</TableCell>
        </TableRow>
      ))}
      {rows.length === 0 && (
        <Box sx={{ px: 1.75, py: 1.5, fontSize: 12, color: t.muted }}>None.</Box>
      )}
    </TableShell>
  );
}
