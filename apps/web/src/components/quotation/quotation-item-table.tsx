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
  unitPrice: number | null;
  discountPercent: number;
  surchargeAfterDiscount: number;
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

// 022-gia-von-loi-nhuan-bao-gia.md — chỉ OWNER/ADMIN nhận được map này (page
// cha chỉ fetch cost-summary khi hasPermission("quotation.view-cost")).
interface ItemCostInfo {
  costUnitPrice: number;
  totalCost: number;
  costAvailable: boolean;
}

interface QuotationItemTableProps {
  items: QuotationItemRow[];
  editable: boolean;
  onEdit: (item: QuotationItemRow) => void;
  onDelete: (itemId: string) => void;
  // Giảm thêm cấp toàn báo giá (Sprint 04, chốt 16/07/2026) — hiện dòng riêng
  // trước "Tổng thanh toán" nếu có.
  discountAmount?: number;
  // Giá vốn ước tính theo dòng — undefined nếu không có quyền xem.
  costByItemId?: Map<string, ItemCostInfo>;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function QuotationItemTable({ items, editable, onEdit, onDelete, discountAmount = 0, costByItemId }: QuotationItemTableProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Chưa có sản phẩm nào. {editable ? "Nhấn \"Thêm sản phẩm\" để bắt đầu." : ""}
      </p>
    );
  }

  const showCost = !!costByItemId;
  const totalAmount = items.reduce((s, i) => s + Number(i.subtotal), 0);
  const totalVat = items.reduce((s, i) => s + Number(i.vatAmount ?? 0), 0);
  const totalCost = costByItemId
    ? items.reduce((s, i) => s + (costByItemId.get(i.id)?.totalCost ?? 0), 0)
    : 0;
  const hasIncompleteCost = costByItemId
    ? items.some((i) => costByItemId.get(i.id)?.costAvailable === false)
    : false;
  const profit = totalAmount - totalCost;
  const colSpan = (editable ? 8 : 7) + (showCost ? 1 : 0);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sản phẩm</TableHead>
            <TableHead>Thông số</TableHead>
            <TableHead className="text-right">Giá bán</TableHead>
            <TableHead className="text-center">Chiết khấu</TableHead>
            <TableHead className="text-right">Phụ phí</TableHead>
            <TableHead className="text-right">SL</TableHead>
            <TableHead className="text-right">Thành tiền</TableHead>
            <TableHead className="text-right">VAT</TableHead>
            <TableHead>Chú thích</TableHead>
            {showCost && <TableHead className="text-right">Giá vốn</TableHead>}
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
                {item.unitPrice !== null ? (
                  <>
                    <div className="font-semibold">{formatNumber(Number(item.unitPrice))}</div>
                    <div className="text-xs text-muted-foreground font-sans">đ/m²</div>
                  </>
                ) : (
                  formatMoney(Number(item.systemPrice))
                )}
              </TableCell>
              <TableCell className="text-center text-sm">
                {Number(item.discountPercent) > 0 ? `${item.discountPercent}%` : "—"}
              </TableCell>
              <TableCell className="text-right text-sm">
                {Number(item.surchargeAfterDiscount) > 0
                  ? formatMoney(Number(item.surchargeAfterDiscount))
                  : "—"}
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
              {showCost && (
                <TableCell className="text-right font-mono text-sm text-muted-foreground">
                  {(() => {
                    const cost = costByItemId!.get(item.id);
                    if (!cost || !cost.costAvailable) {
                      return (
                        <span title="Sản phẩm chưa có Định mức vật tư đang hoạt động">—</span>
                      );
                    }
                    return formatMoney(cost.costUnitPrice);
                  })()}
                </TableCell>
              )}
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
          {showCost && (
            <>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={colSpan} className="text-right text-sm text-muted-foreground">
                  Tổng giá vốn (ước tính){hasIncompleteCost && " *"}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatMoney(totalCost)}
                </TableCell>
                {editable && <TableCell />}
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={colSpan} className="text-right text-sm font-semibold">
                  Lợi nhuận (ước tính)
                </TableCell>
                <TableCell
                  className={`text-right font-mono font-bold ${profit < 0 ? "text-destructive" : ""}`}
                >
                  {formatMoney(profit)}
                </TableCell>
                {editable && <TableCell />}
              </TableRow>
              {hasIncompleteCost && (
                <TableRow>
                  <TableCell colSpan={colSpan + 1 + (editable ? 1 : 0)} className="text-xs text-muted-foreground text-right pt-0">
                    * Một số sản phẩm chưa có Định mức vật tư đang hoạt động — giá vốn chưa đầy đủ.
                  </TableCell>
                </TableRow>
              )}
            </>
          )}
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
