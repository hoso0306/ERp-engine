import type { ChangelogRelease } from "./types";

// Nhật ký cập nhật — mới nhất ở TRÊN CÙNG. Mỗi đợt deploy có tính năng mới
// cho người dùng: thêm 1 phần tử vào đầu mảng (cùng commit với tính năng).
export const CHANGELOG: ChangelogRelease[] = [
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
