"use client";

import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { QuotationStatusBadge } from "./quotation-status-badge";
import { useAuth } from "@/context/auth-context";

interface QuotationItem {
  id: string;
  subtotal: number;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
}

interface Quotation {
  id: string;
  code: string;
  status: string;
  expiryDate: string | null;
  note: string | null;
  createdAt: string;
  customer: Customer;
  items: QuotationItem[];
  // 022-gia-von-loi-nhuan-bao-gia.md — chỉ có khi role có quotation.view-cost,
  // API omit hẳn field này nếu không có quyền (không trả null).
  totalCost?: number;
  profit?: number;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface QuotationTableProps {
  quotations: Quotation[];
  meta: Meta;
  onPageChange: (page: number) => void;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function isExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date(new Date().toDateString());
}

export function QuotationTable({ quotations, meta, onPageChange }: QuotationTableProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  // API omit hẳn totalCost/profit nếu role không có quyền — kiểm tra thêm dữ
  // liệu thật có mặt, không chỉ dựa permission (đề phòng lệch quyền).
  const showCost =
    hasPermission("quotation.view-cost") &&
    quotations.some((q) => q.totalCost !== undefined);

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Mã BG</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead className="text-right">Tổng tiền</TableHead>
              {showCost && <TableHead className="text-right">Tổng giá vốn</TableHead>}
              {showCost && <TableHead className="text-right">Lợi nhuận</TableHead>}
              <TableHead>Ngày hết hạn</TableHead>
              <TableHead>Ngày tạo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotations.map((q) => {
              const total = q.items.reduce((s, i) => s + Number(i.subtotal), 0);
              // Cảnh báo quá hạn chỉ áp dụng báo giá còn mở (Nháp/Đã gửi) —
              // báo giá Đã duyệt/Đã huỷ không còn ý nghĩa hết hạn (testlan1).
              const expired =
                isExpired(q.expiryDate) && (q.status === "DRAFT" || q.status === "SENT");

              return (
                <TableRow
                  key={q.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/quotations/${q.id}`)}
                >
                  <TableCell className="font-mono text-xs font-medium">{q.code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{q.customer.name}</div>
                    <div className="text-xs text-muted-foreground">{q.customer.phone}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <QuotationStatusBadge status={q.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-56 truncate">
                    {q.note || <span className="text-muted-foreground/60">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {q.items.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      formatMoney(total)
                    )}
                  </TableCell>
                  {showCost && (
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {q.totalCost !== undefined ? formatMoney(q.totalCost) : "—"}
                    </TableCell>
                  )}
                  {showCost && (
                    <TableCell
                      className={`text-right font-mono text-sm font-medium ${
                        q.profit !== undefined && q.profit < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {q.profit !== undefined ? formatMoney(q.profit) : "—"}
                    </TableCell>
                  )}
                  <TableCell>
                    {q.expiryDate ? (
                      <span className={expired ? "text-destructive flex items-center gap-1 text-sm" : "text-sm"}>
                        {expired && <AlertCircle className="h-3.5 w-3.5" />}
                        {new Date(q.expiryDate).toLocaleDateString("vi-VN")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(q.createdAt).toLocaleDateString("vi-VN")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <p className="text-sm text-muted-foreground">
          Hiển thị {quotations.length} / {meta.total} báo giá
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{meta.page} / {meta.totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
