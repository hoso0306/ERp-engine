import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportService, ReportRange } from './report.service';
import { ReportExportQueryDto, ReportQueryDto } from './dto/report-query.dto';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';
import { PermissionService } from '../permission/permission.service';
import type { AuthenticatedRequest } from '../auth/auth.guard';
import { ExcelService } from '../shared/excel/excel.service';
import { PdfService } from '../shared/pdf/pdf.service';
import type { ReportGroupBy } from '../shared/report-range';

const GROUP_BY_VALUES: ReportGroupBy[] = ['day', 'week', 'month', 'year'];

// Report chỉ có Read + Export — không Create/Update/Delete (report.md
// "Vai trò trong ERP"). Mỗi thẻ báo cáo một quyền `report.<slug>` (029 —
// thay cho `report.view` dùng chung trước đây), slug trùng đúng route.
@Controller('reports')
@UseGuards(AuthGuard, PermissionGuard)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly excelService: ExcelService,
    private readonly pdfService: PdfService,
    private readonly permissionService: PermissionService,
  ) {}

  // A1
  @Get('revenue')
  @RequirePermission('report.revenue')
  getRevenue(@Query() query: ReportQueryDto) {
    return this.reportService.getRevenue(
      this.parseRange(query),
      this.parseGroupBy(query.groupBy),
    );
  }

  // A2
  @Get('cash-in')
  @RequirePermission('report.cash-in')
  getCashIn(@Query() query: ReportQueryDto) {
    return this.reportService.getCashIn(
      this.parseRange(query),
      this.parseGroupBy(query.groupBy),
    );
  }

  // A3
  @Get('profit')
  @RequirePermission('report.profit')
  getProfit(@Query() query: ReportQueryDto) {
    return this.reportService.getProfit(
      this.parseRange(query),
      this.parseGroupBy(query.groupBy),
    );
  }

  // A4
  @Get('debt')
  @RequirePermission('report.debt')
  getDebt(@Query() query: ReportQueryDto) {
    return this.reportService.getDebt(this.parseRange(query));
  }

  // B1
  @Get('orders')
  @RequirePermission('report.orders')
  getOrders(@Query() query: ReportQueryDto) {
    return this.reportService.getOrders(this.parseRange(query));
  }

  // B2
  @Get('revenue-by-product')
  @RequirePermission('report.revenue-by-product')
  getRevenueByProduct(@Query() query: ReportQueryDto) {
    return this.reportService.getRevenueByProduct(this.parseRange(query));
  }

  // B3 — groupBy chỉ nhận week|month|year, mặc định month.
  @Get('growth')
  @RequirePermission('report.growth')
  getGrowth(@Query() query: ReportQueryDto) {
    return this.reportService.getGrowth(
      this.parseRange(query),
      this.parseWeekMonthYearGroupBy(query.groupBy),
    );
  }

  // B4 — groupBy chỉ nhận week|month|year, mặc định month.
  @Get('growth-by-product-type')
  @RequirePermission('report.growth-by-product-type')
  getGrowthByProductType(@Query() query: ReportQueryDto) {
    return this.reportService.getGrowthByProductType(
      this.parseRange(query),
      this.parseWeekMonthYearGroupBy(query.groupBy),
    );
  }

  // C1
  @Get('revenue-by-employee')
  @RequirePermission('report.revenue-by-employee')
  getRevenueByEmployee(@Query() query: ReportQueryDto) {
    return this.reportService.getRevenueByEmployee(this.parseRange(query));
  }

  // C2
  @Get('revenue-by-customer')
  @RequirePermission('report.revenue-by-customer')
  getRevenueByCustomer(@Query() query: ReportQueryDto) {
    return this.reportService.getRevenueByCustomer(this.parseRange(query));
  }

  // Nhóm Sản xuất — Doanh thu theo xưởng (sprint-04/028).
  @Get('revenue-by-production-center')
  @RequirePermission('report.revenue-by-production-center')
  getRevenueByProductionCenter(@Query() query: ReportQueryDto) {
    return this.reportService.getRevenueByProductionCenter(
      this.parseRange(query),
    );
  }

  @Get('revenue-by-production-center/:id')
  @RequirePermission('report.revenue-by-production-center')
  getProductionCenterRevenue(
    @Param('id') id: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getProductionCenterRevenue(
      id,
      this.parseRange(query),
      this.parseGroupBy(query.groupBy),
    );
  }

  // D2
  @Get('returns')
  @RequirePermission('report.returns')
  getReturns(@Query() query: ReportQueryDto) {
    return this.reportService.getReturns(this.parseRange(query));
  }

  // Task 06 — Excel/PDF là bản in của API: cùng dữ liệu, cùng bộ lọc
  // (report.md "Excel & PDF Export"). :name khớp đúng slug endpoint ở trên.
  // Phân quyền theo từng báo cáo (029): `:name` động nên không gắn được
  // @RequirePermission tĩnh — kiểm tra `report.${name}` ngay trong method
  // (slug export trùng đúng action quyền). Không có decorator thì
  // PermissionGuard cho qua, nên check dưới đây là nguồn duy nhất.
  @Get(':name/export')
  async export(
    @Param('name') name: string,
    @Query() query: ReportExportQueryDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const permissionKey = `report.${name}`;
    const roleId = req.user?.roleId;
    if (
      !roleId ||
      !(await this.permissionService.hasPermission(roleId, permissionKey))
    ) {
      throw new ForbiddenException(`Không có quyền "${permissionKey}".`);
    }
    const range = this.parseRange(query);
    const groupBy =
      name === 'growth' || name === 'growth-by-product-type'
        ? this.parseWeekMonthYearGroupBy(query.groupBy)
        : this.parseGroupBy(query.groupBy);
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

  private parseWeekMonthYearGroupBy(value?: string): 'week' | 'month' | 'year' {
    return value === 'week' || value === 'year' ? value : 'month';
  }
}
