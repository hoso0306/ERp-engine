// Query chung cho mọi endpoint Report (014-bao-cao.md Task 02) — from/to
// ISO date string (yyyy-mm-dd), BẮT BUỘC: Report không có "Tất cả" như
// preset Dashboard. groupBy chỉ áp dụng cho báo cáo có chuỗi thời gian.
export class ReportQueryDto {
  from?: string;
  to?: string;
  groupBy?: string;
}

export class ReportExportQueryDto extends ReportQueryDto {
  // 'xlsx' (mặc định) | 'pdf'
  format?: string;
}
