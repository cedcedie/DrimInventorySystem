"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Box, ButtonBase, Tab, Tabs, Typography, useMediaQuery } from "@mui/material";
import { RichTooltip } from "@/components/RichTooltip";
import { EntityModal } from "@/components/EntityModal";
import { fetchJson } from "@/lib/api";
import { usePaginatedQuery } from "@/lib/usePaginatedQuery";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
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
import { SearchByPanel } from "@/components/SearchByPanel";
import { ItemFilterField } from "@/components/ItemFilterField";
import { ExportButton } from "@/components/ExportButton";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { LastUpdated } from "@/components/LastUpdated";
import { useCan } from "@/components/PermissionsProvider";
import type { StockInData, StockOutData } from "@/lib/data/stock";
import type { OpenMrfsQueueData } from "@/lib/data/mrf";
import { ACCENT_HOVER, motion } from "@/theme/tokens";

const SI_COLS = "110px 106px minmax(0,1.1fr) minmax(0,1.1fr) 76px 64px";
const SO_COLS = "92px 96px minmax(0,1fr) minmax(0,1.1fr) 48px 84px minmax(0,1fr)";
const MRF_COLS = "100px 96px minmax(0,0.9fr) minmax(0,0.9fr) minmax(0,1fr) 72px 72px 88px";

export function StockScreen({ initialTab }: { initialTab?: string }) {
  return (
    <Suspense fallback={<TableSkeleton label="Loading stock…" columns={6} rows={6} />}>
      <StockScreenInner initialTab={initialTab} />
    </Suspense>
  );
}

