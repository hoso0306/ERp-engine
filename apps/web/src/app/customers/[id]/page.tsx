"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Loading, ErrorState, ConfirmDialog } from "@/components/shared";
import { CustomerProductDiscountList } from "@/components/customer/customer-product-discount-list";
import { toast } from "sonner";
import { apiGet, apiDelete, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string | null;
  companyName: string | null;
  taxCode: string | null;
  province: string | null;
  district: string | null;
  ward: string | null;
  address: string | null;
  priority: string;
  status: string;
  debtLimit: string;
  debtTermDays: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  customerGroup: { id: string; name: string } | null;
  deliveryRoute: { id: string; name: string } | null;
  sale: { id: string; name: string } | null;
}

interface ProductDiscount {
  id: string;
  discountPercent: number;
  product: { id: string; code: string; name: string };
}

const priorityLabels: Record<string, string> = { LOW: "Thấp", MEDIUM: "Trung bình", HIGH: "Cao" };
const statusLabels: Record<string, string> = { ACTIVE: "Hoạt động", INACTIVE: "Ngừng hoạt động" };

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [discounts, setDiscounts] = useState<ProductDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchDiscounts = useCallback(() => {
    apiGet<ProductDiscount[]>(`/customers/${params.id}/product-discounts`)
      .then(setDiscounts)
      .catch(() => setDiscounts([]));
  }, [params.id]);

  useEffect(() => {
    apiGet<Customer>(`/customers/${params.id}`)
      .then(setCustomer)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không tìm thấy khách hàng."))
      .finally(() => setLoading(false));
    fetchDiscounts();
  }, [params.id, fetchDiscounts]);

  async function handleDelete() {
    try {
      await apiDelete(`/customers/${params.id}`);
      toast.success("Đã xoá khách hàng.");
      router.push("/customers");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState description={error} onRetry={() => router.refresh()} />;
  if (!customer) return null;

  const fullAddress = [customer.address, customer.ward, customer.district, customer.province]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={customer.code}
        actions={
          <div className="flex gap-2">
            {hasPermission("customer.update") && (
              <Button variant="outline" render={<Link href={`/customers/${customer.id}/edit`} />}>
                <Pencil className="mr-2 h-4 w-4" />
                Chỉnh sửa
              </Button>
            )}
            {hasPermission("customer.delete") && (
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Xoá
              </Button>
            )}
          </div>
        }
      />

      <div className="flex gap-2">
        <Badge variant={customer.status === "ACTIVE" ? "default" : "secondary"}>
          {statusLabels[customer.status]}
        </Badge>
        <Badge variant={customer.priority === "HIGH" ? "destructive" : customer.priority === "LOW" ? "secondary" : "default"}>
          {priorityLabels[customer.priority]}
        </Badge>
      </div>

      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Thông tin cơ bản</h3>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Số điện thoại" value={customer.phone} />
          <Field label="Email" value={customer.email} />
          <Field label="Tên công ty" value={customer.companyName} />
          <Field label="Mã số thuế" value={customer.taxCode} />
          <Field label="Địa chỉ" value={fullAddress} />
        </dl>
      </div>

      <div className="rounded-lg border p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Thông tin kinh doanh</h3>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Nhóm khách hàng" value={customer.customerGroup?.name} />
          <Field label="Tuyến giao hàng" value={customer.deliveryRoute?.name} />
          <Field label="Người phụ trách" value={customer.sale?.name} />
          <Field label="Hạn mức công nợ" value={`${Number(customer.debtLimit).toLocaleString("vi-VN")} đ`} />
          <Field label="Thời hạn công nợ" value={`${customer.debtTermDays} ngày`} />
        </dl>
      </div>

      <CustomerProductDiscountList
        customerId={customer.id}
        discounts={discounts}
        onChanged={fetchDiscounts}
      />

      {customer.note && (
        <div className="rounded-lg border p-6">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Ghi chú</h3>
          <p className="text-sm">{customer.note}</p>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Tạo lúc: {new Date(customer.createdAt).toLocaleString("vi-VN")} · Cập nhật: {new Date(customer.updatedAt).toLocaleString("vi-VN")}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xoá khách hàng"
        description={`Bạn có chắc muốn xoá "${customer.name}" (${customer.code})? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
