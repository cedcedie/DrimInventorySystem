"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Box, Select, MenuItem, Typography } from "@mui/material";
import { SearchByPanel, SEARCH_FIELD_HEIGHT } from "@/components/SearchByPanel";
import { ExportButton } from "@/components/ExportButton";
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
import { TableSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { PageChrome } from "@/components/PageChrome";
import { useTheme } from "@mui/material/styles";
import { deleteJson } from "@/lib/mutate";
import { useToast } from "@/components/Toast";
import { ProductModal, type ProductFormRow } from "@/components/modals/ProductModal";
import { useCan } from "@/components/PermissionsProvider";
import type { ProductsData } from "@/lib/data/products";

function thumbSrc(imageKey: string | null | undefined) {
  if (!imageKey) return null;
  return `/api/blobs/${imageKey}`;
}

export function ProductsScreen({
  initialData,
}: {
  initialData?: ProductsData;
}) {
  return (
    <Suspense fallback={<TableSkeleton label="Loading product catalog…" columns={7} rows={8} />}>
      <ProductsScreenInner initialData={initialData} />
    </Suspense>
  );
}

function ProductsScreenInner({
  initialData,
}: {
  initialData?: ProductsData;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState("All");
  // The inputs stay instant (local state) — only the actual server fetch
  // waits for typing to pause, so it's not a full request per keystroke.
  const debouncedCode = useDebouncedValue(code, 300);
  const debouncedName = useDebouncedValue(name, 300);
  const debouncedSupplier = useDebouncedValue(supplier, 300);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormRow | null>(null);
  const canCreate = useCan("products", "canCreate");
  const canEdit = useCan("products", "canEdit");
  const canDelete = useCan("products", "canDelete");
  const canExport = useCan("products", "canExport");
  const canManage = canEdit || canDelete;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Deep link from the header's "+ Add New" button: "?add=1" opens the Add
  // Product modal immediately instead of just landing on this page.
  useEffect(() => {
    if (!canCreate || searchParams.get("add") !== "1") return;
    setEditingProduct(null);
    setModalOpen(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("add");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for this deep link, not on every searchParams identity change
  }, [canCreate]);

  const { data, page, setPage } = usePaginatedQuery<ProductsData>({
    queryKey: (p) =>
      queryKeys.products({ page: p, code: debouncedCode, name: debouncedName, supplier: debouncedSupplier, category }),
    url: (p) =>
      `/api/products?page=${p}&code=${encodeURIComponent(debouncedCode)}&name=${encodeURIComponent(debouncedName)}&supplier=${encodeURIComponent(debouncedSupplier)}&category=${encodeURIComponent(category)}`,
    initialData,
    live: liveCool,
  });

  // Reset to page 1 once the search/category filter actually changes (i.e.
  // once a new fetch is about to happen) — not on every keystroke.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only page-reset on a real filter change, not every render
  }, [debouncedCode, debouncedName, debouncedSupplier, category]);

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

  const rows = data?.rows ?? [];

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

      <SearchByPanel
        fields={[
          { key: "code", label: "Code", value: code, onChange: setCode },
          { key: "name", label: "Product Name", value: name, onChange: setName },
          { key: "supplier", label: "Supplier", value: supplier, onChange: setSupplier },
          {
            key: "category",
            label: "Category",
            value: category,
            onChange: setCategory,
            render: () => (
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                size="small"
                fullWidth
                sx={{
                  height: SEARCH_FIELD_HEIGHT,
                  fontSize: 13,
                  bgcolor: t.mode === "dark" ? "background.default" : "#F9FAFB",
                  "& .MuiSelect-select": { display: "flex", alignItems: "center", height: "100%", boxSizing: "border-box", py: 0 },
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: t.border },
                }}
              >
                {categories.map((c) => (
                  <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            ),
          },
        ]}
        trailing={
          canExport && (
            <ExportButton
              buildUrl={(format) =>
                `/api/products/export?format=${format}&code=${encodeURIComponent(debouncedCode)}&name=${encodeURIComponent(debouncedName)}&supplier=${encodeURIComponent(debouncedSupplier)}&category=${encodeURIComponent(category)}`
              }
            />
          )
        }
      />

      {!data ? (
        <TableSkeleton label="Loading product catalog…" columns={canManage ? 7 : 6} rows={8} />
      ) : (
        <TableShell minWidth={minWidth}>
          <TableHeaderRow columns={columns} headers={headers} />
          {rows.map((r) => {
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
                <TableCell label="Code" mono color={t.text2}>
                  {r.code}
                </TableCell>
                <TableCell label="Product Name" bold>
                  {r.name}
                </TableCell>
                <TableCell label="Category" color={t.muted}>{r.category}</TableCell>
                <TableCell label="Unit" color={t.muted}>{r.unit}</TableCell>
                <TableCell label="Supplier" color={t.muted}>{r.supplier}</TableCell>
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
          {rows.length === 0 && (
            <EmptyState
              message={
                code || name || supplier || category !== "All"
                  ? "No products match your filters."
                  : "No products yet — add the first catalog entry."
              }
              actionLabel={
                canCreate && !code && !name && !supplier && category === "All" ? "Add Product" : undefined
              }
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
              onChange={setPage}
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
