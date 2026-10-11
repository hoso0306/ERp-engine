"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loading, ErrorState, EmptyState } from "@/components/shared";
import { apiGet } from "@/lib/api";

type Priority = "HIGH" | "MEDIUM" | "LOW";

interface ReminderRow {
  customerId: string;
  code: string;
  name: string;
  phone: string;
  companyName: string | null;
  priority: Priority;
  lastOrderAt: string | null;
  orderCount: number;
  totalRevenue: number;
  daysSinceLastOrder: number;
  thresholdDays: number;
  overdueDays: number;
}

interface ReminderResponse {
  thresholds: Record<Priority, number>;
  customers: ReminderRow[];
}

// Cùng nhãn/màu với CustomerTable để mức ưu tiên đọc giống nhau toàn trang.
const priorityMap: Record<Priority, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  HIGH: { label: "Cao", variant: "destructive" },
  MEDIUM: { label: "TB", variant: "default" },
  LOW: { label: "Thấp", variant: "secondary" },
};

const FILTERS: { value: Priority | "all"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "HIGH", label: "Cao" },
  { value: "MEDIUM", label: "Trung bình" },
  { value: "LOW", label: "Thấp" },
];

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

// Tab "Khách cần nhắc" (sprint-04/028) — chỉ đọc. Ngưỡng số ngày theo mức
// ưu tiên của khách, chỉnh ở Cài đặt hệ thống → Khách hàng. BE đã lọc khách
// quá ngưỡng + sắp xếp (Cao → Thấp, rồi số ngày quá ngưỡng giảm dần).
export function CustomerReminderPanel() {
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [data, setData] = useState<ReminderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (priority !== "all") params.set("priority", priority);
      setData(await apiGet<ReminderResponse>(`/customers/reminders?${params}`));
    } catch {
      setError("Không thể tải danh sách khách cần nhắc.");
    } finally {
      setLoading(false);
    }
  }, [priority]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-md border p-0.5">
          {FILTERS.map((f) => (
            <Button key={f.value} variant={priority === f.value ? "default" : "ghost"} size="sm" onClick={() => setPriority(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
        {data && (
          <p className="text-xs text-muted-foreground">
            Ngưỡng nhắc: Cao {data.thresholds.HIGH} ngày · TB {data.thresholds.MEDIUM} ngày · Thấp {data.thresholds.LOW} ngày
            {" "}(chỉnh ở Cài đặt → Hệ thống → Khách hàng)
          </p>
        )}
      </div>

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorState description={error} onRetry={fetchData} />
      ) : !data || data.customers.length === 0 ? (
        <EmptyState title="Không có khách cần nhắc" description="Chưa có khách nào vượt ngưỡng số ngày không mua hàng." />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khách hàng</TableHead>
                <TableHead>SĐT</TableHead>
                <TableHead className="text-center">Ưu tiên</TableHead>
                <TableHead>Mua gần nhất</TableHead>
                <TableHead className="text-right">Số ngày không mua</TableHead>
                <TableHead className="text-right">Quá ngưỡng</TableHead>
                <TableHead className="text-right">Số đơn</TableHead>
                <TableHead className="text-right">Tổng doanh số</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.customers.map((c) => {
                const p = priorityMap[c.priority];
                return (
                  <TableRow key={c.customerId}>
                    <TableCell>
                      <Link href={`/customers/${c.customerId}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {c.code}
                        {c.companyName ? ` · ${c.companyName}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{c.phone}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.variant}>{p.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.lastOrderAt ? (
                        new Date(c.lastOrderAt).toLocaleDateString("vi-VN")
                      ) : (
                        <span className="text-muted-foreground">Chưa mua</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{c.daysSinceLastOrder}</TableCell>
                    <TableCell className="text-right text-sm font-medium text-destructive">+{c.overdueDays}</TableCell>
                    <TableCell className="text-right text-sm">{c.orderCount}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatMoney(c.totalRevenue)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
