"use client";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangeFilter } from "@/components/shared";
import { Search } from "lucide-react";

export interface SalesOrderOwnerOption {
  id: string;
  name: string;
}

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
  createdFrom: string;
  onCreatedFromChange: (v: string) => void;
  createdTo: string;
  onCreatedToChange: (v: string) => void;
  deliveryFrom: string;
  onDeliveryFromChange: (v: string) => void;
  deliveryTo: string;
  onDeliveryToChange: (v: string) => void;
  // "self" = của người đang đăng nhập, "all" = tất cả, hoặc userId cụ thể.
  ownerId: string;
  onOwnerIdChange: (v: string) => void;
  owners: SalesOrderOwnerOption[];
}

export function SalesOrderFilter({
  search,
  onSearchChange,
  tab,
  onTabChange,
  createdFrom,
  onCreatedFromChange,
  createdTo,
  onCreatedToChange,
  deliveryFrom,
  onDeliveryFromChange,
  deliveryTo,
  onDeliveryToChange,
  ownerId,
  onOwnerIdChange,
  owners,
}: SalesOrderFilterProps) {
  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => onTabChange((v as SalesOrderTab) ?? "all")}>
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="in_production">Đang SX</TabsTrigger>
          <TabsTrigger value="production_completed">SX xong</TabsTrigger>
          <TabsTrigger value="shipped">Đã gửi xe</TabsTrigger>
          <TabsTrigger value="delivered">Đã giao</TabsTrigger>
          <TabsTrigger value="cancelled">Đã huỷ</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã đơn, mã BG, tên / SĐT khách hàng..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={ownerId} onValueChange={(v) => onOwnerIdChange(v ?? "all")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Người phụ trách" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả nhân viên</SelectItem>
            <SelectItem value="self">Của tôi</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DateRangeFilter
          label="Ngày tạo"
          dateFrom={createdFrom}
          onDateFromChange={onCreatedFromChange}
          dateTo={createdTo}
          onDateToChange={onCreatedToChange}
        />
        <DateRangeFilter
          label="Hạn giao hàng"
          dateFrom={deliveryFrom}
          onDateFromChange={onDeliveryFromChange}
          dateTo={deliveryTo}
          onDateToChange={onDeliveryToChange}
        />
      </div>
    </div>
  );
}
