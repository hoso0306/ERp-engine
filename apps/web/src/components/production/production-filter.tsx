"use client";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export type ProductionOrderTab = "pending" | "in_production" | "completed" | "cancelled" | "all";

// Map tab → tham số status của API (GET /production-orders?status=...).
export const TAB_STATUS_PARAM: Record<ProductionOrderTab, string | null> = {
  pending: "PENDING",
  in_production: "IN_PRODUCTION",
  completed: "PRODUCTION_COMPLETED",
  cancelled: "CANCELLED",
  all: null,
};

interface ProductionCenterOption {
  id: string;
  code: string;
  name: string;
}

interface ProductionFilterProps {
  search: string;
  onSearchChange: (v: string) => void;
  tab: ProductionOrderTab;
  onTabChange: (v: ProductionOrderTab) => void;
  productionCenters: ProductionCenterOption[];
  productionCenterId: string;
  onProductionCenterChange: (v: string | null) => void;
}

export function ProductionFilter({
  search,
  onSearchChange,
  tab,
  onTabChange,
  productionCenters,
  productionCenterId,
  onProductionCenterChange,
}: ProductionFilterProps) {
  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => onTabChange((v as ProductionOrderTab) ?? "pending")}>
        <TabsList>
          <TabsTrigger value="pending">Chờ SX</TabsTrigger>
          <TabsTrigger value="in_production">Đang SX</TabsTrigger>
          <TabsTrigger value="completed">Hoàn thành</TabsTrigger>
          <TabsTrigger value="cancelled">Đã huỷ</TabsTrigger>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã phiếu, mã đơn / tên khách hàng..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={productionCenterId} onValueChange={onProductionCenterChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Xưởng sản xuất" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả xưởng</SelectItem>
            {productionCenters.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
