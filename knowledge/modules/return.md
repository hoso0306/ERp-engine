# Module Return (Recovery Management)

> **Tên file:** `knowledge/modules/return.md`

---

# Mục đích

Quản lý toàn bộ hàng khách trả về sau khi đã giao hàng.

Return **không phải** module tài chính.

Return **không phải** module hoàn tiền.

Return **không phải** module điều chỉnh doanh thu.

Module này giúp doanh nghiệp:

- Ghi nhận hàng khách trả.
- Thống kê nguyên nhân trả hàng.
- Quản lý kho hàng thu hồi.
- Hỗ trợ tận dụng hàng thu hồi cho các đơn hàng sau.

---

# Vai trò trong ERP

Return là một module độc lập.

Module này **chỉ đọc** dữ liệu từ Sales Order.

Không cập nhật ngược:

- Sales Order
- Production
- Warehouse
- Debt
- Dashboard tài chính

Ví dụ:

```text
Sales Order

20.000.000

↓

Khách trả 1 sản phẩm

↓

Return

↓

Sales Order vẫn giữ nguyên
20.000.000
```

Return chỉ phục vụ thống kê và quản lý tài sản thu hồi.

**Nếu doanh nghiệp quyết định giảm công nợ cho khách sau khi nhận hàng hoàn** (khách sẽ không trả tiền phần đã hoàn), nghiệp vụ đó là **Điều chỉnh công nợ thủ công (Manual Adjustment) — thuộc Debt module** (V2, xem `debt.md` mục Ghi chú), do kế toán thực hiện có chủ đích, kèm lý do và người thực hiện. Return không tự động làm việc này, không gợi ý số tiền, không gọi sang Debt.

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

returnDate

receivedBy

status          // ReturnStatus: PROCESSING | COMPLETED — xem "Trạng thái Return"

note

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

**Chỉ được tạo Return khi `SalesOrder.status = DELIVERED`** — khớp đúng với "Mục đích" (hàng trả về sau khi đã giao hàng). Không tạo Return cho đơn còn đang sản xuất/vận chuyển/chưa giao.

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
- Chỉ tạo Return khi `SalesOrder.status = DELIVERED`.
- Return có trạng thái xử lý `PROCESSING → COMPLETED` (một chiều, Action `complete`, chỉ chạy từ `PROCESSING`). Trạng thái này độc lập với `RecoveryInventoryStatus` và không ảnh hưởng tài chính.
- Một Return có nhiều ReturnItem.
- Một ReturnItem chỉ thuộc đúng một SalesOrderItem.
- Cho phép trả một phần số lượng (`returnedQuantity <= orderedQuantity`).
- Tổng `returnedQuantity` của tất cả ReturnItem cùng một `salesOrderItemId` không được vượt `orderedQuantity` (validate cộng dồn qua nhiều Return).
- Return chỉ Snapshot dữ liệu — không có `subtotalSnapshot`/`condition` (xem "Snapshot Rule").
- Không cập nhật ngược SalesOrder.
- Recovery Inventory độc lập với Warehouse.
- Sau khi tạo, RecoveryInventory chỉ sửa được `location`/`status` — không sửa lại dữ liệu Snapshot.
- Không xoá RecoveryInventory — chỉ chuyển `status = DISPOSED`.
- Action `mark-used`/`dispose` chỉ thực hiện được khi `status = AVAILABLE`.
- Return không làm thay đổi doanh thu.
- Return không làm thay đổi lợi nhuận.
- Return không làm thay đổi công nợ. Giảm công nợ sau Return (nếu doanh nghiệp quyết định) thực hiện qua Manual Adjustment của Debt module (V2) — không thuộc Return.
- Return không làm thay đổi Payment.
- Return không làm thay đổi Dashboard tài chính.

---

# Dashboard Rule

Dashboard chỉ phục vụ thống kê vận hành.

Bao gồm:

- Return trong tháng
- Tổng sản phẩm Return
- Giá trị Return theo giá bán
- Recovery Inventory hiện có
- Top lý do Return

Không tính vào:

- Doanh thu
- Lợi nhuận
- Công nợ
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
