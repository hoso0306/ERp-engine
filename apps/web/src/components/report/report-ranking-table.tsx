import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface RankingRow {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  percent: number;
  // Drill-down sang trang chi tiết (vd Doanh thu theo xưởng) — optional.
  href?: string;
  // Giá trị cột phụ (vd Lợi nhuận kế hoạch theo xưởng, 031) — chỉ hiển thị
  // khi bảng truyền `extraColumn`.
  extraValue?: number;
}

interface ReportRankingTableProps {
  rows: RankingRow[];
  labelHeader: string;
  valueHeader: string;
  formatValue?: (value: number) => string;
  // Cột phụ tuỳ chọn đặt ngay sau cột giá trị chính — không truyền thì bảng
  // giữ nguyên như cũ (B2/C1/D2 không bị ảnh hưởng).
  extraColumn?: { header: string; format: (value: number) => string };
}

// Bảng xếp hạng dùng chung cho báo cáo group-by (B2 sản phẩm, C1 nhân viên,
// D2 lý do hoàn) — % tỷ trọng hiển thị bằng thanh ngang, không phải chart
// riêng (report.md B2/B4: "bảng xếp hạng thay vì line chart theo ngày").
export function ReportRankingTable({ rows, labelHeader, valueHeader, formatValue, extraColumn }: ReportRankingTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead>{labelHeader}</TableHead>
            <TableHead className="text-right">{valueHeader}</TableHead>
            {extraColumn && <TableHead className="text-right">{extraColumn.header}</TableHead>}
            <TableHead className="w-20 text-right">Tỷ trọng</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.id}>
              <TableCell className="text-center text-sm text-muted-foreground">{index + 1}</TableCell>
              <TableCell>
                <div className="text-sm font-medium">
                  {row.href ? (
                    <Link href={row.href} className="text-primary hover:underline">
                      {row.label}
                    </Link>
                  ) : (
                    row.label
                  )}
                </div>
                {row.sublabel && <div className="text-xs text-muted-foreground">{row.sublabel}</div>}
                <div className="mt-1.5 h-1.5 w-full max-w-40 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-[var(--chart-1)]"
                    style={{ width: `${Math.min(row.percent, 100)}%` }}
                  />
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatValue ? formatValue(row.value) : row.value}
              </TableCell>
              {extraColumn && (
                <TableCell
                  className={`text-right font-mono text-sm ${(row.extraValue ?? 0) < 0 ? "text-destructive" : ""}`}
                >
                  {row.extraValue === undefined ? "—" : extraColumn.format(row.extraValue)}
                </TableCell>
              )}
              <TableCell className="text-right text-sm text-muted-foreground">{row.percent.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
