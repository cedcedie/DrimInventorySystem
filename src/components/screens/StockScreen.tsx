"use client";

import { useCallback, useState, Suspense } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Box, ButtonBase, Typography, useMediaQuery } from "@mui/material";
import { EntityModal } from "@/components/EntityModal";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { liveHot, liveWarm } from "@/lib/liveQuery";
import { formatDate } from "@/lib/format";
import { parseStockTab, type StockTab } from "@/lib/stockTabs";
import { TableShell, TableHeaderRow, TableRow, TableCell, Pagination, RowActionButton } from "@/components/DataTable";
import { TableSkeleton } from "@/components/Skeleton";
import { StatusChip } from "@/components/StatusChip";
import { useTheme, type Palette } from "@mui/material/styles";
import { StockInModal } from "@/components/modals/StockInModal";
import { StockOutModal } from "@/components/modals/StockOutModal";
import { MrfDetailModal } from "@/components/modals/MrfDetailModal";
import { AdjustStockModal, type AdjustableProduct } from "@/components/modals/AdjustStockModal";
import { PageChrome } from "@/components/PageChrome";
import { EmptyState } from "@/components/EmptyState";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { LastUpdated } from "@/components/LastUpdated";
import { useCan } from "@/components/PermissionsProvider";
import type { Role } from "@/generated/prisma";
import type { StockInData, StockOutData } from "@/lib/data/stock";
import type { OpenMrfsQueueData } from "@/lib/data/mrf";
import { ACCENT_HOVER, motion } from "@/theme/tokens";

const SI_COLS = "110px 106px minmax(0,1.1fr) minmax(0,1.1fr) 76px 40px";
const SO_COLS = "92px 96px minmax(0,1fr) minmax(0,1.1fr) 48px 84px minmax(0,1fr)";
const MRF_COLS = "100px 96px minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,1fr) 72px 72px 72px 88px";

export function StockScreen({ role, initialTab }: { role: Role; initialTab?: string }) {
  return (
    <Suspense fallback={<TableSkeleton label="Loading stock…" columns={6} rows={6} />}>
      <StockScreenInner role={role} initialTab={initialTab} />
    </Suspense>
  );
}

