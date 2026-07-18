import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportService, ReportRange } from './report.service';
import { ReportExportQueryDto, ReportQueryDto } from './dto/report-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';
import { ExcelService } from '../shared/excel/excel.service';
import { PdfService } from '../shared/pdf/pdf.service';
import type { ReportGroupBy } from '../shared/report-range';

const GROUP_BY_VALUES: ReportGroupBy[] = ['day', 'month', 'year'];

// Report chỉ có Read + Export — không Create/Update/Delete (report.md
// "Vai trò trong ERP"). Một quyền duy nhất report.view cho toàn bộ endpoint
// (014-bao-cao.md Task 01) — không tách quyền theo từng báo cáo ở V1.
@Controller('reports')
@UseGuards(AuthGuard, PermissionGuard)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly excelService: ExcelService,
    private readonly pdfService: PdfService,
  ) {}

  // A1
  @Get('revenue')
  @RequirePermission('report.view')
  getRevenue(@Query() query: ReportQueryDto) {
    return this.reportService.getRevenue(
      this.parseRange(query),
      this.parseGroupBy(query.groupBy),
    );
  }

  // A2
  @Get('cash-in')
  @RequirePermission('report.view')
  getCashIn(@Query() query: ReportQueryDto) {
    return this.reportService.getCashIn(
      this.parseRange(query),
      this.parseGroupBy(query.groupBy),
    );
  }

  // A3
  @Get('profit')
  @RequirePermission('report.view')
  getProfit(@Query() query: ReportQueryDto) {
    return this.reportService.getProfit(
      this.parseRange(query),
      this.parseGroupBy(query.groupBy),
    );
  }

  // A4
  @Get('debt')
  @RequirePermission('report.view')
  getDebt(@Query() query: ReportQueryDto) {
    return this.reportService.getDebt(this.parseRange(query));
  }

  // B1
  @Get('orders')
  @RequirePermission('report.view')
  getOrders(@Query() query: ReportQueryDto) {
    return this.reportService.getOrders(this.parseRange(query));
  }

  // B2
  @Get('revenue-by-product')
  @RequirePermission('report.view')
  getRevenueByProduct(@Query() query: ReportQueryDto) {
    return this.reportService.getRevenueByProduct(this.parseRange(query));
  }

  // B3 — groupBy chỉ nhận month|year (report.md API), mặc định month.
  @Get('growth')
  @RequirePermission('report.view')
  getGrowth(@Query() query: ReportQueryDto) {
    const groupBy = query.groupBy === 'year' ? 'year' : 'month';
    return this.reportService.getGrowth(this.parseRange(query), groupBy);
  }

  // B4
  @Get('growth-by-product-type')
  @RequirePermission('report.view')
  getGrowthByProductType(@Query() query: ReportQueryDto) {
    return this.reportService.getGrowthByProductType(this.parseRange(query));
  }

  // C1
  @Get('revenue-by-employee')
  @RequirePermission('report.view')
  getRevenueByEmployee(@Query() query: ReportQueryDto) {
    return this.reportService.getRevenueByEmployee(this.parseRange(query));
  }

  // C2
  @Get('revenue-by-customer')
  @RequirePermission('report.view')
  getRevenueByCustomer(@Query() query: ReportQueryDto) {
    return this.reportService.getRevenueByCustomer(this.parseRange(query));
  }

  // D2
  @Get('returns')
  @RequirePermission('report.view')
  getReturns(@Query() query: ReportQueryDto) {
    return this.reportService.getReturns(this.parseRange(query));
  }

  // Task 06 — Excel/PDF là bản in của API: cùng dữ liệu, cùng bộ lọc
  // (report.md "Excel & PDF Export"). :name khớp đúng slug endpoint ở trên.
  @Get(':name/export')
  @RequirePermission('report.view')
  async export(
    @Param('name') name: string,
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ) {
    const range = this.parseRange(query);
    const groupBy = this.parseGroupBy(query.groupBy);
    const data = await this.reportService.buildExport(name, range, groupBy);
    const filename = `${name}_${query.from}_${query.to}`;

    if (query.format === 'pdf') {
      const subtitle = await this.reportService.exportSubtitle(range);
      await this.pdfService.export(res, filename, data.columns, data.rows, {
        title: data.title,
        subtitle,
        landscape: data.landscape,
      });
      return;
    }

    await this.excelService.export(res, filename, data.columns, data.rows);
  }

  // Report bắt buộc from/to — không có preset "Tất cả" như Dashboard
  // (report.md "Khác nhau giữa Report và Dashboard"). Cùng pattern parseRange
  // đã dùng ở dashboard.controller.ts, chỉ khác: bắt buộc thay vì optional.
  private parseRange(query: ReportQueryDto): ReportRange {
    if (!query.from || !query.to) {
      throw new BadRequestException('Báo cáo yêu cầu tham số from và to.');
    }
    return {
      from: new Date(`${query.from}T00:00:00`),
      to: new Date(`${query.to}T23:59:59.999`),
    };
  }

  private parseGroupBy(value?: string): ReportGroupBy {
    return GROUP_BY_VALUES.includes(value as ReportGroupBy)
      ? (value as ReportGroupBy)
      : 'day';
  }
}
