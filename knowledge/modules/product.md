# Module Sản phẩm

> **Tên file:** `knowledge/modules/product.md`

---

# Mục đích

Quản lý toàn bộ danh mục sản phẩm theo mô hình **Configure-to-Order (CTO)**.

Khách hàng không mua một sản phẩm cố định.

Khách hàng chỉ nhập các thông số của sản phẩm.

Từ các thông số đó, hệ thống sẽ:

- Tính giá bán
- Tính định mức vật liệu
- Tính giá vốn
- Sinh BOM thực tế
- Chuẩn bị dữ liệu cho sản xuất và kho

Module Product là trung tâm của toàn bộ hệ thống ERP.

Các Module sử dụng dữ liệu từ Module này:

- Báo giá
- Đơn hàng
- Kho
- Sản xuất
- Dashboard
- Báo cáo

---

# Phạm vi

Module này chịu trách nhiệm quản lý:

- Loại sản phẩm (Product Type)
- Danh mục sản phẩm (Product)
- Đơn vị tính (Unit)
- Nguyên liệu (Material)
- Giá nguyên liệu (Material Price)
- Thông số sản phẩm (Product Parameter)
- Quy tắc báo giá (Pricing Rule)
- Phiên bản Quy tắc báo giá (Pricing Rule Version)
- Định mức vật liệu (Material Requirement)
- Phiên bản Định mức vật liệu (Material Requirement Version)

Không xử lý:

- Báo giá
- Đơn hàng
- Kho
- Xuất kho
- Nhập kho
- Sản xuất

Các nghiệp vụ trên sẽ được xử lý tại Module tương ứng.

---

# Mô hình Configure-to-Order (CTO)

Sản phẩm không có kích thước hay cấu tạo cố định.

Khách hàng chỉ nhập thông số.

Ví dụ:

```text
Chiều rộng = 1200mm

Chiều cao = 2100mm

Khung = Xingfa

Số cánh = 2
```

Sau đó hệ thống sẽ tự động:

```text
Thông số đặt hàng

↓

Quy tắc báo giá

↓

Giá bán

↓

Định mức vật liệu

↓

Order BOM

↓

Giá vốn

↓

Kho & Sản xuất
```

Mọi dữ liệu đều được Snapshot khi Đơn hàng chuyển sang trạng thái **Đang sản xuất**.

---

# Phân biệt Quy tắc báo giá và Định mức vật liệu

Hai khái niệm này hoàn toàn độc lập.

## Quy tắc báo giá

Mục tiêu:

Tính giá bán cho khách hàng.

Được sử dụng cho:

- Báo giá
- Đơn hàng
- Doanh thu
- Lợi nhuận

Ví dụ:

```text
Nếu diện tích < 0.7m²

↓

Tính thành 0.7m²
```

Hoặc

```text
Nếu chiều dài < 1m

↓

Tính thành 1m
```

Đây là quy tắc kinh doanh.

Không ảnh hưởng tới sản xuất.

---

## Định mức vật liệu

Mục tiêu:

Tính lượng nguyên vật liệu cần sử dụng.

Được sử dụng cho:

- Giá vốn
- Kho
- Sản xuất
- BOM

Ví dụ:

```text
Vải

=

width × height × 2

↓

+ 5% hao hụt

↓

Làm tròn 0.1m²
```

Đây là quy tắc sản xuất.

Không ảnh hưởng tới giá bán.

---

# Danh mục (Master Data)

## Loại sản phẩm (Product Type)

Ví dụ:

- Mái hiên
- Mái hiên di động
- Rèm cầu vồng
- Rèm tổ ong
- Cửa lưới chống muỗi

Người dùng có thể:

- Thêm
- Chỉnh sửa
- Ngừng sử dụng

---

## Đơn vị tính (Unit)

Ví dụ:

- Bộ
- Mét
- Mét dài
- Mét vuông
- Cái
- Kg

Đơn vị tính được dùng chung cho toàn hệ thống.

---

## Nguyên liệu (Material)

Nguyên liệu là Master Data.

Thông tin gồm:

- Mã nguyên liệu
- Tên nguyên liệu
- Đơn vị tính
- Trạng thái
- Ghi chú

