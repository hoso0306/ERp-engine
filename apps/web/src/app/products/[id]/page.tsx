"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Loading, ErrorState, ConfirmDialog } from "@/components/shared";
import { ProductParameterList } from "@/components/product/product-parameter-list";
import { PricingRuleSection } from "@/components/product/pricing-rule-section";
import { MaterialRequirementSection } from "@/components/product/material-requirement-section";
import { ValidationRuleSection } from "@/components/product/validation-rule-section";
import { DerivedParameterSection } from "@/components/product/derived-parameter-section";
import { toast } from "sonner";
import { apiGet, apiPatch, apiDelete, apiUrl, ApiError } from "@/lib/api";
import { getStoredToken } from "@/lib/auth-cookie";

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  productType: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  DRAFT: { label: "Nháp", variant: "outline" },
  ACTIVE: { label: "Đang bán", variant: "default" },
  INACTIVE: { label: "Ngừng bán", variant: "secondary" },
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<string>("");
  const [acting, setActing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<Product>(`/products/${params.id}`);
        setProduct(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Không tìm thấy sản phẩm.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  async function handleDelete() {
    try {
      await apiDelete(`/products/${params.id}`);
      toast.success("Đã xoá sản phẩm.");
      router.push("/products");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể xoá sản phẩm.");
    }
  }

  async function handleStatusChange() {
    setActing(true);
    try {
      const updated = await apiPatch<Product>(`/products/${params.id}/status`, {
        status: nextStatus,
      });
      setProduct(updated);
      toast.success("Đã cập nhật trạng thái.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Không thể đổi trạng thái.");
    } finally {
      setActing(false);
    }
  }

  function openStatusDialog(status: string) {
    setNextStatus(status);
    setStatusOpen(true);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const token = getStoredToken();
      const res = await fetch(apiUrl(`/products/${params.id}/export`), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        toast.error("Không thể xuất file.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `product-${product?.code ?? params.id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Lỗi kết nối server.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState description={error} onRetry={() => router.refresh()} />;
  if (!product) return null;

  const status = statusMap[product.status] ?? statusMap.DRAFT;
  const isDraft = product.status === "DRAFT";
  const isActive = product.status === "ACTIVE";
  const isInactive = product.status === "INACTIVE";

  const statusDialogLabel =
    nextStatus === "ACTIVE"
      ? "Kích hoạt sản phẩm"
      : nextStatus === "INACTIVE"
      ? "Ngừng kinh doanh"
      : "";

  const statusDialogDesc =
    nextStatus === "ACTIVE"
      ? `Sản phẩm "${product.name}" sẽ được kích hoạt và có thể dùng để báo giá.`
      : nextStatus === "INACTIVE"
      ? `Sản phẩm "${product.name}" sẽ ngừng kinh doanh và không thể chọn trong đơn hàng mới.`
      : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={product.code}
        actions={
          <div className="flex gap-2">
            {isDraft && (
              <Button onClick={() => openStatusDialog("ACTIVE")} disabled={acting}>
                Kích hoạt
              </Button>
            )}
            {isActive && (
              <Button
                variant="outline"
                onClick={() => openStatusDialog("INACTIVE")}
                disabled={acting}
              >
                Ngừng kinh doanh
              </Button>
            )}
            {isInactive && (
              <Button onClick={() => openStatusDialog("ACTIVE")} disabled={acting}>
                Tái kích hoạt
              </Button>
            )}
            <Button variant="outline" render={<Link href={`/products/${product.id}/edit`} />}>
              <Pencil className="mr-2 h-4 w-4" />
              Chỉnh sửa
            </Button>
            {isDraft && (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Xoá
              </Button>
            )}
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Đang xuất..." : "Export"}
            </Button>
          </div>
        }
      />

      <div className="flex gap-2">
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Thông tin sản phẩm</h3>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Mã sản phẩm" value={product.code} />
          <Field label="Loại sản phẩm" value={product.productType?.name} />
          <Field label="Đơn vị tính" value={product.unit?.name} />
        </dl>
      </div>

      {product.description && (
        <div className="rounded-lg border p-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Mô tả</h3>
          <p className="text-sm">{product.description}</p>
        </div>
      )}

      <div className="rounded-lg border p-6">
        <ProductParameterList productId={product.id} />
      </div>

      <div className="rounded-lg border p-6">
        <PricingRuleSection productId={product.id} />
      </div>

      <div className="rounded-lg border p-6">
        <MaterialRequirementSection productId={product.id} />
      </div>

      <div className="rounded-lg border p-6">
        <DerivedParameterSection productId={product.id} />
      </div>

      <div className="rounded-lg border p-6">
        <ValidationRuleSection productId={product.id} />
      </div>

      <div className="text-xs text-muted-foreground">
        Tạo lúc: {new Date(product.createdAt).toLocaleString("vi-VN")} · Cập nhật:{" "}
        {new Date(product.updatedAt).toLocaleString("vi-VN")}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xoá sản phẩm"
        description={`Bạn có chắc muốn xoá "${product.name}" (${product.code})? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        title={statusDialogLabel}
        description={statusDialogDesc}
        confirmLabel="Xác nhận"
        onConfirm={handleStatusChange}
      />
    </div>
  );
}
