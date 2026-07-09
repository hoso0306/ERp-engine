"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";

export type SalesOrderTab =
  | "in_production"
  | "production_completed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "all";

// Map tab → tham số status của API (GET /sales-orders?status=...).
export const TAB_STATUS_PARAM: Record<SalesOrderTab, string | null> = {
  in_production: "IN_PRODUCTION",
  production_completed: "PRODUCTION_COMPLETED",
  shipped: "SHIPPED",
  delivered: "DELIVERED",
  cancelled: "CANCELLED",
  all: null,
};

interface SalesOrderFilterProps {
  search: string;
  onSearchChange: (v: string) => void;
  tab: SalesOrderTab;
  onTabChange: (v: SalesOrderTab) => void;
  deliveryFrom: string;
  onDeliveryFromChange: (v: string) => void;
  deliveryTo: string;
  onDeliveryToChange: (v: string) => void;
}

export function SalesOrderFilter({
  search,
  onSearchChange,
  tab,
  onTabChange,
  deliveryFrom,
  onDeliveryFromChange,
  deliveryTo,
  onDeliveryToChange,
}: SalesOrderFilterProps) {
  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => onTabChange((v as SalesOrderTab) ?? "in_production")}>
        <TabsList>
          <TabsTrigger value="in_production">Đang SX</TabsTrigger>
          <TabsTrigger value="production_completed">SX xong</TabsTrigger>
          <TabsTrigger value="shipped">Đã gửi xe</TabsTrigger>
          <TabsTrigger value="delivered">Đã giao</TabsTrigger>
          <TabsTrigger value="cancelled">Đã huỷ</TabsTrigger>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã đơn, mã BG, tên / SĐT khách hàng..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="delivery-from" className="text-sm text-muted-foreground whitespace-nowrap">
            Giao từ ngày
          </Label>
          <Input
            id="delivery-from"
            type="date"
            value={deliveryFrom}
            onChange={(e) => onDeliveryFromChange(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="delivery-to" className="text-sm text-muted-foreground whitespace-nowrap">
            Đến ngày
          </Label>
          <Input
            id="delivery-to"
            type="date"
            value={deliveryTo}
            onChange={(e) => onDeliveryToChange(e.target.value)}
            className="w-40"
          />
        </div>
      </div>
    </div>
  );
}
