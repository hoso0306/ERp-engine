"use client";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
};

interface PaymentRow {
  id: string;
  code: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  note: string | null;
  createdBy: string | null;
}

interface PaymentTableProps {
  payments: PaymentRow[];
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export function PaymentTable({ payments }: PaymentTableProps) {
  if (payments.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Chưa có khoản thanh toán nào.</p>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Mã phiếu thu</TableHead>
            <TableHead>Ngày thu</TableHead>
            <TableHead className="text-right">Số tiền</TableHead>
            <TableHead>Phương thức</TableHead>
            <TableHead>Số tham chiếu</TableHead>
            <TableHead>Ghi chú</TableHead>
            <TableHead>Người thu</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs font-medium">{p.code}</TableCell>
              <TableCell className="text-sm">{new Date(p.paymentDate).toLocaleString("vi-VN")}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold text-green-600">
                {formatMoney(Number(p.amount))}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{PAYMENT_METHOD_LABEL[p.paymentMethod] ?? p.paymentMethod}</Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.referenceNumber ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.note ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.createdBy ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
