"use client";

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { OpeningBalanceDialog } from "./opening-balance-dialog";
import { ReduceOpeningBalanceDialog } from "./reduce-opening-balance-dialog";

interface OpeningBalance {
  id: string;
  code: string;
  amount: number;
  remainingAmount: number;
  note: string | null;
  createdAt: string;
}

interface OpeningBalanceSectionProps {
  customerId: string;
  balances: OpeningBalance[];
  onChanged: () => void;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

// opening-balance.md — Công nợ đầu kỳ: nợ cũ trước khi dùng phần mềm, nhập
// tay bởi kế toán. Chỉ Create + Reduce (Manual Override, bắt buộc lý do),
// không Update/Delete.
export function OpeningBalanceSection({
  customerId,
  balances,
  onChanged,
}: OpeningBalanceSectionProps) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("debt.create-payment");
  const [addOpen, setAddOpen] = useState(false);
  const [reduceTarget, setReduceTarget] = useState<OpeningBalance | null>(null);

  return (
    <div className="rounded-lg border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Công nợ đầu kỳ</h3>
        {canManage && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Thêm Công nợ đầu kỳ
          </Button>
        )}
      </div>

      {balances.length === 0 ? (
        <p className="text-sm text-muted-foreground">Khách hàng không có Công nợ đầu kỳ.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead className="text-right">Số tiền gốc</TableHead>
                <TableHead className="text-right">Còn lại</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((b) => {
                const remainingAmount = Number(b.remainingAmount);
                const isOpen = remainingAmount > 0;
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {b.code}
                      <div className="text-xs text-muted-foreground font-normal">
                        {new Date(b.createdAt).toLocaleDateString("vi-VN")}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatMoney(Number(b.amount))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <span className={isOpen ? "text-destructive" : "text-muted-foreground"}>
                        {formatMoney(remainingAmount)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.note || "—"}</TableCell>
                    <TableCell>
                      {/* Rà soát mô hình công nợ lần 2 (chốt 28/07/2026): không ẩn
                          theo isOpen nữa — backend/client validation đã báo lỗi rõ
                          ràng khi bấm lúc đã tất toán hết. */}
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReduceTarget(b)}
                          >
                            Giảm trừ
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <OpeningBalanceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        customerId={customerId}
        onSaved={onChanged}
      />

      <ReduceOpeningBalanceDialog
        key={reduceTarget?.id}
        open={!!reduceTarget}
        onOpenChange={(open) => !open && setReduceTarget(null)}
        openingBalance={reduceTarget}
        onSaved={onChanged}
      />
    </div>
  );
}
