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

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
      const res = await fetch(`${API_URL}/api/materials/${params.id}`);
      if (!res.ok) throw new Error("Không tìm thấy vật tư.");
      const data = await res.json();
      setMaterial(data);
    } catch (err) {
      setError((err as Error).message);
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
      const res = await fetch(`${API_URL}/api/materials/${material.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !material.isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "Không thể cập nhật trạng thái.");
        return;
      }
      const updated = await res.json();
      setMaterial((prev) => prev ? { ...prev, isActive: updated.isActive } : prev);
      toast.success(updated.isActive ? "Đã kích hoạt vật tư." : "Đã ngừng sử dụng vật tư.");
    } catch {
      toast.error("Lỗi kết nối server.");
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
          <Field label="Ghi chú" value={material.note} />
        </dl>
      </div>

      {/* Tồn kho (testlan1 mục 1.4) — API trả sẵn currentStock/minimumStock */}
      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Tồn kho</h3>
        {(() => {
          const stock = Number(material.currentStock);
          const minStock = material.minimumStock !== null ? Number(material.minimumStock) : null;
          const belowMinimum = minStock !== null && stock < minStock;
          return (
            <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <dt className="text-sm text-muted-foreground">Tồn kho hiện tại</dt>
                <dd className={`mt-1 text-lg font-semibold font-mono ${belowMinimum ? "text-destructive" : ""}`}>
                  {formatQty(stock)} {material.unit?.name ?? ""}
                  {belowMinimum && (
                    <Badge variant="destructive" className="ml-2 align-middle text-[10px]">
                      Dưới mức tối thiểu
                    </Badge>
                  )}
                </dd>
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
