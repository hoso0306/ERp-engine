# Module Return (Recovery Management)

> **Tên file:** `knowledge/modules/return.md`

---

# Mục đích

Quản lý toàn bộ hàng khách trả.

**Cập nhật 27/08/2026 — đảo ngược một phần các khẳng định "không phải" bên dưới:** trước đây Return hoàn toàn tách biệt tài chính. Rà soát nghiệp vụ 27/08/2026 bổ sung: Return **có thể** kích hoạt giảm công nợ (qua Debt module) và **có** ảnh hưởng tới Dashboard doanh thu — nhưng CHỈ đúng phần "công ty chịu" của giá trị hoàn (xem mục "Phân bổ khách/công ty chịu"), không phải toàn bộ giá trị hoàn, và không tự sửa `SalesOrder`/`Payment`.

Return vẫn **không phải** module hoàn tiền (Refund) — không có tiền mặt thật chảy ra khi tạo Return.

**Cập nhật 17/09/2026 — hỗ trợ hoàn dòng vật tư bán lẻ.** `SalesOrderItem.itemType = MATERIAL` (tính năng "Bán lẻ vật tư", chốt 28/07/2026) trước đây bị chặn ở Return (chỉ nhận dòng PRODUCT, quyết định cắt phạm vi lúc đó, không phải giới hạn kỹ thuật). Nay Return nhận cả 2 loại — `ReturnItem`/`RecoveryInventory` snapshot rẽ nhánh theo `itemType`: PRODUCT dùng `productCode/productName`, MATERIAL dùng `materialCode/materialName/materialUnit` (cùng convention `SalesOrderItem`). Vật tư hoàn về **vẫn sinh `RecoveryInventory`** (đưa vào kho thu hồi, để đó) giống sản phẩm — chưa có logic tái sử dụng riêng cho vật tư ở V1. `Return.totalValue`/`customerBorneAmount` tính ở cấp header (không phân biệt loại dòng) nên tự động phản ánh đúng vào Dashboard/Report A1/B3/C1/C2, không cần sửa thêm ở các nơi đó.

Module này giúp doanh nghiệp:

- Ghi nhận hàng khách trả.
- Thống kê nguyên nhân trả hàng.
- Quản lý kho hàng thu hồi.
- Hỗ trợ tận dụng hàng thu hồi cho các đơn hàng sau.

---

# Vai trò trong ERP

Return **đọc** dữ liệu từ Sales Order, và **có thể kích hoạt** Debt module (Manual Adjustment) khi tạo phiếu hoàn — nhưng không tự mình sở hữu logic tài chính, không tự đọc/ghi bảng của Debt.

Không cập nhật ngược:

- Sales Order (vẫn Immutable Document — `totalAmount`/`plannedProfit`... không đổi)
- Production
- Warehouse
- Payment (Return không bao giờ tạo `Payment`, không có tiền mặt thật)

**Có thể** kích hoạt (không tự sửa trực tiếp):

- Debt (`Receivable.totalAmount`/`remainingAmount`) — qua `POST /receivables/:id/manual-adjustment`, chỉ khi phần "Công ty hỗ trợ" > 0 (xem mục "Phân bổ Phí khách/Công ty hỗ trợ"). Đây là **hành động riêng, người dùng chủ động bấm nút "Giảm trừ công nợ"** sau khi tạo phiếu hoàn thành công (đảo ngược quyết định "tự động ngay lúc tạo" — chốt lại 27/08/2026) — Return service **không** import/gọi thẳng `DebtService`, chỉ FE điều hướng.
- Dashboard "Doanh thu kế hoạch"/"Doanh số theo nhân viên" — trừ đúng phần Công ty hỗ trợ, tính ở tầng Dashboard (Aggregate đơn giản, không phải Return tự sửa số liệu).

Ví dụ:

```text
Sales Order
20.000.000
        ↓
Khách trả 1 sản phẩm — giá trị 2.000.000
        ↓
Return: Phí khách 1.500.000, Công ty hỗ trợ 500.000 (lỗi sản xuất)
        ↓
Sales Order vẫn giữ nguyên 20.000.000 (Immutable Document)
        ↓
Người dùng bấm "Giảm trừ công nợ" (không tự động)
        ↓
Receivable giảm 500.000 (Manual Adjustment)
Dashboard "Doanh thu kế hoạch" giảm 500.000 (không phải cả 2.000.000)
```

