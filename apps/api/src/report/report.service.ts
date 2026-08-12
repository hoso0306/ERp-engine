import { BadRequestException, Injectable } from '@nestjs/common';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { DebtService } from '../debt/debt.service';
import { CustomerService } from '../customer/customer.service';
import { ReturnService } from '../return/return.service';
import { SettingService } from '../setting/setting.service';
import type { ReportGroupBy } from '../shared/report-range';
import type { ExcelColumn } from '../shared/excel/excel.service';
import type { PdfColumn } from '../shared/pdf/pdf.service';

export interface ReportRange {
  from: Date;
  to: Date;
}

// Bản mô tả dữ liệu export (Task 06) — dùng chung cho cả Excel lẫn PDF để
// hai định dạng không bao giờ lệch nhau, và không lệch với API (cùng một
// method đọc tạo ra dữ liệu).
export interface ReportExportData {
  title: string;
  columns: (ExcelColumn & PdfColumn)[];
  rows: Record<string, unknown>[];
  landscape?: boolean;
}

// Nhãn tiếng Việt cho enum khi export — chỉ phục vụ trình bày, không phải
// Business Logic.
const SALES_ORDER_STATUS_LABELS: Record<string, string> = {
  IN_PRODUCTION: 'Đang sản xuất',
  PRODUCTION_COMPLETED: 'Hoàn thành sản xuất',
  SHIPPED: 'Đã gửi xe',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã huỷ',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIALLY_PAID: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
};

// Khớp đúng enum ReturnReason (schema.prisma) — cùng nhãn với FE
// (apps/web/src/components/return/return-reason-label.ts).
const RETURN_REASON_LABELS: Record<string, string> = {
  WRONG_SIZE: 'Sai kích thước',
  WRONG_COLOR: 'Sai màu',
  WRONG_MODEL: 'Sai mẫu',
  PRODUCTION_DEFECT: 'Lỗi sản xuất',
  INSTALLATION_DEFECT: 'Lỗi lắp đặt',
  CUSTOMER_CHANGED_MIND: 'Khách đổi ý',
  OTHER: 'Khác',
};

// Khớp enum PaymentType (schema.prisma) — chỉ dùng cho export "Xuất dữ liệu
// backup" bên dưới.
const PAYMENT_TYPE_LABELS: Record<string, string> = {
  NORMAL: 'Thường',
  REVERSAL: 'Đảo chiều',
};

// Khớp enum Priority/CustomerStatus (schema.prisma) — chỉ dùng cho export
// "Xuất dữ liệu backup" bên dưới, cùng nhãn đã dùng ở FE (customer-table.tsx).
const CUSTOMER_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
};

const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
};

// Report là Presentation Layer (report.md): không Prisma, không Business
// Logic — chỉ gọi Service của module sở hữu dữ liệu và trình bày lại.
@Injectable()
export class ReportService {
  constructor(
    private readonly salesOrderService: SalesOrderService,
    private readonly debtService: DebtService,
    private readonly customerService: CustomerService,
    private readonly returnService: ReturnService,
    private readonly settingService: SettingService,
  ) {}

  // ─────────────────────────────────────────────────────
  // Nhóm A — Tài chính (Task 02)
  // ─────────────────────────────────────────────────────

  // A1
  getRevenue(range: ReportRange, groupBy: ReportGroupBy = 'day') {
    return this.salesOrderService.getRevenueReport(
      range.from,
      range.to,
      groupBy,
    );
  }

  // A2 — Actual, không cộng lẫn với A1/A3 (Planned).
  getCashIn(range: ReportRange, groupBy: ReportGroupBy = 'day') {
    return this.debtService.getCashInReport(range.from, range.to, groupBy);
  }

  // A3 — nhãn bắt buộc "Lợi nhuận kế hoạch".
  getProfit(range: ReportRange, groupBy: ReportGroupBy = 'day') {
    return this.salesOrderService.getProfitReport(range.from, range.to, groupBy);
  }

  // A4 — tách rõ balance / inRange (DebtService chịu trách nhiệm cấu trúc).
  getDebt(range: ReportRange) {
    return this.debtService.getDebtReport(range.from, range.to);
  }

  // ─────────────────────────────────────────────────────
  // Nhóm B — Bán hàng (Task 03)
  // ─────────────────────────────────────────────────────

  // B1
  getOrders(range: ReportRange) {
    return this.salesOrderService.getOrdersReport(range.from, range.to);
  }

