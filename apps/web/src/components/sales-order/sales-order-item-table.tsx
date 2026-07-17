"use client";

import { Fragment, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Parameter {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

interface OrderBOMItem {
  id: string;
  materialCode: string;
  materialName: string;
  materialUnit: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface SalesOrderItemRow {
  id: string;
  productCode: string;
  productName: string;
  quantity: number;
  systemPrice: number;
  unitPrice: number | null;
  discountPercent: number;
  finalPrice: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  note: string | null;
  parameters: Parameter[];
  bom: { items: OrderBOMItem[] } | null;
}

interface SalesOrderItemTableProps {
  items: SalesOrderItemRow[];
  // Giảm thêm cấp toàn đơn (Sprint 04, chốt 16/07/2026) — hiện dòng riêng
  // trước "Tổng thanh toán" nếu có.
  discountAmount?: number;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function SalesOrderItemTable({ items, discountAmount = 0 }: SalesOrderItemTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Chưa có sản phẩm nào.</p>;
  }

  const totalAmount = items.reduce((s, i) => s + Number(i.subtotal), 0);
  const totalVat = items.reduce((s, i) => s + Number(i.vatAmount ?? 0), 0);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Sản phẩm</TableHead>
            <TableHead>Thông số</TableHead>
            <TableHead className="text-right">Giá bán</TableHead>
            <TableHead className="text-center">Chiết khấu</TableHead>
            <TableHead className="text-right">SL</TableHead>
            <TableHead className="text-right">Thành tiền</TableHead>
            <TableHead className="text-right">VAT</TableHead>
            <TableHead>Chú thích</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const bomItems = item.bom?.items ?? [];
            const isOpen = expanded.has(item.id);
            return (
              <Fragment key={item.id}>
                <TableRow
                  className={bomItems.length > 0 ? "cursor-pointer" : undefined}
                  onClick={() => bomItems.length > 0 && toggle(item.id)}
                >
                  <TableCell>
                    {bomItems.length > 0 && (
                      isOpen
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
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
                  <TableCell className="text-right text-sm">{Number(item.quantity)}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">
                    {formatMoney(Number(item.subtotal))}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {Number(item.vatRate) > 0
                      ? `${item.vatRate}% · ${formatMoney(Number(item.vatAmount))}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground w-48">
                    {item.note || "—"}
                  </TableCell>
                </TableRow>
                {isOpen && bomItems.length > 0 && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell />
                    <TableCell colSpan={8} className="py-3">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        BOM — vật tư cần cho {item.productName}
                      </div>
                      <div className="rounded-md border bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Vật tư</TableHead>
                              <TableHead className="text-right text-xs">Số lượng</TableHead>
                              <TableHead className="text-right text-xs">Đơn giá</TableHead>
                              <TableHead className="text-right text-xs">Thành tiền</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bomItems.map((b) => (
                              <TableRow key={b.id}>
                                <TableCell className="text-sm">
                                  <span className="font-mono text-xs text-muted-foreground">{b.materialCode}</span>
                                  {" — "}
                                  {b.materialName}
                                </TableCell>
                                <TableCell className="text-right text-sm font-mono">
                                  {Number(b.quantity).toLocaleString("vi-VN", { maximumFractionDigits: 4 })}
                                  {b.materialUnit ? ` ${b.materialUnit}` : ""}
                                </TableCell>
                                <TableCell className="text-right text-sm font-mono">
                                  {formatMoney(Number(b.unitPrice))}
                                </TableCell>
                                <TableCell className="text-right text-sm font-mono">
                                  {formatMoney(Number(b.lineTotal))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
          {totalVat > 0 || discountAmount > 0 ? (
            <>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={8} className="text-right text-sm font-medium">
                  Tổng tiền hàng
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {formatMoney(totalAmount)}
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={8} className="text-right text-sm text-muted-foreground">
                  Tổng VAT
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatMoney(totalVat)}
                </TableCell>
              </TableRow>
              {discountAmount > 0 && (
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={8} className="text-right text-sm text-muted-foreground">
                    Giảm thêm
                  </TableCell>
                  <TableCell className="text-right font-mono text-destructive">
                    −{formatMoney(discountAmount)}
                  </TableCell>
                </TableRow>
              )}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={8} className="text-right text-sm font-semibold">
                  Tổng thanh toán
                </TableCell>
                <TableCell className="text-right font-mono font-bold">
                  {formatMoney(totalAmount + totalVat - discountAmount)}
                </TableCell>
              </TableRow>
            </>
          ) : (
            <TableRow className="bg-muted/50">
              <TableCell colSpan={8} className="text-right text-sm font-medium">
                Tổng cộng
              </TableCell>
              <TableCell className="text-right font-mono font-bold">
                {formatMoney(totalAmount)}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