Return vẫn chỉ phục vụ thống kê và quản lý tài sản thu hồi ở phần **không** liên quan phân bổ Phí khách/Công ty hỗ trợ (lý do trả, kho thu hồi...).

---

# Business Flow

```text
Sales Order (đã DELIVERED)
        │
        ▼
Khách trả một hoặc nhiều sản phẩm
        │
        ▼
ERP tạo Return
        │
        ▼
Sinh Return Items (Snapshot)
        │
        ▼
Sinh Recovery Inventory
        │
        ▼
Theo dõi hàng thu hồi
        │
        ▼
Đánh dấu đã sử dụng / đã thanh lý
```

---

# Triết lý thiết kế

Return là một Snapshot độc lập.

Sau khi tạo Return:

Không đọc lại:

- Product
- SalesOrderItem

Mọi dữ liệu cần thiết đều được snapshot tại thời điểm tạo.

Điều này đảm bảo:

- Lịch sử không thay đổi.
- Có thể lưu trữ lâu dài.
- Không bị ảnh hưởng khi dữ liệu gốc thay đổi.

---

# Quan hệ dữ liệu

```text
SalesOrder
      │
      ▼
SalesOrderItem
      │
      ▼
ReturnItem (Snapshot)
      │
      ▼
RecoveryInventory
```

Return Header chỉ là chứng từ.

ReturnItem mới là dữ liệu nghiệp vụ chính.

---

# Running Number

```text
Return

↓

RT000001
```

---

# Return Header

Quản lý thông tin chung của một lần khách trả.

```text
Return

code

salesOrderId

salesOrderCode

customerId

customerName

ownerId         // snapshot từ SalesOrder.ownerId — group theo nhân viên (Dashboard)
ownerName       // snapshot từ SalesOrder.ownerName — chỉ hiển thị

returnDate

receivedBy

status          // ReturnStatus: PROCESSING | COMPLETED — xem "Trạng thái Return"

note

totalValue              // giá trị phiếu hoàn, đã gồm VAT
customerBorneAmount     // "Phí khách" — xem "Phân bổ Phí khách/Công ty hỗ trợ"
companyBorneReason      // lý do "Công ty hỗ trợ" phần còn lại — NULL nếu Phí khách = 100%
debtAdjustedAt          // KHÔNG lưu cột riêng (sửa 27/08/2026) — findOne() tự query lại
                        // từ bảng DebtAdjustment (where returnId = id), trả về response
                        // cùng tên field như trước. = thời điểm lần điều chỉnh gần nhất.
debtAdjustedAmount      // Cùng cách tính — TỔNG đã giảm trừ, SUM(DebtAdjustment.amount) cộng dồn qua mọi lần.

createdAt

updatedAt
```

Một Return có thể có nhiều ReturnItem.

## Trạng thái Return

Đây là **trạng thái xử lý của phiếu hoàn** — đã cam kết ở `03-danh-sach-module.md` (Hàng hoàn: "Trạng thái xử lý") và `02-quy-trinh-nghiep-vu.md` (Hàng hoàn → Đang xử lý → Hoàn tất). Khác hoàn toàn với `RecoveryInventoryStatus` (trạng thái của **tài sản** thu hồi).

```text
PROCESSING → COMPLETED
```

- **PROCESSING** (mặc định khi tạo): đang xử lý với khách — kiểm tra hàng, thương lượng, quyết định hướng giải quyết.
- **COMPLETED**: vụ việc đã chốt xong với khách. Chỉ mang ý nghĩa quản lý vụ việc — **không ảnh hưởng** RecoveryInventory (tài sản thu hồi vẫn theo dõi độc lập bằng `AVAILABLE/USED/DISPOSED`), không ảnh hưởng tài chính.

Action:

```http
POST /returns/:id/complete
```

- Chỉ chạy được khi `status = PROCESSING`. Workflow một chiều — không có Action quay lại `PROCESSING`, không có Cancel (phiếu tạo nhầm xử lý theo tiền lệ chung của dự án).
- Ghi nhận người thực hiện + thời gian (V1 chưa có Timeline riêng cho Return — dùng `updatedAt` + `completedBy` nếu cần tối giản, hoặc bổ sung khi có nhu cầu thật).

