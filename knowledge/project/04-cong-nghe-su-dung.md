# Công nghệ sử dụng

> **Tên file:** `05-cong-nghe-su-dung.md`

---

# Mục đích

Tài liệu này mô tả các công nghệ được sử dụng trong dự án ERP Quản lý Xưởng Rèm Thăng Long.

Trong quá trình phát triển, không tự ý thay đổi công nghệ nếu chưa được thống nhất.

---

# Frontend

| Thành phần | Công nghệ       |
| ---------- | --------------- |
| Framework  | Next.js         |
| Ngôn ngữ   | TypeScript      |
| UI         | shadcn/ui       |
| CSS        | Tailwind CSS    |
| Icon       | Lucide React    |
| Form       | React Hook Form |
| Validation | Zod             |
| Table      | TanStack Table  |

---

# Backend

| Thành phần | Công nghệ   |
| ---------- | ----------- |
| Framework  | NestJS      |
| Ngôn ngữ   | TypeScript  |
| ORM        | Prisma ORM  |
| API        | RESTful API |

---

# Database

| Thành phần | Công nghệ  |
| ---------- | ---------- |
| Database   | PostgreSQL |

---

# Xác thực & Phân quyền

| Thành phần     | Công nghệ                        |
| -------------- | -------------------------------- |
| Authentication | JWT                              |
| Authorization  | RBAC (Role-Based Access Control) |

---

# Lưu trữ dữ liệu

| Thành phần      | Công nghệ                 |
| --------------- | ------------------------- |
| File Upload     | Lưu trên VPS (`/uploads`) |
| Backup Database | PostgreSQL Dump           |
| Backup File     | Nén thư mục `/uploads`    |

## Quy ước

Không truy cập trực tiếp vào thư mục `/uploads`.

Toàn bộ thao tác lưu, đọc và xóa file phải thông qua `StorageService`.

Ví dụ:

* `storageService.save(file)`
* `storageService.delete(path)`
* `storageService.getUrl(path)`

Việc tách riêng `StorageService` giúp hệ thống dễ dàng chuyển sang Cloudflare R2, Amazon S3 hoặc dịch vụ lưu trữ khác trong tương lai mà không cần sửa các Module nghiệp vụ.

---

# Triển khai hệ thống

| Thành phần    | Công nghệ     |
| ------------- | ------------- |
| Hệ điều hành  | Ubuntu Server |
| Reverse Proxy | Nginx         |
| Container     | Docker        |
| DNS / SSL     | Cloudflare    |

---

# Quản lý mã nguồn

| Thành phần      | Công nghệ |
| --------------- | --------- |
| Version Control | Git       |
| Repository      | GitHub    |

---

# AI hỗ trợ phát triển

| Công cụ          | Mục đích                                                    |
| ---------------- | ----------------------------------------------------------- |
| Claude Code Pro  | Phát triển, refactor và review code                         |
| Google AI Studio | Prototype giao diện                                         |
| ChatGPT          | Phân tích nghiệp vụ, thiết kế kiến trúc và hỗ trợ lập trình |

---

# Nguyên tắc kiến trúc

Để đảm bảo hệ thống dễ mở rộng và bảo trì, mọi dịch vụ bên ngoài phải được đóng gói (Wrapper) thành các Service riêng.

Business Module **không được gọi trực tiếp** đến thư viện hoặc dịch vụ bên ngoài.

Các Service chuẩn của hệ thống:

| Service               | Chức năng                                       |
| --------------------- | ----------------------------------------------- |
| `StorageService`      | Quản lý Upload, Download và Xóa file            |
| `ExcelService`        | Import và Export Excel                          |
| `PdfService`          | Sinh file PDF                                   |
| `MailService`         | Gửi Email                                       |
| `NotificationService` | Gửi Email, Zalo, Telegram và các thông báo khác |
| `CacheService`        | Quản lý Cache                                   |
| `AiService`           | Tích hợp AI                                     |
| `LoggerService`       | Ghi log hệ thống                                |

## Quy định bắt buộc

Business Module chỉ được phép gọi các Service trên.

**Không gọi trực tiếp:**

* File System (`fs`)
* SMTP
* Cloudflare R2
* Amazon S3
* OpenAI API
* Google Gemini API
* Thư viện Excel
* Thư viện PDF
* Redis Client
* Bất kỳ SDK của bên thứ ba nào

Nếu sau này thay đổi công nghệ (ví dụ chuyển từ lưu file trên VPS sang Cloudflare R2), chỉ cần sửa Service tương ứng mà không ảnh hưởng đến Business Module.

---

# Quy ước phát triển

* Sử dụng TypeScript cho toàn bộ Frontend và Backend.
* Ưu tiên thư viện phổ biến, ổn định và có cộng đồng lớn.
* Hạn chế cài thêm thư viện nếu chưa thực sự cần thiết.
* Mọi thay đổi về công nghệ phải được cập nhật vào tài liệu này trước khi triển khai.

---

# Phiên bản

| Thuộc tính | Giá trị    |
| ---------- | ---------- |
| Phiên bản  | 1.0        |
| Trạng thái | Draft      |
| Cập nhật   | 29/06/2026 |
