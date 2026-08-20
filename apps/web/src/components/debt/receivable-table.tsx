"use client";

import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/shared";
import { RiskBadge, computeDaysOverdue, computeRiskLevel } from "./risk-badge";

interface ReceivableRow {
  id: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string | null;
  salesOrder: {
    id: string;
    code: string;
    customerName: string;
    customerPhone: string;
  };
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ReceivableTableProps {
  receivables: ReceivableRow[];
  meta: Meta;
  onPageChange: (page: number) => void;
  // Ô chọn số dòng/trang (Pagination dùng chung, chốt 20/08/2026) — optional,
  // không truyền thì giữ nguyên limit cố định như trước.
  onLimitChange?: (limit: number) => void;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export function ReceivableTable({ receivables, meta, onPageChange, onLimitChange }: ReceivableTableProps) {
  const router = useRouter();

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Khách hàng</TableHead>
              <TableHead className="w-32">Mã đơn</TableHead>
              <TableHead className="text-right">Tổng tiền</TableHead>
              <TableHead className="text-right">Đã thu</TableHead>
              <TableHead className="text-right">Còn lại</TableHead>
              <TableHead>Hạn thanh toán</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receivables.map((r) => {
              const daysOverdue = computeDaysOverdue(r.dueDate);
              const riskLevel = computeRiskLevel(daysOverdue);
              return (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/debts/${r.id}`)}
                >
                  <TableCell>
                    <div className="font-medium">{r.salesOrder.customerName}</div>
                    <div className="text-xs text-muted-foreground">{r.salesOrder.customerPhone}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium">{r.salesOrder.code}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatMoney(Number(r.totalAmount))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-green-600">
                    {formatMoney(Number(r.paidAmount))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-destructive">
                    {formatMoney(Number(r.remainingAmount))}
                  </TableCell>
                  <TableCell>
                    {r.dueDate ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{new Date(r.dueDate).toLocaleDateString("vi-VN")}</span>
                        <RiskBadge riskLevel={riskLevel} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {receivables.length} / {meta.total} công nợ
        </p>
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          onPageChange={onPageChange}
          limit={onLimitChange ? meta.limit : undefined}
          onLimitChange={onLimitChange}
        />
      </div>
    </div>
  );
}