**Được tạo Return ở mọi trạng thái `SalesOrder`, chỉ chặn `CANCELLED`** (rà soát nghiệp vụ Return, 27/08/2026 — đảo ngược quyết định cũ "chỉ tạo khi DELIVERED"). Doanh nghiệp có nhu cầu ghi nhận trả hàng/điều chỉnh ngay cả khi đơn còn đang sản xuất hoặc đang vận chuyển, không đợi tới lúc giao xong.

---

# Phân bổ Phí khách/Công ty hỗ trợ (rà soát nghiệp vụ Return, 27/08/2026; đổi luồng + thuật ngữ 27/08/2026)

Ngay trong luồng tạo phiếu hoàn (Bước 2 — không đợi xử lý xong với khách), ERP bắt kế toán xác nhận **giá trị hoàn được chia cho ai chịu**. Thuật ngữ hiển thị (FE): **"Phí khách"** = phần khách chịu, **"Công ty hỗ trợ"** = phần công ty chịu — field trong DB vẫn giữ tên cũ (`customerBorneAmount`/`companyBorneReason`), chỉ đổi nhãn hiển thị.

```text
Tổng giá trị phiếu hoàn (totalValue)
        │
        ├── Phí khách (customerBorneAmount) — khách vẫn phải trả đủ phần này,
        │     không ảnh hưởng công nợ/doanh thu
        │
        └── Công ty hỗ trợ (totalValue - customerBorneAmount) — công ty nhận
              tổn thất phần này (vd lỗi sản xuất), CÓ THỂ giảm công nợ qua
              Manual Adjustment (xem debt.md), và bị trừ vào Dashboard
              "Doanh thu kế hoạch"/"Doanh số theo nhân viên"
```

- **Mặc định `customerBorneAmount = totalValue`** (Phí khách 100%) nếu không truyền — an toàn, không tự ý tạo tổn thất cho công ty nếu kế toán không chủ động chỉnh.
- **Bắt buộc `companyBorneReason`** khi phần Công ty hỗ trợ > 0 (giải trình lý do, vd "Lỗi sản xuất — cắt sai kích thước"). Không bắt buộc khi Phí khách = 100%.

**Giảm công nợ TỰ ĐỘNG ngay sau khi tạo, dùng đúng số liệu đã chốt ở Bước 2** (chốt lại lần cuối 27/08/2026 — trước đó từng thử "hành động riêng, người dùng tự bấm" rồi đổi lại, vì Bước 2 đã chốt amount/reason rồi nên bắt xác nhận thêm lần nữa là dư thừa):

```text
Tạo phiếu hoàn (POST /returns) — lưu Return + ReturnItem + RecoveryInventory
        ↓ (chỉ khi Công ty hỗ trợ > 0)
FE tự động gọi tiếp POST /receivables/:id/manual-adjustment (kèm returnId,
amount = Công ty hỗ trợ, reason = companyBorneReason — đúng số liệu đã nhập
ở Bước 2, KHÔNG hỏi lại)
        ↓
Thành công → 1 dialog duy nhất: "Đã tạo phiếu hoàn thành công. Đã giảm trừ
công nợ Xđ cho đơn {code} của khách hàng {tên}."
        ↓ (chỉ khi bước tự động ở trên LỖI)
Dialog vẫn báo tạo Return thành công, kèm thêm nút "Giảm trừ công nợ" (qua
DebtAdjustmentGate, biết chắc debtAdjustedAt=null) để thử lại thủ công
```

