"use client";

import { RecoveryInventoryStatusBadge } from "./recovery-inventory-status-badge";
import { RETURN_REASON_LABEL } from "./return-reason-label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Parameter {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

interface RecoveryInventory {
  id: string;
  code: string;
  quantity: number;
  status: string;
  location: string | null;
}

interface ReturnItemRow {
  id: string;
  productCode: string;
  productName: string;
  productParameters: Parameter[] | null;
  orderedQuantity: number;
  returnedQuantity: number;
  unitPriceSnapshot: number;
  reason: string;
  note: string | null;
  recoveryInventory: RecoveryInventory | null;
}

interface ReturnItemTableProps {
  items: ReturnItemRow[];
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

export function ReturnItemTable({ items }: ReturnItemTableProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Chưa có sản phẩm nào.</p>;
  }

  const grandTotal = items.reduce((s, i) => s + Number(i.returnedQuantity) * Number(i.unitPriceSnapshot), 0);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sản phẩm</TableHead>
            <TableHead>Thông số</TableHead>
            <TableHead className="text-right">SL đặt / trả</TableHead>
            <TableHead className="text-right">Đơn giá</TableHead>
            <TableHead className="text-right">Thành tiền</TableHead>
            <TableHead>Lý do</TableHead>
            <TableHead>Thu hồi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const subtotal = Number(item.returnedQuantity) * Number(item.unitPriceSnapshot);
            const parameters = item.productParameters ?? [];
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.productName}</div>
                  <div className="text-xs text-muted-foreground font-mono">{item.productCode}</div>
                  {item.note && (
                    <div className="text-xs text-muted-foreground italic mt-1">{item.note}</div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground w-48">
                  <div className="space-y-0.5">
                    {parameters.length > 0
                      ? parameters.map((p) => (
                          <div key={p.name} className="truncate max-w-[180px]">
                            <span className="text-muted-foreground/70">{p.label}:</span>{" "}
                            {p.value}{p.unit ? ` ${p.unit}` : ""}
                          </div>
                        ))
                      : "—"}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm">
                  {Number(item.orderedQuantity)} / {Number(item.returnedQuantity)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatMoney(Number(item.unitPriceSnapshot))}
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {formatMoney(subtotal)}
                </TableCell>
                <TableCell className="text-sm">
                  {RETURN_REASON_LABEL[item.reason] ?? item.reason}
                </TableCell>
                <TableCell className="text-xs">
                  {item.recoveryInventory ? (
                    <div className="space-y-0.5">
                      <div className="font-mono">{item.recoveryInventory.code}</div>
                      <RecoveryInventoryStatusBadge status={item.recoveryInventory.status} />
                      {item.recoveryInventory.location && (
                        <div className="text-muted-foreground">{item.recoveryInventory.location}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-muted/50">
            <TableCell colSpan={4} className="text-right text-sm font-medium">
              Tổng giá trị hàng trả
            </TableCell>
            <TableCell className="text-right font-mono font-bold">
              {formatMoney(grandTotal)}
            </TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