  // B2
  getRevenueByProduct(range: ReportRange) {
    return this.salesOrderService.getRevenueByProduct(range.from, range.to);
  }

  // B3 — KHÔNG phải method mới: gọi lại A1/A2/A3 với groupBy tháng/năm, gộp
  // 3 kết quả. % tăng trưởng tính runtime từ chính chuỗi đã trả về.
  async getGrowth(range: ReportRange, groupBy: 'month' | 'year' = 'month') {
    const [revenue, cashIn, profit] = await Promise.all([
      this.getRevenue(range, groupBy),
      this.getCashIn(range, groupBy),
      this.getProfit(range, groupBy),
    ]);

    // 3 chuỗi cùng range + groupBy nên bucket trùng nhau — gộp theo period.
    const cashInByPeriod = new Map(
      cashIn.series.map((p) => [p.period, p.cashIn]),
    );
    const profitByPeriod = new Map(
      profit.series.map((p) => [p.period, p.plannedProfit]),
    );

    const series = revenue.series.map((point, index, all) => {
      const previous = index > 0 ? all[index - 1].revenue : null;
      // Cùng kỳ năm trước: period 'yyyy-mm' → '(yyyy-1)-mm', 'yyyy' → 'yyyy-1'.
      const lastYearPeriod = String(Number(point.period.slice(0, 4)) - 1).concat(
        point.period.slice(4),
      );
      const lastYear = all.find((p) => p.period === lastYearPeriod);

      return {
        period: point.period,
        revenue: point.revenue,
        orderCount: point.orderCount,
        cashIn: cashInByPeriod.get(point.period) ?? 0,
        plannedProfit: profitByPeriod.get(point.period) ?? 0,
        // Derived, runtime — không lưu (Task 03 DoD).
        revenueGrowthPercent:
          previous !== null && previous > 0
            ? ((point.revenue - previous) / previous) * 100
            : null,
        revenueGrowthYoYPercent:
          lastYear && lastYear.revenue > 0
            ? ((point.revenue - lastYear.revenue) / lastYear.revenue) * 100
            : null,
      };
    });

    return {
      groupBy,
      totals: {
        revenue: revenue.totalRevenue,
        cashIn: cashIn.totalCashIn,
        plannedProfit: profit.totalPlannedProfit,
      },
      series,
    };
  }

  // B4 — groupBy chỉ nhận week|month|year, mặc định month.
  getGrowthByProductType(
    range: ReportRange,
    groupBy: 'week' | 'month' | 'year' = 'month',
  ) {
    return this.salesOrderService.getGrowthByProductType(
      range.from,
      range.to,
      groupBy,
    );
  }

  // ─────────────────────────────────────────────────────
  // Nhóm C — Con người (Task 04)
  // ─────────────────────────────────────────────────────

  // C1
  getRevenueByEmployee(range: ReportRange) {
    return this.salesOrderService.getRevenueByEmployee(range.from, range.to);
  }

  // C2 — gộp 3 nguồn: doanh thu theo khách (Sales Order) + khách mới trong kỳ
  // (Customer) + công nợ hiện tại từng khách (Debt, realtime — không lưu).
  async getRevenueByCustomer(range: ReportRange) {
    const [byCustomer, newCustomers] = await Promise.all([
      this.salesOrderService.getRevenueByCustomer(range.from, range.to),
      this.customerService.getNewCustomersInRange(range.from, range.to),
    ]);

    const remainingByCustomer = await this.debtService.getRemainingByCustomers(
      byCustomer.customers.map((c) => c.customerId),
    );

    return {
      totalRevenue: byCustomer.totalRevenue,
      customers: byCustomer.customers.map((c) => ({
        ...c,
        currentDebt: remainingByCustomer.get(c.customerId) ?? 0,
      })),
      newCustomers,
    };
  }

  // ─────────────────────────────────────────────────────
  // Nhóm D — Vận hành (Task 05, chỉ D2 — D1 Kho tạm gỡ, không import
  // WarehouseService)
  // ─────────────────────────────────────────────────────

  // D2 — tái dùng nguyên 3 method ReturnService đã xây cho Dashboard, chỉ
  // khác: from/to bắt buộc. Giá trị hoàn hiển thị riêng, không trừ doanh thu.
  async getReturns(range: ReportRange) {
    const [summary, topReasons, byCustomer] = await Promise.all([
      this.returnService.getDashboardSummary(range),
      this.returnService.getTopReturnReasons(range),
      this.returnService.getReturnsByCustomer(range),
    ]);

    return { summary, topReasons, byCustomer };
  }

