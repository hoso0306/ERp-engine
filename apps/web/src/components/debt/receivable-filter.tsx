"use client";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

export type ReceivableTab = "all" | "overdue" | "credit_exceeded";

interface ReceivableFilterProps {
  search: string;
  onSearchChange: (v: string) => void;
  tab: ReceivableTab;
  onTabChange: (v: ReceivableTab) => void;
  risk: string;
  onRiskChange: (v: string) => void;
  paymentStatus: string;
  onPaymentStatusChange: (v: string) => void;
}

export function ReceivableFilter({
  search,
  onSearchChange,
  tab,
  onTabChange,
  risk,
  onRiskChange,
  paymentStatus,
  onPaymentStatusChange,
}: ReceivableFilterProps) {
  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => onTabChange((v as ReceivableTab) ?? "all")}>
        <TabsList>
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="overdue">Quá hạn</TabsTrigger>
          <TabsTrigger value="credit_exceeded">Vượt hạn mức</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo mã đơn, tên / SĐT khách hàng..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={risk} onValueChange={(v) => onRiskChange(v ?? "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Mức rủi ro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả mức rủi ro</SelectItem>
            <SelectItem value="LOW">Thấp</SelectItem>
            <SelectItem value="MEDIUM">Trung bình</SelectItem>
            <SelectItem value="HIGH">Cao</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentStatus} onValueChange={(v) => onPaymentStatusChange(v ?? "all")}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Trạng thái thanh toán" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả thanh toán</SelectItem>
            <SelectItem value="UNPAID">Chưa thanh toán</SelectItem>
            <SelectItem value="PARTIALLY_PAID">Thanh toán một phần</SelectItem>
            <SelectItem value="PAID">Đã thanh toán</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
