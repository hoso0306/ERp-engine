"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";

interface WarehouseTransaction {
  id: string;
  direction: string;
  transactionType: string;
  quantity: number;
  createdAt: string;
}

interface MaterialReceipt {
  id: string;
  code: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: number;
  supplierName: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  transaction: WarehouseTransaction | null;
}

export default function MaterialReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [receipt, setReceipt] = useState<MaterialReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipt = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<MaterialReceipt>(`/material-receipts/${id}`);
      setReceipt(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải phiếu nhập kho.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchReceipt(); }, [fetchReceipt]);

  if (loading) return <Loading />;
  if (error || !receipt) return <ErrorState description={error ?? "Không tìm thấy phiếu nhập kho."} onRetry={fetchReceipt} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={receipt.code}
        description={`Phiếu nhập kho — ${receipt.materialName}`}
        actions={
          <Button variant="outline" onClick={() => router.push("/warehouse")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Button>
        }
      />

      <div className="rounded-lg border p-5 space-y-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Vật tư</span>
            <span className="font-medium">{receipt.materialName}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Mã vật tư</span>
            <span className="font-mono text-xs">{receipt.materialCode}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Số lượng</span>
            <span className="font-mono font-semibold">
              {Number(receipt.quantity).toLocaleString("vi-VN", { maximumFractionDigits: 4 })} {receipt.unit}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Nhà cung cấp</span>
            <span>{receipt.supplierName ?? "—"}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Người tạo</span>
            <span>{receipt.createdBy ?? "—"}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-36 shrink-0">Ngày tạo</span>
            <span>{new Date(receipt.createdAt).toLocaleString("vi-VN")}</span>
          </div>
          {receipt.note && (
            <div className="flex gap-2 col-span-2">
              <span className="text-muted-foreground w-36 shrink-0">Ghi chú</span>
              <span>{receipt.note}</span>
            </div>
          )}
        </div>
      </div>

      {receipt.transaction && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Giao dịch kho phát sinh</h3>
            <div className="rounded-lg border p-4 text-sm flex items-center justify-between">
              <span>
                Nhập kho{" "}
                <span className="font-mono font-medium">
                  +{Number(receipt.transaction.quantity).toLocaleString("vi-VN", { maximumFractionDigits: 4 })} {receipt.unit}
                </span>
              </span>
              <span className="text-muted-foreground">
                {new Date(receipt.transaction.createdAt).toLocaleString("vi-VN")}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