Mã nguyên liệu sinh tự động theo Running Number, ví dụ: NL000001, NL000002.

Người dùng có thể sửa lại mã nếu cần.

Ví dụ:

- Nhôm Xingfa
- Ray
- Vải
- Dây kéo
- Tay nắm
- Bánh xe

Nguyên liệu được sử dụng trong:

- Định mức vật liệu
- Kho
- Giá vốn
- Nhà cung cấp

---

## Giá nguyên liệu (Material Price)

Một nguyên liệu có thể có nhiều mức giá.

Ví dụ:

| Nhà cung cấp | Giá | Hiệu lực |
|--------------|------|-----------|
| NCC A | 130.000 | 01/01/2025 |
| NCC B | 128.000 | 01/06/2025 |

Thông tin quản lý:

- Nguyên liệu
- Nhà cung cấp
- Giá mua
- Ngày hiệu lực
- Ngày hết hiệu lực
- Giá mặc định
- Ghi chú

Khi tính giá vốn, hệ thống lấy:

1. Giá mặc định còn hiệu lực.

Nếu không có:

2. Giá mới nhất còn hiệu lực.

Giá này sẽ được Snapshot vào Order.

---

# Thông số sản phẩm (Product Parameter)

Thông số sản phẩm là dữ liệu được khai báo khi thiết kế sản phẩm.

Đây là Schema.

Không phải dữ liệu khách hàng nhập.

Ví dụ:

| Tên | Hiển thị | Kiểu |
|------|----------|------|
| width | Chiều rộng | NUMBER |
| height | Chiều cao | NUMBER |
| frameType | Loại khung | ENUM |
| doorCount | Số cánh | NUMBER |
| hasMotor | Có motor | BOOLEAN |
| color | Màu sắc | TEXT |

Các kiểu dữ liệu hỗ trợ:

| Kiểu | Mô tả | UI sinh ra |
|---|---|---|
| NUMBER | Số thực | Input số, hỗ trợ Min / Max / Step |
| TEXT | Chuỗi tự do | Input text |
| ENUM | Danh sách chọn | Dropdown, cần khai báo danh sách giá trị hợp lệ |
| BOOLEAN | Có / Không | Checkbox |

Mỗi Parameter có:

- Tên (tiếng Anh, dùng trong Expression)
- Nhãn hiển thị
- Kiểu dữ liệu
- Đơn vị
- Giá trị mặc định
- Required
- Min (chỉ NUMBER)
- Max (chỉ NUMBER)
- Step (chỉ NUMBER)
- Options (chỉ ENUM — danh sách giá trị hợp lệ)
- Tham gia báo giá
- Tham gia định mức vật liệu
- Thứ tự hiển thị

Frontend sẽ tự sinh Form từ Product Parameter.

Không hard-code giao diện.

---

# Thông tin sản phẩm

Mỗi sản phẩm bao gồm:

- Mã sản phẩm
- Tên sản phẩm
- Loại sản phẩm
- Đơn vị tính
- **Production Center** (bắt buộc, NOT NULL) — xưởng sản xuất phụ trách sản phẩm này
- Trạng thái
- Mô tả

**Production Center** là thuộc tính bắt buộc của Product.

V1: Một Product thuộc đúng một Production Center. Hệ thống dùng thông tin này để sinh Production Order khi Báo giá được duyệt. Không để Sales chọn — lấy trực tiếp từ Product.

Mã sản phẩm sử dụng Running Number.

Ví dụ:

```text
SP000001

SP000002
```

---

# Trạng thái sản phẩm

Có ba trạng thái.

## DRAFT

Đang thiết kế.

Có thể:

- chưa có Pricing Rule
- chưa có Định mức vật liệu

Không được sử dụng để báo giá.

Có thể xóa (Soft Delete).

---

## ACTIVE

Đã cấu hình hoàn chỉnh.

Được sử dụng để:

- Báo giá
- Đơn hàng

Không được xóa. Chỉ được chuyển sang INACTIVE.

---

## INACTIVE

Ngừng kinh doanh.

Không được chọn trong đơn hàng mới.

