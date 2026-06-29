"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/shared";
import { CustomerFilter } from "@/components/customer/customer-filter";
import { CustomerTable } from "@/components/customer/customer-table";
import { Loading } from "@/components/shared";
import { ErrorState } from "@/components/shared";
import { EmptyState } from "@/components/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface FilterOption {
  id: string;
  name: string;
}

export default function CustomersPage() {
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

  return (
    <div className="space-y-6">
      <PageHeader title="Khách hàng" description="Quản lý danh sách khách hàng" />

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
    </div>
  );
}
