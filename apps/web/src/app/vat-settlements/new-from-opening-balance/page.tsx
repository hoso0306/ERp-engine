"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import {
  OpeningBalanceLineDialog,
  type OpeningBalanceLineDraft,
} from "@/components/debt/opening-balance-line-dialog";

interface OpeningBalanceDetail {
  id: string;
  code: string;
  customerId: string;
  remainingAmount: number;
}

interface CustomerBrief {
  id: string;
  name: string;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

// opening-balance.md — "Phục dựng hoá đơn" cho Công nợ đầu kỳ: kế toán thêm
// dòng sản phẩm THẬT chỉ để tính ra số tiền cần xuất hoá đơn (không tạo Sales
// Order/Production Order/Warehouse). Vào từ nút "Phục dựng hoá đơn" trên trang
// chi tiết khách hàng (`?openingBalanceId=`).
export default function NewVatSettlementFromOpeningBalancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openingBalanceId = searchParams.get("openingBalanceId");

  const [openingBalance, setOpeningBalance] = useState<OpeningBalanceDetail | null>(null);
  const [customer, setCustomer] = useState<CustomerBrief | null>(null);
  const [lines, setLines] = useState<OpeningBalanceLineDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!openingBalanceId) {
      setError("Thiếu Công nợ đầu kỳ nguồn — vui lòng vào từ trang chi tiết khách hàng.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ob = await apiGet<OpeningBalanceDetail>(`/opening-balances/${openingBalanceId}`);
        if (cancelled) return;
        if (Number(ob.remainingAmount) <= 0) {
          setError("Công nợ đầu kỳ này đã đóng hết, không thể phục dựng hoá đơn.");
          setLoading(false);
          return;
        }
        setOpeningBalance(ob);
        const c = await apiGet<CustomerBrief>(`/customers/${ob.customerId}`);
        if (cancelled) return;
        setCustomer(c);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Không thể tải dữ liệu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [openingBalanceId]);

  const totalVatAmount = useMemo(
    () => lines.reduce((s, l) => s + l.vatAmount, 0),
    [lines],
  );

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  async function handleSubmit() {
    if (!openingBalance || lines.length === 0) {
      toast.error("Vui lòng thêm ít nhất 1 dòng sản phẩm.");
      return;
    }
    setSaving(true);
    try {
      const settlement = await apiPost<{ id: string }>("/vat-settlements/from-opening-balance", {
        openingBalanceId: openingBalance.id,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          parameters: l.parameters,
        })),
      });
      toast.success("Đã tạo VAT Settlement.");
      router.push(`/vat-settlements/${settlement.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !openingBalance || !customer) {
    return <ErrorState description={error ?? "Không thể tải dữ liệu."} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phục dựng hoá đơn từ Công nợ đầu kỳ"
        description={`${openingBalance.code} · Khách hàng ${customer.name}`}
        actions={
          <Button variant="outline" onClick={() => router.back()}>Quay lại</Button>
        }
      />

      <div className="flex items-center justify-between rounded-md border p-4">
        <span className="text-sm text-muted-foreground">
          Số dư Công nợ đầu kỳ còn lại
        </span>
        <span className="font-mono font-semibold">
          {formatMoney(Number(openingBalance.remainingAmount))}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Dòng sản phẩm</h3>
        <Button size="sm" onClick={() => setLineDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Thêm dòng sản phẩm
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sản phẩm</TableHead>
              <TableHead className="text-right">Số lượng</TableHead>
              <TableHead className="text-right">Giá bán</TableHead>
              <TableHead className="text-right">Thành tiền</TableHead>
              <TableHead className="text-right">VAT</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l) => (
              <TableRow key={l.key}>
                <TableCell>
                  <div className="font-medium">{l.productName}</div>
                  <div className="text-xs text-muted-foreground font-mono">{l.productCode}</div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{l.quantity}</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatMoney(l.finalPrice)}</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatMoney(l.subtotal)}</TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {formatMoney(l.vatAmount)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon-sm" onClick={() => removeLine(l.key)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Chưa có dòng sản phẩm nào.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between rounded-md border p-4">
        <span className="text-sm text-muted-foreground">Tổng phần VAT sẽ đưa vào Settlement</span>
        <span className="font-mono font-semibold text-lg">{formatMoney(totalVatAmount)}</span>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={saving || lines.length === 0}>
          {saving ? "Đang tạo..." : "Tạo VAT Settlement"}
        </Button>
      </div>

      <OpeningBalanceLineDialog
        open={lineDialogOpen}
        onOpenChange={setLineDialogOpen}
        customerId={openingBalance.customerId}
        onAdd={(line) => setLines((prev) => [...prev, line])}
      />
    </div>
  );
}
