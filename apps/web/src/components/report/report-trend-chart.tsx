"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export interface ReportTrendSeries {
  key: string;
  label: string;
  // Token màu theo palette Report (globals.css --chart-1..5) — cùng chỉ số
  // luôn cùng màu giữa các trang report (Task 07).
  color: string;
  formatValue?: (value: number) => string;
}

interface ReportTrendChartProps<T extends { period: string }> {
  // Mỗi phần tử là 1 điểm trên trục thời gian, bắt buộc có field `period`
  // (nhãn bucket 'yyyy-mm-dd' | 'yyyy-mm' | 'yyyy' từ buildSeries() ở BE).
  data: T[];
  series: ReportTrendSeries[];
  // Kỳ ngắn (ngày) dễ đọc dạng cột; kỳ dài (tháng/năm) dùng line cho xu hướng.
  variant?: "line" | "bar";
  height?: number;
}

function formatPeriodLabel(period: string): string {
  const parts = period.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  if (parts.length === 2) return `Th${Number(parts[1])}/${parts[0].slice(2)}`;
  return period;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(value);
}

// Component dùng chung cho mọi report có chuỗi thời gian (A1/A2/A3/B3) — vẽ
// trực tiếp từ dữ liệu bảng đã fetch, không gọi thêm endpoint riêng (report.md
// "Biểu đồ là cách trình bày lại dữ liệu API").
export function ReportTrendChart<T extends { period: string }>({
  data,
  series,
  variant = "line",
  height = 280,
}: ReportTrendChartProps<T>) {
  const chartData = useMemo(
    () => data.map((d) => ({ ...d, __label: formatPeriodLabel(String(d.period)) })),
    [data],
  );

  const chartBody = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
      <XAxis
        dataKey="__label"
        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
        axisLine={{ stroke: "var(--border)" }}
        tickLine={false}
      />
      <YAxis
        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
        axisLine={false}
        tickLine={false}
        width={56}
        tickFormatter={formatCompact}
      />
      <Tooltip
        formatter={(value, name) => {
          const s = series.find((s) => s.label === name);
          const num = typeof value === "number" ? value : Number(value ?? 0);
          return [
            s?.formatValue ? s.formatValue(num) : new Intl.NumberFormat("vi-VN").format(num),
            String(name),
          ];
        }}
        contentStyle={{
          background: "var(--popover)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 12,
          color: "var(--popover-foreground)",
        }}
      />
      {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
      {series.map((s) =>
        variant === "bar" ? (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ) : (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ),
      )}
    </>
  );

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        {variant === "bar" ? (
          <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            {chartBody}
          </BarChart>
        ) : (
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            {chartBody}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
