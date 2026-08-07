"use client";

import { useState } from "react";
import { useQuery, keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, InputBase } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
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
import type { Role } from "@prisma/client";
import type { InventoryData } from "@/lib/data/inventory";

export function InventoryScreen({
  role,
  initialData,
}: {
  role: Role;
  initialData?: InventoryData;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
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
  void role;
  const isDefaultView = q === "" && category === "All" && page === 1;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.inventory({ q, category, page }),
    queryFn: () =>
      fetchJson<InventoryData>(
        `/api/inventory?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}&page=${page}`
      ),
    initialData: isDefaultView ? initialData : undefined,
    // Keep showing the previous rows while a new filter/page loads instead of
    // flashing back to a skeleton — filter clicks should feel instant.
    placeholderData: keepPreviousData,
  });
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
    mutationFn: (id: string) => deleteJson(`/api/products/${id}`),
    onSuccess: () => {
      invalidateAll();
      showToast("Item deleted from inventory.");
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
          borderRadius: "8px",
        }}
      >
        <InputBase
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search by Product Code or Name"
          sx={{
            flex: "1 1 200px",
            border: "1px solid",
            borderColor: t.border,
            borderRadius: "8px",
            px: 1.375,
            py: 0.75,
            fontSize: 13,
            bgcolor: t.mode === "dark" ? "background.default" : "#FAFBFE",
          }}
        />
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {["All", ...(data?.categories ?? [])].slice(0, 10).map((c) => {
            const active = category === c;
            return (
              <ButtonBase
                key={c}
                onClick={() => {
                  setCategory(c);
                  setPage(1);
                }}
                sx={{
                  border: "1px solid",
                  borderColor: active ? t.primary.main : t.border,
                  bgcolor: active ? t.primary.main : t.surface,
                  color: active ? "#fff" : t.text2,
                  borderRadius: "8px",
                  px: 1.25,
                  py: 0.625,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {c}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      {!data ? (
        <TableSkeleton label="Loading inventory…" columns={canManage ? (showMinLevel ? 9 : 8) : 7} rows={8} />
      ) : (
        <TableShell minWidth={minWidth} dimmed={isFetching}>
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
              <TableCell mono color={t.text2}>
                {r.code}
              </TableCell>
              <TableCell bold sx={{ whiteSpace: "normal" }}>
                {r.name}
              </TableCell>
              <TableCell color={t.muted}>{r.category}</TableCell>
              <TableCell bold sx={{ overflow: "visible" }}>
                {r.stocks}
                <StockMeter stocks={r.stocks} minLevel={r.minLevel} />
              </TableCell>
              <TableCell color={t.muted}>{r.unit}</TableCell>
              <TableCell>
                <StatusChip label={r.status} />
              </TableCell>
              {showMinLevel && (
                <TableCell sx={{ overflow: "visible" }}>
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