  // ─────────────────────────────────────────────────────
  // Export (Task 06) — Excel/PDF là bản in của API: cùng method đọc, cùng bộ
  // lọc, không chỉ số riêng.
  // ─────────────────────────────────────────────────────

  async buildExport(
    name: string,
    range: ReportRange,
    groupBy?: ReportGroupBy,
  ): Promise<ReportExportData> {
    switch (name) {
      case 'revenue':
        return this.buildRevenueExport(range, groupBy ?? 'day');
      case 'cash-in':
        return this.buildCashInExport(range, groupBy ?? 'day');
      case 'profit':
        return this.buildProfitExport(range, groupBy ?? 'day');
      case 'debt':
        return this.buildDebtExport(range);
      case 'orders':
        return this.buildOrdersExport(range);
      case 'revenue-by-product':
        return this.buildRevenueByProductExport(range);
      case 'growth':
        return this.buildGrowthExport(
          range,
          groupBy === 'year' ? 'year' : 'month',
        );
      case 'growth-by-product-type':
        return this.buildGrowthByProductTypeExport(
          range,
          groupBy === 'week' || groupBy === 'year' ? groupBy : 'month',
        );
      case 'revenue-by-employee':
        return this.buildRevenueByEmployeeExport(range);
      case 'revenue-by-customer':
        return this.buildRevenueByCustomerExport(range);
      case 'returns':
        return this.buildReturnsExport(range);
      // Xuất dữ liệu backup (report.md mục "Xuất dữ liệu backup") — NGOÀI
      // catalog 14 báo cáo phân tích, chỉ dùng chung route/hạ tầng export.
      case 'orders-list':
        return this.buildOrdersListExport(range);
      case 'receivables-list':
        return this.buildReceivablesListExport(range);
      case 'payments-list':
        return this.buildPaymentsListExport(range);
      case 'customers-list':
        return this.buildCustomersListExport(range);
      default:
        throw new BadRequestException(`Báo cáo "${name}" không tồn tại.`);
    }
  }

