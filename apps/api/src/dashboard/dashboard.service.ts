import { Injectable } from '@nestjs/common';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { ProductionOrderService } from '../production/production-order.service';
import { DebtService } from '../debt/debt.service';
import { ReturnService } from '../return/return.service';
import { QuotationWorkflowService } from '../quotation/quotation-workflow.service';

// Dashboard không truy cập Prisma/Repository — chỉ gọi Service của module sở
// hữu dữ liệu (Module Ownership, xem knowledge/modules/dashboard.md).
@Injectable()
export class DashboardService {
  constructor(
    private readonly salesOrderService: SalesOrderService,
    private readonly productionOrderService: ProductionOrderService,
    private readonly debtService: DebtService,
    private readonly returnService: ReturnService,
    private readonly quotationService: QuotationWorkflowService,
  ) {}

  // 027-thiet-ke-lai-dashboard-bo-loc-rieng.md — mỗi khối giờ có bộ lọc riêng,
  // độc lập với nhau, FE gọi 5 route riêng (/sales /production /debt /returns
  // /today) thay vì route gộp này. getOverview() GIỮ NGUYÊN không xoá (không
  // biết chắc có nơi khác đang gọi hay không), hành vi cũ không đổi: sales/
  // debt/today luôn all-time/hôm nay, chỉ production/returns theo `range`.
  async getOverview(range?: { from?: Date; to?: Date }) {
    const [sales, production, debt, returns, today, alerts] =
      await Promise.all([
        this.getSalesDashboard(),
        this.getProductionDashboard(range),
        this.getDebtDashboard(),
        this.getReturnDashboard(range),
        this.getTodaySummary(),
        this.getAlerts(),
      ]);

    return { sales, production, debt, returns, today, alerts };
  }

  // Dải "Hôm nay" — khối này giờ có bộ lọc riêng (027-thiet-ke-lai-dashboard-
  // bo-loc-rieng.md mục 5), mặc định "Hôm nay" nhưng đổi được. Không truyền
  // range = giữ đúng hành vi cũ (luôn đúng ngày hôm nay). "Tiền đã thu" tái
  // dùng DebtService.getCashInReport() (đã có sẵn cho Report A2), không viết
  // lại logic đọc Payment.
  async getTodaySummary(range?: { from: Date; to: Date }) {
    const period = range ?? this.getTodayRange();
    const [sales, cashIn] = await Promise.all([
      this.salesOrderService.getTodaySummary(period),
      this.debtService.getCashInReport(period.from, period.to),
    ]);

    return {
      newOrders: sales.newOrders,
      shippedOrders: sales.shippedOrders,
      cashInToday: cashIn.totalCashIn,
    };
  }

