import type { HelpArticle } from "../types";

// Nhóm "Khách hàng & bán hàng".
export const SALES_ARTICLES: HelpArticle[] = [
  {
    slug: "quan-ly-khach-hang",
    title: "Quản lý khách hàng",
    summary: "Thêm, sửa, nhập Excel khách hàng và cài chiết khấu riêng cho khách",
    group: "Khách hàng & bán hàng",
    updatedAt: "2026-10-12",
    requiredAnyPermission: ["customer.view"],
    sections: [
      {
        heading: "Thêm khách hàng mới",
        steps: [
          "Vào Khách hàng → bấm \"Thêm khách hàng\".",
          "Nhập Tên khách hàng và Số điện thoại (bắt buộc). Số điện thoại không được trùng với khách đã có.",
          "Điền thêm nếu có: Email, Mã số thuế (khách công ty), địa chỉ, Nhóm khách hàng, Tuyến giao hàng, Mức độ ưu tiên, Thời hạn và Hạn mức công nợ, thông tin Nhà xe mặc định.",
          "Bấm \"Tạo khách hàng\". Hệ thống tự cấp mã khách hàng.",
        ],
        bullets: [
          "Nếu để trống: Nhóm khách hàng mặc định \"Đại lý\", Hạn mức công nợ mặc định 30.000.000 ₫, Mức độ ưu tiên mặc định Trung bình.",
          "Thông tin Nhà xe mặc định sẽ được điền sẵn vào phiếu khi giao hàng, sửa riêng từng đơn được.",
        ],
        links: [{ label: "Thêm khách hàng", href: "/customers/new" }],
      },
      {
        heading: "Tìm, lọc và xuất danh sách",
        bullets: [
          "Ô tìm kiếm tìm theo tên, số điện thoại hoặc mã khách — gõ không dấu vẫn tìm được.",
          "Lọc theo Nhóm khách hàng, Tuyến giao hàng, Mức độ ưu tiên.",
          "Bấm Export để tải danh sách đang lọc ra Excel.",
        ],
      },
      {
        heading: "Nhập nhiều khách hàng từ Excel",
        steps: [
          "Bấm \"Import\" → \"Tải file mẫu (.xlsx)\".",
          "Điền dữ liệu vào file mẫu (các cột Nhóm KH, Tuyến GH, Ưu tiên, Trạng thái có sẵn danh sách để chọn).",
          "Chọn file đã điền → xem trước → xác nhận import.",
        ],
        bullets: [
          "Dòng nào lỗi (thiếu tên/SĐT, sai giá trị…) chỉ bỏ qua đúng dòng đó và báo số dòng lỗi; các dòng khác vẫn được nhập.",
          "Số điện thoại trùng với khách đã có: hệ thống không tạo khách mới mà chỉ điền thêm vào những thông tin còn trống của khách đó.",
        ],
      },
      {
        heading: "Xem chi tiết và chỉnh sửa",
        steps: [
          "Bấm vào tên khách trong danh sách.",
          "Tab Thông tin: thông tin cơ bản, kinh doanh và chiết khấu riêng. Tab Đơn hàng: các đơn của khách. Tab Công nợ: số còn nợ, phiếu thu.",
          "Bấm \"Chỉnh sửa\" để sửa thông tin, \"Ghi nhận thanh toán\" để thu tiền của khách.",
        ],
      },
      {
        heading: "Cài chiết khấu riêng cho khách",
        intro: "Dùng khi khách được giảm giá cố định theo loại sản phẩm (vd đại lý được giảm 10% rèm cuốn).",
        steps: [
          "Mở chi tiết khách → mục \"Chiết khấu loại sản phẩm\" → \"Thêm chiết khấu\".",
          "Chọn loại sản phẩm và nhập % chiết khấu → Lưu.",
        ],
        notes: [
          "Chiết khấu được tự áp vào mỗi dòng sản phẩm khi thêm vào báo giá MỚI của khách. Báo giá đã tạo trước đó không bị thay đổi.",
        ],
      },
      {
        heading: "Ngừng hoạt động và xoá khách",
        bullets: [
          "Trạng thái \"Ngừng hoạt động\": khách vẫn hiện trong danh sách nhưng không nằm trong tab \"Khách cần nhắc\".",
          "Xoá khách: khách chuyển sang tab \"Đã xoá\", có thể khôi phục lại từ tab đó. Dữ liệu đơn hàng cũ của khách không bị mất.",
        ],
      },
    ],
  },
  {
    slug: "bao-gia-va-don-hang",
    title: "Báo giá → khách duyệt → đơn hàng",
    summary: "Lập báo giá, gửi khách, chốt đơn để hệ thống tự sinh đơn hàng và phiếu sản xuất",
    group: "Khách hàng & bán hàng",
    updatedAt: "2026-10-27",
    requiredAnyPermission: ["quotation.view"],
    sections: [
      {
        heading: "Luồng tổng quát",
        bullets: [
          "Nháp → Đã gửi → Đã duyệt (hoặc Đã huỷ).",
          "Khi bấm \"Khách đã duyệt\", hệ thống TỰ tạo Đơn hàng, Phiếu sản xuất cho từng xưởng liên quan và Công nợ — không cần nhập lại.",
          "Sau khi duyệt, báo giá và đơn hàng giữ nguyên giá đã chốt; đổi giá sản phẩm sau này không ảnh hưởng đơn cũ.",
        ],
      },
      {
        heading: "1. Tạo báo giá",
        steps: [
          "Vào Báo giá → \"Tạo báo giá\".",
          "Chọn Khách hàng (gõ tên hoặc số điện thoại để tìm). Ngày hết hạn, Hạn giao hàng, Ghi chú có thể bỏ trống.",
          "Bấm \"Tạo báo giá\" → mở trang chi tiết báo giá ở trạng thái Nháp.",
        ],
        links: [{ label: "Tạo báo giá", href: "/quotations/new" }],
      },
      {
        heading: "2. Thêm sản phẩm và chỉnh giá",
        steps: [
          "Bấm \"Thêm sản phẩm\" → chọn sản phẩm, nhập các thông số (kích thước…), số lượng và ghi chú nếu cần → Lưu. Hệ thống tự tính giá theo bảng giá hiện hành.",
          "Bán lẻ vật tư (không qua sản xuất): bấm \"Thêm vật tư\".",
          "Dòng giống nhau: dùng \"Nhân đôi dòng này\" rồi sửa thông số cho nhanh.",
          "Giảm giá cho cả báo giá: bấm \"Giảm thêm\", nhập số tiền giảm (trừ trên tổng thanh toán đã gồm VAT) và lý do.",
          "Sửa khách hàng, hạn giao, phí vận chuyển, ghi chú: bấm \"Sửa thông tin\".",
        ],
        notes: [
          "Chiết khấu từng dòng được lấy tự động theo chiết khấu đã cài cho khách (xem bài Quản lý khách hàng), không sửa tay trong báo giá.",
          "Chỉ đổi được khách hàng khi báo giá còn ở trạng thái Nháp.",
        ],
      },
      {
        heading: "3. Gửi khách",
        steps: [
          "Bấm \"In Đơn\" để mở bản in. Tại đây có thể \"Sao chép ảnh báo giá\" để dán thẳng vào Zalo, hoặc xuất PDF.",
          "Bấm \"Gửi báo giá\" → xác nhận. Báo giá chuyển sang Đã gửi (vẫn sửa được nếu khách yêu cầu đổi).",
        ],
        notes: [
          "Trên bản in báo giá và đơn hàng, đơn giá nhập tay chỉ được ưu tiên khi lớn hơn 0. Nếu bằng 0 hoặc không có, bản in dùng giá đã lưu của chứng từ; thành tiền giữ nguyên.",
        ],
      },
      {
        heading: "4. Khách đồng ý → chốt đơn",
        steps: [
          "Mở báo giá đang ở trạng thái Đã gửi → bấm \"Khách đã duyệt\" → xác nhận.",
          "Hệ thống tạo Đơn hàng và Phiếu sản xuất. Bấm \"Xem đơn hàng\" để theo dõi tiếp.",
        ],
        notes: [
          "Nếu hiện cảnh báo \"Không thể duyệt: giá … được tính bằng phiên bản quy tắc giá đã cũ\": bảng giá đã thay đổi sau khi lập báo giá. Bấm \"Tính lại giá\", xem phần chênh lệch; nếu giá đổi, nên gửi lại khách xác nhận trước khi duyệt.",
        ],
      },
      {
        heading: "Huỷ và điều chỉnh đặc biệt",
        bullets: [
          "Khách không mua nữa: bấm \"Huỷ báo giá\" và nhập lý do.",
          "\"Xem lãi/lỗ\" (chỉ Chủ doanh nghiệp/Quản trị) cho biết giá vốn và lợi nhuận ước tính của báo giá.",
          "\"Override\" chỉ dùng cho trường hợp đặc biệt cần đổi trạng thái bằng tay — bắt buộc nhập lý do và được ghi lại trong Lịch sử hoạt động.",
        ],
        links: [{ label: "Mở danh sách báo giá", href: "/quotations" }],
      },
    ],
  },
];
