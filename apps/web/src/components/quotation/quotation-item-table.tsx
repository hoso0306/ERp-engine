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
  groupDiscount: number;
  additionalDiscountPercent: number;
  additionalDiscountAmount: number;
  discountReason: string | null;
  discountBy: string | null;
  finalPrice: number;
  subtotal: number;
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
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

function formatParams(params: Parameter[]) {
  return params
    .map((p) => `${p.label}: ${p.value}${p.unit ? ` ${p.unit}` : ""}`)
    .join(" · ");
}

export function QuotationItemTable({ items, editable, onEdit, onDelete }: QuotationItemTableProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Chưa có sản phẩm nào. {editable ? "Nhấn \"Thêm sản phẩm\" để bắt đầu." : ""}
      </p>
    );
  }

  const grandTotal = items.reduce((s, i) => s + Number(i.subtotal), 0);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sản phẩm</TableHead>
            <TableHead>Thông số</TableHead>
            <TableHead className="text-right">Giá hệ thống</TableHead>
            <TableHead className="text-center">CK nhóm</TableHead>
            <TableHead className="text-right">Giá bán</TableHead>
            <TableHead className="text-right">SL</TableHead>
            <TableHead className="text-right">Thành tiền</TableHead>
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
                {Number(item.groupDiscount) > 0 ? `${item.groupDiscount}%` : "—"}
              </TableCell>
              <TableCell className="text-right font-mono text-sm font-medium">
                {formatMoney(Number(item.finalPrice))}
              </TableCell>
              <TableCell className="text-right text-sm">{Number(item.quantity)}</TableCell>
              <TableCell className="text-right font-mono text-sm font-semibold">
                {formatMoney(Number(item.subtotal))}
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
          <TableRow className="bg-muted/50">
            <TableCell colSpan={editable ? 6 : 5} className="text-right text-sm font-medium">
              Tổng cộng
            </TableCell>
            <TableCell className="text-right font-mono font-bold">
              {formatMoney(grandTotal)}
            </TableCell>
            {editable && <TableCell />}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