- Return service **không** gọi thẳng `DebtService` — vẫn là 2 lệnh gọi API tuần tự do FE điều phối, giữ ranh giới 2 module độc lập (đúng nguyên tắc "Return chỉ đọc SalesOrder"), chỉ khác là FE gọi NGAY không cần người dùng bấm thêm.
- `DebtService.manualAdjustment()` ghi bản ghi mới vào bảng `DebtAdjustment` (kèm `returnId`) — Return **không tự lưu** field nào cả (sửa 27/08/2026, thay cho cách lưu cộng dồn trực tiếp trên Return trước đó — 2 nguồn dữ liệu dễ lệch nhau). `ReturnService.findOne()` tự SUM/query lại từ `DebtAdjustment` mỗi lần đọc, trả về response cùng tên field `debtAdjustedAt/Amount/ByName` như cũ. Xem chi tiết bảng `DebtAdjustment` ở `debt.md` mục "Manual Adjustment".
- **Component `DebtAdjustmentGate`** (dùng chung, bọc ngoài `ManualAdjustmentDialog`) — mọi nơi có nút "Giảm trừ công nợ" (trang chi tiết Return, hoặc màn tạo khi bước tự động lỗi) đều qua gate này trước, tránh giảm trừ trùng cho cùng 1 Return:
  - Nếu `debtAdjustedAt` đã có: cảnh báo *"Phiếu hoàn {code} đã có thông tin giảm công nợ, tổng cộng {amount} (lần gần nhất ngày {date}, tạo bởi {actor})."* — có nút "Vẫn tạo tiếp" nếu thật sự muốn giảm thêm lần nữa (vd điều chỉnh bổ sung).
  - Nếu chưa có: xác nhận nhẹ *"Phiếu hoàn {code} CHƯA CÓ thông tin giảm công nợ."* — nút "Tạo".
  - Cả 2 nhánh, bấm nút xác nhận mới thực sự mở `ManualAdjustmentDialog` (nhập/sửa amount+reason rồi mới gọi API).

**Thể hiện trên bản in đơn hàng** (bổ sung 27/08/2026, chỉnh lại 2 lần theo phản hồi UI cùng ngày — `quotations/[id]/print/page.tsx`, dùng chung cho cả Báo giá lẫn Xác nhận đơn hàng, chỉ đổi hành vi khi in ở chế độ Đơn hàng):
- **Không gạch ngang dòng sản phẩm đã hoàn** (đảo ngược thiết kế lần đầu — bỏ hẳn `textDecoration: line-through` và màu xám, mọi ô của dòng vẫn hiển thị bình thường như dòng chưa hoàn).
- Ô "Chú thích" của dòng đã hoàn: nội dung cũ (cảnh báo giá/ghi chú) **vẫn render bình thường, không xoá** — tem "ĐÃ HOÀN a/b SP" (a = số lượng đã hoàn, b = tổng số lượng đã đặt) phủ **đè lên trên** dạng overlay (`position: absolute`, nền trắng mờ, chữ đỏ viền đỏ xoay nhẹ), không xoá nội dung bên dưới.
- Cột "Thành Tiền": dòng đã hoàn hiện thêm 1 dòng phụ **màu đỏ, có dấu "−" ở trước**, cỡ chữ giống số Thành Tiền — là phần Công ty hỗ trợ phân bổ riêng cho đúng dòng sản phẩm này (1 Return có thể gồm nhiều dòng, phân bổ theo tỷ trọng giá trị dòng trên tổng `totalValue` của Return đó).
- Khối "Đã hoàn" đặt **ngay dưới bảng danh sách sản phẩm** — chỉ hiện khi đơn có ≥1 Return. Mỗi dòng sản phẩm hoàn: giá trị đặt **ngay cạnh tên sản phẩm** (inline, không dàn hàng sang phải).
- **Hàng TỔNG tách khỏi bảng sản phẩm, đặt SAU khối "Đã hoàn"** (không còn là hàng cuối trong `<table>` items) — dùng bảng riêng, cùng `colgroup` để thẳng cột. Giá trị TỔNG = `SUM(subtotal)` gốc **trừ thẳng** tổng phần Công ty hỗ trợ của mọi Return thuộc đơn.
- Khối "Tình hình công nợ", dòng "Đơn hàng này" **lấy thẳng giá trị từ hàng TỔNG** ở trên (không dùng `SalesOrder.grandTotal` snapshot gốc nữa cho dòng này) — không có dòng "Giảm trừ do hoàn hàng" riêng (hàng TỔNG đã tự phản ánh). `TỔNG PHẢI THANH TOÁN` (số cuối) vẫn tính từ `Receivable.remainingAmount` thật, không đổi.

---

# Return Item

Return luôn gắn với từng SalesOrderItem.

Không gắn trực tiếp với toàn bộ SalesOrder.

Ví dụ:

```text
SO000001

- Rèm phòng khách
- Rèm phòng ngủ
- Bạt mái hiên
```

Khách chỉ trả:

```text
Rèm phòng ngủ
```

ERP chỉ tạo ReturnItem cho đúng sản phẩm đó.

---

## Cho phép trả một phần

Ví dụ:

```text
SalesOrderItem

Quantity = 5
```

Khách trả:

```text
Returned Quantity = 2
```

ERP không coi toàn bộ sản phẩm đã bị trả.