Nhưng vẫn được giữ để phục vụ lịch sử.

Không được xóa.

---

# Quy tắc báo giá (Pricing Rule)

Quy tắc báo giá dùng để tính giá bán cho khách hàng.

Mỗi Pricing Rule Version gồm:

- Expression — công thức tính giá
- Danh sách Pricing Rule Item — quy tắc điều chỉnh thông số trước khi tính
- Price Round Step — làm tròn giá bán lên (tùy chọn, đơn vị: VND)

## Pricing Rule Item

| Trường | Mô tả |
|---|---|
| type | Loại quy tắc: MIN_AREA hoặc MIN_DIMENSION |
| targetParameter | Tên thông số áp dụng (chỉ dùng với MIN_DIMENSION) |
| minValue | Giá trị tối thiểu |
| description | Ghi chú |

Loại quy tắc hỗ trợ trong V1:

- `MIN_AREA` — Diện tích tối thiểu (m²). Nếu diện tích tính từ thông số < minValue → dùng minValue thay thế khi tính giá.
- `MIN_DIMENSION` — Chiều dài tối thiểu cho một thông số cụ thể. Nếu giá trị thông số < minValue → dùng minValue.

## Thứ tự tính giá

```text
Thông số khách nhập (width, height, ...)
↓
Áp dụng Pricing Rule Items (điều chỉnh nếu vi phạm giới hạn tối thiểu)
↓
Tính Expression với giá trị đã điều chỉnh
↓
Làm tròn lên theo Price Round Step (nếu có)
↓
Giá bán
```

Ví dụ:

```text
Khách nhập: width=400mm, height=500mm

Rule MIN_AREA = 0.7m²:
  area = 400 × 500 / 1,000,000 = 0.2m²
  0.2m² < 0.7m² → tính như 0.7m²

Expression: area × unitPrice
  = 0.7 × 200,000 = 140,000 VND

Price Round Step = 1,000 VND:
  → Giá bán = 140,000 VND
```

Khi thay đổi phải tạo Version mới.

Không sửa Version cũ.

# Định mức vật liệu (Material Requirement)

Định mức vật liệu dùng để tính lượng nguyên vật liệu cần sử dụng để sản xuất.

Không dùng để tính giá bán.

Đây là dữ liệu phục vụ:

- Giá vốn
- Kho
- Sản xuất
- BOM

---

## Material Requirement Version

Một sản phẩm có thể có nhiều phiên bản định mức vật liệu.

Ví dụ:

```text
Version 1

↓

Khung Xingfa

↓

Nhôm A
```

Sau một thời gian.

```text
Version 2

↓

Đổi sang

Nhôm B
```

Không được cập nhật Version cũ.

Muốn thay đổi phải tạo Version mới.

Đơn hàng đã tạo luôn sử dụng đúng Version tại thời điểm xác nhận.

---

## Material Requirement Item

Mỗi dòng định mức gồm:

- Nguyên liệu
- Công thức tính (expression)
- Tỷ lệ hao hụt (%)
- Bước làm tròn (roundStep) — chiều luôn là làm tròn **lên** (ceiling)

`roundStep = 0` hoặc để trống = không làm tròn.

Ví dụ: `roundStep = 0.1` → kết quả làm tròn lên bội số của 0.1.

Ví dụ

| Nguyên liệu | Công thức | Hao hụt | roundStep |
|-------------|-----------|----------|-----------|
| Vải | width × height × 2 | 5% | 0.1 |
| Khung | (width + height) × 2 | 3% | 0.5 |
| Ray | width × 2 | 0% | 0.1 |
| Bánh xe | doorCount × 2 | 0% | 1 |
| Tay nắm | doorCount | 0% | 1 |

---

## Quy tắc tính định mức

ERP sẽ tính theo thứ tự:

```text
Expression

↓

Waste %

↓

Round Rule

↓

Material Quantity
```

Ví dụ

```text
width × height × 2

↓

1.20m²

↓

+5%

↓

1.26m²

↓

Round 0.1m²

↓

1.30m²
```

Đây là số lượng cuối cùng dùng để:

