"use client";

import { useState } from "react";
import { useQuery, keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, ButtonBase, Typography } from "@mui/material";
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
import { TableSkeleton } from "@/components/Skeleton";
import { useColorMode } from "@/theme/ThemeRegistry";
import { lightTokens, darkTokens, ACCENT } from "@/theme/tokens";
import { deleteJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { ProductModal, type ProductFormRow } from "@/components/modals/ProductModal";
import type { Role } from "@prisma/client";
import type { ProductsData } from "@/lib/data/products";

export function ProductsScreen({
  role,
  initialData,
}: {
  role: Role;
  initialData?: ProductsData;
}) {
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormRow | null>(null);
  const canManage = role === "OWNER" || role === "ADMIN";
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.products({ page }),
    queryFn: () => fetchJson<ProductsData>(`/api/products?page=${page}`),
    initialData: page === 1 ? initialData : undefined,
    placeholderData: keepPreviousData,
  });
  const { mode } = useColorMode();
  const t = mode === "dark" ? darkTokens : lightTokens;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJson(`/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      showToast("Product removed from catalog.");
    },
  });

  const columns = canManage
    ? "96px minmax(0,1.4fr) minmax(0,1fr) 62px 96px minmax(0,1fr) 128px"
    : "100px minmax(0,1.4fr) minmax(0,1fr) 70px 100px minmax(0,1fr)";
  const minWidth = canManage ? 860 : 740;
  const headers = [
    "Product Code",
    "Product Name",
    "Category",
    "Unit",
    "Amount",
    "Preferred Supplier",
    ...(canManage ? ["Actions"] : []),
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
        <Typography sx={{ fontSize: 12, color: t.muted }}>
          Master catalog of products and materials. Stock levels are managed in Inventory.
        </Typography>
        {canManage && (
          <ButtonBase
            onClick={() => {
              setEditingProduct(null);
              setModalOpen(true);
            }}
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
            + Add Product
          </ButtonBase>
        )}
      </Box>

      {!data ? (
        <TableSkeleton label="Loading product catalog…" columns={canManage ? 7 : 6} rows={8} />
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
              <TableCell color={t.muted}>{r.unit}</TableCell>
              <TableCell mono>{peso(r.amount)}</TableCell>
              <TableCell color={t.muted}>{r.supplier}</TableCell>
              {canManage && (
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.75 }}>
                    <ButtonBase
                      aria-label={`Edit ${r.name}`}
                      onClick={() => {
                        setEditingProduct(r);
                        setModalOpen(true);
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
              No products in the catalog yet.
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
