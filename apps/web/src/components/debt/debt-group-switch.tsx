"use client";

import Link from "next/link";
import { List, Users, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

interface DebtGroupSwitchProps {
  active: "order" | "customer" | "payments";
}

// 3 route riêng (rà soát tab Công nợ, chốt 26/07/2026, mở rộng 11/08/2026):
// /debts/by-order (theo đơn hàng), /debts/by-customer (gộp theo khách hàng,
// mặc định khi bấm vào mục "Công nợ" ở sidebar — /debts chỉ redirect sang
// đây), /debts/payments (toàn bộ phiếu thu) — điều hướng thật, không phải
// state ẩn trong 1 trang, nên dùng Link chứ không dùng <Tabs> (Tabs điều khiển
// panel cùng trang, không hợp với chuyển route).
export function DebtGroupSwitch({ active }: DebtGroupSwitchProps) {
  const pill = (isActive: boolean) =>
    cn(
      "inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-all",
      isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="inline-flex h-8 items-center gap-[3px] rounded-lg bg-secondary p-[3px]">
      <Link href="/debts/by-customer" className={pill(active === "customer")}>
        <Users className="h-4 w-4" />
        Theo khách hàng
      </Link>
      <Link href="/debts/by-order" className={pill(active === "order")}>
        <List className="h-4 w-4" />
        Theo đơn hàng
      </Link>
      <Link href="/debts/payments" className={pill(active === "payments")}>
        <Banknote className="h-4 w-4" />
        Phiếu thu
      </Link>
    </div>
  );
}
