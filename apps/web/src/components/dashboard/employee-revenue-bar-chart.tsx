"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export interface EmployeeRevenueBarRow {
  ownerId: string | null;
  ownerName: string | null;
  revenue: number;
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(value);
}

// Biểu đồ cột so sánh doanh số nhân viên (trang "Tài khoản của tôi", rà soát
// nghiệp vụ 27/08/2026) — 1 cột/nhân viên, chỉ vẽ nhân viên đã phát sinh
// doanh thu trong kỳ (data truyền vào đã lọc sẵn từ BE, không lọc lại ở đây).
// Khác ReportTrendChart (chuỗi thời gian, trục X là period) — đây là dữ liệu
// phân loại (categorical), trục X là tên nhân viên, nên viết component riêng
// thay vì ép dùng lại ReportTrendChart.
export function EmployeeRevenueBarChart({
  data,
  height = 280,
}: {
  data: EmployeeRevenueBarRow[];
  height?: number;
}) {
  const chartData = data.map((d) => ({
    name: d.ownerName ?? "Không xác định",
    revenue: d.revenue,
  }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={formatCompact}
          />
          <Tooltip
            formatter={(value) => [formatMoney(Number(value ?? 0)), "Doanh số"]}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
          />
          <Bar dataKey="revenue" name="Doanh số" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
