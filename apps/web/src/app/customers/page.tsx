"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { CustomerFilter } from "@/components/customer/customer-filter";
import { CustomerTable } from "@/components/customer/customer-table";
import { CustomerDeletedTable } from "@/components/customer/customer-deleted-table";
import { CustomerImportDialog } from "@/components/customer/customer-import-dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface FilterOption {
  id: string;
  name: string;
}

export default function CustomersPage() {
  const [tab, setTab] = useState("all");

  // Active customers state
  const [customers, setCustomers] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [groups, setGroups] = useState<FilterOption[]>([]);
  const [routes, setRoutes] = useState<FilterOption[]>([]);
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState("all");
  const [routeId, setRouteId] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deleted customers state
  const [deleted, setDeleted] = useState([]);
  const [deletedMeta, setDeletedMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [deletedPage, setDeletedPage] = useState(1);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (groupId !== "all") params.set("customerGroupId", groupId);
      if (routeId !== "all") params.set("deliveryRouteId", routeId);
      params.set("page", String(page));
      params.set("limit", "10");

      const res = await fetch(`${API_URL}/api/customers?${params}`);
      const json = await res.json();
      setCustomers(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách khách hàng.");
    } finally {
      setLoading(false);
    }
  }, [search, groupId, routeId, page]);

  const fetchDeleted = useCallback(async () => {
    setDeletedLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(deletedPage));
      params.set("limit", "10");
      const res = await fetch(`${API_URL}/api/customers/deleted?${params}`);
      const json = await res.json();
      setDeleted(json.data);
      setDeletedMeta(json.meta);
    } catch {
      /* silent */
    } finally {
      setDeletedLoading(false);
    }
  }, [deletedPage]);

  useEffect(() => {
    fetch(`${API_URL}/api/customers/groups`).then((r) => r.json()).then(setGroups).catch(() => {});
    fetch(`${API_URL}/api/customers/routes`).then((r) => r.json()).then(setRoutes).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchCustomers, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchCustomers, search]);

  useEffect(() => {
    setPage(1);
  }, [search, groupId, routeId]);

  useEffect(() => {
    if (tab === "deleted") fetchDeleted();
  }, [tab, fetchDeleted]);

  function handleRestored() {
    fetchDeleted();
    fetchCustomers();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khách hàng"
        description="Quản lý danh sách khách hàng"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const params = new URLSearchParams();
                if (search) params.set("search", search);
                if (groupId !== "all") params.set("customerGroupId", groupId);
                if (routeId !== "all") params.set("deliveryRouteId", routeId);
                window.open(`${API_URL}/api/customers/export?${params}`, "_blank");
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button render={<Link href="/customers/new" />}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm khách hàng
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="deleted">
            Đã xoá {deletedMeta.total > 0 && `(${deletedMeta.total})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          <CustomerFilter
            search={search}
            onSearchChange={setSearch}
            groups={groups}
            selectedGroupId={groupId}
            onGroupChange={(v) => setGroupId(v ?? "all")}
            routes={routes}
            selectedRouteId={routeId}
            onRouteChange={(v) => setRouteId(v ?? "all")}
          />

          {loading && <Loading />}
          {error && <ErrorState description={error} onRetry={fetchCustomers} />}
          {!loading && !error && customers.length === 0 && (
            <EmptyState title="Chưa có khách hàng" description="Chưa có khách hàng nào được tạo." />
          )}
          {!loading && !error && customers.length > 0 && (
            <CustomerTable customers={customers} meta={meta} onPageChange={setPage} />
          )}
        </TabsContent>

        <TabsContent value="deleted" className="mt-4">
          {deletedLoading && <Loading />}
          {!deletedLoading && deleted.length === 0 && (
            <EmptyState title="Không có khách hàng đã xoá" description="Chưa có khách hàng nào bị xoá." />
          )}
          {!deletedLoading && deleted.length > 0 && (
            <CustomerDeletedTable
              customers={deleted}
              meta={deletedMeta}
              onPageChange={setDeletedPage}
              onRestored={handleRestored}
            />
          )}
        </TabsContent>
      </Tabs>

      <CustomerImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={fetchCustomers}
      />
    </div>
  );
}