## Validate cộng dồn qua nhiều lần Return

**Không chỉ so sánh trong một ReturnItem đơn lẻ.** Một `SalesOrderItem` có thể được trả nhiều lần qua nhiều Return khác nhau — tổng `returnedQuantity` của **tất cả** ReturnItem gắn với cùng một `salesOrderItemId` không được vượt `orderedQuantity`:

```text
SalesOrderItem.quantity = 5

Return lần 1: returnedQuantity = 3   → tổng đã trả = 3  (hợp lệ)
Return lần 2: returnedQuantity = 3   → tổng đã trả = 6  (KHÔNG hợp lệ, vượt quá 5)
```

Chỉ validate `returnedQuantity <= orderedQuantity` cho một ReturnItem là chưa đủ — phải validate:

```text
SUM(returnedQuantity của tất cả ReturnItem cùng salesOrderItemId) <= orderedQuantity
```

---

# Snapshot Rule

ReturnItem snapshot toàn bộ dữ liệu cần thiết.

```text
ReturnItem

salesOrderItemId

productCode

productName

productParameters

orderedQuantity

returnedQuantity

unitPriceSnapshot

reason

note
```

Trong đó:

**unitPriceSnapshot**

Snapshot từ SalesOrderItem.finalPrice.

Không đọc lại SalesOrderItem sau khi tạo.

**Không có `subtotalSnapshot`.** Giá trị dòng trả (`returnedQuantity × unitPriceSnapshot`) tính được ngay từ 2 field đã có, không cần lưu thêm — tránh Derived Data không cần thiết (CLAUDE.md mục 13).

**Không có `condition`.** Tình trạng thực tế của hàng trả (nếu cần) chỉ ghi tự do vào `note` — kế toán nhập tay lúc xử lý Return, không phân loại theo enum cố định.

---

# Return Reason

Sử dụng danh mục chuẩn.

Ví dụ:

- Sai kích thước
- Sai màu
- Sai mẫu
- Lỗi sản xuất
- Lỗi lắp đặt
- Khách đổi ý
- Khác

Dashboard thống kê trực tiếp theo danh mục này.

---

# Recovery Inventory

Recovery Inventory là kho hàng thu hồi.

Không phải Warehouse.

Không phải Material.

Không phải Thành phẩm.

Recovery Inventory chỉ quản lý tài sản đã thu hồi.

```text
RecoveryInventory

code

returnItemId

createdFromReturnCode

productCode

productName

productParameters

quantity

location

status

imageUrl

createdAt

updatedAt
```

**`createdFromReturnCode` là Redundant Reference** (copy `Return.code` tại thời điểm tạo, tránh phải join qua `returnItemId → ReturnItem → Return` mỗi lần hiển thị) — cùng pattern đã dùng cho `Receivable.customerId`, `Payment.salesOrderId`. Owner xem danh sách kho thu hồi thường xuyên cần biết ngay "cái này của phiếu Return nào" mà không cần join.

**Không có `receivedDate` riêng — dùng `createdAt`.** `RecoveryInventory` được sinh cùng lúc, cùng transaction với việc tạo Return (không có bước "nhận hàng" tách rời xảy ra sau đó), nên không có kịch bản nào khiến ngày nhận thực tế khác thời điểm tạo bản ghi. Thêm field riêng lúc này là dư thừa — chỉ cân nhắc lại nếu sau này module có bước nhận hàng trễ hơn lúc tạo Return.

**`imageUrl` chỉ lưu URL (String?), V1 không xây hạ tầng upload/lưu file** — hệ thống hiện chưa có tính năng upload nào (xem `knowledge/modules/setting.md` mục "Future Policies"). Người dùng dán link ảnh đã có sẵn ở đâu đó (vd đã upload qua công cụ khác). Khi có Module Upload thật ở V2, chuyển sang dùng luôn.

**Sau khi tạo, chỉ được sửa `location`/`status`.** `productCode`/`productName`/`productParameters`/`quantity` là Snapshot từ ReturnItem — khoá cứng, không sửa lại. `imageUrl`/note (nếu cần bổ sung ghi chú sau) có thể cập nhật khi hàng còn nằm trong kho.

**Không xoá `RecoveryInventory`.** Nếu nhập sai hoặc không còn cần theo dõi, chuyển `status = DISPOSED`, không Delete — giữ lịch sử, cùng nguyên tắc đã áp dụng cho Payment/MaterialReceipt/ProductionOrder.

