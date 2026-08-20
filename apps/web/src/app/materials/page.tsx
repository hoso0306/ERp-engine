"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, FileSpreadsheet, Loader2, Upload } from "lucide-react";
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
import { ExcelImportDialog } from "@/components/product/excel-import-dialog";
import { apiGet, apiPost, apiUrl } from "@/lib/api";
import { downloadAuthenticatedFile } from "@/lib/download";
import { toast } from "sonner";

interface ProductionCenterOption {
  id: string;
  name: string;
}

interface MaterialImportChange {
  label: string;
  oldValue: string;
  newValue: string;
}

interface MaterialImportCreateField {
  label: string;
  value: string;
}

// Để trống Mã VT trên file import = tạo vật tư mới (10/08/2026) — khớp
// MaterialImportRow phía BE (product.service.ts).
type MaterialImportRow =
  | {
      kind: "update";
      materialId: string;
      code: string;
      name: string;
      changes: MaterialImportChange[];
      update: Record<string, unknown>;
    }
  | {
      kind: "create";
      name: string;
      fields: MaterialImportCreateField[];
      create: Record<string, unknown>;
    };

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState("all");
  const [centerId, setCenterId] = useState("all");
  // Bán lẻ vật tư trong Báo giá (chốt 28/07/2026, sprint-04/025).
  const [isRetailable, setIsRetailable] = useState("all");
  const [centers, setCenters] = useState<ProductionCenterOption[]>([]);
  const [page, setPage] = useState(1);
  // Số dòng/trang (Pagination dùng chung, chốt 20/08/2026) — mặc định giữ
  // nguyên 20 như trước (khác các trang khác dùng 10).
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    apiGet<ProductionCenterOption[]>("/production-centers").then(setCenters).catch(() => {});
  }, []);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (isActive !== "all") params.set("isActive", isActive);
      if (centerId !== "all") params.set("productionCenterId", centerId);
      if (isRetailable !== "all") params.set("isRetailable", isRetailable);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const json = await apiGet<{ data: any[]; meta: typeof meta }>(`/materials?${params}`);
      setMaterials(json.data);
      setMeta(json.meta);
    } catch {
      setError("Không thể tải danh sách vật tư.");
    } finally {
      setLoading(false);
    }
  }, [search, isActive, centerId, isRetailable, page, limit]);

  useEffect(() => {
    const timer = setTimeout(fetchMaterials, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchMaterials, search]);

  useEffect(() => {
    setPage(1);
  }, [search, isActive, centerId, isRetailable, limit]);

  function currentFilterParams() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (isActive !== "all") params.set("isActive", isActive);
    if (centerId !== "all") params.set("productionCenterId", centerId);
    if (isRetailable !== "all") params.set("isRetailable", isRetailable);
    return params;
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadAuthenticatedFile(
        apiUrl(`/materials/export?${currentFilterParams()}`),
        "vat_tu.xlsx",
      );
    } catch {
      toast.error("Không thể tải file export.");
    } finally {
      setExporting(false);
    }
  }

  async function handleApplyImport(rows: MaterialImportRow[]) {
    const { created, updated } = await apiPost<{ created: number; updated: number }>(
      "/materials/import-apply",
      {
        rows: rows.map((row) =>
          row.kind === "create"
            ? { kind: "create" as const, create: row.create }
            : { kind: "update" as const, materialId: row.materialId, update: row.update },
        ),
      },
    );
    const parts: string[] = [];
    if (created > 0) parts.push(`tạo mới ${created}`);
    if (updated > 0) parts.push(`cập nhật ${updated}`);
    toast.success(`Đã ${parts.join(", ")} vật tư từ Excel.`);
    fetchMaterials();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vật tư"
        description="Quản lý danh mục vật tư và giá"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={exporting} onClick={handleExport}>
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Xuất Excel
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Nhập từ Excel
            </Button>
            <Button render={<Link href="/materials/new" />}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm vật tư
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, mã vật tư..."
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

        <Select value={centerId} onValueChange={(v) => setCenterId(v ?? "all")}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Xưởng sản xuất" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả xưởng</SelectItem>
            {centers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={isRetailable} onValueChange={(v) => setIsRetailable(v ?? "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Vật tư bán lẻ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="true">Vật tư bán lẻ</SelectItem>
            <SelectItem value="false">Không bán lẻ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && <Loading />}
      {error && <ErrorState description={error} onRetry={fetchMaterials} />}
      {!loading && !error && materials.length === 0 && (
        <EmptyState
          title="Chưa có vật tư"
          description="Thêm vật tư đầu tiên để bắt đầu."
        />
      )}
      {!loading && !error && materials.length > 0 && (
        <MaterialTable
          materials={materials}
          meta={meta}
          onPageChange={setPage}
          onLimitChange={setLimit}
          onRefresh={fetchMaterials}
        />
      )}

      <ExcelImportDialog<MaterialImportRow>
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Nhập Vật tư từ Excel"
        description="Tải file Excel (chính là file Xuất Excel), sửa Đơn vị/Trạng thái/Giá rồi nhập lại để cập nhật, hoặc thêm dòng mới để trống Mã VT (điền Tên vật tư, Đơn vị, Giá nhập, Trạng thái) để tạo vật tư mới — cột Xưởng không áp dụng qua Excel, gán sau khi cần. Chỉ hiện các dòng có thay đổi/tạo mới, chỉ áp dụng được khi file không còn dòng lỗi."
        templateUrl={`/materials/export?${currentFilterParams()}`}
        previewUrl="/materials/import-preview"
        columns={[
          {
            header: "Mã VT",
            render: (row) =>
              row.kind === "create" ? (
                <span className="font-medium text-green-700 dark:text-green-500">Mới</span>
              ) : (
                row.code
              ),
          },
          { header: "Tên vật tư", render: (row) => row.name },
          {
            header: "Thay đổi",
            render: (row) =>
              row.kind === "create" ? (
                <div className="space-y-0.5">
                  <div className="font-medium text-green-700 dark:text-green-500">Tạo mới</div>
                  {row.fields.map((f, i) => (
                    <div key={i}>
                      {f.label}: {f.value}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {row.changes.map((c, i) => (
                    <div key={i}>
                      {c.label}: {c.oldValue} → {c.newValue}
                    </div>
                  ))}
                </div>
              ),
          },
        ]}
        onApply={handleApplyImport}
      />
    </div>
  );
}
