# Tổng quan dự án

> **Tên file:** `01-tong-quan-du-an.md`

---

# 1. Thông tin dự án

**Tên dự án:** ERP Quản lý Xưởng Rèm Thăng Long

**Khách hàng:** Xưởng Rèm Thăng Long

**Người phát triển:** Sơn Nguyễn

**Thời gian thực hiện:** 20 ngày

**Giá trị hợp đồng:** 69.000.000 VNĐ

**Đã thanh toán:** 30.000.000 VNĐ

---

# 2. Mục tiêu dự án

Xây dựng phần mềm ERP nội bộ giúp doanh nghiệp quản lý toàn bộ quy trình làm việc trên một hệ thống duy nhất.

Mục tiêu:

* Quản lý khách hàng
* Quản lý báo giá
* Quản lý đơn hàng
* Quản lý sản phẩm
* Quản lý kho
* Quản lý công nợ
* Quản lý hàng hoàn
* Thống kê và báo cáo
* Import / Export Excel

---

# 3. Người sử dụng

Hệ thống phục vụ khoảng **03 người dùng nội bộ**.

Bao gồm:

* Chủ doanh nghiệp
* Kế toán và kinh doanh
* Nhân viên kho và sản xuất

---

# 4. Phạm vi triển khai

Bao gồm:

* Dashboard
* Khách hàng
* Báo giá
* Đơn hàng
* Sản phẩm
* Kho
* Công nợ
* Hàng hoàn
* Báo cáo
* Import / Export Excel

Chưa triển khai:

* Mobile App
* Website bán hàng
* AI
* Đồng bộ với phần mềm kế toán

---

# 5. Công nghệ sử dụng

Frontend

* Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui

Backend

* NestJS

Database

* PostgreSQL

ORM

* Prisma

Quản lý mã nguồn

* Git
* GitHub

AI hỗ trợ lập trình

* Claude Code

---

# 6. Nguyên tắc phát triển

* Mỗi chức năng phải được hoàn thành độc lập.
* Mỗi Task tương ứng một Commit.
* Chỉ phát triển trong phạm vi dự án.
* Không tự ý thêm chức năng ngoài yêu cầu khách hàng.
* Ưu tiên code dễ đọc, dễ bảo trì và có thể tái sử dụng.

---

# 7. Tiêu chí hoàn thành

Dự án hoàn thành khi:

* Các chức năng trong phạm vi hoạt động đúng.
* Người dùng có thể sử dụng trong thực tế.
* Không còn lỗi nghiêm trọng.
* Có thể sao lưu dữ liệu.
* Có tài liệu hướng dẫn cơ bản.
* Khách hàng nghiệm thu.

---

# 8. Ghi chú

Đây là dự án đầu tiên được phát triển trên nền tảng ERP Engine.

Trong quá trình triển khai, ưu tiên hoàn thành đúng tiến độ và đảm bảo chất lượng. Các tính năng mở rộng sẽ được xem xét ở các phiên bản tiếp theo.