- Sinh Order BOM
- Tính giá vốn
- Trừ kho

---

# Cấu trúc chi phí

Phiên bản V1 chỉ quản lý hai loại chi phí.

## 1. Giá vốn nguyên liệu

Được tính tự động.

```text
Order BOM

×

Material Price

=

Material Cost
```

---

## 2. Chi phí bổ sung

Người dùng nhập chi phí bổ sung **mỗi đơn vị** cho từng dòng sản phẩm.

```text
additionalCostPerUnit × quantity = additionalCost (mỗi OrderItem)
```

Ví dụ: gia công, đóng gói, vận chuyển.

ERP không tách riêng từng loại trong V1.

---

## Tổng chi phí

```text
Total Cost

=

Material Cost

+

Additional Cost
```

---

## Lợi nhuận

```text
Profit

=

Revenue

-

Total Cost
```

---

## Tỷ suất lợi nhuận

```text
Profit Margin

=

Profit

/

Revenue
```

---

## Thời điểm ghi nhận

Khi Đơn hàng chuyển sang **Đang sản xuất**, hệ thống tính và lưu trực tiếp vào Order:

```text
-- Mỗi OrderItem:
itemRevenue        = sellingPrice × quantity × (1 − discount%)
itemMaterialCost   = sum(OrderBomItem.totalCost)
itemAdditionalCost = additionalCostPerUnit × quantity
itemTotalCost      = itemMaterialCost + itemAdditionalCost
itemProfit         = itemRevenue − itemTotalCost

-- Tổng Order:
revenue        = sum(itemRevenue)
materialCost   = sum(itemMaterialCost)
additionalCost = sum(itemAdditionalCost)
totalCost      = materialCost + additionalCost
profit         = revenue − totalCost
profitMargin   = profit / revenue
```

Dashboard chỉ đọc các trường đã lưu, không tính lại.

---

# Chức năng

## Danh mục sản phẩm

- Danh sách
- Thêm
- Chỉnh sửa
- Tìm kiếm
- Lọc
- Phân trang
- Quản lý trạng thái

---

## Nguyên liệu

- Danh sách
- Thêm
- Chỉnh sửa
- Quản lý giá nguyên liệu

---

## Thông số sản phẩm

- Thêm Parameter
- Chỉnh sửa Parameter
- Sắp xếp thứ tự
- Required
- Min
- Max
- Step
- Tham gia báo giá
- Tham gia định mức

---

## Quy tắc báo giá

- Danh sách Version
- Tạo Version mới
- Chỉnh sửa Version nháp
- Kích hoạt Version
- Preview giá bán

---

## Định mức vật liệu

- Danh sách Version
- Tạo Version mới
- Chỉnh sửa Version nháp
- Kích hoạt Version
- Preview lượng vật tư
- Preview giá vốn

---

## Export

Cho phép xuất:

- Danh sách sản phẩm
- Product Parameter
- Pricing Rule
- Material Requirement

---

# Business Rule

- Một Product thuộc đúng một Product Type.
- Một Product sử dụng một Unit.
- Một Product có nhiều Product Parameter.
- Một Product có đúng một Pricing Rule. Pricing Rule đó có nhiều Pricing Rule Version.
- Một Product có đúng một Material Requirement. Material Requirement đó có nhiều Material Requirement Version.
- Chỉ có một Pricing Rule Version hoạt động tại một thời điểm.
- Chỉ có một Material Requirement Version hoạt động tại một thời điểm.
- Không được sửa Version đã phát hành.
- Muốn thay đổi phải tạo Version mới.
- Chỉ Product ACTIVE mới được sử dụng trong Báo giá và Đơn hàng.
- Pricing Rule chỉ dùng để tính giá bán.
- Material Requirement chỉ dùng để tính giá vốn và sản xuất.
- Hai Rule hoàn toàn độc lập.
- Material Requirement Item không lưu số lượng cố định.
- Chỉ lưu công thức tính.
- Order BOM là kết quả sinh ra từ Material Requirement.
- Chỉ được xóa Product ở trạng thái DRAFT (Soft Delete).
- Product ACTIVE và INACTIVE không được xóa.
- additionalCost nhập ở cấp OrderItem theo đơn vị (additionalCostPerUnit × quantity).
- Doanh thu và lợi nhuận được ghi nhận khi Đơn hàng chuyển sang Đang sản xuất.
- Dashboard chỉ đọc dữ liệu đã lưu trong Order, không tính lại.

