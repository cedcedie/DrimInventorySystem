"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Box, ButtonBase, Typography } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate } from "@/lib/format";
import { TableShell, TableHeaderRow, TableRow, TableCell, Pagination } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";
import { StockInModal } from "@/components/modals/StockInModal";
import { StockOutModal } from "@/components/modals/StockOutModal";
import type { Role } from "@prisma/client";
import type { StockInData, StockOutData } from "@/lib/data/stock";

const SI_COLS = "110px 106px minmax(0,1.2fr) minmax(0,1.2fr) 80px";
const SO_COLS = "92px 96px minmax(0,1fr) minmax(0,1.1fr) 48px 84px minmax(0,1fr)";

export function StockScreen({ role }: { role: Role }) {
  const [tab, setTab] = useState<"in" | "out">("in");
  const canStock = role === "ADMIN" || role === "WAREHOUSE_STAFF";
  const isOwner = role === "OWNER";
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box>
      <Box sx={{ display: "flex", gap: 0.25, mb: 1.75, borderBottom: "1px solid", borderColor: t.line }}>
        <TabButton label="Stock In" active={tab === "in"} onClick={() => setTab("in")} />
        <TabButton label="Stock Out" active={tab === "out"} onClick={() => setTab("out")} />
      </Box>

      {tab === "in" ? (
        <StockInTab canStock={canStock} isOwner={isOwner} />
      ) : (
        <StockOutTab canStock={canStock} isOwner={isOwner} />
      )}
    </Box>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        border: "none",
        bgcolor: "transparent",
        px: 2,
        py: 1,
        fontSize: 13,
        fontWeight: 600,
        color: active ? ACCENT : t.muted,
        borderBottom: "2px solid",
        borderColor: active ? ACCENT : "transparent",
        mb: "-1px",
      }}
    >
      {label}
    </ButtonBase>
  );
}

function ViewOnlyNotice({ text }: { text: string }) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;
  return (
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
      {text}
    </Box>
  );
}

function StockInTab({ canStock, isOwner }: { canStock: boolean; isOwner: boolean }) {
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.stockIn({ page }),
    queryFn: () => fetchJson<StockInData>(`/api/stock-in?page=${page}`),
    placeholderData: keepPreviousData,
  });

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: t.muted }}>
          Incoming stock received from suppliers
        </Typography>
        {canStock && (
          <ButtonBase
            onClick={() => setModalOpen(true)}
            sx={{
              ml: "auto",
              border: "none",
              bgcolor: ACCENT,
              color: "#fff",
              borderRadius: "2px",
              px: 1.625,
              py: 1,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            + New Stock In
          </ButtonBase>
        )}
        {isOwner && <ViewOnlyNotice text="View only — Stock In requires Admin or Warehouse Staff role" />}
      </Box>

      {!data ? (
        <TableSkeleton label="Loading stock-in deliveries…" columns={5} rows={5} />
      ) : (
        <TableShell minWidth={620} dimmed={isFetching}>
          <TableHeaderRow columns={SI_COLS} headers={["Reference No.", "Date", "Supplier", "Item", "Quantity"]} />
          {data.rows.map((r) => (
            <TableRow key={r.id} columns={SI_COLS}>
              <TableCell mono color={ACCENT}>
                {r.ref}
              </TableCell>
              <TableCell color={t.text2}>{formatDate(new Date(r.date))}</TableCell>
              <TableCell>{r.supplier}</TableCell>
              <TableCell>{r.item}</TableCell>
              <TableCell bold>{r.qty}</TableCell>
            </TableRow>
          ))}
          {data.rows.length === 0 && (
            <Box sx={{ px: 1.75, py: 3, fontSize: 12.5, color: t.muted, textAlign: "center" }}>
              No stock-in deliveries recorded yet.
            </Box>
          )}
          {data.totalPages > 1 && (
            <Pagination
              info={`Showing ${data.rows.length ? (page - 1) * 15 + 1 : 0}–${
                (page - 1) * 15 + data.rows.length
              } of ${data.total} · Page ${page} of ${data.totalPages}`}
              page={page}
              totalPages={data.totalPages}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            />
          )}
        </TableShell>
      )}

      {canStock && <StockInModal open={modalOpen} onClose={() => setModalOpen(false)} />}
    </Box>
  );
}

