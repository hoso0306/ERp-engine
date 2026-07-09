"use client";

import { Fragment, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Parameter {
  name: string;
  label: string;
  value: string;
  unit: string | null;
}

interface BomMaterial {
  materialCode: string;
  materialName: string;
  materialUnit: string | null;
  quantity: number;
}

interface ProductionOrderItemRow {
  id: string;
  productCode: string;
  productName: string;
  quantity: number;
  parameters: Parameter[];
  bomMaterials: BomMaterial[];
}

interface ProductionItemTableProps {
  items: ProductionOrderItemRow[];
}

export function ProductionItemTable({ items }: ProductionItemTableProps) {
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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Sản phẩm</TableHead>
            <TableHead>Thông số</TableHead>
            <TableHead className="text-right">Số lượng</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const hasBom = item.bomMaterials.length > 0;
            const isOpen = expanded.has(item.id);
            return (
              <Fragment key={item.id}>
                <TableRow
                  className={hasBom ? "cursor-pointer" : undefined}
                  onClick={() => hasBom && toggle(item.id)}
                >
                  <TableCell>
                    {hasBom && (
                      isOpen
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{item.productName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{item.productCode}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground w-56">
                    <div className="space-y-0.5">
                      {item.parameters.length > 0
                        ? item.parameters.map((p) => (
                            <div key={p.name} className="truncate max-w-[220px]">
                              <span className="text-muted-foreground/70">{p.label}:</span>{" "}
                              {p.value}{p.unit ? ` ${p.unit}` : ""}
                            </div>
                          ))
                        : "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">{Number(item.quantity)}</TableCell>
                </TableRow>
                {isOpen && hasBom && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell />
                    <TableCell colSpan={3} className="py-3">
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        BOM — vật tư cần cho {item.productName}
                      </div>
                      <div className="rounded-md border bg-background">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Vật tư</TableHead>
                              <TableHead className="text-right text-xs">Số lượng</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {item.bomMaterials.map((b, idx) => (
                              <TableRow key={`${b.materialCode}-${idx}`}>
                                <TableCell className="text-sm">
                                  <span className="font-mono text-xs text-muted-foreground">{b.materialCode}</span>
                                  {" — "}
                                  {b.materialName}
                                </TableCell>
                                <TableCell className="text-right text-sm font-mono">
                                  {Number(b.quantity).toLocaleString("vi-VN", { maximumFractionDigits: 4 })}
                                  {b.materialUnit ? ` ${b.materialUnit}` : ""}
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
        </TableBody>
      </Table>
    </div>
  );
}
