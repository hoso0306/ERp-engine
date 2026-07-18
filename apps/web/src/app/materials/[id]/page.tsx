"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { MaterialPriceList } from "@/components/material/material-price-list";
import { toast } from "sonner";
import { apiGet, apiPatch, ApiError } from "@/lib/api";

interface MaterialPrice {
  id: string;
  price: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isDefault: boolean;
  note: string | null;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

interface Material {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  note: string | null;
  unit: { id: string; name: string } | null;
  currentStock: number | string;
  minimumStock: number | string | null;
  retailPrice: number | string | null;
  prices: MaterialPrice[];
  productionCenters?: { productionCenter: { id: string; name: string } }[];
  createdAt: string;
  updatedAt: string;
}

function formatQty(n: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(n);
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

export default function MaterialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchMaterial = useCallback(async () => {
    try {
      const data = await apiGet<Material>(`/materials/${params.id}`);
      setMaterial(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tìm thấy vật tư.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchMaterial();
  }, [fetchMaterial]);

  async function handleToggleActive() {
    if (!material) return;
    setToggling(true);
    try {
      const updated = await apiPatch<Material>(`/materials/${material.id}`, {
        isActive: !material.isActive,
      });
      setMaterial((prev) => prev ? { ...prev, isActive: updated.isActive } : prev);
      toast.success(updated.isActive ? "Đã kích hoạt vật tư." : "Đã ngừng sử dụng vật tư.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể cập nhật trạng thái.");
    } finally {
      setToggling(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState description={error} onRetry={() => router.refresh()} />;
  if (!material) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={material.name}
        description={material.code}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleToggleActive}
              disabled={toggling}
            >
              {material.isActive ? "Ngừng sử dụng" : "Kích hoạt"}
            </Button>
            <Button variant="outline" render={<Link href={`/materials/${material.id}/edit`} />}>
              <Pencil className="mr-2 h-4 w-4" />
              Chỉnh sửa
            </Button>
          </div>
        }
      />

      <div className="flex gap-2">
        <Badge variant={material.isActive ? "default" : "secondary"}>
          {material.isActive ? "Đang dùng" : "Ngừng dùng"}
        </Badge>
      </div>

      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Thông tin vật tư</h3>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Mã vật tư" value={material.code} />
          <Field label="Đơn vị tính" value={material.unit?.name} />
          <Field
            label="Giá nhập (mặc định)"
            value={(() => {
              const def = material.prices.find((p) => p.isDefault);
              return def ? formatMoney(Number(def.price)) : null;
            })()}
          />
          <Field
            label="Giá bán lẻ"
            value={material.retailPrice !== null ? formatMoney(Number(material.retailPrice)) : null}
          />
          <Field
            label="Xưởng sử dụng"
            value={
              (material.productionCenters ?? []).map((pc) => pc.productionCenter.name).join(", ") ||
              null
            }
          />
          <Field label="Ghi chú" value={material.note} />
        </dl>
      </div>

      {/* Module Kho tạm gỡ khỏi triển khai (18/07/2026 — warehouse.md
          "Trạng thái triển khai"): tồn kho hiện tại để trống, không cảnh báo
          dưới mức. Khôi phục hiển thị currentStock khi bật lại Kho. */}
      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Tồn kho</h3>
        {(() => {
          const minStock = material.minimumStock !== null ? Number(material.minimumStock) : null;
          return (
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <dt className="text-sm text-muted-foreground">Tồn kho hiện tại</dt>
                <dd className="mt-1 text-lg font-semibold font-mono text-muted-foreground">—</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Tồn kho tối thiểu</dt>
                <dd className="mt-1 text-lg font-semibold font-mono">
                  {minStock !== null ? `${formatQty(minStock)} ${material.unit?.name ?? ""}` : "—"}
                </dd>
              </div>
            </dl>
          );
        })()}
      </div>

      <div className="rounded-lg border p-6">
        <MaterialPriceList
          materialId={material.id}
          prices={material.prices}
          onChanged={fetchMaterial}
        />
      </div>

      <div className="text-xs text-muted-foreground">
        Tạo lúc: {new Date(material.createdAt).toLocaleString("vi-VN")} · Cập nhật:{" "}
        {new Date(material.updatedAt).toLocaleString("vi-VN")}
      </div>
    </div>
  );
}
