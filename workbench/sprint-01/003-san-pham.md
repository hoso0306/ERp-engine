# Milestone 03 - Module Sản phẩm

> **Tên file:** `workbench/sprint-01/003-san-pham.md`

---

# Mục tiêu

Hoàn thành Module Quản lý Sản phẩm theo mô hình Configure-to-Order (CTO).

Sau khi hoàn thành, Module phải sẵn sàng để Module Báo giá, Đơn hàng, Kho và Sản xuất sử dụng.

---

# Phạm vi

Chỉ phát triển Module Sản phẩm.

Không sửa hoặc phát triển Module khác.

Nếu phát hiện nghiệp vụ chưa rõ hoặc xung đột phải dừng và hỏi người dùng trước khi tiếp tục.

---

# Tham chiếu

Trước khi thực hiện cần đọc:

* `.claude/CLAUDE.md`
* `knowledge/project/05-coding-convention.md`
* `knowledge/modules/product.md`

Chỉ đọc thêm tài liệu khác nếu thật sự cần thiết.

---

# Quy trình làm việc

* Mỗi lần chỉ thực hiện **01 Task**.
* Hoàn thành xong Task thì dừng.
* Tóm tắt những gì đã thực hiện.
* Liệt kê các file đã tạo hoặc chỉnh sửa.
* Đề xuất Commit Message.
* Chờ Task tiếp theo.

---

# Task 01 - Thiết kế Data Model

## Mục tiêu

Thiết kế toàn bộ Data Model của Module Product.

Bao gồm:

* Product Type
* Unit
* Product
* Material
* Material Price
* Product Parameter
* Pricing Rule
* Pricing Rule Version
* Material Requirement
* Material Requirement Version
* Material Requirement Item

### Definition of Done

- [x] Đề xuất đầy đủ Data Model.
- [x] Đề xuất Relationship.
- [x] Đề xuất Index.
- [x] Đề xuất Version Strategy.
- [x] Chờ người dùng xác nhận trước khi code.

**Commit**

```text
docs(product): design product data model
```

---

# Task 02 - Backend Product

## Mục tiêu

Hoàn thành Backend CRUD cho Module Product.

### Bao gồm

- Prisma Schema
- Migration
- Repository
- Service
- Controller
- DTO
- Validation

### Definition of Done

- [x] Database hoạt động.
- [x] CRUD Product hoạt động.
- [x] Quản lý trạng thái DRAFT / ACTIVE / INACTIVE.
- [x] Soft Delete chỉ áp dụng cho Product DRAFT.
- [x] CRUD Product Type hoạt động.
- [x] CRUD Unit hoạt động.
- [x] CRUD Material hoạt động.
- [x] CRUD Material Price hoạt động.
- [x] API Build thành công.

**Commit**

```text
feat(product): backend product management
```

---

# Task 03 - Danh mục sản phẩm

## Mục tiêu

Hoàn thành giao diện quản lý sản phẩm.

### Bao gồm

- Danh sách
- Tìm kiếm
- Bộ lọc
- Phân trang
- Thêm
- Chỉnh sửa
- Trạng thái

### Definition of Done

- [x] UI hoạt động.
- [x] Gọi API thành công.
- [x] Soft Delete chỉ áp dụng cho Product DRAFT.
- [x] Product ACTIVE và INACTIVE không được xóa.
- [x] Build thành công.

**Commit**

```text
feat(product): product management ui
```

---

# Task 04 - Quản lý nguyên liệu

## Mục tiêu

Hoàn thành quản lý Nguyên liệu và Giá nguyên liệu.

### Bao gồm

- Material
- Material Price
- Lịch sử giá
- Giá mặc định

### Definition of Done

- [x] CRUD Material.
- [x] Mã nguyên liệu sinh tự động (NL000001), cho phép sửa lại.
- [x] CRUD Material Price (supplierId, price, effectiveFrom, effectiveTo, isDefault).
- [x] Đánh dấu isDefault để hệ thống ưu tiên khi tính giá vốn.
- [x] Xem lịch sử giá của từng nguyên liệu.
- [x] Build thành công.

**Commit**

```text
feat(product): material management
```

---

# Task 05 - Thông số sản phẩm

## Mục tiêu

Hoàn thành Product Parameter.

### Bao gồm

Kiểu dữ liệu:

- NUMBER
- TEXT
- ENUM
- BOOLEAN

Thuộc tính:

- Required
- Default Value
- Min
- Max
- Step
- Display Order
- Dùng cho báo giá
- Dùng cho định mức vật liệu

