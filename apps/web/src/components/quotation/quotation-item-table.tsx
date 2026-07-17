"use client";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";

interface Parameter {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

interface QuotationItemRow {
  id: string;
  productId: string;
  quantity: number;
  systemPrice: number;
  discountPercent: number;
  finalPrice: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  note: string | null;
  // Snapshot cảnh báo Validation Rule (WARN) tại thời điểm tính giá dòng này.
  warnings: string[] | null;
  // Snapshot tại thời điểm thêm/sửa dòng — hiển thị đọc từ đây, không đọc Product.
  productCode: string;
  productName: string;
  // Chỉ dùng điều hướng (navigation), không dùng hiển thị.
  product: { id: string; code: string; name: string };
  parameters: Parameter[];
}

interface QuotationItemTableProps {
  items: QuotationItemRow[];
  editable: boolean;
  onEdit: (item: QuotationItemRow) => void;
  onDelete: (itemId: string) => void;
  // Giảm thêm cấp toàn báo giá (Sprint 04, chốt 16/07/2026) — hiện dòng riêng
  // trước "Tổng thanh toán" nếu có.
  discountAmount?: number;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

export function QuotationItemTable({ items, editable, onEdit, onDelete, discountAmount = 0 }: QuotationItemTableProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Chưa có sản phẩm nào. {editable ? "Nhấn \"Thêm sản phẩm\" để bắt đầu." : ""}
      </p>
    );
  }

  const totalAmount = items.reduce((s, i) => s + Number(i.subtotal), 0);
  const totalVat = items.reduce((s, i) => s + Number(i.vatAmount ?? 0), 0);
  const colSpan = editable ? 7 : 6;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sản phẩm</TableHead>
            <TableHead>Thông số</TableHead>
            <TableHead className="text-right">Giá bán</TableHead>
            <TableHead className="text-center">Chiết khấu</TableHead>
            <TableHead className="text-right">SL</TableHead>
            <TableHead className="text-right">Thành tiền</TableHead>
            <TableHead className="text-right">VAT</TableHead>
            <TableHead>Chú thích</TableHead>
            {editable && <TableHead className="w-20" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <div className="font-medium">{item.productName}</div>
                <div className="text-xs text-muted-foreground font-mono">{item.productCode}</div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground w-48">
                <div className="space-y-0.5">
                  {item.parameters.length > 0
                    ? item.parameters.map((p) => (
                        <div key={p.name} className="truncate max-w-[180px]">
                          <span className="text-muted-foreground/70">{p.label}:</span>{" "}
                          {p.value}{p.unit ? ` ${p.unit}` : ""}
                        </div>
                      ))
                    : "—"}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatMoney(Number(item.systemPrice))}
              </TableCell>
              <TableCell className="text-center text-sm">
                {Number(item.discountPercent) > 0 ? `${item.discountPercent}%` : "—"}
              </TableCell>
              <TableCell className="text-right text-sm">{Number(item.quantity)}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold">
                {formatMoney(Number(item.subtotal))}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {Number(item.vatRate) > 0
                  ? `${item.vatRate}% · ${formatMoney(Number(item.vatAmount))}`
                  : "—"}
              </TableCell>
              <TableCell className="text-xs w-56">
                <div className="space-y-0.5">
                  {item.warnings?.map((w, idx) => (
                    <div key={idx} className="text-amber-600 dark:text-amber-500">⚠ {w}</div>
                  ))}
                  {item.note && <div className="text-muted-foreground">{item.note}</div>}
                  {!item.warnings?.length && !item.note && "—"}
                </div>
              </TableCell>
              {editable && (
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {totalVat > 0 || discountAmount > 0 ? (
            <>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={colSpan} className="text-right text-sm font-medium">
                  Tổng tiền hàng
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {formatMoney(totalAmount)}
                </TableCell>
                {editable && <TableCell />}
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={colSpan} className="text-right text-sm text-muted-foreground">
                  Tổng VAT
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatMoney(totalVat)}
                </TableCell>
                {editable && <TableCell />}
              </TableRow>
              {discountAmount > 0 && (
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={colSpan} className="text-right text-sm text-muted-foreground">
                    Giảm thêm
                  </TableCell>
                  <TableCell className="text-right font-mono text-destructive">
                    −{formatMoney(discountAmount)}
                  </TableCell>
                  {editable && <TableCell />}
                </TableRow>
              )}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={colSpan} className="text-right text-sm font-semibold">
                  Tổng thanh toán
                </TableCell>
                <TableCell className="text-right font-mono font-bold">
                  {formatMoney(totalAmount + totalVat - discountAmount)}
                </TableCell>
                {editable && <TableCell />}
              </TableRow>
            </>
          ) : (
            <TableRow className="bg-muted/50">
              <TableCell colSpan={colSpan} className="text-right text-sm font-medium">
                Tổng cộng
              </TableCell>
              <TableCell className="text-right font-mono font-bold">
                {formatMoney(totalAmount)}
              </TableCell>
              {editable && <TableCell />}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
