"use client";

import { Box, Typography } from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTheme } from "@mui/material/styles";
import { ACCENT, KPI_COLORS } from "@/theme/tokens";

export function StockMovementChart({
  data,
}: {
  data: { day: string; stockIn: number; stockOut: number }[];
}) {
  const t = useTheme().palette;
  const isDark = t.mode === "dark";

  return (
    <Box sx={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} barGap={4} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke={t.line} vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fill: t.muted }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: t.muted }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.04)" }}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${t.line}`,
              backgroundColor: t.background.paper,
              color: t.text.primary,
              fontSize: 12.5,
              boxShadow: "none",
            }}
            labelStyle={{ color: t.text.primary, fontWeight: 700, marginBottom: 4 }}
            itemStyle={{ color: t.text.secondary }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => <span style={{ color: t.muted }}>{value}</span>}
          />
          <Bar dataKey="stockIn" name="Stock In" fill={ACCENT} radius={[4, 4, 0, 0]} />
          <Bar dataKey="stockOut" name="Stock Out" fill={KPI_COLORS.navy} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

export function StockMovementChartFallback() {
  return (
    <Box sx={{ height: 220, display: "grid", placeItems: "center" }}>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Loading chart…</Typography>
    </Box>
  );
}
