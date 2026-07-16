"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { apiGet, ApiError } from "@/lib/api";

interface MaterialReceiptItem {
  id: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: number;
}

interface MaterialReceipt {
  id: string;
  code: string;
  items: MaterialReceiptItem[];
  supplierName: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
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
        description={`Phiếu nhập kho — ${receipt.items.length} loại vật tư`}
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

      <Separator />

      <div className="space-y-3">
        <h3 className="text-base font-semibold">Danh sách vật tư</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã vật tư</TableHead>
                <TableHead>Tên vật tư</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipt.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.materialCode}</TableCell>
                  <TableCell className="font-medium">{item.materialName}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    +{Number(item.quantity).toLocaleString("vi-VN", { maximumFractionDigits: 4 })} {item.unit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