function StockScreenInner({ initialTab }: { initialTab?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseStockTab(searchParams.get("tab") ?? initialTab);
  const [stockOutOpen, setStockOutOpen] = useState(false);
  const [fulfillItemId, setFulfillItemId] = useState<string | undefined>();
  const [detailMrfId, setDetailMrfId] = useState<string | null>(null);
  const canStock = useCan("stock", "canCreate");
  const viewOnly = !canStock;
  const t = useTheme().palette;

  const setTab = useCallback(
    (next: StockTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Deep link from Activity Log: "?ref=MRF-0123" opens that request's detail
  // once the open queue loads. Only covers still-open (pending/partial) MRFs
  // — a fulfilled/old one won't be in the queue, so it just lands on the tab.
  const refParam = searchParams.get("ref");
  const { data: openMrfsForLink } = useQuery({
    queryKey: queryKeys.openMrfs(),
    queryFn: () => fetchJson<OpenMrfsQueueData>("/api/mrf/open"),
    enabled: Boolean(refParam) && tab === "requests",
  });
  useEffect(() => {
    if (!refParam || tab !== "requests" || !openMrfsForLink) return;
    const match = openMrfsForLink.mrfs.find((m) => m.refNo === refParam);
    if (match) setDetailMrfId(match.id);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("ref");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when the linked data arrives, not on every searchParams identity change
  }, [refParam, tab, openMrfsForLink]);

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
      <Tabs
        value={tab}
        onChange={(_, next: StockTab) => setTab(next)}
        aria-label="Stock sections"
        sx={{
          mb: 1.75,
          minHeight: "auto",
          borderBottom: "1px solid",
          borderColor: t.line,
          "& .MuiTab-root": {
            minHeight: "auto",
            px: 2,
            py: 1,
            fontSize: 13,
            fontWeight: 600,
            textTransform: "none",
            color: t.muted,
            "&.Mui-selected": { color: t.primary.main },
            "&:focus-visible": { outline: `2px solid ${t.primary.main}`, outlineOffset: 2 },
          },
          "& .MuiTabs-indicator": { bgcolor: t.primary.main, height: 2 },
        }}
      >
        <Tab label="Open MRFs" value="requests" />
        <Tab label="Stock In (SI)" value="in" />
        <Tab label="Stock Out (SO)" value="out" />
      </Tabs>

      {tab === "requests" ? (
        <OpenMrfsTab canStock={canStock} viewOnly={viewOnly} onOpenDetail={setDetailMrfId} />
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



function OpenMrfsTab({
  canStock,
  viewOnly,
  onOpenDetail,
}: {
  canStock: boolean;
  viewOnly: boolean;
  /** Opens the MRF detail modal, where each line item gets its own Fulfill button. */
  onOpenDetail: (mrfId: string) => void;
}) {
  const t = useTheme().palette;
  const canExportOpenMrfs = useCan("stock", "canExport");
  const [mrfNumber, setMrfNumber] = useState("");
  const [project, setProject] = useState("");
  const [item, setItem] = useState("");
  const [technician, setTechnician] = useState("");
  // The inputs stay instant (local state) — only the actual server fetch
  // waits for typing to pause, so it's not a full request per keystroke.
  const debouncedMrfNumber = useDebouncedValue(mrfNumber, 300);
  const debouncedProject = useDebouncedValue(project, 300);
  const debouncedItem = useDebouncedValue(item, 300);
  const debouncedTechnician = useDebouncedValue(technician, 300);
  const hasFilter = Boolean(debouncedMrfNumber || debouncedProject || debouncedItem || debouncedTechnician);
  const { data, dataUpdatedAt, setPage } = usePaginatedQuery<OpenMrfsQueueData>({
    queryKey: (p) =>
      queryKeys.openMrfs({
        page: p,
        mrfNumber: debouncedMrfNumber,
        project: debouncedProject,
        item: debouncedItem,
        technician: debouncedTechnician,
      }),
    url: (p) =>
      `/api/mrf/open?page=${p}&mrfNumber=${encodeURIComponent(debouncedMrfNumber)}&project=${encodeURIComponent(debouncedProject)}&item=${encodeURIComponent(debouncedItem)}&technician=${encodeURIComponent(debouncedTechnician)}`,
    live: liveHot,
  });

  // Reset to page 1 once a filter actually changes (i.e. once a new fetch
  // is about to happen) — not on every keystroke.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only page-reset on a real filter change, not every render
  }, [debouncedMrfNumber, debouncedProject, debouncedItem, debouncedTechnician]);

  // One row per MRF, not per line item, so multi-item MRFs don't repeat as duplicate-looking rows.
  const mrfRows =
    data?.mrfs.map((mrf) => {
      const totalRemaining = mrf.items.reduce((sum, item) => sum + item.qtyRemaining, 0);
      const anyShort = mrf.items.some((item) => item.availableStock < item.qtyRemaining);
      const worstStock = mrf.items.reduce(
        (min, item) => Math.min(min, item.availableStock),
        Infinity
      );
      return {
        mrfId: mrf.id,
        refNo: mrf.refNo,
        project: mrf.project,
        externalRefNo: mrf.externalRefNo,
        technicianName: mrf.technicianName,
        status: mrf.status,
        createdAt: mrf.createdAt,
        firstItem: mrf.items[0],
        extraItemCount: mrf.items.length - 1,
        allItems: mrf.items,
        totalRemaining,
        unit: mrf.items[0]?.unit ?? "",
        anyShort,
        worstStock: Number.isFinite(worstStock) ? worstStock : 0,
      };
    }) ?? [];

  return (
    <Box>
      {viewOnly && (
        <ViewOnlyBanner text="View only — fulfilling material requests requires Stock Out permission" />
      )}
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 1.5, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: 12, color: t.muted }}>
          Material requests awaiting warehouse release — fulfill against the request # (MRF)
        </Typography>
        <Box sx={{ ml: "auto" }}>
          <LastUpdated dataUpdatedAt={dataUpdatedAt} />
        </Box>
      </Box>
      <SearchByPanel
        fields={[
          { key: "mrfNumber", label: "MRF #", value: mrfNumber, onChange: setMrfNumber },
          { key: "item", label: "Item", value: item, onChange: setItem, render: () => <ItemFilterField value={item} onChange={setItem} /> },
          { key: "project", label: "Project Name", value: project, onChange: setProject },
          { key: "technician", label: "Technician", value: technician, onChange: setTechnician },
        ]}
        trailing={
          canExportOpenMrfs && (
            <ExportButton
              buildUrl={(format) =>
                `/api/mrf/open/export?format=${format}&mrfNumber=${encodeURIComponent(debouncedMrfNumber)}&project=${encodeURIComponent(debouncedProject)}&item=${encodeURIComponent(debouncedItem)}&technician=${encodeURIComponent(debouncedTechnician)}`
              }
            />
          )
        }
      />

      {!data ? (
        <TableSkeleton label="Loading open material requests…" columns={8} rows={6} />
      ) : (
        <TableShell minWidth={900}>
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
          {mrfRows.map((row) => (
            <TableRow key={row.mrfId} columns={MRF_COLS} onClick={() => onOpenDetail(row.mrfId)}>
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
                <RichTooltip
                  arrow
                  title={
                    <Box sx={{ py: 1, px: 1.25 }}>
                      <Box sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: t.muted, mb: 0.75 }}>
                        {row.allItems.length} ITEM{row.allItems.length === 1 ? "" : "S"} ON THIS REQUEST
                      </Box>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.625 }}>
                        {row.allItems.map((it) => (
                          <Box
                            key={it.id}
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              gap: 1,
                              pb: 0.625,
                              borderBottom: "1px solid",
                              borderColor: t.line2,
                              "&:last-of-type": { borderBottom: "none", pb: 0 },
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Box sx={{ fontSize: 12.5, fontWeight: 600 }}>{it.productName}</Box>
                              <Box sx={{ fontSize: 10, color: t.muted2, fontFamily: "'IBM Plex Mono', monospace" }}>
                                {it.productCode}
                              </Box>
                            </Box>
                            <Box sx={{ fontSize: 12, fontWeight: 700, color: t.primary.main, whiteSpace: "nowrap" }}>
                              {it.qtyRemaining} {it.unit}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  }
                >
                  <Box component="span" sx={{ cursor: "default" }}>
                    {row.firstItem?.productName}
                    {row.extraItemCount > 0 && (
                      <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: t.muted, fontWeight: 600 }}>
                        (+{row.extraItemCount} more)
                      </Box>
                    )}
                    <Box component="span" sx={{ display: "block", fontSize: 10, color: t.muted2, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {row.firstItem?.productCode}
                    </Box>
                  </Box>
                </RichTooltip>
              </TableCell>
              <TableCell label="Need" bold>
                {row.totalRemaining} {row.unit}
              </TableCell>
              <TableCell label="In stock" bold color={row.anyShort ? t.warning.main : t.success.main}>
                {row.worstStock}
              </TableCell>
              <TableCell label="Action">
                {canStock ? (
                  <ButtonBase
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetail(row.mrfId);
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
          {mrfRows.length === 0 && (
            <EmptyState
              message={hasFilter ? "No open requests match your search." : "No open material requests — all caught up."}
            />
          )}
          {data && mrfRows.length > 0 && (
            <Pagination
              info={`${data.total} open request${data.total === 1 ? "" : "s"}`}
              page={data.page}
              totalPages={data.totalPages}
              onChange={setPage}
            />
          )}
        </TableShell>
      )}
    </Box>
  );
}

function StockInTab({ canStock, viewOnly }: { canStock: boolean; viewOnly: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [correcting, setCorrecting] = useState<{ product: AdjustableProduct; note: string } | null>(null);
  const canCorrect = useCan("inventory", "canEdit");
  const canExport = useCan("stock", "canExport");
  const t = useTheme().palette;
  const [item, setItem] = useState("");
  const [supplier, setSupplier] = useState("");
  const [refNo, setRefNo] = useState("");
  const [date, setDate] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  // The inputs stay instant (local state) — only the actual server fetch
  // waits for typing to pause, so it's not a full request per keystroke.
  const debouncedItem = useDebouncedValue(item, 300);
  const debouncedSupplier = useDebouncedValue(supplier, 300);
  const debouncedRefNo = useDebouncedValue(refNo, 300);
  const debouncedDate = useDebouncedValue(date, 300);
  const debouncedReceivedBy = useDebouncedValue(receivedBy, 300);
  const filters = {
    item: debouncedItem,
    supplier: debouncedSupplier,
    refNo: debouncedRefNo,
    date: debouncedDate,
    receivedBy: debouncedReceivedBy,
  };
  const hasFilter = Object.values(filters).some(Boolean);

  const { data, page, setPage } = usePaginatedQuery<StockInData>({
    queryKey: (p) => queryKeys.stockIn({ page: p, ...filters }),
    url: (p) =>
      `/api/stock-in?page=${p}&item=${encodeURIComponent(debouncedItem)}&supplier=${encodeURIComponent(debouncedSupplier)}&refNo=${encodeURIComponent(debouncedRefNo)}&date=${encodeURIComponent(debouncedDate)}&receivedBy=${encodeURIComponent(debouncedReceivedBy)}`,
    live: liveWarm,
  });

  // Reset to page 1 once a filter actually changes (i.e. once a new fetch
  // is about to happen) — not on every keystroke.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only page-reset on a real filter change, not every render
  }, [debouncedItem, debouncedSupplier, debouncedRefNo, debouncedDate, debouncedReceivedBy]);

  const cols = canCorrect ? SI_COLS : "110px 106px minmax(0,1.2fr) minmax(0,1.2fr) 80px";

  return (
    <Box>
      {viewOnly && <ViewOnlyBanner text="View only — recording Stock In requires create permission" />}
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, flexWrap: "wrap" }}>
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
      <SearchByPanel
        fields={[
          { key: "refNo", label: "Receipt #", value: refNo, onChange: setRefNo },
          { key: "date", label: "Date", value: date, onChange: setDate },
          { key: "supplier", label: "Supplier", value: supplier, onChange: setSupplier },
          { key: "item", label: "Item", value: item, onChange: setItem, render: () => <ItemFilterField value={item} onChange={setItem} /> },
          { key: "receivedBy", label: "Received By", value: receivedBy, onChange: setReceivedBy },
        ]}
        trailing={
          canExport && (
            <ExportButton
              buildUrl={(format) =>
                `/api/stock-in/export?format=${format}&item=${encodeURIComponent(debouncedItem)}&supplier=${encodeURIComponent(debouncedSupplier)}&refNo=${encodeURIComponent(debouncedRefNo)}&date=${encodeURIComponent(debouncedDate)}&receivedBy=${encodeURIComponent(debouncedReceivedBy)}`
              }
            />
          )
        }
      />

      {!data ? (
        <TableSkeleton label="Loading stock-in deliveries…" columns={5} rows={5} />
      ) : (
        <TableShell minWidth={660}>
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
              message={hasFilter ? "No deliveries match your search." : "No stock-in deliveries recorded yet."}
              actionLabel={canStock && !hasFilter ? "Record Stock In" : undefined}
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
              onChange={setPage}
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
  const [pickedIdx, setPickedIdx] = useState(0);
  const [correcting, setCorrecting] = useState<{ product: AdjustableProduct; note: string } | null>(null);
  const [mrfNumber, setMrfNumber] = useState("");
  const [date, setDate] = useState("");
  const [item, setItem] = useState("");
  const [project, setProject] = useState("");
  const [technician, setTechnician] = useState("");
  // The inputs stay instant (local state) — only the actual server fetch
  // waits for typing to pause, so it's not a full request per keystroke.
  const debouncedMrfNumber = useDebouncedValue(mrfNumber, 300);
  const debouncedDate = useDebouncedValue(date, 300);
  const debouncedItem = useDebouncedValue(item, 300);
  const debouncedProject = useDebouncedValue(project, 300);
  const debouncedTechnician = useDebouncedValue(technician, 300);
  const canCorrect = useCan("inventory", "canEdit");
  const canExport = useCan("stock", "canExport");
  const theme = useTheme();
  const t = theme.palette;
  // Below `sm` the side panel would render below the table instead of beside it, so use a modal instead.
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const { data, page, setPage } = usePaginatedQuery<StockOutData>({
    queryKey: (p) =>
      queryKeys.stockOut({
        page: p,
        mrfNumber: debouncedMrfNumber,
        date: debouncedDate,
        item: debouncedItem,
        project: debouncedProject,
        technician: debouncedTechnician,
      }),
    url: (p) =>
      `/api/stock-out?page=${p}&mrfNumber=${encodeURIComponent(debouncedMrfNumber)}&date=${encodeURIComponent(debouncedDate)}&item=${encodeURIComponent(debouncedItem)}&project=${encodeURIComponent(debouncedProject)}&technician=${encodeURIComponent(debouncedTechnician)}`,
    live: liveWarm,
  });

  // Reset to page 1 once a filter actually changes (i.e. once a new fetch
  // is about to happen) — not on every keystroke.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only page-reset on a real filter change, not every render
  }, [debouncedMrfNumber, debouncedDate, debouncedItem, debouncedProject, debouncedTechnician]);

  const picked = data?.rows[pickedIdx] ?? data?.rows[0];

  return (
    <Box>
      {viewOnly && <ViewOnlyBanner text="View only — releasing Stock Out requires create permission" />}
      {/* Spans the full width of both columns below, so Download/Fulfill MRF land
         flush with the right edge of the Release detail card, not just the
         narrower table column. */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 1.25, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: 12, color: t.muted }}>
          Release slips (SO) — stock issued against material requests
        </Typography>
        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1.25 }}>
          {canExport && (
            <ExportButton
              buildUrl={(format) =>
                `/api/stock-out/export?format=${format}&mrfNumber=${encodeURIComponent(debouncedMrfNumber)}&date=${encodeURIComponent(debouncedDate)}&item=${encodeURIComponent(debouncedItem)}&project=${encodeURIComponent(debouncedProject)}&technician=${encodeURIComponent(debouncedTechnician)}`
              }
            />
          )}
          {canStock && (
            <ButtonBase
              onClick={onFulfill}
              sx={{
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
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        {/* minWidth must match TableShell's minWidth={720} below, else the sibling panel squeezes the table and clips it instead of scrolling */}
        <Box sx={{ flex: "2.4 1 460px", minWidth: { xs: "100%", sm: 720 } }}>
        {/* Filters every release down to one item — e.g. "Copper Pipe 1/2" — so
           its full history (MRF, slip, requester, project, qty) is visible
           together instead of scattered across pages of unrelated releases. */}
        <SearchByPanel
          fields={[
            { key: "mrfNumber", label: "MRF #", value: mrfNumber, onChange: setMrfNumber },
            { key: "date", label: "Date", value: date, onChange: setDate },
            { key: "item", label: "Item", value: item, onChange: setItem, render: () => <ItemFilterField value={item} onChange={setItem} /> },
            { key: "project", label: "Project Name", value: project, onChange: setProject },
            { key: "technician", label: "Technician", value: technician, onChange: setTechnician },
          ]}
        />

        {!data ? (
          <TableSkeleton label="Loading stock-out releases…" columns={7} rows={5} />
        ) : (
          <TableShell minWidth={720}>
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
                onChange={setPage}
              />
            )}
          </TableShell>
        )}
      </Box>

      {/* Desktop/tablet inline side panel; below `sm` a modal replaces it (see mobileDetailOpen) */}
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
  /** Modal body needs its own padding; the inline panel gets it from the surrounding card. */
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
