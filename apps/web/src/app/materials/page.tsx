"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { PageHeader, Loading, ErrorState, EmptyState } from "@/components/shared";
import { MaterialTable } from "@/components/material/material-table";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (isActive !== "all") params.set("isActive", isActive);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`${API_URL}/api/materials?${params}`);
      const json = await res.json();
      setMaterials(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách nguyên liệu.");
    } finally {
      setLoading(false);
    }
  }, [search, isActive, page]);

  useEffect(() => {
    const timer = setTimeout(fetchMaterials, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchMaterials, search]);

  useEffect(() => {
    setPage(1);
  }, [search, isActive]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nguyên liệu"
        description="Quản lý danh mục nguyên liệu và giá"
        actions={
          <Button render={<Link href="/materials/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm nguyên liệu
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, mã nguyên liệu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={isActive} onValueChange={(v) => setIsActive(v ?? "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="true">Đang dùng</SelectItem>
            <SelectItem value="false">Ngừng dùng</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchMaterials} />}
      {!loading && !error && materials.length === 0 && (
        <EmptyState
          title="Chưa có nguyên liệu"
          description="Thêm nguyên liệu đầu tiên để bắt đầu."
        />
      )}
      {!loading && !error && materials.length > 0 && (
        <MaterialTable materials={materials} meta={meta} onPageChange={setPage} />
      )}
    </div>
  );
}