### Definition of Done

- [ ] CRUD Product Parameter.
- [ ] UI hoạt động.
- [ ] Build thành công.

**Commit**

```text
feat(product): product parameter
```

---

# Task 06 - Quy tắc báo giá

## Mục tiêu

Hoàn thành Pricing Rule.

### Bao gồm

- Pricing Rule Version
- Expression (công thức tính giá)
- Pricing Rule Item (MIN_AREA, MIN_DIMENSION)
- Price Round Step (làm tròn giá bán lên)

### Definition of Done

- [ ] CRUD Pricing Rule Version.
- [ ] CRUD Pricing Rule Item (type, targetParameter, minValue, description).
- [ ] Chỉ một Pricing Rule Version active tại một thời điểm.
- [ ] Validate Expression.
- [ ] Preview giá bán (áp dụng Rule Items → Expression → Price Round Step).
- [ ] Build thành công.

**Commit**

```text
feat(product): pricing rule
```

---

# Task 07 - Định mức vật liệu

## Mục tiêu

Hoàn thành Material Requirement.

### Bao gồm

- Material Requirement Version
- Material Requirement Item

Mỗi Item gồm:

- Material
- Expression
- Waste %
- Round Rule

Kết quả:

- Preview Material
- Preview Material Cost

### Definition of Done

- [ ] CRUD Material Requirement Version.
- [ ] CRUD Material Requirement Item (material, expression, wastePercent, roundStep).
- [ ] roundStep: nhập số thực dương, làm tròn lên (ceiling). 0 hoặc trống = không làm tròn.
- [ ] Chỉ một Material Requirement Version active tại một thời điểm.
- [ ] Validate Expression.
- [ ] Preview số lượng vật tư (sau waste% và roundStep).
- [ ] Preview giá vốn (số lượng × MaterialPrice).
- [ ] Build thành công.

**Commit**

```text
feat(product): material requirement
```

---

# Task 08 - Export

## Mục tiêu

Cho phép Export toàn bộ dữ liệu Module Product.

### Bao gồm

- Product
- Product Parameter
- Pricing Rule
- Material Requirement

### Definition of Done

- [ ] Export hoạt động.
- [ ] File đúng dữ liệu.
- [ ] Build thành công.

**Commit**

```text
feat(product): export product
```

---

# Task 09 - Hoàn thiện Module

## Mục tiêu

Kiểm tra và hoàn thiện toàn bộ Module.

### Definition of Done

- [ ] Không lỗi Runtime.
- [ ] Không lỗi TypeScript.
- [ ] Build thành công.
- [ ] Tự Review.
- [ ] Đề xuất Commit.
- [ ] Dừng.

**Commit**

```text
chore(product): complete product module
```

---

# Tiêu chí hoàn thành

Module được xem là hoàn thành khi:

- [ ] Hoàn thành toàn bộ Task.
- [ ] Đã Commit.
- [ ] Đã Push GitHub.
- [ ] Sẵn sàng cho Module Báo giá.

---

# Module tiếp theo

Sau khi hoàn thành Module Sản phẩm sẽ chuyển sang:

**004-bao-gia.md**

---

# Architecture Decisions

Đây là các quyết định kiến trúc đã được thống nhất trong quá trình review.

Các Task phía sau phải tuân thủ các quyết định này.

## Decision 01

Product có đúng 1 Pricing Rule.

Pricing Rule được quản lý bằng Version.

Không tạo nhiều Pricing Rule cho cùng một Product.

Nếu sau này có bảng giá theo khách hàng, đại lý hoặc khu vực thì sẽ xử lý bằng Module Báo giá (Price Policy / Price List), không xử lý trong Module Product.

---

## Decision 02

Product có đúng 1 Material Requirement.

Material Requirement được quản lý bằng Version.

Không tạo nhiều Material Requirement cho cùng một Product.

Nếu sau này có nhiều nhà máy hoặc nhiều quy trình sản xuất thì sẽ xử lý ở Module Production.

---

## Decision 03

PricingRuleItem.ruleType sử dụng Enum.

Không sử dụng String để đảm bảo type-safe và thống nhất.

---

## Decision 04

Pricing Rule chỉ dùng để tính giá bán.

Bao gồm:

* Báo giá
* Đơn hàng
* Doanh thu
* Lợi nhuận

Không dùng cho sản xuất.

---

## Decision 05

Material Requirement chỉ dùng để tính:

* Định mức vật liệu
* Giá vốn
* Sinh Order BOM
* Trừ kho

Không dùng để tính giá bán.
