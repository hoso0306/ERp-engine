# Foundation

> **Tên file:** `workbench/sprint-01/000-foundation.md`

# Cách làm việc

Mỗi lần chỉ thực hiện một Task.

Prompt sử dụng:

Hoàn thành Task XX trong workbench/sprint-01/000-foundation.md

Sau khi hoàn thành:
- Dừng.
- Tóm tắt thay đổi.
- Đề xuất Commit Message.
- Chờ yêu cầu tiếp theo.

# Trạng thái

- [V ] Task 01 - Khởi tạo Workspace
- [V ] Task 02 - Khởi tạo Frontend
- [ ] Task 03 - Khởi tạo Backend
- [ ] Task 04 - Docker & PostgreSQL
- [ ] Task 05 - Prisma ORM
- [ ] Task 06 - Health Check
- [ ] Task 07 - Kết nối Frontend & Backend
- [ ] Task 08 - Kiểm tra Foundation
---

# Mục tiêu

Xây dựng nền tảng (Foundation) cho hệ thống ERP.

Sau khi hoàn thành, dự án phải có thể chạy đầy đủ Frontend, Backend và Database trên môi trường Development.

---

# Quy tắc

* Chỉ thực hiện **01 Task** mỗi lần.
* Hoàn thành xong một Task thì dừng.
* Không tự ý làm sang Task tiếp theo.
* Nếu cần quyết định về kiến trúc hoặc công nghệ, hãy hỏi trước khi thực hiện.

---

# Task 01 - Khởi tạo workspace

## Mục tiêu

Khởi tạo Workspace của dự án theo đúng cấu trúc đã thống nhất.

### Definition of Done

- [v ] pnpm workspace hoạt động.
- [v ] apps được nhận diện.
- [v ] packages được nhận diện.
- [v ] Có thể chạy lệnh pnpm trên toàn bộ dự án.

**Commit đề xuất**

```text
chore(workspace): initialize workspace
```

---

# Task 02 - Khởi tạo Frontend

## Mục tiêu

Khởi tạo ứng dụng Web sử dụng Next.js và TypeScript.

### Definition of Done

* [ v] Frontend chạy thành công.
* [v ] Không lỗi.
* [v ] Có thể truy cập bằng trình duyệt.

**Commit đề xuất**

```text
chore(web): initialize Next.js application
```

---

# Task 03 - Khởi tạo Backend

## Mục tiêu

Khởi tạo API sử dụng NestJS và TypeScript.

### Definition of Done

* [ v] Backend chạy thành công.
* [ v] Không lỗi.
* [ v] Có thể gọi API.

**Commit đề xuất**

```text
chore(api): initialize NestJS application
```

---

# Task 04 - Docker & PostgreSQL

## Mục tiêu

Thiết lập môi trường Docker và PostgreSQL cho Development.

### Definition of Done

* [ v] Docker Compose hoạt động.
* [ v] PostgreSQL chạy thành công.
* [ v] Có thể kết nối Database.

**Commit đề xuất**

```text
chore(docker): setup PostgreSQL container
```

---

# Task 05 - Prisma ORM

## Mục tiêu

Thiết lập Prisma và kết nối với PostgreSQL.

### Definition of Done

* [ v] Prisma hoạt động.
* [ v] Migration đầu tiên thành công.
* [ v] Prisma Studio mở được.

**Commit đề xuất**

```text
chore(database): setup Prisma ORM
```

---

# Task 06 - Health Check

## Mục tiêu

Tạo API kiểm tra trạng thái hoạt động của hệ thống.

### Definition of Done

* [v ] API hoạt động.
* [v ] Trả về trạng thái hệ thống.
* [v ] Có thể kiểm tra Backend đã chạy.

**Commit đề xuất**

```text
feat(api): add health check endpoint
```

---

# Task 07 - Kết nối Frontend & Backend

## Mục tiêu

Frontend có thể gọi thành công API từ Backend.

### Definition of Done

* [ v] Frontend gọi được API.
* [ v] Hiển thị dữ liệu thành công.
* [ v] Không lỗi CORS.
* [ v] Không lỗi Network.

**Commit đề xuất**

```text
feat(web): connect frontend to backend
```

---

# Task 08 - Kiểm tra Foundation

## Mục tiêu

Kiểm tra toàn bộ Foundation trước khi bắt đầu phát triển nghiệp vụ.

### Definition of Done

* [ v] Frontend hoạt động.
* [ v] Backend hoạt động.
* [ v] PostgreSQL hoạt động.
* [ v] Prisma hoạt động.
* [ v] Docker hoạt động.
* [ v] Health API hoạt động.
* [ v] Build thành công.
* [ v] Không còn lỗi TypeScript.
* [ v] Không còn lỗi Runtime.

**Commit đề xuất**

```text
chore(project): complete foundation setup
```

---

# Ghi chú

Sau khi hoàn thành toàn bộ Foundation, mới được bắt đầu phát triển các Module nghiệp vụ như Dashboard, Khách hàng, Sản phẩm, Đơn hàng...

Trong giai đoạn Foundation, không triển khai chức năng nghiệp vụ hoặc giao diện ERP.

# Sprint tiếp theo

Sau khi Foundation hoàn thành:

- Dashboard
- Khách hàng
- Sản phẩm
- Báo giá
- Đơn hàng
- Kho
- Công nợ
- Hàng hoàn
- Báo cáo
- Cài đặt