function StockOutTab({ canStock, isOwner }: { canStock: boolean; isOwner: boolean }) {
  const [page, setPage] = useState(1);
  const [pickedIdx, setPickedIdx] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.stockOut({ page }),
    queryFn: () => fetchJson<StockOutData>(`/api/stock-out?page=${page}`),
    placeholderData: keepPreviousData,
  });

  const picked = data?.rows[pickedIdx] ?? data?.rows[0];

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
      <Box sx={{ flex: "2.4 1 460px", minWidth: 460 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
          <Typography sx={{ fontSize: 12, color: t.muted }}>
            Stock released against Material Request Forms
          </Typography>
          {canStock && (
            <ButtonBase
              onClick={() => setModalOpen(true)}
              sx={{
                ml: "auto",
                border: "none",
                bgcolor: ACCENT,
                color: "#fff",
                borderRadius: "2px",
                px: 1.625,
                py: 1,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              + New Stock Out
            </ButtonBase>
          )}
          {isOwner && <ViewOnlyNotice text="View only — Stock Out requires Admin or Warehouse Staff role" />}
        </Box>

        {!data ? (
          <TableSkeleton label="Loading stock-out releases…" columns={7} rows={5} />
        ) : (
          <TableShell minWidth={720} dimmed={isFetching}>
            <TableHeaderRow
              columns={SO_COLS}
              headers={["Reference No.", "Date", "Technician Name", "Item", "Qty", "MRF Number", "Project"]}
            />
            {data.rows.map((r, i) => (
              <TableRow key={r.id} columns={SO_COLS} onClick={() => setPickedIdx(i)} selected={picked?.id === r.id}>
                <TableCell mono color={ACCENT}>
                  {r.ref}
                </TableCell>
                <TableCell color={t.text2}>{formatDate(new Date(r.date))}</TableCell>
                <TableCell>{r.tech}</TableCell>
                <TableCell>{r.item}</TableCell>
                <TableCell bold>{r.qty}</TableCell>
                <TableCell mono>{r.mrf}</TableCell>
                <TableCell color={t.text2}>{r.project}</TableCell>
              </TableRow>
            ))}
            {data.rows.length === 0 && (
              <Box sx={{ px: 1.75, py: 3, fontSize: 12.5, color: t.muted, textAlign: "center" }}>
                No stock-out releases recorded yet.
              </Box>
            )}
            {data.totalPages > 1 && (
              <Pagination
                info={`Showing ${data.rows.length ? (page - 1) * 15 + 1 : 0}–${
                  (page - 1) * 15 + data.rows.length
                } of ${data.total} · Page ${page} of ${data.totalPages}`}
                page={page}
                totalPages={data.totalPages}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              />
            )}
          </TableShell>
        )}
      </Box>

      <Box sx={{ flex: "1 1 250px", minWidth: 250, bgcolor: t.surface, border: "1px solid", borderColor: t.line }}>
        <Box sx={{ px: 1.75, py: 1.25, borderBottom: "1px solid", borderColor: t.line }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Technician Profile</Typography>
        </Box>
        {picked ? (
          <Box sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 1.375 }}>
            <ProfileField label="Name" value={picked.tech} bold />
            <ProfileField label="Employee Number" value={picked.empNo} mono />
            <ProfileField label="Position" value={picked.position} />
            <ProfileField
              label="Recent Transaction"
              value={`${picked.mrf} · ${picked.item} × ${picked.qty} — ${formatDate(new Date(picked.date))}`}
            />
          </Box>
        ) : (
          <Box sx={{ p: 1.75, fontSize: 12.5, color: t.muted }}>No stock-out selected.</Box>
        )}
      </Box>

      {canStock && <StockOutModal open={modalOpen} onClose={() => setModalOpen(false)} />}
    </Box>
  );
}

function ProfileField({
  label,
  value,
  bold,
  mono,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
}) {
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  return (
    <Box>
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
          color: t.muted2,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: bold ? 13 : 12.5,
          fontWeight: bold ? 600 : 400,
          fontFamily: mono ? "'IBM Plex Mono', monospace" : undefined,
          mt: 0.25,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
