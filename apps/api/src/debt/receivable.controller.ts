import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { DebtService } from './debt.service';
import { ReceivableQueryDto } from './dto/receivable-query.dto';
import { ReceivableByCustomerQueryDto } from './dto/receivable-by-customer-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';
import { PdfService } from '../shared/pdf/pdf.service';
import { ExcelService } from '../shared/excel/excel.service';

@Controller('receivables')
@UseGuards(AuthGuard, PermissionGuard)
export class ReceivableController {
  constructor(
    private readonly debtService: DebtService,
    private readonly pdfService: PdfService,
    private readonly excelService: ExcelService,
  ) {}

  // Không có Create/Update/Delete API cho Receivable — chỉ ERP tự sinh/tự cập nhật.

  // Đăng ký trước ':id' để tránh 'dashboard' bị nuốt bởi route động.
  @Get('dashboard')
  @RequirePermission('debt.view')
  getOwnerDashboard() {
    return this.debtService.getOwnerDashboard();
  }

  // Danh sách Receivable còn nợ của 1 khách hàng, sort FIFO — phục vụ preview
  // trước khi xác nhận POST /payments/allocate (023-cong-no-payment-allocation-fifo).
  // Đăng ký trước ':id' cùng lý do trên.
  @Get('open-by-customer/:customerId')
  @RequirePermission('debt.view')
  getOpenByCustomer(@Param('customerId') customerId: string) {
    return this.debtService.getOpenReceivablesForCustomer(customerId);
  }

  // Preview cấn trừ FIFO trước khi xác nhận POST /payments/allocate (rà soát
  // tab Công nợ, 11/08/2026) — gộp cả Công nợ đầu kỳ, khác open-by-customer ở
  // trên (chỉ Receivable). Đăng ký trước ':id' cùng lý do các route literal khác.
  @Get('fifo-preview/:customerId')
  @RequirePermission('debt.view')
  getFifoPreview(@Param('customerId') customerId: string) {
    return this.debtService.getFifoPreviewForCustomer(customerId);
  }

  // Trang "Theo khách hàng" (rà soát tab Công nợ, chốt 26/07/2026) — đăng ký
  // trước ':id' cùng lý do các route literal khác ở trên.
  @Get('by-customer')
  @RequirePermission('debt.view')
  findAllByCustomer(@Query() query: ReceivableByCustomerQueryDto) {
    return this.debtService.findReceivablesByCustomer(query);
  }

  // "In PDF"/"Xuất Excel" ở trang Theo khách hàng (rà soát 27/08/2026) — cùng
  // bộ lọc với findAllByCustomer(), TOÀN BỘ kết quả khớp bộ lọc, không phân
  // trang. Chọn định dạng qua query `format` (cùng convention report.md
  // "Excel & PDF Export": mặc định xlsx nếu không truyền).
  @Get('by-customer/export')
  @RequirePermission('debt.view')
  async exportByCustomer(
    @Query() query: ReceivableByCustomerQueryDto,
    @Res() res: Response,
  ) {
    if (query.format === 'pdf') {
      const { title, columns, body } =
        await this.debtService.buildReceivablesByCustomerExport(query);
      await this.pdfService.exportGrouped(
        res,
        'cong-no-theo-khach-hang',
        columns,
        body,
        {
          title,
          subtitle: this.exportSubtitle(),
          landscape: true,
        },
      );
      return;
    }
    const { groupColumns, itemColumns, groups } =
      await this.debtService.buildReceivablesByCustomerExcelExport(query);
    await this.excelService.exportGrouped(
      res,
      'cong-no-theo-khach-hang',
      groupColumns,
      itemColumns,
      groups,
    );
  }

  @Get()
  @RequirePermission('debt.view')
  findAll(@Query() query: ReceivableQueryDto) {
    return this.debtService.findAllReceivables(query);
  }

  // "In PDF"/"Xuất Excel" ở trang Theo đơn hàng (rà soát 27/08/2026) — cùng
  // bộ lọc với findAll(), TOÀN BỘ kết quả khớp bộ lọc, không phân trang.
  // Chọn định dạng qua query `format` (mặc định xlsx nếu không truyền).
  // Đăng ký trước ':id' — nếu không NestJS sẽ khớp "export" như 1 giá trị :id.
  @Get('export')
  @RequirePermission('debt.view')
  async exportReceivables(
    @Query() query: ReceivableQueryDto,
    @Res() res: Response,
  ) {
    if (query.format === 'pdf') {
      const { title, columns, rows } =
        await this.debtService.buildReceivablesExport(query);
      await this.pdfService.export(
        res,
        'cong-no-theo-don-hang',
        columns,
        rows,
        {
          title,
          subtitle: this.exportSubtitle(),
          landscape: true,
        },
      );
      return;
    }
    const { columns, rows } =
      await this.debtService.buildReceivablesExcelExport(query);
    await this.excelService.export(res, 'cong-no-theo-don-hang', columns, rows);
  }

  @Get(':id')
  @RequirePermission('debt.view')
  findOne(@Param('id') id: string) {
    return this.debtService.findOneReceivable(id);
  }

  // Dòng phụ bắt buộc theo convention "Excel & PDF Export" (report.md) — thời
  // điểm xuất. Khác Report: trang Công nợ không có khoảng ngày bắt buộc nên
  // không có "Kỳ báo cáo" đi kèm.
  private exportSubtitle(): string {
    const exportedAt = new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    return `Xuất lúc: ${exportedAt}`;
  }
}