---

# Recovery Inventory Status

```text
AVAILABLE

USED

DISPOSED
```

## AVAILABLE

Đang còn trong kho.

Có thể tận dụng.

---

## USED

Đã tận dụng cho đơn hàng khác.

Không còn trong kho.

---

## DISPOSED

Đã thanh lý hoặc loại bỏ.

---

# Workflow

Không cần Workflow phức tạp như Production. Chỉ 2 Action thủ công, đơn giản, không tự động hoá, không sinh dữ liệu ở module khác:

```http
POST /recovery-inventory/:id/mark-used

POST /recovery-inventory/:id/dispose
```

Cả hai Action **chỉ được thực hiện khi `status = AVAILABLE`** — không cho chuyển ngược từ `USED`/`DISPOSED`, không chuyển chéo giữa `USED` và `DISPOSED`.

## mark-used (`AVAILABLE → USED`)

Người dùng (Owner/nhân viên kho) lấy hàng trong kho thu hồi ra dùng thì bấm "Đánh dấu đã sử dụng".

Có thể ghi kèm:

```text
usedForNote   String?   // vd "SO000231" hoặc "Cắt làm rèm mẫu"
```

**Không có FK, không sinh SalesOrder/ProductionOrder mới, không automation.** Chỉ để thống kê — đúng nhu cầu thực tế ("chủ yếu để thống kê, đừng làm nặng").

## dispose (`AVAILABLE → DISPOSED`)

Người dùng đánh dấu "Đã thanh lý" khi hàng không còn tận dụng được. Cùng mức đơn giản như `mark-used`, không cần thêm dữ liệu bắt buộc.

---

# Dashboard

Return có Dashboard riêng.

Không ảnh hưởng Dashboard tài chính.

---

## Return trong tháng

Hiển thị:

- Số phiếu Return
- Tổng số sản phẩm Return

---

## Giá trị Return trong tháng

Hiển thị:

```text
SUM(

returnedQuantity

×

unitPriceSnapshot

)
```

Đây là:

**Giá trị bán của hàng bị trả**.

Không phải:

- giá vốn
- giá trị thu hồi
- giá trị còn tận dụng

---

## Recovery Inventory hiện có

Hiển thị:

- Tổng số sản phẩm còn AVAILABLE

Có thể mở danh sách để xem:

- Tên sản phẩm
- Kích thước
- Màu
- Vị trí

---

## Hàng tồn lâu

Derived Data, tính runtime — không lưu field mới:

```text
daysInStock = NOW() - createdAt   (chỉ tính khi status = AVAILABLE)
```

Hiển thị:

```text
> 30 ngày:  12 sản phẩm
> 90 ngày:  4 sản phẩm
```

Giúp Owner biết sản phẩm nào để lâu quá nên ưu tiên tận dụng hoặc thanh lý.

---

## Top lý do Return

Ví dụ:

```text
Sai kích thước

42%
```

```text
Lỗi sản xuất

18%
```

```text
Sai màu

15%
```

...

---

## Return theo khách hàng

Chỉ phục vụ thống kê.

Không đánh giá khách hàng.

---

# Business Rule

