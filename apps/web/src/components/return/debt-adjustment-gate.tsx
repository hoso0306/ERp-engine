"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ManualAdjustmentDialog } from "./manual-adjustment-dialog";

interface DebtAdjustmentGateProps {
  returnCode: string;
  returnId: string;
  // Trạng thái đã biết (từ GET /returns/:id, hoặc null nếu vừa tạo và bước
  // tự động lúc tạo bị lỗi/bỏ qua — chắc chắn chưa có).
  debtAdjustedAt: string | null;
  debtAdjustedAmount: number | null;
  debtAdjustedByName: string | null;
  receivableId: string;
  salesOrderCode: string;
  remainingAmount?: number;
  suggestedAmount?: number;
  suggestedReason?: string;
  onSaved: () => void;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
  triggerClassName?: string;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

// Nút "Giảm trừ công nợ" dùng chung (returns/new sau khi tạo + returns/[id]
// dự phòng) — bấm vào LUÔN qua 1 lớp cảnh báo trước khi mở dialog nhập số
// tiền/lý do thật (ManualAdjustmentDialog), để tránh giảm trừ trùng lặp cho
// cùng 1 phiếu hoàn (rà soát UI 27/08/2026):
// - Đã có debtAdjustedAt: cảnh báo đã giảm trừ trước đó, hỏi có muốn tạo
//   thêm 1 lần điều chỉnh nữa không (vd giảm bổ sung/sửa sai).
// - Chưa có: xác nhận nhẹ trước khi mở dialog nhập liệu thật.
export function DebtAdjustmentGate({
  returnCode,
  returnId,
  debtAdjustedAt,
  debtAdjustedAmount,
  debtAdjustedByName,
  receivableId,
  salesOrderCode,
  remainingAmount,
  suggestedAmount,
  suggestedReason,
  onSaved,
  triggerLabel = "Giảm trừ công nợ",
  triggerVariant = "outline",
  triggerClassName,
}: DebtAdjustmentGateProps) {
  const [gateOpen, setGateOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const alreadyAdjusted = !!debtAdjustedAt;

  return (
    <>
      <Button variant={triggerVariant} className={triggerClassName} onClick={() => setGateOpen(true)}>
        {triggerLabel}
      </Button>

      <Dialog open={gateOpen} onOpenChange={setGateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{alreadyAdjusted ? "Đã có thông tin giảm công nợ" : "Giảm trừ công nợ"}</DialogTitle>
          </DialogHeader>
          {alreadyAdjusted ? (
            <p className="text-sm text-muted-foreground">
              Phiếu hoàn {returnCode} đã có thông tin giảm công nợ, tổng cộng {formatMoney(Number(debtAdjustedAmount ?? 0))}
              {" "}(lần gần nhất ngày {debtAdjustedAt && new Date(debtAdjustedAt).toLocaleString("vi-VN")}
              {debtAdjustedByName && <>, tạo bởi {debtAdjustedByName}</>}).
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Phiếu hoàn {returnCode} <strong>CHƯA CÓ</strong> thông tin giảm công nợ.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGateOpen(false)}>Huỷ</Button>
            <Button
              onClick={() => {
                setGateOpen(false);
                setAdjustOpen(true);
              }}
            >
              {alreadyAdjusted ? "Vẫn tạo tiếp" : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManualAdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        receivableId={receivableId}
        salesOrderCode={salesOrderCode}
        remainingAmount={remainingAmount}
        suggestedAmount={suggestedAmount}
        suggestedReason={suggestedReason}
        returnId={returnId}
        returnCode={returnCode}
        onSaved={onSaved}
      />
    </>
  );
}
