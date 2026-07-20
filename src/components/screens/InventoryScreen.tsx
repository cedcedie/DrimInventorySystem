"use client";

import { useState } from "react";
import { useQuery, keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, InputBase } from "@mui/material";
import { fetchJson } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { peso } from "@/lib/format";
import {
  TableShell,
  TableHeaderRow,
  TableRow,
  TableCell,
  Pagination,
} from "@/components/DataTable";
import { StatusChip } from "@/components/StatusChip";
import { TableSkeleton } from "@/components/Skeleton";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";
import { patchJson, deleteJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { ProductModal, type ProductFormRow } from "@/components/modals/ProductModal";
import { CategoryModal } from "@/components/modals/CategoryModal";
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
  const isOwner = role === "OWNER";
  const canManage = role === "OWNER" || role === "ADMIN";
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
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

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

  // Min. Stock column only shows for Owner (README: "Set Min. Stock Level" is
  // Owner-exclusive); Actions (Edit/Delete) shows for Owner or Admin.
  const columns = canManage
    ? isOwner
      ? "90px minmax(0,1.4fr) minmax(0,1fr) 60px 58px 92px 108px 92px 78px 128px"
      : "90px minmax(0,1.4fr) minmax(0,1fr) 60px 58px 92px 108px 92px 128px"
    : "100px minmax(0,1.5fr) minmax(0,1.1fr) 68px 66px 100px 118px 106px";
  const minWidth = canManage ? (isOwner ? 1000 : 940) : 780;
  const headers = [
    "Product Code",
    "Product Name",
    "Category",
    "Stocks",
    "Unit",
    "Amount",
    "Total Amount",
    "Status",
    ...(isOwner ? ["Min. Stock"] : []),
    ...(canManage ? ["Actions"] : []),
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5, flexWrap: "wrap" }}>
        <InputBase
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search by Product Code or Name"
          sx={{
            flex: "1 1 230px",
            maxWidth: 360,
            border: "1px solid",
            borderColor: t.border,
            borderRadius: "2px",
            px: 1.375,
            py: 1,
            fontSize: 12.5,
            bgcolor: t.surface,
          }}
        />
        {canManage ? (
          <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
            <ButtonBase
              onClick={() => setCategoryModalOpen(true)}
              sx={{
                border: "1px solid",
                borderColor: t.border,
                bgcolor: t.surface,
                borderRadius: "2px",
                px: 1.625,
                py: 1,
                fontSize: 12,
                fontWeight: 600,
                color: t.text2,
              }}
            >
              Choose / Add Category
            </ButtonBase>
            <ButtonBase
              onClick={() => {
                setEditingProduct(null);
                setProductModalOpen(true);
              }}
              sx={{
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
              + Add Product
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
            View only — Add / Edit / Delete require Owner or Admin role
          </Box>
        )}
      </Box>

      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1.5 }}>
        {["All", ...(data?.categories ?? [])].map((c) => {
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
                borderColor: active ? ACCENT : t.border,
                bgcolor: active ? ACCENT : t.surface,
                color: active ? "#fff" : t.text2,
                borderRadius: "2px",
                px: 1.5,
                py: 0.625,
                fontSize: 11.5,
                fontWeight: 600,
              }}
            >
              {c}
            </ButtonBase>
          );
        })}
      </Box>

      {!data ? (
        <TableSkeleton label="Loading inventory…" columns={canManage ? (isOwner ? 10 : 9) : 8} rows={8} />
      ) : (
        <TableShell minWidth={minWidth} dimmed={isFetching}>
          <TableHeaderRow columns={columns} headers={headers} />
          {data.rows.map((r) => (
            <TableRow key={r.id} columns={columns}>
              <TableCell mono color={t.text2}>
                {r.code}
              </TableCell>
              <TableCell bold sx={{ whiteSpace: "normal" }}>
                {r.name}
              </TableCell>
              <TableCell color={t.muted}>{r.category}</TableCell>
              <TableCell bold>{r.stocks}</TableCell>
              <TableCell color={t.muted}>{r.unit}</TableCell>
              <TableCell mono>{peso(r.amount)}</TableCell>
              <TableCell mono bold>
                {peso(r.total)}
              </TableCell>
              <TableCell>
                <StatusChip label={r.status} />
              </TableCell>
              {isOwner && (
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
                      borderRadius: "2px",
                      px: 0.75,
                      py: 0.5,
                      fontSize: 12,
                      bgcolor: t.surface,
                      color: t.text,
                    }}
                  />
                </TableCell>
              )}
              {canManage && (
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.75 }}>
                    <ButtonBase
                      aria-label={`Edit ${r.name}`}
                      onClick={() => {
                        setEditingProduct(r);
                        setProductModalOpen(true);
                      }}
                      sx={{
                        border: "1px solid",
                        borderColor: t.border,
                        bgcolor: t.surface,
                        borderRadius: "2px",
                        px: 1.25,
                        py: 0.5,
                        fontSize: 11,
                        fontWeight: 600,
                        color: t.text2,
                      }}
                    >
                      Edit
                    </ButtonBase>
                    <ButtonBase
                      aria-label={`Delete ${r.name}`}
                      onClick={() => deleteMutation.mutate(r.id)}
                      sx={{
                        border: "1px solid",
                        borderColor: t.danger,
                        bgcolor: t.surface,
                        borderRadius: "2px",
                        px: 1.25,
                        py: 0.5,
                        fontSize: 11,
                        fontWeight: 600,
                        color: t.danger,
                      }}
                    >
                      Delete
                    </ButtonBase>
                  </Box>
                </TableCell>
              )}
            </TableRow>
          ))}
          {data.rows.length === 0 && (
            <Box sx={{ px: 1.75, py: 3, fontSize: 12.5, color: t.muted, textAlign: "center" }}>
              No products match your filters.
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

      {canManage && data && (
        <>
          <ProductModal
            open={productModalOpen}
            onClose={() => setProductModalOpen(false)}
            product={editingProduct}
            categories={data.categoryList}
            suppliers={data.supplierList}
          />
          <CategoryModal
            open={categoryModalOpen}
            onClose={() => setCategoryModalOpen(false)}
            existingNames={data.categories}
          />
        </>
      )}
    </Box>
  );
}
