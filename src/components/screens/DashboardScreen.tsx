"use client";

import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import dynamic from "next/dynamic";
import { Box, Typography } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatDateTime } from "@/lib/format";
import { StatCard } from "@/components/dashboard/StatCard";
import { BentoGrid } from "@/components/dashboard/BentoGrid";
import { StockMovementChartFallback } from "@/components/dashboard/StockMovementChart";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import ProductionQuantityLimitsOutlinedIcon from "@mui/icons-material/ProductionQuantityLimitsOutlined";
import TrendingDownOutlinedIcon from "@mui/icons-material/TrendingDownOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { KPI_COLORS, ACCENT } from "@/theme/tokens";
import { TableShell, TableHeaderRow, TableRow, TableCell } from "@/components/DataTable";
import { StatusChip } from "@/components/StatusChip";
import { EmptyState } from "@/components/EmptyState";
import { KpiSkeleton, TableSkeleton } from "@/components/Skeleton";
import { useTheme } from "@mui/material/styles";
import type { Role } from "@/generated/prisma";
import type { DashboardData } from "@/lib/data/dashboard";

const StockMovementChart = dynamic(
  () =>
    import("@/components/dashboard/StockMovementChart").then((m) => m.StockMovementChart),
  { ssr: false, loading: () => <StockMovementChartFallback /> }
);

const TX_COLS = "126px 78px 88px minmax(0,1fr) 92px 96px";

export function DashboardScreen({
  role,
  initialData,
}: {
  role: Role;
  initialData?: DashboardData;
}) {
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
        <TableSkeleton label="Loading dashboard…" columns={4} rows={4} />
      </Box>
    );
  }

  const pendingMrfs = data.pendingMrfs ?? [];

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <BentoGrid>
          <StatCard
            label="Pending MRFs"
            value={data.kpis.pendingMrfCount}
            sub={role === "TECHNICIAN" ? "your open requests" : "awaiting fulfillment"}
            color={KPI_COLORS.orange}
            icon={<PendingActionsOutlinedIcon />}
          />
          <StatCard
            label="Out of Stock"
            value={data.kpis.outOfStockCount}
            sub="needs replenishment"
            color={KPI_COLORS.navy}
            icon={<ProductionQuantityLimitsOutlinedIcon />}
          />
          <StatCard
            label="Low Stock"
            value={data.kpis.lowStockCount}
            sub="at or below min. level"
            color={KPI_COLORS.teal}
            icon={<TrendingDownOutlinedIcon />}
          />
          <StatCard
            label="Products Tracked"
            value={data.kpis.totalProducts}
            sub={`${data.kpis.categoryCount} categories`}
            color={KPI_COLORS.blue}
            icon={<Inventory2OutlinedIcon />}
          />
        </BentoGrid>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2, alignItems: "stretch" }}>
        {/* Weekly movement chart */}
        <Box
          sx={{
            flex: "1.6 1 360px",
            minWidth: 300,
            bgcolor: t.surface,
            border: "1px solid",
            borderColor: t.line,
            borderRadius: "8px",
            p: 2,
          }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 800, mb: 0.25 }}>
            Stock movement · last 7 days
          </Typography>
          <Typography sx={{ fontSize: 12, color: t.muted, mb: 1.5 }}>
            Units received vs released
          </Typography>
          <Box sx={{ width: "100%", height: 220 }}>
            <StockMovementChart data={data.weeklyMovement ?? []} />
          </Box>
        </Box>

        {/* Pending MRFs */}
        <Box
          sx={{
            flex: "1 1 280px",
            minWidth: 260,
            bgcolor: t.surface,
            border: "1px solid",
            borderColor: t.line,
            borderRadius: "8px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: "1px solid",
              borderColor: t.line,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 800 }}>Pending MRFs</Typography>
            <Box
              component={NextLink}
              href="/stock?tab=requests"
              sx={{ fontSize: 12.5, fontWeight: 700, color: ACCENT, textDecoration: "none" }}
            >
              Open queue
            </Box>
          </Box>
          {pendingMrfs.length === 0 ? (
            <EmptyState message="No open material requests. You're clear." />
          ) : (
            pendingMrfs.map((m, i) => (
              <Box
                key={m.id}
                sx={{
                  px: 2,
                  py: 1.25,
                  borderBottom: i === pendingMrfs.length - 1 ? "none" : "1px solid",
                  borderColor: t.line2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: ACCENT, fontFamily: "monospace" }}>
                    {m.refNo}
                  </Typography>
                  <StatusChip label={m.status === "PARTIAL" ? "Partial" : "Pending"} />
                </Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: t.text.primary, mt: 0.25 }}>
                  {m.project}
                </Typography>
                <Typography sx={{ fontSize: 12, color: t.muted, mt: 0.25 }}>
                  {m.technician} · {m.itemCount} item{m.itemCount === 1 ? "" : "s"} · {m.fulfilled}/{m.requested} qty
                </Typography>
              </Box>
            ))
          )}
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: "2.2 1 420px", minWidth: 300 }}>
          <TableShell minWidth={560}>
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
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Recent Transactions</Typography>
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
              <EmptyState message="No stock movements yet. Record a Stock In or Stock Out to see them here." />
            )}
          </TableShell>
        </Box>

        <Box sx={{ flex: "1 1 260px", minWidth: 240, display: "flex", flexDirection: "column", gap: 2 }}>
          <AlertPanel
            title="Low Stock"
            dotColor={t.stock.low}
            rows={data.lowAlerts}
            qtyColor={t.stock.low}
            emptyMessage="Every product is above its minimum level."
          />
          <AlertPanel
            title="Out of Stock"
            dotColor={t.stock.out}
            rows={data.outAlerts}
            qtyColor={t.stock.out}
            emptyMessage="Nothing is out of stock."
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
  emptyMessage,
}: {
  title: string;
  dotColor: string;
  rows: { product: string; category: string; qty: number; unit: string }[];
  qtyColor: string;
  emptyMessage: string;
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
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: dotColor }} />
        <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{title}</Typography>
      </Box>
      {rows.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        rows.slice(0, 5).map((a, i) => (
          <Box
            key={`${a.product}-${i}`}
            sx={{
              px: 1.75,
              py: 1,
              borderBottom: i === Math.min(rows.length, 5) - 1 ? "none" : "1px solid",
              borderColor: t.line2,
              display: "flex",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.product}
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: t.muted }}>{a.category}</Typography>
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: qtyColor, flexShrink: 0 }}>
              {a.qty} {a.unit}
            </Typography>
          </Box>
        ))
      )}
    </TableShell>
  );
}
