# Quy trình nghiệp vụ

> **Tên file:** `02-quy-trinh-nghiep-vu.md`

---

# 1. Mục đích

Mô tả quy trình làm việc thực tế của Xưởng Rèm Thăng Long để làm cơ sở xây dựng các chức năng của hệ thống ERP.

---

# 2. Quy trình tổng thể

```text
Khách hàng

↓

Tiếp nhận yêu cầu

↓

Báo giá

↓

Khách xác nhận

↓

Đặt cọc hoặc công nợ

↓

Tạo đơn hàng

↓

Sản xuất

↓

Giao hàng

↓

Thanh toán

↓

Bảo hành

↓

Hàng hoàn (nếu có)
```

---

# 3. Chi tiết từng bước

## Bước 1. Tiếp nhận khách hàng

Nguồn khách chủ yếu:

* Khách cũ
* Zalo
* Điện thoại

Nhân viên tạo hoặc cập nhật thông tin khách hàng trên hệ thống.

---

## Bước 2. Báo giá

Nhân viên lập báo giá.

Báo giá được gửi cho khách hàng xác nhận.

Không cần khảo sát trực tiếp trong đa số trường hợp.

---

## Bước 3. Xác nhận đơn hàng

Sau khi khách đồng ý báo giá:

* Có thể đặt cọc.
* Hoặc bán theo công nợ.

Sau đó tạo Đơn hàng.

---

## Bước 4. Sản xuất

Khi đã có đầy đủ thông số kích thước và sản phẩm:

* Xưởng tiến hành sản xuất.

Không có bước kiểm tra chất lượng riêng.

---

## Bước 5. Giao hàng

Hàng được giao bằng xe vận chuyển.

Không cần quản lý lắp đặt.

Không cần biên bản nghiệm thu.

---

## Bước 6. Thanh toán

Có hai hình thức:

* Thanh toán ngay.
* Công nợ.

Nếu công nợ:

* Thời hạn tối đa 30 ngày.

---

## Bước 7. Bảo hành

Sau khi giao hàng hoàn tất:

* Đơn hàng chuyển sang trạng thái Bảo hành.

Hệ thống cần lưu thời gian bảo hành.

---

## Bước 8. Hàng hoàn

Các trường hợp phát sinh:

* Kích thước không phù hợp.
* Khách hàng thay đổi yêu cầu.

Hệ thống cần quản lý:

* Ngày hoàn.
* Lý do hoàn.
* Giá trị hàng hoàn.
* Trạng thái xử lý.

---

# 4. Quy tắc nghiệp vụ

* Một khách hàng có thể có nhiều báo giá.
* Một báo giá có thể chuyển thành một đơn hàng.
* Một khách hàng có thể có nhiều đơn hàng.
* Một đơn hàng chỉ thuộc một khách hàng.
* Một đơn hàng có thể phát sinh công nợ.
* Một đơn hàng có thể phát sinh hàng hoàn.
* Một đơn hàng có một trạng thái tại một thời điểm.

---

# 5. Trạng thái đơn hàng

```text
Báo giá

↓

Chờ xác nhận

↓

Đã xác nhận

↓

Đang sản xuất

↓

Đã giao hàng

↓

Đã thanh toán

↓

Bảo hành

↓

Hoàn thành
```

Nếu phát sinh hàng hoàn:

```text
Đã giao hàng

↓

Hàng hoàn

↓

Đang xử lý

↓

Hoàn tất
```

---

# 6. Ghi chú 

Quy trình trên phản ánh cách vận hành hiện tại của doanh nghiệp.

Trong quá trình triển khai, nếu khách hàng thay đổi quy trình hoặc bổ sung nghiệp vụ mới, tài liệu này sẽ được cập nhật trước khi phát triển phần mềm.
