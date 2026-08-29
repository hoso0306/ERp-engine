# Kế hoạch: Bảng DebtAdjustment thống nhất + Giảm trừ công nợ độc lập + Tab lịch sử khách hàng

Ngày: 2026-08-27
Trạng thái: Đã chốt, đang triển khai (user yêu cầu làm luôn sau khi lên plan).

## Bối cảnh

Đang có 3 việc gộp lại từ cùng 1 mạch trao đổi:

1. `Return.debtAdjustedAt/debtAdjustedAmount/debtAdjustedByName` hiện lưu cộng dồn thủ công trên chính Return (vừa sửa sáng nay) — nhưng đây là Derived Data có thể tính trực tiếp từ nguồn với chi phí thấp, nên thay bằng 1 bảng nguồn thật `DebtAdjustment`, Return chỉ query lại.
2. Cần thêm nút "Giảm trừ công nợ" **độc lập**, không bắt buộc gắn Return, dùng ngay từ tab Công nợ (không đi qua luồng tạo phiếu hoàn). Vẫn giảm Receivable, trừ doanh thu kế hoạch + doanh số nhân viên, KHÔNG vào dòng tiền mặt.
3. Tab mới "Lịch sử giảm trừ/công nợ đầu kỳ" trong Customer Debt Tab (cạnh "Tiến trình thanh toán"/"Phiếu thu") — gộp lịch sử: giảm trừ do hoàn hàng, giảm trừ độc lập, và tăng công nợ do tạo Công nợ đầu kỳ. Mỗi dòng lưu người tạo + thời gian.

## 1. Schema

### Model mới `DebtAdjustment`

```prisma
model DebtAdjustment {
  id           String   @id @default(cuid())
  receivableId String   @map("receivable_id")
  // Redundant reference (copy ID bất biến) — tránh join khi query theo khách
  // hàng/đơn hàng, cùng convention Return.customerId/ownerId.
  customerId   String   @map("customer_id")
  salesOrderId String   @map("sales_order_id")
  returnId     String?  @map("return_id")

  amount Decimal @db.Decimal(15, 0)
  reason String

  // Người phụ trách để tính "Doanh số theo nhân viên" (KHÔNG phải người bấm
  // nút). Có returnId -> copy từ Return.ownerId/ownerName. Không có (giảm
  // trừ độc lập) -> mặc định copy từ SalesOrder.ownerId/ownerName tại thời
  // điểm tạo. Plain field, không @relation, cùng convention Return.ownerId.
  ownerId   String? @map("owner_id")
  ownerName String? @map("owner_name")

  // Người thực hiện thao tác (kế toán) + thời gian — luôn bắt buộc lưu.
  createdBy     String?  @map("created_by")
  createdByName String?  @map("created_by_name")
  createdAt     DateTime @default(now()) @map("created_at")

  receivable    Receivable @relation(fields: [receivableId], references: [id])
  createdByUser User?      @relation(fields: [createdBy], references: [id], onDelete: SetNull)

  @@index([customerId, createdAt])
  @@index([returnId])
  @@index([salesOrderId])
  @@map("debt_adjustments")
}
```

- `receivableId`: relation thật (append-only, giống SalesOrderTimeline.salesOrderId) — Receivable có back-relation `debtAdjustments DebtAdjustment[]`.
- `customerId`/`salesOrderId`/`returnId`/`ownerId`: redundant reference thuần, không `@relation` — tránh phải thêm back-relation array vào SalesOrder/Return/User cho use case chỉ cần lọc theo ID.
- Không lưu `returnCode` (khác với JSON payload Timeline cũ) — cần thì join `return.code` lúc đọc, chi phí thấp vì luôn kèm `returnId`.

### Return — bỏ 3 field lưu cộng dồn

Xoá `debtAdjustedAt`, `debtAdjustedAmount`, `debtAdjustedByName` khỏi model `Return` (migration DROP COLUMN). `ReturnService.findOne()` sẽ tự tính lại 3 giá trị này (cùng tên, để FE không phải đổi) bằng cách query `DebtAdjustment where returnId = id`:
- `debtAdjustedAmount` = SUM(amount), NULL nếu chưa có dòng nào.
- `debtAdjustedAt` = createdAt của dòng mới nhất.
- `debtAdjustedByName` = createdByName của dòng mới nhất.

→ `returns/[id]/page.tsx` và `debt-adjustment-gate.tsx` **không cần sửa** (interface field name giữ nguyên).

### Backfill dữ liệu cũ

Trước khi xoá cột trên Return, chạy 1 script one-off (ts-node, không đụng seed.ts) convert các `SalesOrderTimeline` có `action = DEBT_MANUAL_ADJUSTED` (payload có `returnId`) thành bản ghi `DebtAdjustment` tương ứng, suy ra `customerId`/`ownerId`/`ownerName` từ Return/SalesOrder liên quan — đúng nguyên tắc Timeline First, không mất lịch sử khi đổi cách lưu.

## 2. Backend logic

### `DebtService.manualAdjustment()`

