import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "./stat-tile";

interface StockMaterial {
  id: string;
  code: string;
  name: string;
  currentStock: number;
  minimumStock: number;
  unit: { id: string; name: string };
  outOfStock: boolean;
}

export interface WarehouseOverview {
  inventorySummary: {
    totalMaterials: number;
    totalCurrentStock: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  topConsumedMaterials: {
    materialId: string;
    materialCode: string;
    materialName: string;
    unit: string;
    totalConsumed: number;
  }[];
  lowStockMaterials: StockMaterial[];
  outOfStockMaterials: StockMaterial[];
}

export function WarehouseOverviewPanel({ warehouse }: { warehouse: WarehouseOverview }) {
  const attentionMaterials = [...warehouse.outOfStockMaterials, ...warehouse.lowStockMaterials];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Kho</h3>
        <Button variant="outline" size="sm" render={<Link href="/warehouse" />}>
          Xem tất cả kho
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Tổng số vật tư" value={String(warehouse.inventorySummary.totalMaterials)} />
        <StatTile
          label="Tổng tồn kho hiện tại"
          value={new Intl.NumberFormat("vi-VN").format(warehouse.inventorySummary.totalCurrentStock)}
        />
        <StatTile
          label="Sắp hết hàng"
          value={String(warehouse.inventorySummary.lowStockCount)}
          tone={warehouse.inventorySummary.lowStockCount > 0 ? "danger" : "default"}
        />
        <StatTile
          label="Hết hàng"
          value={String(warehouse.inventorySummary.outOfStockCount)}
          tone={warehouse.inventorySummary.outOfStockCount > 0 ? "danger" : "default"}
        />
      </div>

      {warehouse.topConsumedMaterials.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Top vật tư tiêu thụ</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouse.topConsumedMaterials.map((m) => (
                <TableRow key={m.materialId}>
                  <TableCell>
                    <Link href={`/materials/${m.materialId}`} className="text-primary underline underline-offset-2">
                      {m.materialCode} — {m.materialName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {new Intl.NumberFormat("vi-VN").format(m.totalConsumed)} {m.unit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {attentionMaterials.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vật tư cần chú ý</TableHead>
                <TableHead className="text-right">Tồn hiện tại</TableHead>
                <TableHead className="text-right">Tồn tối thiểu</TableHead>
                <TableHead className="text-center">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attentionMaterials.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link href={`/materials/${m.id}`} className="text-primary underline underline-offset-2">
                      {m.code} — {m.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {new Intl.NumberFormat("vi-VN").format(m.currentStock)} {m.unit.name}
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono">
                    {new Intl.NumberFormat("vi-VN").format(m.minimumStock)} {m.unit.name}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={m.outOfStock ? "destructive" : "secondary"}>
                      {m.outOfStock ? "Hết hàng" : "Sắp hết hàng"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
