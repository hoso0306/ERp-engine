"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { CustomerTypeahead, type CustomerOption } from "@/components/quotation/customer-typeahead";

type FifoTarget = "RECEIVABLE" | "OPENING_BALANCE";

// Rà soát tab Công nợ (11/08/2026) — Công nợ đầu kỳ cấn trừ chung Allocation
// Engine với Receivable (GET /receivables/fifo-preview/:customerId trả gộp
// cả 2, luôn ưu tiên Công nợ đầu kỳ trước). `target` phân biệt để biết gửi
// `receivableId` hay `openingBalanceId` khi submit.
interface FifoPreviewItem {
  target: FifoTarget;
  id: string;
  code: string;
  remainingAmount: number;
}

interface AllocationRow {
  target: FifoTarget;
  id: string;
  code: string;
  remainingAmount: number;
  allocated: number;
}

interface AllocatePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Đã biết khách hàng (vào từ trang Khách hàng) — ẩn CustomerTypeahead.
  fixedCustomer?: CustomerOption;
  onSaved: () => void;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

// Luồng theo khách hàng (023-cong-no-payment-allocation-fifo) — mặc định cấn
// FIFO (đơn cũ nhất trước, danh sách BE đã sort createdAt asc), cho phép kế
// toán sửa tay từng dòng. Không được thanh toán vượt tổng công nợ hiện tại.
export function AllocatePaymentDialog({
  open,
  onOpenChange,
  fixedCustomer,
  onSaved,
}: AllocatePaymentDialogProps) {
  // customer là giá trị dẫn xuất (không phải state riêng) — luôn phản ánh
  // đúng fixedCustomer khi dialog mở từ trang Khách hàng, không cần effect để
  // đồng bộ (react-hooks/set-state-in-effect).
  const [pickedCustomer, setPickedCustomer] = useState<CustomerOption | null>(null);
  const customer = fixedCustomer ?? pickedCustomer;

  const [fifoTargets, setFifoTargets] = useState<FifoPreviewItem[]>([]);
  const [loadingReceivables, setLoadingReceivables] = useState(false);
  const [amount, setAmount] = useState("");
  // null = chưa sửa tay, dùng FIFO mặc định (defaultRows); có giá trị = kế
  // toán đã tự chỉnh, giữ nguyên lựa chọn của họ.
  const [manualRows, setManualRows] = useState<AllocationRow[] | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    // setTimeout: tránh gọi setState đồng bộ ngay trong thân effect (cùng
    // pattern debts/page.tsx đang dùng cho fetchReceivables).
    const timer = setTimeout(() => {
      setLoadingReceivables(true);
      apiGet<FifoPreviewItem[]>(`/receivables/fifo-preview/${customer.id}`)
        .then(setFifoTargets)
        .catch(() => setFifoTargets([]))
        .finally(() => setLoadingReceivables(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [open, customer]);

  const totalOpen = useMemo(
    () => fifoTargets.reduce((s, r) => s + Number(r.remainingAmount), 0),
    [fifoTargets],
  );

  // Preview FIFO — tính trực tiếp trong render (useMemo), không qua effect+state.
  // fifoTargets đã đúng thứ tự ưu tiên (Công nợ đầu kỳ trước, rồi Receivable
  // createdAt asc — xem DebtService.getFifoPreviewForCustomer()).
  const defaultRows = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    let remaining = amt;
    const next: AllocationRow[] = [];
    for (const r of fifoTargets) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Number(r.remainingAmount));
      next.push({
        target: r.target,
        id: r.id,
        code: r.code,
        remainingAmount: Number(r.remainingAmount),
        allocated: take,
      });
      remaining -= take;
    }
    return next;
  }, [amount, fifoTargets]);

  const rows = manualRows ?? defaultRows;
  const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
  const amt = parseFloat(amount) || 0;

  function reset() {
    setPickedCustomer(null);
    setFifoTargets([]);
    setAmount("");
    setManualRows(null);
    setPaymentMethod("CASH");
    setReferenceNumber("");
    setNote("");
  }

  function updateRowAmount(id: string, value: string) {
    const v = parseFloat(value) || 0;
    setManualRows(rows.map((r) => (r.id === id ? { ...r, allocated: v } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) { toast.error("Vui lòng chọn khách hàng."); return; }
    if (!amt || amt <= 0) { toast.error("Số tiền phải lớn hơn 0."); return; }
    // totalOpen = 0 (khách không còn công nợ) — không có gì để cấn, toàn bộ
    // amt sẽ thành Thu tạm ứng (BE tự chuyển nhánh khi allocations rỗng).
    // Chỉ validate cấn trừ khi khách còn công nợ mở.
    if (totalOpen > 0) {
      if (amt > totalOpen) {
        toast.error("Số tiền vượt quá tổng công nợ hiện tại của khách hàng.");
        return;
      }
      if (totalAllocated !== amt) {
        toast.error("Tổng số tiền cấn từng đơn phải bằng đúng số tiền thanh toán.");
        return;
      }
    }
    if (paymentMethod === "BANK_TRANSFER" && !referenceNumber.trim()) {
      toast.error("Vui lòng nhập số tham chiếu khi chuyển khoản.");
      return;
    }

    setSaving(true);
    try {
      await apiPost("/payments/allocate", {
        customerId: customer.id,
        amount: amt,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        note: note.trim() || undefined,
        allocations: rows
          .filter((r) => r.allocated > 0)
          .map((r) => ({
            receivableId: r.target === "RECEIVABLE" ? r.id : undefined,
            openingBalanceId: r.target === "OPENING_BALANCE" ? r.id : undefined,
            amount: r.allocated,
          })),
      });
      toast.success("Đã ghi nhận thanh toán.");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Lỗi kết nối server.");
    } finally {
      setSaving(false);
    }
  }

  const needsReference = paymentMethod === "BANK_TRANSFER";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán theo khách hàng</DialogTitle>
        </DialogHeader>
        <form id="allocate-payment-form" onSubmit={handleSubmit} className="space-y-4">
          {!fixedCustomer && (
            <div className="space-y-2">
              <Label>Khách hàng *</Label>
              <CustomerTypeahead
                value={customer}
                onChange={(c) => {
                  setPickedCustomer(c);
                  setFifoTargets([]);
                  setManualRows(null);
                }}
              />
            </div>
          )}

          {customer && (
            <p className="text-sm text-muted-foreground">
              Tổng công nợ hiện tại:{" "}
              <span className="font-mono font-semibold text-foreground">{formatMoney(totalOpen)}</span>
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="allocate-amount">Số tiền *</Label>
            <Input
              id="allocate-amount"
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setManualRows(null); }}
              placeholder="0"
              disabled={!customer}
              required
            />
          </div>

          {customer && loadingReceivables && (
            <p className="text-sm text-muted-foreground">Đang tải danh sách công nợ...</p>
          )}

          {customer && !loadingReceivables && fifoTargets.length === 0 && amt > 0 && (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Khách hàng không còn công nợ mở nào — khoản này sẽ được ghi nhận là{" "}
              <span className="font-medium text-foreground">Thu tạm ứng</span>, không cấn
              vào đơn hàng nào. Kế toán tự cấn khoản này vào công nợ mới phát sinh sau này.
            </p>
          )}

          {customer && !loadingReceivables && rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cấn trừ (mặc định FIFO — có thể sửa tay)</Label>
                <span className={`text-xs ${totalAllocated === amt ? "text-muted-foreground" : "text-destructive"}`}>
                  Đã cấn: {formatMoney(totalAllocated)} / {formatMoney(amt)}
                </span>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Đơn hàng</TableHead>
                      <TableHead className="text-right">Còn nợ</TableHead>
                      <TableHead className="w-36 text-right">Cấn trừ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">
                          {r.code}
                          {r.target === "OPENING_BALANCE" && (
                            <Badge variant="secondary" className="ml-2 text-[10px] font-sans">
                              Công nợ đầu kỳ
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          {formatMoney(r.remainingAmount)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={r.allocated}
                            onChange={(e) => updateRowAmount(r.id, e.target.value)}
                            className="text-right"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Phương thức *</Label>
            <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v ?? "CASH")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Tiền mặt</SelectItem>
                <SelectItem value="BANK_TRANSFER">Chuyển khoản</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="allocate-reference">
              Số tham chiếu {needsReference && "*"}
            </Label>
            <Input
              id="allocate-reference"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={needsReference ? "Bắt buộc khi chuyển khoản..." : "Không bắt buộc..."}
              required={needsReference}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allocate-note">Ghi chú</Label>
            <Textarea
              id="allocate-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
          <Button
            type="submit"
            form="allocate-payment-form"
            disabled={
              saving ||
              !customer ||
              !amount ||
              loadingReceivables ||
              // fifoTargets rỗng = khách không còn công nợ → cho submit (luồng
              // Thu tạm ứng). Còn công nợ mà rows rỗng (chưa cấn được) thì vẫn chặn.
              (fifoTargets.length > 0 && rows.length === 0)
            }
          >
            {saving ? "Đang lưu..." : "Ghi nhận thanh toán"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
