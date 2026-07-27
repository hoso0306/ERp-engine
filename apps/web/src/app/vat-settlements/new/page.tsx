"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Loading, ErrorState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api";

interface EligibleReceivable {
  id: string;
  totalAmount: number;
  totalAmountBeforeVat: number;
  salesOrder: { id: string; code: string; customerName: string; customerPhone: string };
}

interface ReceivableDetail {
  id: string;
  customerId: string;
  closedWithoutVat: boolean;
  salesOrder: { code: string; customerName: string };
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

// 024-cong-no-vat-settlement.md Việc 7 — vào từ Receivable detail (`?receivableId=`)
// nên đã biết khách hàng + đơn được pre-select; vẫn hiện toàn bộ danh sách đủ
// điều kiện của khách đó để kế toán gộp thêm đơn khác nếu muốn (Quyết định #4:
// 1 Receivable chỉ thuộc tối đa 1 VatSettlement active tại một thời điểm).
export default function NewVatSettlementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const receivableId = searchParams.get("receivableId");

  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [eligible, setEligible] = useState<EligibleReceivable[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!receivableId) {
      setError("Thiếu công nợ nguồn — vui lòng vào từ trang chi tiết công nợ.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const receivable = await apiGet<ReceivableDetail>(`/receivables/${receivableId}`);
        if (cancelled) return;
        if (!receivable.closedWithoutVat) {
          setError("Công nợ này chưa được đóng theo chế độ Đóng công nợ (không xuất hóa đơn).");
          setLoading(false);
          return;
        }
        setCustomer({ id: receivable.customerId, name: receivable.salesOrder.customerName });
        const list = await apiGet<EligibleReceivable[]>(
          `/receivables/eligible-for-vat-settlement/${receivable.customerId}`,
        );
        if (cancelled) return;
        setEligible(list);
        setSelected(new Set(list.some((r) => r.id === receivableId) ? [receivableId] : []));
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Không thể tải dữ liệu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [receivableId]);

  const totalAmount = useMemo(
    () => eligible.filter((r) => selected.has(r.id)).reduce((s, r) => s + (Number(r.totalAmount) - Number(r.totalAmountBeforeVat)), 0),
    [eligible, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (!customer || selected.size === 0) {
      toast.error("Vui lòng chọn ít nhất 1 công nợ.");
      return;
    }
    setSaving(true);
    try {
      const settlement = await apiPost<{ id: string }>("/vat-settlements", {
        customerId: customer.id,
        receivableIds: Array.from(selected),
      });
      toast.success("Đã tạo Quyết toán VAT.");
      router.push(`/vat-settlements/${settlement.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;
  if (error || !customer) return <ErrorState description={error ?? "Không thể tải dữ liệu."} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tạo Quyết toán VAT"
        description={`Khách hàng ${customer.name}`}
        actions={
          <Button variant="outline" onClick={() => router.back()}>Quay lại</Button>
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Đơn hàng</TableHead>
              <TableHead className="text-right">Tổng tiền (sau VAT)</TableHead>
              <TableHead className="text-right">Trước VAT</TableHead>
              <TableHead className="text-right">Phần VAT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eligible.map((r) => {
              const vatAmount = Number(r.totalAmount) - Number(r.totalAmountBeforeVat);
              return (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => toggle(r.id)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.salesOrder.code}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatMoney(Number(r.totalAmount))}</TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">{formatMoney(Number(r.totalAmountBeforeVat))}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">{formatMoney(vatAmount)}</TableCell>
                </TableRow>
              );
            })}
            {eligible.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Khách hàng này chưa có công nợ nào đủ điều kiện.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between rounded-md border p-4">
        <span className="text-sm text-muted-foreground">Tổng phần VAT sẽ đưa vào Settlement</span>
        <span className="font-mono font-semibold text-lg">{formatMoney(totalAmount)}</span>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={saving || selected.size === 0}>
          {saving ? "Đang tạo..." : "Tạo Quyết toán VAT"}
        </Button>
      </div>
    </div>
  );
}