function StockScreenInner({ role, initialTab }: { role: Role; initialTab?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseStockTab(searchParams.get("tab") ?? initialTab);
  const [stockOutOpen, setStockOutOpen] = useState(false);
  const [fulfillItemId, setFulfillItemId] = useState<string | undefined>();
  const [detailMrfId, setDetailMrfId] = useState<string | null>(null);
  const canStock = useCan("stock", "canCreate");
  const viewOnly = !canStock;
  void role;
  const t = useTheme().palette;

  const setTab = useCallback(
    (next: StockTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const openFulfill = (mrfItemId?: string) => {
    setFulfillItemId(mrfItemId);
    setStockOutOpen(true);
  };

  const closeStockOut = () => {
    setStockOutOpen(false);
    setFulfillItemId(undefined);
  };

  return (
    <Box>
      <PageChrome title="Stock & Material Requests" />
      <Box
        role="tablist"
        aria-label="Stock sections"
        sx={{ display: "flex", gap: 0.25, mb: 1.75, borderBottom: "1px solid", borderColor: t.line }}
      >
        <TabButton label="Open MRFs" active={tab === "requests"} onClick={() => setTab("requests")} />
        <TabButton label="Stock In (SI)" active={tab === "in"} onClick={() => setTab("in")} />
        <TabButton label="Stock Out (SO)" active={tab === "out"} onClick={() => setTab("out")} />
      </Box>

      {tab === "requests" ? (
        <OpenMrfsTab
          canStock={canStock}
          viewOnly={viewOnly}
          onFulfill={openFulfill}
          onOpenDetail={setDetailMrfId}
        />
      ) : tab === "in" ? (
        <StockInTab canStock={canStock} viewOnly={viewOnly} />
      ) : (
        <StockOutTab canStock={canStock} viewOnly={viewOnly} onFulfill={() => openFulfill()} />
      )}

      {canStock && (
        <StockOutModal open={stockOutOpen} onClose={closeStockOut} initialMrfItemId={fulfillItemId} />
      )}

      <MrfDetailModal
        mrfId={detailMrfId}
        open={Boolean(detailMrfId)}
        onClose={() => setDetailMrfId(null)}
        onFulfill={canStock ? openFulfill : undefined}
      />
    </Box>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const t = useTheme().palette;

  return (
    <ButtonBase
      role="tab"
      aria-selected={active}
      onClick={onClick}
      sx={{
        border: "none",
        bgcolor: "transparent",
        px: 2,
        py: 1,
        fontSize: 13,
        fontWeight: 600,
        color: active ? t.primary.main : t.muted,
        borderBottom: "2px solid",
        borderColor: active ? t.primary.main : "transparent",
        mb: "-1px",
        "&:focus-visible": {
          outline: `2px solid ${t.primary.main}`,
          outlineOffset: 2,
        },
      }}
    >
      {label}
    </ButtonBase>
  );
}


function OpenMrfsTab({
  canStock,
  viewOnly,
  onFulfill,
  onOpenDetail,
}: {
  canStock: boolean;
  viewOnly: boolean;
  onFulfill: (mrfItemId: string) => void;
  onOpenDetail: (mrfId: string) => void;
}) {
  const t = useTheme().palette;
  const { data, isFetching, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.openMrfs,
    queryFn: () => fetchJson<OpenMrfsQueueData>("/api/mrf/open"),
    ...liveHot,
  });

  const flatRows =
    data?.mrfs.flatMap((mrf) =>
      mrf.items.map((item) => ({
        mrfId: mrf.id,
        ...item,
        refNo: mrf.refNo,
        project: mrf.project,
        externalRefNo: mrf.externalRefNo,
        technicianName: mrf.technicianName,
        status: mrf.status,
        createdAt: mrf.createdAt,
      }))
    ) ?? [];

  return (
    <Box>
      {viewOnly && (
        <ViewOnlyBanner text="View only — fulfilling material requests requires Stock Out permission" />
      )}
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: t.muted }}>
          Material requests awaiting warehouse release — fulfill against the request # (MRF)
        </Typography>
        <Box sx={{ ml: "auto" }}>
          <LastUpdated dataUpdatedAt={dataUpdatedAt} />
        </Box>
      </Box>

      {!data ? (
        <TableSkeleton label="Loading open material requests…" columns={8} rows={6} />
      ) : (
        <TableShell minWidth={900} dimmed={isFetching}>
          <TableHeaderRow
            columns={MRF_COLS}
            headers={[
              "Request #",
              "Filed",
              "Technician",
              "Project",
              "Item",
              "Need",
              "In stock",
              "Action",
            ]}
          />
          {flatRows.map((row) => (
            <TableRow key={row.id} columns={MRF_COLS} onClick={() => onOpenDetail(row.mrfId)}>
              <TableCell label="Request #" mono color={t.primary.main}>
                {row.refNo}
              </TableCell>
              <TableCell label="Filed" color={t.text2}>{formatDate(new Date(row.createdAt))}</TableCell>
              <TableCell label="Technician">{row.technicianName}</TableCell>
              <TableCell label="Project" color={t.text2}>
                {row.project}
                {row.externalRefNo && (
                  <Box component="span" sx={{ display: "block", fontSize: 10, color: t.muted2 }}>
                    Ext. {row.externalRefNo}
                  </Box>
                )}
              </TableCell>
              <TableCell label="Item">
                {row.productName}
                <Box component="span" sx={{ display: "block", fontSize: 10, color: t.muted2, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {row.productCode}
                </Box>
              </TableCell>
              <TableCell label="Need" bold>
                {row.qtyRemaining} {row.unit}
                {row.qtyFulfilled > 0 && (
                  <Box component="span" sx={{ fontSize: 10, color: t.muted, fontWeight: 400 }}>
                    {" "}
                    ({row.qtyFulfilled} done)
                  </Box>
                )}
              </TableCell>
              <TableCell
                label="In stock"
                bold
                color={row.availableStock >= row.qtyRemaining ? t.success.main : t.warning.main}
              >
                {row.availableStock}
              </TableCell>
              <TableCell label="Action">
                {canStock ? (
                  <ButtonBase
                    onClick={(e) => {
                      e.stopPropagation();
                      onFulfill(row.id);
                    }}
                    sx={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: t.primary.main,
                      px: 1,
                      py: 0.5,
                      border: "1px solid",
                      borderColor: t.primary.main,
                      borderRadius: "8px",
                      transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, color ${motion.duration.color}ms ${motion.easing.standard}`,
                      "&:hover": { bgcolor: t.primary.main, color: "#fff" },
                    }}
                  >
                    Fulfill
                  </ButtonBase>
                ) : (
                  <StatusChip label={row.status === "PARTIAL" ? "Partial" : "Pending"} />
                )}
              </TableCell>
            </TableRow>
          ))}
          {flatRows.length === 0 && (
            <EmptyState message="No open material requests — all caught up." />
          )}
        </TableShell>
      )}
    </Box>
  );
}

function StockInTab({ canStock, viewOnly }: { canStock: boolean; viewOnly: boolean }) {
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [correcting, setCorrecting] = useState<{ product: AdjustableProduct; note: string } | null>(null);
  const canCorrect = useCan("inventory", "canEdit");
  const t = useTheme().palette;

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.stockIn({ page }),
    queryFn: () => fetchJson<StockInData>(`/api/stock-in?page=${page}`),
    placeholderData: keepPreviousData,
    ...liveWarm,
  });

  const cols = canCorrect ? SI_COLS : "110px 106px minmax(0,1.2fr) minmax(0,1.2fr) 80px";

  return (
    <Box>
      {viewOnly && <ViewOnlyBanner text="View only — recording Stock In requires create permission" />}
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: t.muted }}>
          Receipt slips (SI) — incoming stock from suppliers
        </Typography>
        {canStock && (
          <ButtonBase
            onClick={() => setModalOpen(true)}
            sx={{
              ml: "auto",
              border: "none",
              bgcolor: t.primary.main,
              color: "#fff",
              borderRadius: "8px",
              px: 1.625,
              py: 1,
              fontSize: 12,
              fontWeight: 600,
              transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, transform ${motion.duration.press}ms ${motion.easing.standard}`,
              "&:hover": { bgcolor: ACCENT_HOVER },
              "&:active": { transform: "scale(0.98)" },
            }}
          >
            + New Stock In
          </ButtonBase>
        )}
      </Box>

      {!data ? (
        <TableSkeleton label="Loading stock-in deliveries…" columns={5} rows={5} />
      ) : (
        <TableShell minWidth={620} dimmed={isFetching}>
          <TableHeaderRow
            columns={cols}
            headers={
              canCorrect
                ? ["Receipt slip (SI)", "Date", "Supplier", "Item", "Quantity", ""]
                : ["Receipt slip (SI)", "Date", "Supplier", "Item", "Quantity"]
            }
          />
          {data.rows.map((r) => (
            <TableRow key={r.id} columns={cols}>
              <TableCell label="Receipt slip (SI)" mono color={t.primary.main}>
                {r.ref}
              </TableCell>
              <TableCell label="Date" color={t.text2}>{formatDate(new Date(r.date))}</TableCell>
              <TableCell label="Supplier">{r.supplier}</TableCell>
              <TableCell label="Item">{r.item}</TableCell>
              <TableCell label="Quantity" bold>{r.qty}</TableCell>
              {canCorrect && (
                <TableCell>
                  <RowActionButton
                    kind="adjust"
                    label={`Correct ${r.item} count`}
                    onClick={() =>
                      setCorrecting({
                        product: {
                          id: r.productId,
                          name: r.item,
                          code: r.productCode,
                          unit: r.productUnit,
                          stocks: r.productStocks,
                        },
                        note: `Correcting Stock In ${r.ref} — recorded ${r.qty} ${r.productUnit}`,
                      })
                    }
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
          {data.rows.length === 0 && (
            <EmptyState
              message="No stock-in deliveries recorded yet."
              actionLabel={canStock ? "Record Stock In" : undefined}
              onAction={canStock ? () => setModalOpen(true) : undefined}
            />
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
      {canCorrect && (
        <AdjustStockModal
          product={correcting?.product ?? null}
          initialNote={correcting?.note}
          onClose={() => setCorrecting(null)}
        />
      )}
    </Box>
  );
}

function StockOutTab({
  canStock,
  viewOnly,
  onFulfill,
}: {
  canStock: boolean;
  viewOnly: boolean;
  onFulfill: () => void;
}) {
  const [page, setPage] = useState(1);
  const [pickedIdx, setPickedIdx] = useState(0);
  const [correcting, setCorrecting] = useState<{ product: AdjustableProduct; note: string } | null>(null);
  const canCorrect = useCan("inventory", "canEdit");
  const theme = useTheme();
  const t = theme.palette;
  // Below this width the inline "Release detail" side panel would render
  // beneath the whole table instead of next to it — tapping a row would
  // silently update a panel the user has to scroll past the table to see.
  // Below that width a tap opens the same detail in a modal instead, so
  // it's front-and-center regardless of which row was picked.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.stockOut({ page }),
    queryFn: () => fetchJson<StockOutData>(`/api/stock-out?page=${page}`),
    placeholderData: keepPreviousData,
    ...liveWarm,
  });

  const picked = data?.rows[pickedIdx] ?? data?.rows[0];

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
      <Box sx={{ flex: "2.4 1 460px", minWidth: { xs: "100%", sm: 460 } }}>
        {viewOnly && <ViewOnlyBanner text="View only — releasing Stock Out requires create permission" />}
        <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
          <Typography sx={{ fontSize: 12, color: t.muted }}>
            Release slips (SO) — stock issued against material requests
          </Typography>
          {canStock && (
            <ButtonBase
              onClick={onFulfill}
              sx={{
                ml: "auto",
                border: "none",
                bgcolor: t.primary.main,
                color: "#fff",
                borderRadius: "2px",
                px: 1.625,
                py: 1,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              + Fulfill MRF
            </ButtonBase>
          )}
        </Box>

        {!data ? (
          <TableSkeleton label="Loading stock-out releases…" columns={7} rows={5} />
        ) : (
          <TableShell minWidth={720} dimmed={isFetching}>
            <TableHeaderRow
              columns={SO_COLS}
              headers={[
                "Release slip (SO)",
                "Date",
                "Technician",
                "Item",
                "Qty",
                "Request # (MRF)",
                "Project",
              ]}
            />
            {data.rows.map((r, i) => (
              <TableRow
                key={r.id}
                columns={SO_COLS}
                onClick={() => {
                  setPickedIdx(i);
                  if (isMobile) setMobileDetailOpen(true);
                }}
                selected={picked?.id === r.id}
              >
                <TableCell label="Release slip (SO)" mono color={t.primary.main}>
                  {r.ref}
                </TableCell>
                <TableCell label="Date" color={t.text2}>{formatDate(new Date(r.date))}</TableCell>
                <TableCell label="Technician">{r.tech}</TableCell>
                <TableCell label="Item">{r.item}</TableCell>
                <TableCell label="Qty" bold>{r.qty}</TableCell>
                <TableCell label="Request # (MRF)" mono>{r.mrf}</TableCell>
                <TableCell label="Project" color={t.text2}>{r.project}</TableCell>
              </TableRow>
            ))}
            {data.rows.length === 0 && (
              <EmptyState
                message="No stock-out releases recorded yet."
                actionLabel={canStock ? "Fulfill an MRF" : undefined}
                onAction={canStock ? onFulfill : undefined}
              />
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

      {/* Desktop/tablet: inline side panel. Below `sm` this is replaced by
          the modal opened on row-tap (see mobileDetailOpen) so the detail
          is never rendered below content the user would have to scroll
          past to reach. */}
      <Box
        sx={{
          display: { xs: "none", sm: "block" },
          flex: "1 1 250px",
          minWidth: 250,
          bgcolor: t.surface,
          border: "1px solid",
          borderColor: t.line,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <Box sx={{ px: 1.75, py: 1.25, borderBottom: "1px solid", borderColor: t.line }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Release detail</Typography>
        </Box>
        <ReleaseDetailBody picked={picked} canCorrect={canCorrect} onCorrect={setCorrecting} t={t} />
      </Box>

      <EntityModal
        open={isMobile && mobileDetailOpen}
        onClose={() => setMobileDetailOpen(false)}
        title={picked ? `Release ${picked.ref}` : "Release detail"}
        width={420}
      >
        <ReleaseDetailBody
          picked={picked}
          canCorrect={canCorrect}
          onCorrect={(c) => {
            setMobileDetailOpen(false);
            setCorrecting(c);
          }}
          t={t}
          padded
        />
      </EntityModal>

      {canCorrect && (
        <AdjustStockModal
          product={correcting?.product ?? null}
          initialNote={correcting?.note}
          onClose={() => setCorrecting(null)}
        />
      )}
    </Box>
  );
}

function ReleaseDetailBody({
  picked,
  canCorrect,
  onCorrect,
  t,
  padded,
}: {
  picked: StockOutData["rows"][number] | undefined;
  canCorrect: boolean;
  onCorrect: (c: { product: AdjustableProduct; note: string }) => void;
  t: Palette;
  /** The modal body needs its own padding; the inline panel already gets it
   * from the surrounding card. */
  padded?: boolean;
}) {
  if (!picked) {
    return <Box sx={{ p: 1.75, fontSize: 12.5, color: t.muted }}>No release selected.</Box>;
  }

  return (
    <Box sx={{ p: padded ? 2.25 : 1.75, display: "flex", flexDirection: "column", gap: 1.375 }}>
      <ProfileField label="Release slip (SO)" value={picked.ref} mono bold />
      <ProfileField label="Request # (MRF)" value={picked.mrf} mono />
      <ProfileField label="Technician" value={picked.tech} bold />
      <ProfileField label="Employee Number" value={picked.empNo} mono />
      <ProfileField label="Item" value={`${picked.item} × ${picked.qty}`} />
      <ProfileField label="Project" value={picked.project} />
      <ProfileField label="Released" value={formatDate(new Date(picked.date))} />
      {canCorrect && (
        <ButtonBase
          onClick={() =>
            onCorrect({
              product: {
                id: picked.productId,
                name: picked.item,
                code: picked.productCode,
                unit: picked.productUnit,
                stocks: picked.productStocks,
              },
              note: `Correcting Stock Out ${picked.ref} — released ${picked.qty} ${picked.productUnit}`,
            })
          }
          sx={{
            mt: 0.5,
            alignSelf: "flex-start",
            fontSize: 11.5,
            fontWeight: 600,
            color: t.warning.main,
            border: "1px solid",
            borderColor: t.warning.main,
            borderRadius: "8px",
            px: 1.25,
            py: 0.625,
            transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, color ${motion.duration.color}ms ${motion.easing.standard}`,
            "&:hover": { bgcolor: t.warning.main, color: "#fff" },
          }}
        >
          Correct this release
        </ButtonBase>
      )}
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
  const t = useTheme().palette;

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
