"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { ReturnStatusBadge } from "@/components/return/return-status-badge";
import { ReturnItemTable } from "@/components/return/return-item-table";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface Parameter {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

interface RecoveryInventory {
  id: string;
  code: string;
  quantity: number;
  status: string;
  location: string | null;
}

interface ReturnItem {
  id: string;
  productCode: string;
  productName: string;
  productParameters: Parameter[] | null;
  orderedQuantity: number;
  returnedQuantity: number;
  unitPriceSnapshot: number;
  reason: string;
  note: string | null;
  recoveryInventory: RecoveryInventory | null;
}

interface ReturnDetail {
  id: string;
  code: string;
  salesOrderId: string;
  salesOrderCode: string;
  customerName: string;
  returnDate: string;
  receivedBy: string | null;
  completedByName: string | null;
  status: string;
  note: string | null;
  items: ReturnItem[];
}

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [ret, setRet] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const fetchReturn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<ReturnDetail>(`/returns/${id}`);
      setRet(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải phiếu hoàn.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchReturn(); }, [fetchReturn]);

  async function handleComplete() {
    if (!confirm("Chốt xong vụ việc này với khách? Không ảnh hưởng tài chính, không thể quay lại.")) return;
    setCompleting(true);
    try {
      await apiPost(`/returns/${id}/complete`);
      toast.success("Đã hoàn tất xử lý.");
      fetchReturn();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setCompleting(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !ret) return <ErrorState description={error ?? "Không tìm thấy phiếu hoàn."} onRetry={fetchReturn} />;

  const canComplete = ret.status === "PROCESSING" && hasPermission("return.update");
  const canViewOrder = hasPermission("sales-order.view");

  return (
    <div className="space-y-6">
      <PageHeader
        title={ret.code}
        description={`Phiếu hoàn của ${ret.customerName}`}
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            <Button variant="outline" onClick={() => router.push("/returns")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại
            </Button>
            {canComplete && (
              <Button onClick={handleComplete} disabled={completing} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                {completing ? "Đang xử lý..." : "Hoàn tất xử lý"}
              </Button>
            )}
          </div>
        }
      />

      {/* Header Info */}
      <div className="rounded-lg border p-5 space-y-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Trạng thái</span>
            <ReturnStatusBadge status={ret.status} />
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Đơn hàng gốc</span>
            {canViewOrder ? (
              <Link href={`/orders/${ret.salesOrderId}`} className="font-mono text-xs text-primary underline underline-offset-2">
                {ret.salesOrderCode}
              </Link>
            ) : (
              <span className="font-mono text-xs">{ret.salesOrderCode}</span>
            )}
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Khách hàng</span>
            <span className="font-medium">{ret.customerName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Ngày trả</span>
            <span>{new Date(ret.returnDate).toLocaleDateString("vi-VN")}</span>
          </div>
          {ret.receivedBy && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-36 shrink-0">Người nhận</span>
              <span>{ret.receivedBy}</span>
            </div>
          )}
          {ret.completedByName && (
            <div className="flex gap-2">
              <span className="text-muted-foreground w-36 shrink-0">Người hoàn thành</span>
              <span>{ret.completedByName}</span>
            </div>
          )}
          {ret.note && (
            <div className="flex gap-2 col-span-2">
              <span className="text-muted-foreground w-36 shrink-0">Ghi chú</span>
              <span>{ret.note}</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Items */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Danh sách sản phẩm trả</h3>
        <ReturnItemTable items={ret.items} />
      </div>
    </div>
  );
}
