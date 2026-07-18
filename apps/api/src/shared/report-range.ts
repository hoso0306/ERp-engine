// Helper cắt kỳ cho Module Báo cáo (report.md mục "Nguyên tắc mốc ngày").
// Mọi phép GROUP BY theo ngày/tháng/năm phải chuyển mốc thời gian (lưu UTC)
// về Settings.Company.timezone trước khi cắt kỳ — nếu không, đơn chốt 23h
// ngày 31/07 giờ VN sẽ rơi nhầm sang tháng 8.
//
// Đây là pure function trình bày lại thời gian — không phải Business Logic.

export type ReportGroupBy = 'day' | 'month' | 'year';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// en-CA cho định dạng ISO yyyy-mm-dd sẵn, chỉ cần cắt chuỗi theo groupBy.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function isoDateInTimezone(date: Date, timezone: string): string {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatterCache.set(timezone, formatter);
  }
  return formatter.format(date);
}

// 'day' → '2026-07-18' | 'month' → '2026-07' | 'year' → '2026'
export function bucketDate(
  date: Date,
  timezone: string,
  groupBy: ReportGroupBy,
): string {
  const iso = isoDateInTimezone(date, timezone);
  if (groupBy === 'year') return iso.slice(0, 4);
  if (groupBy === 'month') return iso.slice(0, 7);
  return iso;
}

// Kỳ liền trước có cùng độ dài — phục vụ "so sánh kỳ trước" (A1/A3).
export function previousRange(
  from: Date,
  to: Date,
): { from: Date; to: Date } {
  const length = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - length);
  return { from: prevFrom, to: prevTo };
}

// Liệt kê đầy đủ các bucket giữa from–to (kể cả bucket không có dữ liệu) để
// chuỗi thời gian trên biểu đồ không bị đứt quãng. Bước nhảy theo ngày là đủ
// cho cả 3 mức groupBy (dedupe qua Set), timezone VN không có DST.
export function enumerateBuckets(
  from: Date,
  to: Date,
  timezone: string,
  groupBy: ReportGroupBy,
): string[] {
  const buckets: string[] = [];
  const seen = new Set<string>();
  for (
    let t = from.getTime();
    t <= to.getTime();
    t += MS_PER_DAY
  ) {
    const bucket = bucketDate(new Date(t), timezone, groupBy);
    if (!seen.has(bucket)) {
      seen.add(bucket);
      buckets.push(bucket);
    }
  }
  const lastBucket = bucketDate(to, timezone, groupBy);
  if (!seen.has(lastBucket)) buckets.push(lastBucket);
  return buckets;
}

// Gom một danh sách bản ghi {date, values} thành chuỗi theo bucket — dùng
// chung cho mọi report có chuỗi thời gian (A1/A2/A3/B3/B4). Trả về đủ bucket
// trống (giá trị 0) theo enumerateBuckets.
export function buildSeries<K extends string>(
  rows: { date: Date; values: Record<K, number> }[],
  from: Date,
  to: Date,
  timezone: string,
  groupBy: ReportGroupBy,
  valueKeys: K[],
): ({ period: string } & Record<K, number>)[] {
  const emptyValues = () =>
    Object.fromEntries(valueKeys.map((k) => [k, 0])) as Record<K, number>;

  const byBucket = new Map<string, Record<K, number>>();
  for (const bucket of enumerateBuckets(from, to, timezone, groupBy)) {
    byBucket.set(bucket, emptyValues());
  }

  for (const row of rows) {
    const bucket = bucketDate(row.date, timezone, groupBy);
    const acc = byBucket.get(bucket) ?? emptyValues();
    for (const key of valueKeys) {
      acc[key] += row.values[key];
    }
    byBucket.set(bucket, acc);
  }

  return Array.from(byBucket.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, values]) => ({ period, ...values }));
}
