"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { ProductFilter, type ProductSort } from "@/components/product/product-filter";
import { ProductTable } from "@/components/product/product-table";
import { ProductDeletedTable } from "@/components/product/product-deleted-table";
import { apiGet } from "@/lib/api";

interface ProductType {
  id: string;
  name: string;
}

interface ProductionCenter {
  id: string;
  code: string;
  name: string;
}

// Trạng thái ứng với mỗi tab (Sprint 04) — tab thay thế bộ lọc trạng thái rời rạc,
// tránh trùng lặp 2 chỗ cùng chọn 1 thứ.
const TAB_STATUS: Record<string, string> = { active: "ACTIVE", draft: "DRAFT", all: "all" };

export default function ProductsPage() {
  const [tab, setTab] = useState("active");

  const [products, setProducts] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [productionCenters, setProductionCenters] = useState<ProductionCenter[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(TAB_STATUS.active);
  const [productTypeId, setProductTypeId] = useState("all");
  const [productionCenterId, setProductionCenterId] = useState("all");
  // Mặc định A-Z — lọc thủ công cho phép đổi sang "sản phẩm mới tạo".
  const [sortBy, setSortBy] = useState<ProductSort>("name_asc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleted, setDeleted] = useState<any[]>([]);
  const [deletedMeta, setDeletedMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [deletedPage, setDeletedPage] = useState(1);
  const [deletedLoading, setDeletedLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      if (productTypeId !== "all") params.set("productTypeId", productTypeId);
      if (productionCenterId !== "all") params.set("productionCenterId", productionCenterId);
      params.set("sortBy", sortBy);
      params.set("page", String(page));
      params.set("limit", "10");

      const json = await apiGet<{ data: any[]; meta: typeof meta }>(`/products?${params}`);
      setProducts(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách sản phẩm.");
    } finally {
      setLoading(false);
    }
  }, [search, status, productTypeId, productionCenterId, sortBy, page]);

  const fetchDeleted = useCallback(async () => {
    setDeletedLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(deletedPage));
      params.set("limit", "10");
      const json = await apiGet<{ data: any[]; meta: typeof deletedMeta }>(
        `/products/deleted?${params}`,
      );
      setDeleted(json.data);
      setDeletedMeta(json.meta);
    } catch {
      /* silent */
    } finally {
      setDeletedLoading(false);
    }
  }, [deletedPage]);

  useEffect(() => {
    apiGet<ProductType[]>("/product-types").then(setProductTypes).catch(() => {});
    apiGet<ProductionCenter[]>("/production-centers").then(setProductionCenters).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchProducts, search]);

  useEffect(() => {
    setPage(1);
  }, [search, status, productTypeId, productionCenterId, sortBy]);

  useEffect(() => {
    if (tab === "deleted") {
      fetchDeleted();
      return;
    }
    setStatus(TAB_STATUS[tab] ?? "all");
  }, [tab, fetchDeleted]);

  function handleRestored() {
    fetchDeleted();
    fetchProducts();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sản phẩm"
        description="Quản lý danh mục sản phẩm"
        actions={
          <Button render={<Link href="/products/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm sản phẩm
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Đang bán</TabsTrigger>
          <TabsTrigger value="deleted">
            Đã xoá {deletedMeta.total > 0 && `(${deletedMeta.total})`}
          </TabsTrigger>
          <TabsTrigger value="draft">Nháp</TabsTrigger>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
        </TabsList>

        {(["active", "draft", "all"] as const).map((t) => (
          <TabsContent key={t} value={t} className="space-y-4 mt-4">
            <ProductFilter
              search={search}
              onSearchChange={setSearch}
              productTypes={productTypes}
              productTypeId={productTypeId}
              onProductTypeChange={(v) => setProductTypeId(v ?? "all")}
              productionCenters={productionCenters}
              productionCenterId={productionCenterId}
              onProductionCenterChange={(v) => setProductionCenterId(v ?? "all")}
              sortBy={sortBy}
              onSortByChange={setSortBy}
            />

            {loading && <Loading />}
            {error && <ErrorState description={error} onRetry={fetchProducts} />}
            {!loading && !error && products.length === 0 && (
              <EmptyState
                title="Chưa có sản phẩm"
                description="Thêm sản phẩm đầu tiên để bắt đầu."
              />
            )}
            {!loading && !error && products.length > 0 && (
              <ProductTable products={products} meta={meta} onPageChange={setPage} />
            )}
          </TabsContent>
        ))}

        <TabsContent value="deleted" className="mt-4">
          {deletedLoading && <Loading />}
          {!deletedLoading && deleted.length === 0 && (
            <EmptyState
              title="Không có sản phẩm đã xoá"
              description="Chưa có sản phẩm nào bị xoá."
            />
          )}
          {!deletedLoading && deleted.length > 0 && (
            <ProductDeletedTable
              products={deleted}
              meta={deletedMeta}
              onPageChange={setDeletedPage}
              onRestored={handleRestored}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