- Bỏ đoạn fetch+update `Return.debtAdjustedAmount` cộng dồn (vừa thêm sáng nay).
- Sau khi decrement Receivable + ghi `SalesOrderTimeline` (giữ nguyên, không đổi — vẫn là lịch sử theo đơn hàng), thêm bước tạo `DebtAdjustment`:
  - Nếu có `dto.returnId`: lấy `ownerId/ownerName` từ Return.
  - Nếu không: lấy từ `receivable.salesOrder.ownerId/ownerName` (mở rộng include ban đầu của `manualAdjustment()` để có 2 field này).
- `ManualAdjustmentDto` **không đổi** — FE không cần gửi thêm gì, ownerId luôn suy ra ở BE.

### Query mới cho Dashboard (trong `DebtService`)

- `getStandaloneAdjustmentTotal(range?)`: SUM(amount) từ `DebtAdjustment where returnId = null`, lọc theo `createdAt` nếu có range.
- `getStandaloneAdjustmentByOwner(range?)`: groupBy `ownerId`, cùng điều kiện `returnId = null`.

Lý do tách riêng "standalone" (returnId null): phần Return-driven ĐÃ được `ReturnService.getTotalCompanyBorneValue()/getCompanyBorneValueByOwner()` tính (từ `Return.totalValue - customerBorneAmount`, độc lập với việc đã bấm giảm trừ hay chưa — giữ nguyên hành vi cũ, xem "Phần KPI" đã chốt trước đó). Nếu cộng cả Return-driven từ `DebtAdjustment` nữa sẽ bị trừ trùng.

### `DashboardService`

- `getSalesDashboard()`: `totalRevenue -= (returnService.getTotalCompanyBorneValue(range) + debtService.getStandaloneAdjustmentTotal(range))`.
- `getEmployeeRevenueDashboard()`: merge 2 mảng theo `ownerId` (Return-driven + standalone), cộng dồn `companyBorneValue`.
- Cần inject `DebtService` vào `DashboardModule`/`DashboardService` (hiện chưa có).

### API mới — lịch sử theo khách hàng

`GET /debt-adjustments/by-customer/:customerId` (controller mới `DebtAdjustmentController`, cùng thư mục `debt/`, permission `debt.view`) — trả về danh sách gộp, sort `createdAt desc`, phân trang (page/limit) + lọc khoảng ngày (from/to), gồm 2 nguồn:
- `DebtAdjustment` (customerId match) — loại `RETURN` (có returnId) hoặc `MANUAL` (không có).
- `OpeningBalanceTimeline` action = `OPENING_BALANCE_CREATED`, join `OpeningBalance.customerId` match — loại `OPENING_BALANCE`.

Merge + sort ở tầng Service (đọc 2 nguồn trong cùng module `debt/`, không vi phạm Module Ownership vì OpeningBalance cũng nằm trong DebtModule).

### `POST /receivables/:id/manual-adjustment` — không đổi route/permission, chỉ đổi logic nội bộ đã nêu trên.

## 3. Frontend

- `apps/web/src/app/debts/[id]/page.tsx`: thêm nút "Giảm trừ công nợ" cạnh "Ghi nhận thanh toán" (permission `debt.manual-adjustment`), mở thẳng `ManualAdjustmentDialog` hiện có (không qua `DebtAdjustmentGate` — gate đó dành riêng cho tránh trùng lặp theo 1 Return cụ thể, không áp dụng ở đây).
- `apps/web/src/components/customer/customer-debt-tab.tsx`: thêm sub-tab thứ 3 `"Lịch sử giảm trừ/công nợ đầu kỳ"`, gọi API mới, hiển thị bằng component mới `debt-adjustment-history-table.tsx` (badge loại nguồn gốc, số tiền có dấu +/-, lý do, người tạo, thời gian).
- `returns/[id]/page.tsx`, `debt-adjustment-gate.tsx`: không đổi (đã giải thích ở trên).

## 4. File dự kiến thay đổi/tạo mới

Backend:
- `apps/api/prisma/schema.prisma` (model mới + xoá 3 field Return) + migration mới
- `apps/api/src/debt/debt.service.ts`
- `apps/api/src/debt/debt.service.spec.ts`
- `apps/api/src/debt/debt-adjustment.controller.ts` (mới)
- `apps/api/src/debt/dto/debt-adjustment-query.dto.ts` (mới)
- `apps/api/src/debt/debt.module.ts` (đăng ký controller mới)
- `apps/api/src/return/return.service.ts`, `return.service.spec.ts`
- `apps/api/src/dashboard/dashboard.service.ts`, `dashboard.module.ts`, `dashboard.service.spec.ts`
- Script backfill one-off (chạy 1 lần, không giữ lại trong seed)

Frontend:
- `apps/web/src/app/debts/[id]/page.tsx`
- `apps/web/src/components/customer/customer-debt-tab.tsx`
- `apps/web/src/components/customer/debt-adjustment-history-table.tsx` (mới)

Docs:
- `knowledge/modules/debt.md`, `knowledge/modules/return.md`, `knowledge/modules/dashboard.md`, `knowledge/modules/customer.md`

## 5. Giả định đã chốt cùng người dùng

- Ownerid giảm trừ độc lập: mặc định = salesperson (`ownerId`) của đơn hàng liên quan, không cho chọn thủ công ở FE.
- Không cần cơ chế "hoàn tăng lại công nợ" (đảo ngược Manual Adjustment) — ngoài phạm vi lần này.
