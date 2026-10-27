import type { ChangelogRelease } from "./types";

// Nhật ký cập nhật — mới nhất ở TRÊN CÙNG. Mỗi đợt deploy có tính năng mới
// cho người dùng: thêm 1 phần tử vào đầu mảng (cùng commit với tính năng).
export const CHANGELOG: ChangelogRelease[] = [
  {
    date: "2026-10-27",
    title: "Sửa đơn giá trên bản in",
    items: [
      {
        title: "Hiển thị đúng đơn giá khi không nhập giá tay",
        description:
          "Bản in báo giá và đơn hàng chỉ ưu tiên đơn giá nhập tay lớn hơn 0. Khi giá nhập tay bằng 0, bản in dùng giá đã lưu của chứng từ, khắc phục trường hợp Mành Tăm và Mành Trúc hiển thị đơn giá 0. Thành tiền không thay đổi.",
        requiredAnyPermission: ["quotation.print"],
        articleSlug: "bao-gia-va-don-hang",
      },
    ],
  },
  {
    date: "2026-10-13",
    title: "Lợi nhuận kế hoạch theo xưởng",
    items: [
      {
        title: "Xem lợi nhuận kế hoạch của từng xưởng",
        description:
          "Bên cạnh doanh số, giờ xem được lợi nhuận kế hoạch của từng xưởng.",
        bullets: [
          "Dashboard → khối \"Doanh số theo xưởng\": thêm cột \"Lợi nhuận kế hoạch\".",
          "Báo cáo → Doanh thu theo xưởng: thêm tổng lợi nhuận và cột lợi nhuận từng xưởng.",
          "Trang chi tiết xưởng: thêm ô Lợi nhuận kế hoạch, Tỷ suất lợi nhuận; biểu đồ có ô tích chọn hiện Doanh thu / Lợi nhuận kế hoạch.",
          "Trong Báo cáo, chỉ người có thêm quyền xem báo cáo \"Lợi nhuận kế hoạch\" mới thấy phần lợi nhuận.",
        ],
        requiredAnyPermission: ["sales-order.view-cost", "report.profit"],
        articleSlug: "doanh-so-theo-xuong",
      },
    ],
  },
  {
    date: "2026-10-12",
    title: "Mục Hướng dẫn & cập nhật",
    items: [
      {
        title: "Hướng dẫn sử dụng ngay trong phần mềm",
        description:
          "Mục mới \"Hướng dẫn & cập nhật\" ở cuối menu bên trái: xem các thay đổi mới nhất và hướng dẫn từng bước cho các công việc hằng ngày. Mỗi người chỉ thấy hướng dẫn của những phần mình được phép dùng.",
      },
    ],
  },
  {
    date: "2026-10-11",
    title: "Doanh số theo xưởng, nhắc khách, phân quyền báo cáo",
    items: [
      {
        title: "Doanh số theo xưởng",
        description:
          "Xem mỗi xưởng bán được bao nhiêu, bao nhiêu đơn và chiếm bao nhiêu phần trăm doanh số.",
        bullets: [
          "Dashboard có thêm khối \"Doanh số theo xưởng\" (mặc định Tháng này).",
          "Báo cáo có thêm nhóm \"Sản xuất\" → \"Doanh thu theo xưởng\", bấm vào xưởng để xem doanh thu theo thời gian và danh sách phiếu sản xuất.",
          "Số liệu chưa trừ hàng hoàn.",
        ],
        requiredAnyPermission: ["sales-order.view-cost", "report.revenue-by-production-center"],
        articleSlug: "doanh-so-theo-xuong",
      },
      {
        title: "Nhắc khách lâu không mua",
        description:
          "Trang Khách hàng có thêm tab \"Khách cần nhắc\" — danh sách khách đã lâu không có đơn để chủ động liên hệ. Số ngày nhắc tính theo mức độ ưu tiên của khách (Cao 30, Trung bình 60, Thấp 90 ngày) và chỉnh được trong Cài đặt.",
        requiredAnyPermission: ["customer.view"],
        articleSlug: "nhac-khach-lau-khong-mua",
      },
      {
        title: "Lọc khách hàng theo mức độ ưu tiên",
        description:
          "Danh sách khách hàng có thêm bộ lọc Mức độ ưu tiên (Cao / Trung bình / Thấp). Nút Export cũng xuất theo bộ lọc này.",
        requiredAnyPermission: ["customer.view"],
        articleSlug: "loc-khach-theo-muc-uu-tien",
      },
      {
        title: "Phân quyền xem từng báo cáo",
        description:
          "Mỗi báo cáo là một quyền riêng, chọn được vai trò nào xem báo cáo nào tại Cài đặt → Vai trò → nhóm \"Báo cáo\". Quyền xem hiện tại giữ nguyên như trước.",
        requiredAnyPermission: ["role.view"],
        articleSlug: "phan-quyen-tung-bao-cao",
      },
    ],
    notes: [
      "Nếu chưa thấy tính năng mới, hãy tải lại trang (F5) hoặc đăng xuất rồi đăng nhập lại.",
    ],
  },
];