---

# Business Snapshot Rule

Khi Đơn hàng chuyển sang trạng thái:

```text
Đang sản xuất
```

Hệ thống phải Snapshot toàn bộ.

Bao gồm:

## Sản phẩm

- Product
- Product Parameter

## Báo giá

- Pricing Rule Version
- Công thức
- Quy tắc báo giá

## Định mức

- Material Requirement Version
- Danh sách Material Requirement Item

## Giá nguyên liệu

- Material
- Material Price
- Nhà cung cấp

## Order BOM

Mỗi dòng gồm:

- Material Code
- Material Name
- Quantity
- Unit
- Unit Cost
- Total Cost

## Chi phí

- Revenue
- Material Cost
- Additional Cost
- Total Cost
- Profit
- Profit Margin

Sau khi Snapshot được tạo.

Mọi thay đổi của Product, Pricing Rule, Material Requirement hoặc Material Price đều không làm thay đổi dữ liệu của Order.

---

# Validation

## Khi tạo Product

Bắt buộc:

- Mã
- Tên
- Loại sản phẩm
- Đơn vị tính

Không bắt buộc:

- Pricing Rule
- Material Requirement

Sản phẩm được tạo ở trạng thái DRAFT.

---

## Khi chuyển ACTIVE

Bắt buộc:

- Có Product Parameter.
- Có Pricing Rule Version hoạt động.
- Có Material Requirement Version hoạt động.

Nếu chưa đủ điều kiện.

Không được ACTIVE.

---

## Khi báo giá

Chỉ cho phép chọn Product:

- ACTIVE
- Có Pricing Rule
- Có Material Requirement

---

# Quan hệ dữ liệu

```text
                   Product Type
                        │
                        ▼
                     Product
                        │
      ┌─────────────────┼──────────────────┐
      ▼                 ▼                  ▼
Product Parameter   Pricing Rule        Material Requirement
                        │ (1-1)               │ (1-1)
                        ▼                     ▼
               Pricing Rule Version   Material Requirement Version
                        │                     │
                        ▼                     ▼
               Pricing Rule Item    Material Requirement Item
                                              │
                                              ▼
                                           Material
                                              │
                                              ▼
                                       Material Price

──────────────────────────────────────────────────────────

Order

      │

      ▼

Order Configuration

      │

      ├──────────────► Pricing Rule

      │

      ├──────────────► Material Requirement

      │

      ▼

Order BOM

      │

      ▼

Material Cost

      │

      ▼

Revenue

↓

Profit
```

---

# Ghi chú

Module Product là trung tâm của toàn bộ ERP.

Các Module:

- Báo giá
- Đơn hàng
- Kho
- Sản xuất
- Dashboard

không tự tính giá hoặc định mức.

Mọi dữ liệu đều phải lấy từ Module Product.

Nếu phát hiện nghiệp vụ mới hoặc có xung đột với Module khác thì phải dừng và xác nhận lại trước khi triển khai.

Mọi thay đổi về quy tắc báo giá hoặc định mức vật liệu đều phải tạo Version mới để đảm bảo tính chính xác của dữ liệu lịch sử.

---

## Architecture Decisions

Các quyết định kiến trúc đã được thống nhất. Xem chi tiết tại `workbench/sprint-01/003-san-pham.md`.

Tóm tắt:

- Product 1-1 Pricing Rule (không phải 1-N). Đa dạng hóa giá thuộc về Module Báo giá.
- Product 1-1 Material Requirement (không phải 1-N). Đa dạng hóa quy trình sản xuất thuộc về Module Production.
- PricingRuleItem.ruleType dùng Enum, không dùng String.
- Pricing Rule chỉ dùng để tính giá bán, không dùng cho sản xuất.
- Material Requirement chỉ dùng để tính định mức và giá vốn, không dùng để tính giá bán.