- Một SalesOrder có thể có nhiều Return.
- Được tạo Return ở mọi trạng thái `SalesOrder`, chỉ chặn `CANCELLED` (rà soát nghiệp vụ Return, 27/08/2026 — đảo ngược "chỉ tạo khi DELIVERED").
- Return có trạng thái xử lý `PROCESSING → COMPLETED` (một chiều, Action `complete`, chỉ chạy từ `PROCESSING`). Trạng thái này độc lập với `RecoveryInventoryStatus` và độc lập với việc đã "Giảm trừ công nợ" hay chưa (`debtAdjustedAt`) — 2 trạng thái tách biệt, không phụ thuộc nhau.
- Một Return có nhiều ReturnItem.
- Một ReturnItem chỉ thuộc đúng một SalesOrderItem.
- Cho phép trả một phần số lượng (`returnedQuantity <= orderedQuantity`).
- Tổng `returnedQuantity` của tất cả ReturnItem cùng một `salesOrderItemId` không được vượt `orderedQuantity` (validate cộng dồn qua nhiều Return).
- Return chỉ Snapshot dữ liệu — không có `subtotalSnapshot`/`condition` (xem "Snapshot Rule").
- Không cập nhật ngược SalesOrder — SalesOrder luôn giữ nguyên Immutable Document dù Return có phần Công ty hỗ trợ hay không.
- Recovery Inventory độc lập với Warehouse.
- Sau khi tạo, RecoveryInventory chỉ sửa được `location`/`status` — không sửa lại dữ liệu Snapshot.
- Không xoá RecoveryInventory — chỉ chuyển `status = DISPOSED`.
- Action `mark-used`/`dispose` chỉ thực hiện được khi `status = AVAILABLE`.
- `0 <= customerBorneAmount <= totalValue`; mặc định = `totalValue` nếu không truyền.
- `companyBorneReason` bắt buộc khi `totalValue - customerBorneAmount > 0`.
- Return không làm thay đổi Payment — không bao giờ tạo `Payment`/`PaymentAllocation`.
- Phần Công ty hỗ trợ (nếu > 0) bị trừ vào Dashboard "Doanh thu kế hoạch"/"Doanh số theo nhân viên" ngay cả khi CHƯA bấm "Giảm trừ công nợ" (2 việc độc lập — Dashboard tính runtime từ `totalValue - customerBorneAmount`, không phụ thuộc `debtAdjustedAt`). Giảm công nợ thật (Receivable) thì phải người dùng chủ động bấm (xem mục "Phân bổ Phí khách/Công ty hỗ trợ"). Phần Phí khách thì KHÔNG bị trừ ở đâu cả.
- Return không làm thay đổi lợi nhuận kế hoạch (`SalesOrder.plannedProfit`) — ngoài phạm vi đã xác nhận (27/08/2026).

---

# Dashboard Rule

Dashboard chỉ phục vụ thống kê vận hành, TRỪ 2 điểm ngoại lệ đã xác nhận (27/08/2026) nằm ở **Dashboard chung** (không phải Dashboard riêng của Return, xem dưới):

- KPI "Doanh thu kế hoạch" (Sales Overview) trừ đúng phần Công ty hỗ trợ của Return trong cùng khoảng lọc — tính runtime từ `totalValue - customerBorneAmount`, **không** phụ thuộc đã bấm "Giảm trừ công nợ" (`debtAdjustedAt`) hay chưa. Cần lưu ý: có thể phát sinh chênh lệch tạm thời giữa số hiển thị ở đây và công nợ thực tế nếu kế toán chưa bấm giảm trừ.
- Khối "Doanh số theo nhân viên" (dưới khối Kinh doanh) cũng trừ theo cùng công thức, group theo nhân viên.
- Cùng công thức này mở rộng sang trang Đơn hàng (rà soát nghiệp vụ Return, 27/08/2026) — cột "Tổng tiền" ở danh sách Đơn hàng/tab "Đơn hàng" của Customer, và 2 dòng "Tổng giảm trừ hàng hoàn"/"Tổng giá trị đơn hàng" ở trang chi tiết đơn — đều là giá trị suy diễn để hiển thị (`netAmount`), KHÔNG ghi lại `SalesOrder.totalAmount` (vẫn giữ Immutable Document, xem `order.md` mục "Planned Financials"). Xem chi tiết `order.md`.

Dashboard riêng của Return (mô tả bên dưới) vẫn thuần thống kê vận hành:

- Return trong tháng
- Tổng sản phẩm Return
- Giá trị Return theo giá bán (vẫn là `totalValue` thô — không phân biệt Phí khách/Công ty hỗ trợ, đây là thống kê vận hành, khác KPI tài chính ở Dashboard chung)
- Recovery Inventory hiện có
- Top lý do Return

Không tính vào (Dashboard riêng của Return):

- Lợi nhuận
- Giá vốn

---

# Mục tiêu của Module

Module Return giúp doanh nghiệp trả lời các câu hỏi:

- Tháng này có bao nhiêu hàng bị trả?
- Có bao nhiêu sản phẩm bị trả?
- Giá trị hàng bị trả theo giá bán là bao nhiêu?
- Hiện trong kho thu hồi còn những gì?
- Nguyên nhân trả hàng nhiều nhất là gì?
- Có thể tận dụng những sản phẩm nào cho đơn hàng sau?

Đây là module phục vụ **quản trị vận hành và tối ưu tài sản thu hồi**, không phải quản trị tài chính.
