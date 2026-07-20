"use client";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertCircle } from "lucide-react";

// 022-gia-von-loi-nhuan-bao-gia.md Việc 7 — bảng trực quan lãi/lỗ, dùng lại
// đúng data đã fetch từ GET /quotations/:id/cost-summary ở trang cha (không
// gọi API lần 2). Giá vốn là ƯỚC TÍNH real-time, không phải snapshot.
export interface QuotationMarginItem {
  quotationItemId: string;
  productCode: string;
  productName: string;
  quantity: number;
  costUnitPrice: number;
  saleUnitPrice: number;
  totalCost: number;
  totalSale: number;
  profit: number;
  costAvailable: boolean;
}

export interface QuotationCostSummary {
  items: QuotationMarginItem[];
  totals: { totalCost: number; totalSale: number; profit: number };
  hasIncompleteData: boolean;
}

interface QuotationMarginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationCode: string;
  summary: QuotationCostSummary | null;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
}

export function QuotationMarginDialog({
  open, onOpenChange, quotationCode, summary,
}: QuotationMarginDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lãi/lỗ báo giá {quotationCode}</DialogTitle>
        </DialogHeader>

        {!summary ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Đang tải...</p>
        ) : summary.items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Chưa có sản phẩm nào.</p>
        ) : (
          <div className="space-y-3">
            {summary.hasIncompleteData && (
              <div className="flex items-start gap-2 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Một số sản phẩm chưa có Định mức vật tư đang hoạt động — giá vốn/lợi nhuận bên
                  dưới chưa đầy đủ cho các dòng đó.
                </span>
              </div>
            )}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead className="text-right">SL</TableHead>
                    <TableHead className="text-right">Giá vốn</TableHead>
                    <TableHead className="text-right">Giá bán</TableHead>
                    <TableHead className="text-right">Tổng giá vốn</TableHead>
                    <TableHead className="text-right">Tổng giá bán</TableHead>
                    <TableHead className="text-right">Lợi nhuận</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.items.map((item) => (
                    <TableRow key={item.quotationItemId}>
                      <TableCell>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{item.productCode}</div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {item.costAvailable ? formatMoney(item.costUnitPrice) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {formatMoney(item.saleUnitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.costAvailable ? formatMoney(item.totalCost) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatMoney(item.totalSale)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm font-semibold ${
                          item.profit < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {formatMoney(item.profit)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={4} className="text-right text-sm font-semibold">
                      Tổng cộng
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatMoney(summary.totals.totalCost)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatMoney(summary.totals.totalSale)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-bold ${
                        summary.totals.profit < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {formatMoney(summary.totals.profit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Giá vốn là số ước tính real-time theo Định mức vật tư đang hoạt động — không phải số
              đã khoá cứng như giá bán. Tổng giá bán chưa gồm VAT.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
