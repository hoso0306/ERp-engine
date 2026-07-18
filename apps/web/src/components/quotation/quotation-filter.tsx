"use client";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangeFilter } from "@/components/shared";
import { Search } from "lucide-react";

// Tabs trạng thái (thiết kế chốt 08/07/2026): mặc định "Chờ xử lý" (DRAFT+SENT,
// không giới hạn ngày) — báo giá cũ chưa duyệt không bị ẩn. Lọc ngày là bộ lọc
// riêng, áp dụng cho tab đang chọn.
export type QuotationTab = "pending" | "approved" | "cancelled" | "all";

// Map tab → tham số status của API (hỗ trợ danh sách phân tách dấu phẩy).
export const TAB_STATUS_PARAM: Record<QuotationTab, string | null> = {
  pending: "DRAFT,SENT",
  approved: "APPROVED",
  cancelled: "CANCELLED",
  all: null,
};

interface QuotationFilterProps {
  search: string;
  onSearchChange: (v: string) => void;
  tab: QuotationTab;
  onTabChange: (v: QuotationTab) => void;
  dateFrom: string;
  onDateFromChange: (v: string) => void;
  dateTo: string;
  onDateToChange: (v: string) => void;
}

export function QuotationFilter({
  search,
  onSearchChange,
  tab,
  onTabChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: QuotationFilterProps) {
  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => onTabChange((v as QuotationTab) ?? "pending")}>
        <TabsList>
          <TabsTrigger value="pending">Chờ xử lý</TabsTrigger>
          <TabsTrigger value="approved">Đã duyệt</TabsTrigger>
          <TabsTrigger value="cancelled">Đã huỷ</TabsTrigger>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã BG, tên / SĐT khách hàng..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <DateRangeFilter
          label="Ngày tạo"
          dateFrom={dateFrom}
          onDateFromChange={onDateFromChange}
          dateTo={dateTo}
          onDateToChange={onDateToChange}
        />
      </div>
    </div>
  );
}