  // Dòng tiêu đề bắt buộc của file export: kỳ báo cáo + thời điểm xuất
  // (report.md mục "Excel & PDF Export").
  async exportSubtitle(range: ReportRange): Promise<string> {
    let timezone = 'Asia/Ho_Chi_Minh';
    try {
      timezone = (await this.settingService.getCompany()).timezone;
    } catch {
      /* dùng mặc định */
    }
    const dateFormat: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    };
    const fromLabel = range.from.toLocaleDateString('vi-VN', dateFormat);
    const toLabel = range.to.toLocaleDateString('vi-VN', dateFormat);
    const exportedAt = new Date().toLocaleString('vi-VN', {
      timeZone: timezone,
    });
    return `Kỳ báo cáo: ${fromLabel} – ${toLabel} • Xuất lúc: ${exportedAt}`;
  }

  private async buildRevenueExport(
    range: ReportRange,
    groupBy: ReportGroupBy,
  ): Promise<ReportExportData> {
    const data = await this.getRevenue(range, groupBy);
    return {
      title: 'Báo cáo doanh thu',
      columns: [
        { header: 'Kỳ', key: 'period', width: 16 },
        { header: 'Số đơn', key: 'orderCount', width: 12, align: 'right' },
        { header: 'Doanh thu', key: 'revenue', width: 20, align: 'right' },
      ],
      rows: [
        ...data.series.map((p) => ({
          period: p.period,
          orderCount: p.orderCount,
          revenue: p.revenue,
        })),
        {
          period: 'Tổng',
          orderCount: data.orderCount,
          revenue: data.totalRevenue,
        },
      ],
    };
  }

  private async buildCashInExport(
    range: ReportRange,
    groupBy: ReportGroupBy,
  ): Promise<ReportExportData> {
    const data = await this.getCashIn(range, groupBy);
    return {
      title: 'Báo cáo tiền mặt về',
      columns: [
        { header: 'Kỳ', key: 'period', width: 16 },
        { header: 'Số phiếu thu', key: 'paymentCount', width: 14, align: 'right' },
        { header: 'Tiền về', key: 'cashIn', width: 20, align: 'right' },
      ],
      rows: [
        ...data.series.map((p) => ({
          period: p.period,
          paymentCount: p.paymentCount,
          cashIn: p.cashIn,
        })),
        {
          period: 'Tổng',
          paymentCount: data.paymentCount,
          cashIn: data.totalCashIn,
        },
        ...data.byMethod.map((m) => ({
          period: `Trong đó: ${PAYMENT_METHOD_LABELS[m.paymentMethod] ?? m.paymentMethod}`,
          paymentCount: m.count,
          cashIn: m.amount,
        })),
      ],
    };
  }

  private async buildProfitExport(
    range: ReportRange,
    groupBy: ReportGroupBy,
  ): Promise<ReportExportData> {
    const data = await this.getProfit(range, groupBy);
    return {
      title: 'Báo cáo lợi nhuận kế hoạch',
      columns: [
        { header: 'Kỳ', key: 'period', width: 16 },
        { header: 'Doanh thu', key: 'revenue', width: 18, align: 'right' },
        { header: 'Giá vốn kế hoạch', key: 'plannedCost', width: 18, align: 'right' },
        { header: 'Lợi nhuận kế hoạch', key: 'plannedProfit', width: 20, align: 'right' },
      ],
      rows: [
        ...data.series.map((p) => ({
          period: p.period,
          revenue: p.revenue,
          plannedCost: p.plannedCost,
          plannedProfit: p.plannedProfit,
        })),
        {
          period: 'Tổng',
          revenue: data.totalRevenue,
          plannedCost: data.totalPlannedCost,
          plannedProfit: data.totalPlannedProfit,
        },
      ],
    };
  }

  private async buildDebtExport(range: ReportRange): Promise<ReportExportData> {
    const data = await this.getDebt(range);
    const rows: Record<string, unknown>[] = [
      { label: '— SỐ DƯ HIỆN TẠI (không theo kỳ) —', value: '' },
      { label: 'Tổng còn phải thu', value: data.balance.totalRemaining },
      {
        label: `Quá hạn (${data.balance.overdueCount} phiếu)`,
        value: data.balance.overdueAmount,
      },
      {
        label: `Rủi ro thấp — quá hạn ≤ 7 ngày (${data.balance.byRiskLevel.LOW.count} phiếu)`,
        value: data.balance.byRiskLevel.LOW.amount,
      },
      {
        label: `Rủi ro trung bình — quá hạn 8-30 ngày (${data.balance.byRiskLevel.MEDIUM.count} phiếu)`,
        value: data.balance.byRiskLevel.MEDIUM.amount,
      },
      {
        label: `Rủi ro cao — quá hạn > 30 ngày (${data.balance.byRiskLevel.HIGH.count} phiếu)`,
        value: data.balance.byRiskLevel.HIGH.amount,
      },
      ...data.balance.creditExceeded.map((c) => ({
        label: `Vượt hạn mức: ${c.customerName} (hạn mức ${c.debtLimit})`,
        value: c.totalRemaining,
      })),
      ...data.balance.topDebtors.map((d, i) => ({
        label: `Top nợ #${i + 1}: ${d.customerName}`,
        value: d.totalRemaining,
      })),
      { label: '— PHÁT SINH TRONG KỲ —', value: '' },
      {
        label: `Công nợ mới (${data.inRange.newReceivableCount} phiếu)`,
        value: data.inRange.newReceivableAmount,
      },
      {
        label: `Tiền thu trong kỳ (${data.inRange.cashIn.paymentCount} phiếu thu)`,
        value: data.inRange.cashIn.totalCashIn,
      },
    ];
    return {
      title: 'Báo cáo công nợ',
      columns: [
        { header: 'Chỉ tiêu', key: 'label', width: 48 },
        { header: 'Giá trị', key: 'value', width: 20, align: 'right' },
      ],
      rows,
    };
  }

  private async buildOrdersExport(
    range: ReportRange,
  ): Promise<ReportExportData> {
    const data = await this.getOrders(range);
    return {
      title: 'Báo cáo đơn hàng',
      columns: [
        { header: 'Chỉ tiêu', key: 'label', width: 40 },
        { header: 'Giá trị', key: 'value', width: 20, align: 'right' },
      ],
      rows: [
        { label: 'Tổng số đơn', value: data.totalOrders },
        { label: 'Tổng giá trị', value: data.totalValue },
        { label: 'Giá trị trung bình/đơn', value: Math.round(data.averageOrderValue) },
        ...data.byStatus.map((s) => ({
          label: `Theo trạng thái: ${SALES_ORDER_STATUS_LABELS[s.status] ?? s.status}`,
          value: s.count,
        })),
        ...data.byPaymentStatus.map((s) => ({
          label: `Theo thanh toán: ${PAYMENT_STATUS_LABELS[s.paymentStatus] ?? s.paymentStatus}`,
          value: s.count,
        })),
        {
          label: `Giao đúng hạn (trên ${data.delivery.evaluated} đơn đã giao)`,
          value: data.delivery.onTime,
        },
        { label: 'Giao trễ hạn', value: data.delivery.late },
        {
          label: 'Tỷ lệ đúng hạn (%)',
          value:
            data.delivery.onTimePercent !== null
              ? Math.round(data.delivery.onTimePercent * 10) / 10
              : '—',
        },
      ],
    };
  }

  private async buildRevenueByProductExport(
    range: ReportRange,
  ): Promise<ReportExportData> {
    const data = await this.getRevenueByProduct(range);
    return {
      title: 'Cơ cấu doanh thu theo sản phẩm',
      columns: [
        { header: 'Mã SP', key: 'productCode', width: 14 },
        { header: 'Sản phẩm', key: 'productName', width: 32 },
        { header: 'Số lượng', key: 'quantity', width: 12, align: 'right' },
        { header: 'Doanh thu', key: 'revenue', width: 18, align: 'right' },
        { header: 'Tỷ trọng (%)', key: 'revenuePercent', width: 12, align: 'right' },
      ],
      rows: [
        ...data.products.map((p) => ({
          productCode: p.productCode,
          productName: p.productName,
          quantity: p.quantity,
          revenue: p.revenue,
          revenuePercent: Math.round(p.revenuePercent * 10) / 10,
        })),
        {
          productCode: '',
          productName: 'Tổng',
          quantity: '',
          revenue: data.totalRevenue,
          revenuePercent: 100,
        },
      ],
    };
  }

  private async buildGrowthExport(
    range: ReportRange,
    groupBy: 'month' | 'year',
  ): Promise<ReportExportData> {
    const data = await this.getGrowth(range, groupBy);
    return {
      title: `Báo cáo tốc độ phát triển (theo ${groupBy === 'month' ? 'tháng' : 'năm'})`,
      landscape: true,
      columns: [
        { header: 'Kỳ', key: 'period', width: 12 },
        { header: 'Doanh thu', key: 'revenue', width: 18, align: 'right' },
        { header: 'Tiền mặt về', key: 'cashIn', width: 18, align: 'right' },
        { header: 'Lợi nhuận kế hoạch', key: 'plannedProfit', width: 18, align: 'right' },
        { header: '% so kỳ trước', key: 'growth', width: 14, align: 'right' },
        { header: '% cùng kỳ năm trước', key: 'growthYoY', width: 16, align: 'right' },
      ],
      rows: data.series.map((p) => ({
        period: p.period,
        revenue: p.revenue,
        cashIn: p.cashIn,
        plannedProfit: p.plannedProfit,
        growth:
          p.revenueGrowthPercent !== null
            ? Math.round(p.revenueGrowthPercent * 10) / 10
            : '—',
        growthYoY:
          p.revenueGrowthYoYPercent !== null
            ? Math.round(p.revenueGrowthYoYPercent * 10) / 10
            : '—',
      })),
    };
  }

  private async buildGrowthByProductTypeExport(
    range: ReportRange,
    groupBy: 'week' | 'month' | 'year',
  ): Promise<ReportExportData> {
    const data = await this.getGrowthByProductType(range, groupBy);
    const groupByLabel =
      groupBy === 'week' ? 'tuần' : groupBy === 'year' ? 'năm' : 'tháng';
    return {
      title: `Tốc độ phát triển theo nhóm sản phẩm (theo ${groupByLabel})`,
      landscape: data.periods.length > 4,
      columns: [
        { header: 'Nhóm sản phẩm', key: 'productTypeName', width: 28 },
        ...data.periods.map((p) => ({
          header: p,
          key: `period_${p}`,
          width: 14,
          align: 'right' as const,
        })),
        { header: 'Tổng', key: 'total', width: 16, align: 'right' },
      ],
      rows: data.productTypes.map((t) => ({
        productTypeName: t.productTypeName,
        ...Object.fromEntries(
          t.byPeriod.map((p) => [`period_${p.period}`, p.revenue]),
        ),
        total: t.revenue,
      })),
    };
  }

  private async buildRevenueByEmployeeExport(
    range: ReportRange,
  ): Promise<ReportExportData> {
    const data = await this.getRevenueByEmployee(range);
    return {
      title: 'Doanh thu theo nhân viên',
      columns: [
        { header: 'Nhân viên', key: 'ownerName', width: 28 },
        { header: 'Số đơn', key: 'orderCount', width: 12, align: 'right' },
        { header: 'Doanh thu', key: 'revenue', width: 18, align: 'right' },
        { header: 'Tỷ trọng (%)', key: 'revenuePercent', width: 12, align: 'right' },
      ],
      rows: [
        ...data.employees.map((e) => ({
          ownerName: e.ownerName ?? 'Không xác định',
          orderCount: e.orderCount,
          revenue: e.revenue,
          revenuePercent: Math.round(e.revenuePercent * 10) / 10,
        })),
        {
          ownerName: 'Tổng',
          orderCount: data.employees.reduce((s, e) => s + e.orderCount, 0),
          revenue: data.totalRevenue,
          revenuePercent: 100,
        },
      ],
    };
  }

  private async buildRevenueByCustomerExport(
    range: ReportRange,
  ): Promise<ReportExportData> {
    const data = await this.getRevenueByCustomer(range);
    return {
      title: 'Doanh thu theo khách hàng',
      landscape: true,
      columns: [
        { header: 'Khách hàng', key: 'customerName', width: 28 },
        { header: 'SĐT', key: 'customerPhone', width: 14 },
        { header: 'Số đơn', key: 'orderCount', width: 10, align: 'right' },
        { header: 'Doanh thu', key: 'revenue', width: 18, align: 'right' },
        { header: 'Mua lần đầu', key: 'firstOrderAt', width: 14 },
        { header: 'Mua gần nhất', key: 'lastOrderAt', width: 14 },
        { header: 'Công nợ hiện tại', key: 'currentDebt', width: 16, align: 'right' },
      ],
      rows: [
        ...data.customers.map((c) => ({
          customerName: c.customerName,
          customerPhone: c.customerPhone,
          orderCount: c.orderCount,
          revenue: c.revenue,
          firstOrderAt: c.firstOrderAt
            ? c.firstOrderAt.toLocaleDateString('vi-VN')
            : '',
          lastOrderAt: c.lastOrderAt
            ? c.lastOrderAt.toLocaleDateString('vi-VN')
            : '',
          currentDebt: c.currentDebt,
        })),
        {
          customerName: `Khách mới trong kỳ: ${data.newCustomers.count}`,
          customerPhone: '',
          orderCount: '',
          revenue: data.totalRevenue,
          firstOrderAt: '',
          lastOrderAt: '',
          currentDebt: '',
        },
      ],
    };
  }

  private async buildReturnsExport(
    range: ReportRange,
  ): Promise<ReportExportData> {
    const data = await this.getReturns(range);
    return {
      title: 'Báo cáo hàng hoàn',
      columns: [
        { header: 'Chỉ tiêu', key: 'label', width: 44 },
        { header: 'Giá trị', key: 'value', width: 20, align: 'right' },
      ],
      rows: [
        { label: 'Số phiếu trả hàng trong kỳ', value: data.summary.returnsInRange },
        {
          label: 'Số sản phẩm hoàn trong kỳ',
          value: data.summary.totalProductsReturnedInRange,
        },
        {
          // Giá trị hoàn hiển thị riêng — không trừ vào doanh thu (return.md).
          label: 'Giá trị hàng hoàn (theo giá bán)',
          value: data.summary.returnValueInRange,
        },
        ...data.topReasons.map((r) => ({
          label: `Lý do: ${RETURN_REASON_LABELS[r.reason] ?? r.reason} (${r.percent}%)`,
          value: r.count,
        })),
        ...data.byCustomer.map((c) => ({
          label: `Khách: ${c.customerName}`,
          value: c.returnCount,
        })),
      ],
    };
  }

  // ─────────────────────────────────────────────────────
  // Xuất dữ liệu backup (report.md mục "Xuất dữ liệu backup") — liệt kê
  // TOÀN BỘ bản ghi trong kỳ (KHÔNG loại CANCELLED, khác Quy tắc loại trừ
  // của 14 báo cáo phân tích ở trên) — phục vụ backup dữ liệu, không phải
  // phân tích kinh doanh.
  // ─────────────────────────────────────────────────────

  private async buildOrdersListExport(
    range: ReportRange,
  ): Promise<ReportExportData> {
    const orders = await this.salesOrderService.getAllOrdersRaw(
      range.from,
      range.to,
    );
    return {
      title: 'Xuất dữ liệu backup — Đơn hàng',
      landscape: true,
      columns: [
        { header: 'Mã đơn', key: 'code', width: 14 },
        { header: 'Mã báo giá', key: 'quotationCode', width: 14 },
        { header: 'Khách hàng', key: 'customerName', width: 24 },
        { header: 'SĐT', key: 'customerPhone', width: 14, numFmt: '@' },
        { header: 'Trạng thái', key: 'status', width: 18 },
        { header: 'Thanh toán', key: 'paymentStatus', width: 16 },
        { header: 'Tổng tiền', key: 'totalAmount', width: 16, align: 'right' },
        { header: 'VAT', key: 'totalVatAmount', width: 14, align: 'right' },
        { header: 'Giảm giá', key: 'discountAmount', width: 14, align: 'right' },
        { header: 'Phí ship', key: 'shippingFee', width: 12, align: 'right' },
        { header: 'Tổng thanh toán', key: 'grandTotal', width: 16, align: 'right' },
        { header: 'Giá vốn KH', key: 'plannedCost', width: 14, align: 'right' },
        { header: 'Lợi nhuận KH', key: 'plannedProfit', width: 14, align: 'right' },
        { header: 'Nhân viên phụ trách', key: 'ownerName', width: 20 },
        { header: 'Ngày giao dự kiến', key: 'expectedDeliveryDate', width: 16 },
        { header: 'Ngày giao thực tế', key: 'actualDeliveryDate', width: 16 },
        { header: 'Ngày tạo', key: 'createdAt', width: 16 },
      ],
      rows: orders.map((o) => ({
        code: o.code,
        quotationCode: o.quotationCode,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        status: SALES_ORDER_STATUS_LABELS[o.status] ?? o.status,
        paymentStatus: PAYMENT_STATUS_LABELS[o.paymentStatus] ?? o.paymentStatus,
        totalAmount: Number(o.totalAmount),
        totalVatAmount: Number(o.totalVatAmount),
        discountAmount: Number(o.discountAmount),
        shippingFee: Number(o.shippingFee),
        grandTotal: Number(o.grandTotal),
        plannedCost: Number(o.plannedCost),
        plannedProfit: Number(o.plannedProfit),
        ownerName: o.ownerName ?? '',
        expectedDeliveryDate: o.expectedDeliveryDate
          ? o.expectedDeliveryDate.toLocaleDateString('vi-VN')
          : '',
        actualDeliveryDate: o.actualDeliveryDate
          ? o.actualDeliveryDate.toLocaleDateString('vi-VN')
          : '',
        createdAt: o.createdAt.toLocaleDateString('vi-VN'),
      })),
    };
  }

  private async buildReceivablesListExport(
    range: ReportRange,
  ): Promise<ReportExportData> {
    const receivables = await this.debtService.getAllReceivablesRaw(
      range.from,
      range.to,
    );
    return {
      title: 'Xuất dữ liệu backup — Công nợ',
      landscape: true,
      columns: [
        { header: 'Mã đơn hàng', key: 'orderCode', width: 14 },
        { header: 'Khách hàng', key: 'customerName', width: 24 },
        { header: 'SĐT', key: 'customerPhone', width: 14, numFmt: '@' },
        { header: 'Tổng tiền', key: 'totalAmount', width: 16, align: 'right' },
        { header: 'Đã thu', key: 'paidAmount', width: 16, align: 'right' },
        { header: 'Còn lại', key: 'remainingAmount', width: 16, align: 'right' },
        { header: 'Tổng trước VAT', key: 'totalAmountBeforeVat', width: 16, align: 'right' },
        { header: 'Còn lại trước VAT', key: 'remainingAmountBeforeVat', width: 16, align: 'right' },
        { header: 'Hạn thanh toán', key: 'dueDate', width: 14 },
        { header: 'Đóng không xuất HĐ', key: 'closedWithoutVat', width: 16 },
        { header: 'Ngày tạo', key: 'createdAt', width: 16 },
      ],
      rows: receivables.map((r) => ({
        orderCode: r.salesOrder.code,
        customerName: r.salesOrder.customerName,
        customerPhone: r.salesOrder.customerPhone,
        totalAmount: Number(r.totalAmount),
        paidAmount: Number(r.paidAmount),
        remainingAmount: Number(r.remainingAmount),
        totalAmountBeforeVat: Number(r.totalAmountBeforeVat),
        remainingAmountBeforeVat: Number(r.remainingAmountBeforeVat),
        dueDate: r.dueDate ? r.dueDate.toLocaleDateString('vi-VN') : '',
        closedWithoutVat: r.closedWithoutVat ? 'Có' : 'Không',
        createdAt: r.createdAt.toLocaleDateString('vi-VN'),
      })),
    };
  }

  private async buildPaymentsListExport(
    range: ReportRange,
  ): Promise<ReportExportData> {
    const payments = await this.debtService.getAllPaymentsRaw(
      range.from,
      range.to,
    );
    return {
      title: 'Xuất dữ liệu backup — Thanh toán',
      landscape: true,
      columns: [
        { header: 'Mã phiếu thu', key: 'code', width: 14 },
        { header: 'Ngày thu', key: 'paymentDate', width: 14 },
        { header: 'Số tiền', key: 'amount', width: 16, align: 'right' },
        { header: 'Hình thức TT', key: 'paymentMethod', width: 16 },
        { header: 'Loại', key: 'type', width: 12 },
        { header: 'Số tham chiếu', key: 'referenceNumber', width: 18 },
        { header: 'Người tạo', key: 'createdBy', width: 18 },
        { header: 'Ghi chú', key: 'note', width: 24 },
        { header: 'Ngày tạo', key: 'createdAt', width: 16 },
      ],
      rows: payments.map((p) => ({
        code: p.code,
        paymentDate: p.paymentDate.toLocaleDateString('vi-VN'),
        amount: Number(p.amount),
        paymentMethod: PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod,
        type: PAYMENT_TYPE_LABELS[p.type] ?? p.type,
        referenceNumber: p.referenceNumber ?? '',
        createdBy: p.createdBy ?? '',
        note: p.note ?? '',
        createdAt: p.createdAt.toLocaleDateString('vi-VN'),
      })),
    };
  }

  private async buildCustomersListExport(
    range: ReportRange,
  ): Promise<ReportExportData> {
    const customers = await this.customerService.getAllCustomersRaw(
      range.from,
      range.to,
    );
    return {
      title: 'Xuất dữ liệu backup — Khách hàng',
      landscape: true,
      columns: [
        { header: 'Mã KH', key: 'code', width: 12 },
        { header: 'Tên khách hàng', key: 'name', width: 24 },
        { header: 'SĐT', key: 'phone', width: 14, numFmt: '@' },
        { header: 'Email', key: 'email', width: 22 },
        { header: 'Tên công ty', key: 'companyName', width: 22 },
        { header: 'Mã số thuế', key: 'taxCode', width: 14, numFmt: '@' },
        { header: 'Địa chỉ', key: 'address', width: 30 },
        { header: 'Nhóm KH', key: 'groupName', width: 16 },
        { header: 'Tuyến GH', key: 'routeName', width: 16 },
        { header: 'Ưu tiên', key: 'priority', width: 12 },
        { header: 'Trạng thái', key: 'status', width: 16 },
        { header: 'Hạn mức CN', key: 'debtLimit', width: 14, align: 'right' },
        { header: 'Thời hạn CN (ngày)', key: 'debtTermDays', width: 14, align: 'right' },
        { header: 'Ngày tạo', key: 'createdAt', width: 16 },
      ],
      rows: customers.map((c) => ({
        code: c.code,
        name: c.name,
        phone: c.phone,
        email: c.email ?? '',
        companyName: c.companyName ?? '',
        taxCode: c.taxCode ?? '',
        address: [c.address, c.ward, c.district, c.province]
          .filter(Boolean)
          .join(', '),
        groupName: c.customerGroup?.name ?? '',
        routeName: c.deliveryRoute?.name ?? '',
        priority: CUSTOMER_PRIORITY_LABELS[c.priority] ?? c.priority,
        status: CUSTOMER_STATUS_LABELS[c.status] ?? c.status,
        debtLimit: Number(c.debtLimit),
        debtTermDays: c.debtTermDays,
        createdAt: c.createdAt.toLocaleDateString('vi-VN'),
      })),
    };
  }
}
