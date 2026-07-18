import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface RankingRow {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  percent: number;
}

interface ReportRankingTableProps {
  rows: RankingRow[];
  labelHeader: string;
  valueHeader: string;
  formatValue?: (value: number) => string;
}

// Bảng xếp hạng dùng chung cho báo cáo group-by (B2 sản phẩm, C1 nhân viên,
// D2 lý do hoàn) — % tỷ trọng hiển thị bằng thanh ngang, không phải chart
// riêng (report.md B2/B4: "bảng xếp hạng thay vì line chart theo ngày").
export function ReportRankingTable({ rows, labelHeader, valueHeader, formatValue }: ReportRankingTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead>{labelHeader}</TableHead>
            <TableHead className="text-right">{valueHeader}</TableHead>
            <TableHead className="w-20 text-right">Tỷ trọng</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.id}>
              <TableCell className="text-center text-sm text-muted-foreground">{index + 1}</TableCell>
              <TableCell>
                <div className="text-sm font-medium">{row.label}</div>
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
              <TableCell className="text-right text-sm text-muted-foreground">{row.percent.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
