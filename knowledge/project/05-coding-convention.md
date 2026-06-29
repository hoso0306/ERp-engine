# Coding Convention

> **Tên file:** `knowledge/project/05-coding-convention.md`

---

# Mục đích

Tài liệu này quy định các quy ước đặt tên và tổ chức mã nguồn trong dự án ERP.

Mục tiêu là đảm bảo toàn bộ hệ thống có cấu trúc thống nhất, dễ đọc, dễ bảo trì và dễ mở rộng.

---

# Quy ước chung

* Sử dụng tiếng Anh cho toàn bộ tên file, thư mục, class, biến và API.
* Sử dụng PascalCase cho Class, Interface, Type và Prisma Model.
* Sử dụng camelCase cho biến, hàm và thuộc tính.
* Sử dụng kebab-case cho tên file và thư mục.
* Không viết tắt tên Module hoặc Business.

---

# Quy ước Module

Tên Module sử dụng số ít (Singular).

Ví dụ:

```text
customer
order
product
warehouse
dashboard
report
```

---

# Quy ước API

RESTful API.

Sử dụng danh từ số nhiều.

Ví dụ:

```text
/api/customers
/api/orders
/api/products
/api/reports
```

Không sử dụng động từ trong URL.

Đúng:

```text
POST   /api/customers
GET    /api/customers
GET    /api/customers/:id
PATCH  /api/customers/:id
DELETE /api/customers/:id
```

Sai:

```text
/createCustomer
/updateCustomer
/deleteCustomer
```

---

# Quy ước Database

Tên bảng:

* snake_case
* số nhiều

Ví dụ:

```text
customers
orders
order_items
products
warehouses
```

Tên cột:

```text
created_at
updated_at
customer_id
product_id
```

---

# Quy ước Prisma

Model:

```text
Customer
Order
Product
Warehouse
```

Field:

```text
createdAt
updatedAt
customerId
```

---

# Quy ước NestJS

Tên Class:

```text
CustomerModule
CustomerController
CustomerService
CustomerRepository
```

DTO:

```text
CreateCustomerDto
UpdateCustomerDto
CustomerQueryDto
```

Entity:

```text
CustomerEntity
```

---

# Quy ước Next.js

Trang:

```text
customers/page.tsx
orders/page.tsx
```

Component:

```text
CustomerTable
CustomerForm
CustomerFilter
OrderCard
```

Hook:

```text
useCustomer
useOrder
useDashboard
```

---

# Quy ước Service

Toàn bộ dịch vụ bên ngoài phải được đóng gói thành Service.

Ví dụ:

```text
StorageService
ExcelService
PdfService
MailService
NotificationService
CacheService
AiService
LoggerService
```

Business Module không gọi trực tiếp thư viện hoặc API của bên thứ ba.

---

# Quy ước Git

Branch:

```text
main
develop
feature/customer
feature/dashboard
bugfix/order
```

Commit:

```text
feat(customer): add customer CRUD

feat(order): add order workflow

fix(report): calculate revenue correctly

refactor(product): simplify pricing logic

docs(project): update business flow

chore(workspace): initialize foundation
```

---

# Quy ước thư mục

```text
apps/
packages/
knowledge/
workbench/
docker/
scripts/
templates/
```

Không tạo thư mục ngoài quy hoạch nếu chưa được thống nhất.

---

# Nguyên tắc phát triển

* Một Module chỉ giải quyết một nghiệp vụ.
* Một Commit chỉ hoàn thành một Task.
* Không code khi chưa hiểu nghiệp vụ.
* Không tự ý thêm tính năng ngoài Workbench.
* Ưu tiên code đơn giản, dễ đọc và dễ bảo trì.
* Khi có nhiều cách triển khai, ưu tiên giải pháp đơn giản hơn nếu vẫn đáp ứng yêu cầu.

---

# Nguyên tắc AI Coding

* Claude Code quyết định cách triển khai kỹ thuật.
* Workbench chỉ mô tả mục tiêu và kết quả mong muốn.
* Nếu thiếu nghiệp vụ, Claude phải hỏi trước khi code.
* Không tự ý thay đổi Tech Stack.
* Không tự ý cài thêm thư viện nếu chưa được yêu cầu.
* Mỗi lần chỉ thực hiện một Task trong Workbench.

---

# Phiên bản

| Thuộc tính | Giá trị    |
| ---------- | ---------- |
| Phiên bản  | 1.0        |
| Trạng thái | Draft      |
| Cập nhật   | 29/06/2026 |
