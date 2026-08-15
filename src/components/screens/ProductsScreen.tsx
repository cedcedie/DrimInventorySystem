"use client";

import { useMemo, useState } from "react";
import { useQuery, keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, InputBase, Typography } from "@mui/material";
import { fetchJson } from "@/lib/api";
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
import { TableSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { PageChrome } from "@/components/PageChrome";
import { useTheme } from "@mui/material/styles";
import { deleteJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { ProductModal, type ProductFormRow } from "@/components/modals/ProductModal";
import { useCan } from "@/components/PermissionsProvider";
import type { Role } from "@/generated/prisma";
import type { ProductsData } from "@/lib/data/products";
import { motion } from "@/theme/tokens";

function thumbSrc(imageKey: string | null | undefined) {
  if (!imageKey) return null;
  return `/api/blobs/${imageKey}`;
}

export function ProductsScreen({
  role,
  initialData,
}: {
  role: Role;
  initialData?: ProductsData;
}) {
  void role;
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormRow | null>(null);
  const canCreate = useCan("products", "canCreate");
  const canEdit = useCan("products", "canEdit");
  const canDelete = useCan("products", "canDelete");
  const canManage = canEdit || canDelete;
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.products({ page }),
    queryFn: () => fetchJson<ProductsData>(`/api/products?page=${page}`),
    initialData: page === 1 ? initialData : undefined,
    placeholderData: keepPreviousData,
    ...liveCool,
  });
  const t = useTheme().palette;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJson<{ ok: boolean; archived?: boolean }>(`/api/products/${id}`),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast(
        res.archived
          ? "Product archived — transaction history kept."
          : "Product removed from catalog."
      );
    },
  });

  const categories = useMemo(() => {
    const names = data?.categories.map((c) => c.name) ?? [];
    return ["All", ...names];
  }, [data?.categories]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (category !== "All" && r.category !== category) return false;
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        r.code.toLowerCase().includes(needle) ||
        r.supplier.toLowerCase().includes(needle)
      );
    });
  }, [data, q, category]);

  const columns = canManage
    ? "52px 88px minmax(0,1.5fr) minmax(0,1fr) 62px minmax(0,1fr) 100px"
    : "52px 92px minmax(0,1.5fr) minmax(0,1fr) 70px minmax(0,1fr)";
  const minWidth = canManage ? 820 : 720;
  const headers = [
    "",
    "Code",
    "Product Name",
    "Category",
    "Unit",
    "Supplier",
    ...(canManage ? ["Actions"] : []),
  ];

  return (
    <Box>
      <PageChrome
        title="Products"
        addLabel={canCreate ? "Add Product" : undefined}
        onAdd={
          canCreate
            ? () => {
                setEditingProduct(null);
                setModalOpen(true);
              }
            : undefined
        }
      />

      {/* Filter strip */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          flexWrap: "wrap",
          mb: 1.5,
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
          placeholder="Search code, name, supplier…"
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
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {categories.slice(0, 8).map((c) => {
            const active = category === c;
            return (
              <ButtonBase
                key={c}
                onClick={() => setCategory(c)}
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
                  transition: `background-color ${motion.duration.color}ms ${motion.easing.standard}, border-color ${motion.duration.color}ms ${motion.easing.standard}`,
                }}
              >
                {c}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      {!data ? (
        <TableSkeleton label="Loading product catalog…" columns={canManage ? 7 : 6} rows={8} />
      ) : (
        <TableShell minWidth={minWidth} dimmed={isFetching}>
          <TableHeaderRow columns={columns} headers={headers} />
          {filteredRows.map((r) => {
            const src = thumbSrc(r.imageKey);
            return (
              <TableRow key={r.id} columns={columns}>
                <TableCell sx={{ overflow: "visible" }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "6px",
                      bgcolor: t.mode === "dark" ? "background.paper" : "#F4F6F8",
                      border: "1px solid",
                      borderColor: t.line,
                      overflow: "hidden",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" width={36} height={36} style={{ objectFit: "cover" }} />
                    ) : (
                      <Typography sx={{ fontSize: 10, fontWeight: 800, color: t.muted3 }}>
                        {r.code.slice(0, 2)}
                      </Typography>
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
                <TableCell color={t.muted}>{r.unit}</TableCell>
                <TableCell color={t.muted}>{r.supplier}</TableCell>
                {canManage && (
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.75 }}>
                      {canEdit && (
                        <RowActionButton
                          kind="edit"
                          label={`Edit ${r.name}`}
                          onClick={() => {
                            setEditingProduct(r);
                            setModalOpen(true);
                          }}
                        />
                      )}
                      {canDelete && (
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
            );
          })}
          {filteredRows.length === 0 && (
            <EmptyState
              message={
                q || category !== "All"
                  ? "No products match your filters."
                  : "No products yet — add the first catalog entry."
              }
              actionLabel={canCreate && !q && category === "All" ? "Add Product" : undefined}
              onAction={
                canCreate
                  ? () => {
                      setEditingProduct(null);
                      setModalOpen(true);
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

      {(canCreate || canEdit) && data && (
        <ProductModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          product={editingProduct}
          categories={data.categories}
          suppliers={data.suppliers}
        />
      )}
    </Box>
  );
}
