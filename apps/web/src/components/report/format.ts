// Định dạng dùng chung cho toàn bộ 11 trang report (Task 08) — tránh lặp
// Intl.NumberFormat/toLocaleDateString ở từng trang.

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

// Chọn groupBy theo độ dài kỳ đã chọn — kỳ ngắn xem theo ngày, kỳ dài gộp
// theo tháng/năm cho biểu đồ không bị rối (dùng cho A1/A2/A3, report.md B3
// dùng riêng month|year do BE giới hạn).
export function autoGroupBy(from: string, to: string): "day" | "month" | "year" {
  const days = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
  if (days <= 62) return "day";
  if (days <= 731) return "month";
  return "year";
}
