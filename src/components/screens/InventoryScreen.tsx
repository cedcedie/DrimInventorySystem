"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, InputBase, Select, MenuItem } from "@mui/material";
import { usePaginatedQuery } from "@/lib/usePaginatedQuery";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { queryKeys } from "@/lib/queryKeys";
import { liveCool } from "@/lib/liveQuery";
import {
  TableShell,
  TableHeaderRow,
  TableRow,
  TableCell,
  Pagination,
  RowActionButton,
} from "@/components/DataTable";
import { StatusChip } from "@/components/StatusChip";
import { StockMeter } from "@/components/StockMeter";
import { TableSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { PageChrome } from "@/components/PageChrome";
import { useTheme } from "@mui/material/styles";
import { patchJson, deleteJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { ProductModal, type ProductFormRow } from "@/components/modals/ProductModal";
import { CategoryModal } from "@/components/modals/CategoryModal";
import { AdjustStockModal, type AdjustableProduct } from "@/components/modals/AdjustStockModal";
import { useCan } from "@/components/PermissionsProvider";
import type { InventoryData } from "@/lib/data/inventory";

export function InventoryScreen({
  initialData,
}: {
  initialData?: InventoryData;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  // The input stays instant (local state) — only the actual server fetch
  // waits for typing to pause, so it's not a full request per keystroke.
  const debouncedQ = useDebouncedValue(q, 300);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormRow | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<AdjustableProduct | null>(null);
  const canCreateProduct = useCan("products", "canCreate");
  const canEditProduct = useCan("products", "canEdit");
  const canDeleteProduct = useCan("products", "canDelete");
  const canEditInventory = useCan("inventory", "canEdit");
  const canManage = canEditProduct || canDeleteProduct || canEditInventory;
  const showMinLevel = canEditInventory;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, page, setPage } = usePaginatedQuery<InventoryData>({
    queryKey: (p) => queryKeys.inventory({ q: debouncedQ, category, page: p }),
    url: (p) =>
      `/api/inventory?q=${encodeURIComponent(debouncedQ)}&category=${encodeURIComponent(category)}&page=${p}`,
    initialData,
    live: liveCool,
  });

  // Reset to page 1 once the search/category filter actually changes (i.e.
  // once a new fetch is about to happen) — not on every keystroke.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only page-reset on a real filter change, not every render
  }, [debouncedQ, category]);

  const t = useTheme().palette;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    queryClient.invalidateQueries({ queryKey: ["activity"] });
  };

  const minLevelMutation = useMutation({
    mutationFn: ({ id, minLevel }: { id: string; minLevel: number }) =>
      patchJson(`/api/products/${id}/min-level`, { minLevel }),
    onSuccess: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJson<{ ok: boolean; archived?: boolean }>(`/api/products/${id}`),
    onSuccess: (res) => {
      invalidateAll();
      showToast(
        res.archived
          ? "Product archived — transaction history kept."
          : "Item deleted from inventory."
      );
    },
  });

  const columns = canManage
    ? showMinLevel
      ? "48px 84px minmax(0,1.4fr) minmax(0,0.9fr) 72px 64px 100px 80px 140px"
      : "48px 84px minmax(0,1.4fr) minmax(0,0.9fr) 72px 64px 100px 140px"
    : "48px 92px minmax(0,1.5fr) minmax(0,1fr) 80px 70px 110px";
  const minWidth = canManage ? (showMinLevel ? 900 : 840) : 720;
  const headers = [
    "",
    "Code",
    "Product Name",
    "Category",
    "Stocks",
    "Unit",
    "Status",
    ...(showMinLevel ? ["Min"] : []),
    ...(canManage ? ["Actions"] : []),
  ];

  return (
    <Box>
      <PageChrome
        title="Inventory"
        addLabel={canCreateProduct ? "Add Product" : undefined}
        onAdd={
          canCreateProduct
            ? () => {
                setEditingProduct(null);
                setProductModalOpen(true);
              }
            : undefined
        }
      >
        {canCreateProduct && (
          <ButtonBase
            onClick={() => setCategoryModalOpen(true)}
            sx={{
              border: "1px solid",
              borderColor: t.border,
              bgcolor: t.surface,
              borderRadius: "8px",
              px: 1.5,
              height: 38,
              fontSize: 13,
              fontWeight: 700,
              color: t.text2,
            }}
          >
            Categories
          </ButtonBase>
        )}
      </PageChrome>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          mb: 1.5,
          flexWrap: "wrap",
          px: 1.5,
          py: 1.25,
          bgcolor: t.surface,
          border: "1px solid",
          borderColor: t.line,
          borderRadius: "12px",
        }}
      >
        <InputBase
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by Product Code or Name"
          sx={{
            flex: "1 1 200px",
            border: "1px solid",
            borderColor: t.border,
            borderRadius: "8px",
            px: 1.375,
            py: 0.75,
            fontSize: 13,
            bgcolor: t.mode === "dark" ? "background.default" : "#F9FAFB",
          }}
        />
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          size="small"
          sx={{
            minWidth: 160,
            fontSize: 13,
            fontWeight: 700,
            bgcolor: t.surface,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: t.border },
          }}
        >
          {["All", ...(data?.categories ?? [])].map((c) => (
            <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>
              {c}
            </MenuItem>
          ))}
        </Select>
      </Box>

      {!data ? (
        <TableSkeleton label="Loading inventory…" columns={canManage ? (showMinLevel ? 9 : 8) : 7} rows={8} />
      ) : (
        <TableShell minWidth={minWidth}>
          <TableHeaderRow columns={columns} headers={headers} />
          {data.rows.map((r) => (
            <TableRow key={r.id} columns={columns}>
              <TableCell sx={{ overflow: "visible" }}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: "6px",
                    bgcolor: t.mode === "dark" ? "background.paper" : "#F4F6F8",
                    border: "1px solid",
                    borderColor: t.line,
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {r.imageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/blobs/${r.imageKey}`}
                      alt=""
                      width={34}
                      height={34}
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <Box sx={{ fontSize: 9, fontWeight: 800, color: t.muted3 }}>{r.code.slice(0, 2)}</Box>
                  )}
                </Box>
              </TableCell>
              <TableCell label="Code" mono color={t.text2}>
                {r.code}
              </TableCell>
              <TableCell label="Product Name" bold sx={{ whiteSpace: "normal" }}>
                {r.name}
              </TableCell>
              <TableCell label="Category" color={t.muted}>{r.category}</TableCell>
              <TableCell label="Stocks" bold sx={{ overflow: "visible" }}>
                {r.stocks}
                <StockMeter stocks={r.stocks} minLevel={r.minLevel} />
              </TableCell>
              <TableCell label="Unit" color={t.muted}>{r.unit}</TableCell>
              <TableCell label="Status">
                <StatusChip label={r.status} />
              </TableCell>
              {showMinLevel && (
                <TableCell label="Min" sx={{ overflow: "visible" }}>
                  <Box
                    component="input"
                    type="number"
                    defaultValue={r.minLevel}
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                      const val = Number(e.target.value);
                      if (val !== r.minLevel && Number.isFinite(val) && val >= 0) {
                        minLevelMutation.mutate({ id: r.id, minLevel: val });
                      }
                    }}
                    sx={{
                      width: 56,
                      border: "1px solid",
                      borderColor: t.border,
                      borderRadius: "8px",
                      px: 0.75,
                      py: 0.5,
                      fontSize: 12,
                      bgcolor: t.surface,
                      color: t.text.primary,
                    }}
                  />
                </TableCell>
              )}
              {canManage && (
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.75 }}>
                    {canEditProduct && (
                      <RowActionButton
                        kind="edit"
                        label={`Edit ${r.name}`}
                        onClick={() => {
                          setEditingProduct(r);
                          setProductModalOpen(true);
                        }}
                      />
                    )}
                    {canEditInventory && (
                      <RowActionButton
                        kind="adjust"
                        label={`Adjust stock for ${r.name}`}
                        onClick={() =>
                          setAdjustingProduct({
                            id: r.id,
                            name: r.name,
                            code: r.code,
                            unit: r.unit,
                            stocks: r.stocks,
                          })
                        }
                      />
                    )}
                    {canDeleteProduct && (
                      <RowActionButton
                        kind="delete"
                        label={`Delete ${r.name}`}
                        onClick={() => deleteMutation.mutate(r.id)}
                      />
                    )}
                  </Box>
                </TableCell>
              )}
            </TableRow>
          ))}
          {data.rows.length === 0 && (
            <EmptyState
              message={
                q || category !== "All"
                  ? "No products match your filters."
                  : "No products yet — add one to start tracking stock."
              }
              actionLabel={canCreateProduct && !q && category === "All" ? "Add Product" : undefined}
              onAction={
                canCreateProduct
                  ? () => {
                      setEditingProduct(null);
                      setProductModalOpen(true);
                    }
                  : undefined
              }
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

      {(canCreateProduct || canEditProduct || canEditInventory) && data && (
        <>
          {(canCreateProduct || canEditProduct) && (
            <ProductModal
              open={productModalOpen}
              onClose={() => setProductModalOpen(false)}
              product={editingProduct}
              categories={data.categoryList}
              suppliers={data.supplierList}
            />
          )}
          {canCreateProduct && (
            <CategoryModal
              open={categoryModalOpen}
              onClose={() => setCategoryModalOpen(false)}
              existingNames={data.categories}
            />
          )}
          {canEditInventory && (
            <AdjustStockModal
              product={adjustingProduct}
              onClose={() => setAdjustingProduct(null)}
            />
          )}
        </>
      )}
    </Box>
  );
}
