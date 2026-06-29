# 07. Tiêu chí nghiệm thu

Tài liệu xác định các tiêu chí cần đạt để nghiệm thu dự án ERP-engine:

## 1. Tiêu chí tính năng (Functional Criteria)
*   [ ] Tất cả các tính năng trong danh mục yêu cầu phải hoạt động đúng nghiệp vụ.
*   [ ] Hệ thống phân quyền hoạt động chính xác (User không thể truy cập tài nguyên vượt quá quyền hạn).
*   [ ] Dữ liệu giao dịch được lưu trữ và tính toán chính xác tuyệt đối (đặc biệt là tiền tệ và số lượng tồn kho).

## 2. Tiêu chí phi tính năng (Non-functional Criteria)
*   [ ] **Hiệu năng:** Thời gian phản hồi API trung bình < 500ms cho các truy vấn thông thường.
*   [ ] **Bảo mật:** Tất cả kết nối qua HTTPS, mật khẩu được mã hóa an toàn (bcrypt/argon2).
*   [ ] **Giao diện:** Thân thiện, hỗ trợ responsive tốt trên các kích thước màn hình phổ biến.