  private getTodayRange(): { from: Date; to: Date } {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
      to: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      ),
    };
  }

  // range (027-thiet-ke-lai-dashboard-bo-loc-rieng.md mục 2) — khối Kinh
  // doanh giờ có bộ lọc riêng, mặc định "Hôm nay", áp cả vào 3 tile
  // tiền + 3 tile đếm trong `summary` (đảo ngược quyết định all-time cũ ở
  // 007-bo-loc-thoi-gian-dashboard.md — xem ghi chú chốt lại ở plan mới).
  // `recentOrders` không đổi — vẫn fetch không lọc, FE tự lọc client-side
  // theo đúng filter của khối (giữ nguyên cách làm cũ, không đổi).
  async getSalesDashboard(range?: { from?: Date; to?: Date }) {
    const [summary, recentOrders, companyBorneReturnValue, standaloneAdjustmentValue] =
      await Promise.all([
        this.salesOrderService.getDashboardSummary(range),
        this.salesOrderService.getRecentOrders(),
        // Rà soát nghiệp vụ Return (27/08/2026) — "Tổng doanh thu kế hoạch"
        // trừ đúng phần công ty chịu của Return trong cùng khoảng lọc, KHÔNG
        // trừ toàn bộ Return.totalValue (phần khách chịu công ty vẫn thu đủ
        // tiền, không phải tổn thất doanh thu). Không sửa lợi nhuận kế hoạch
        // — ngoài phạm vi đã xác nhận.
        this.returnService.getTotalCompanyBorneValue(range),
        // Giảm trừ công nợ ĐỘC LẬP (không gắn Return, rà soát nghiệp vụ
        // 27/08/2026) — cũng là tổn thất doanh thu thật, trừ thêm vào cùng
        // KPI. Chỉ lấy returnId = null để không trừ trùng với dòng trên.
        this.debtService.getStandaloneAdjustmentTotal(range),
      ]);

    return {
      summary: {
        ...summary,
        totalRevenue:
          summary.totalRevenue - companyBorneReturnValue - standaloneAdjustmentValue,
      },
      recentOrders,
    };
  }

  // Khối mới "Doanh số theo nhân viên" (rà soát nghiệp vụ Return, 27/08/2026)
  // — đặt dưới khối Kinh doanh, bộ lọc riêng (mặc định "Tháng này" ở FE,
  // luôn truyền from/to cụ thể). Chỉ trả về nhân viên có phát sinh doanh số
  // trong khoảng lọc (getRevenueByEmployee() chỉ nhóm theo ownerId có đơn
  // trong range). Trừ đúng phần công ty chịu của Return cho từng nhân viên.
  async getEmployeeRevenueDashboard(from: Date, to: Date) {
    const [{ employees }, returnByOwner, standaloneByOwner] = await Promise.all([
      this.salesOrderService.getRevenueByEmployee(from, to),
      this.returnService.getCompanyBorneValueByOwner({ from, to }),
      // Giảm trừ công nợ độc lập theo nhân viên (rà soát nghiệp vụ
      // 27/08/2026) — cộng thêm vào cùng phần trừ doanh số, tránh trùng với
      // returnByOwner (getStandaloneAdjustmentByOwner chỉ lấy returnId = null).
      this.debtService.getStandaloneAdjustmentByOwner({ from, to }),
    ]);

    const returnByOwnerId = new Map(
      returnByOwner.map((r) => [r.ownerId, r.companyBorneValue]),
    );
    const standaloneByOwnerId = new Map(
      standaloneByOwner.map((s) => [s.ownerId, s.amount]),
    );

    return employees
      .map((e) => {
        const companyBorneValue = e.ownerId
          ? (returnByOwnerId.get(e.ownerId) ?? 0)
          : 0;
        const standaloneValue = e.ownerId
          ? (standaloneByOwnerId.get(e.ownerId) ?? 0)
          : 0;
        const netRevenue = e.revenue - companyBorneValue - standaloneValue;
        return {
          ownerId: e.ownerId,
          ownerName: e.ownerName,
          orderCount: e.orderCount,
          revenue: netRevenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  // Trang "Tài khoản của tôi" (rà soát nghiệp vụ 27/08/2026) — CHỈ số của
  // CHÍNH userId truyền vào (không nhận ownerId từ bên ngoài, Controller
  // luôn truyền đúng req.user.userId — không lộ số của người khác), nên
  // không cần permission `sales-order.view-cost`/`debt.view` như
  // getEmployeeRevenueDashboard()/getTotalRemainingByOwner() dùng cho người
  // khác. Doanh số/số đơn tái dùng đúng công thức getEmployeeRevenueDashboard()
  // (đã trừ Công ty hỗ trợ + giảm trừ độc lập) — chỉ lọc lấy đúng 1 dòng.
  async getMySummary(userId: string, from: Date, to: Date) {
    const [employees, totalRemainingDebt] = await Promise.all([
      this.getEmployeeRevenueDashboard(from, to),
      this.debtService.getTotalRemainingByOwner(userId),
    ]);
    const mine = employees.find((e) => e.ownerId === userId);
    return {
      revenue: mine?.revenue ?? 0,
      orderCount: mine?.orderCount ?? 0,
      totalRemainingDebt,
    };
  }

  async getProductionDashboard(range?: { from?: Date; to?: Date }) {
    const [summary, busyCenters, progress] = await Promise.all([
      this.productionOrderService.getDashboardSummary(range),
      this.productionOrderService.getBusyCenters(),
      this.productionOrderService.getProgressSummary(),
    ]);

    return { summary, busyCenters, progress };
  }

  // getWarehouseDashboard() đã gỡ hẳn cùng đợt tạm gỡ module Kho khỏi triển
  // khai (18/07/2026 — xem warehouse.md mục "Trạng thái triển khai").

  // upcomingDueDays: nếu không truyền, DebtService tự đọc Settings.Dashboard.upcomingDueDays
  // — Dashboard không hard-code giá trị mặc định (Task 04, 010-cai-dat.md).
  //
  // range (027-thiet-ke-lai-dashboard-bo-loc-rieng.md mục 3-4) — khối Tổng
  // công nợ giờ có bộ lọc riêng, mặc định "Tất cả". Các tile số dư cũ
  // (`summary`/`overdueCustomers`/`upcomingDue`/`creditExceeded`/`topDebtors`)
  // GIỮ NGUYÊN all-time, không đổi theo range (đúng nguyên tắc report.md —
  // công nợ là số dư, không phải số phát sinh theo kỳ). `range` chỉ ảnh
  // hưởng `inRange` (2 tile mới "phát sinh") — null khi chọn "Tất cả" (không
  // đủ 2 mốc from/to cụ thể để tính theo kỳ).
  async getDebtDashboard(
    upcomingDueDays?: number,
    range?: { from?: Date; to?: Date },
  ) {
    const [summary, overdueCustomers, upcomingDue, creditExceeded, topDebtors, inRange] =
      await Promise.all([
        this.debtService.getDashboardSummary(),
        this.debtService.getOverdueCustomers(),
        this.debtService.getUpcomingDueReceivables(upcomingDueDays),
        this.debtService.getCreditLimitExceededCustomers(),
        this.debtService.getTopDebtors(),
        range?.from && range?.to
          ? this.debtService.getReceivablesInRangeSummary(
              range.from,
              range.to,
            )
          : Promise.resolve(null),
      ]);

    return {
      summary,
      overdueCustomers,
      upcomingDue,
      creditExceeded,
      topDebtors,
      inRange,
    };
  }

  async getReturnDashboard(range?: { from?: Date; to?: Date }) {
    const [summary, aging, topReasons, byCustomer] = await Promise.all([
      this.returnService.getDashboardSummary(range),
      this.returnService.getAgingRecoveryInventory(),
      this.returnService.getTopReturnReasons(range),
      this.returnService.getReturnsByCustomer(range),
    ]);

    return { summary, aging, topReasons, byCustomer };
  }

  // Cảnh báo tồn kho (sắp hết/hết hàng) gỡ khỏi Dashboard cùng đợt gỡ khối Kho
  // (chốt 18/07/2026, 007-bo-loc-thoi-gian-dashboard.md — chưa triển khai báo
  // cáo Kho). Còn lại: nợ quá hạn, vượt hạn mức, đơn trễ giao — luôn toàn bộ
  // thời gian, không lọc theo bộ lọc đầu trang.
  async getAlerts() {
    const [
      overdueCustomers,
      creditExceeded,
      delayedOrders,
      pendingQuotations,
      overdueProductionOrders,
    ] = await Promise.all([
      this.debtService.getOverdueCustomers(),
      this.debtService.getCreditLimitExceededCustomers(),
      this.salesOrderService.getDelayedOrders(),
      this.quotationService.getPendingResponseQuotations(),
      this.productionOrderService.getOverdueProductionOrders(),
    ]);

    return {
      overdueDebt: overdueCustomers,
      creditLimitExceeded: creditExceeded,
      delayedOrders,
      pendingQuotations,
      overdueProductionOrders,
    };
  }
}
