import type { HelpArticle } from "../types";

// Nhóm "Tính năng mới" — bài cho các tính năng của đợt cập nhật gần đây.
export const NEW_FEATURE_ARTICLES: HelpArticle[] = [
  {
    slug: "doanh-so-theo-xuong",
    title: "Xem doanh số và lợi nhuận theo xưởng",
    summary: "Mỗi xưởng bán được bao nhiêu, lãi kế hoạch bao nhiêu, theo ngày/tháng, kèm danh sách phiếu sản xuất",
    group: "Tính năng mới",
    updatedAt: "2026-10-13",
    requiredAnyPermission: ["sales-order.view-cost", "report.revenue-by-production-center"],
    sections: [
      {
        heading: "Xem nhanh trên Dashboard",
        steps: [
          "Vào Dashboard, kéo xuống khối \"Doanh số theo xưởng\" (ngay dưới khối Doanh số theo nhân viên).",
          "Bấm vào ô thời gian ở góc phải khối để chọn khoảng cần xem (mặc định Tháng này).",
          "Mỗi dòng cho biết số đơn, doanh số, lợi nhuận kế hoạch và tỷ trọng của xưởng. Dòng \"Bán lẻ vật tư\" là các dòng bán vật tư lẻ, không qua xưởng nào.",
          "Bấm tên xưởng để mở báo cáo chi tiết của xưởng đó.",
        ],
        notes: [
          "Khối này chỉ hiện với tài khoản được xem giá vốn (Chủ doanh nghiệp, Quản trị hệ thống).",
        ],
        links: [{ label: "Mở Dashboard", href: "/dashboard" }],
      },
      {
        heading: "Xem chi tiết trong Báo cáo",
        steps: [
          "Vào Báo cáo → nhóm \"Sản xuất\" → \"Doanh thu theo xưởng\".",
          "Chọn kỳ cần xem (Tháng này, Tháng trước, Quý, Năm hoặc tự chọn ngày). Bảng có doanh thu và lợi nhuận kế hoạch của từng xưởng.",
          "Bấm tên một xưởng để xem: doanh thu, lợi nhuận kế hoạch, tỷ suất lợi nhuận theo Ngày / Tuần / Tháng / Năm kèm biểu đồ, và danh sách phiếu sản xuất của xưởng (lọc được theo trạng thái).",
          "Trên biểu đồ, tích ô \"Doanh thu\" và/hoặc \"Lợi nhuận kế hoạch\" để chọn số liệu muốn xem.",
        ],
        notes: [
          "Phần lợi nhuận trong Báo cáo chỉ hiện với người có thêm quyền xem báo cáo \"Lợi nhuận kế hoạch\" (Cài đặt → Vai trò). Không có quyền này vẫn xem được doanh thu.",
        ],
        links: [{ label: "Mở báo cáo Doanh thu theo xưởng", href: "/reports/production-centers" }],
      },
      {
        heading: "Cách tính",
        bullets: [
          "Doanh số của xưởng = tổng thành tiền các dòng sản phẩm thuộc xưởng đó, theo ngày chốt đơn (ngày khách duyệt báo giá). Đơn đã huỷ không tính.",
          "Một đơn có sản phẩm ở nhiều xưởng sẽ được đếm ở mỗi xưởng, nên tổng cột \"Số đơn\" có thể lớn hơn số đơn thực tế.",
          "Số liệu CHƯA trừ hàng hoàn, nên có thể cao hơn \"Doanh thu\" ở báo cáo Doanh thu (báo cáo đó đã trừ phần công ty hỗ trợ khi hoàn hàng).",
          "Lợi nhuận kế hoạch của xưởng = doanh thu các sản phẩm thuộc xưởng − VAT − giá vốn của chính các sản phẩm đó (giá vốn chốt lúc duyệt báo giá).",
          "Khoản \"Giảm thêm\" nhập cho cả đơn được chia cho các xưởng theo tỷ lệ doanh số trong đơn, nên cộng lợi nhuận các xưởng khớp đúng tổng lợi nhuận kế hoạch ở báo cáo Lợi nhuận kế hoạch.",
          "Lợi nhuận là số KẾ HOẠCH (theo giá vốn định mức), chưa phải lãi thực tế, và không trừ hàng hoàn.",
        ],
      },
    ],
  },
  {
    slug: "nhac-khach-lau-khong-mua",
    title: "Nhắc khách lâu không mua",
    summary: "Danh sách khách đã lâu không có đơn để chủ động liên hệ chăm sóc",
    group: "Tính năng mới",
    updatedAt: "2026-10-11",
    requiredAnyPermission: ["customer.view"],
    sections: [
      {
        heading: "Xem danh sách khách cần nhắc",
        steps: [
          "Vào Khách hàng → tab \"Khách cần nhắc\".",
          "Danh sách xếp khách ưu tiên Cao lên trước, sau đó tới khách quá hạn lâu nhất.",
          "Dùng các nút Tất cả / Cao / Trung bình / Thấp để lọc theo mức độ ưu tiên.",
          "Bấm tên khách để mở thông tin và gọi/nhắn cho khách.",
        ],
        links: [{ label: "Mở trang Khách hàng", href: "/customers" }],
      },
      {
        heading: "Khi nào một khách được nhắc",
        bullets: [
          "Số ngày không mua = từ ngày đặt đơn gần nhất (không tính đơn đã huỷ) tới hôm nay.",
          "Khách được nhắc khi số ngày không mua đạt ngưỡng theo mức độ ưu tiên: Cao 30 ngày, Trung bình 60 ngày, Thấp 90 ngày.",
          "Cột \"Quá ngưỡng\" cho biết đã quá bao nhiêu ngày so với ngưỡng.",
          "Khách chưa từng có đơn trên phần mềm tính từ ngày tạo khách, hiển thị \"Chưa mua\".",
          "Khách đang ở trạng thái Ngừng hoạt động và khách đã xoá không nằm trong danh sách.",
        ],
        notes: [
          "Muốn một khách được nhắc sớm hơn hoặc muộn hơn, đổi Mức độ ưu tiên của khách đó (Khách hàng → mở khách → Chỉnh sửa).",
        ],
      },
      {
        heading: "Đổi số ngày nhắc",
        intro: "Dành cho người có quyền Cài đặt.",
        steps: [
          "Vào Cài đặt → Cấu hình hệ thống → tab \"Khách hàng\".",
          "Sửa số ngày cho từng mức ưu tiên Cao / Trung bình / Thấp.",
          "Bấm Lưu. Danh sách khách cần nhắc áp dụng ngưỡng mới ngay.",
        ],
        links: [{ label: "Mở Cấu hình hệ thống", href: "/settings/system" }],
      },
    ],
  },
  {
    slug: "loc-khach-theo-muc-uu-tien",
    title: "Lọc khách hàng theo mức độ ưu tiên",
    summary: "Lọc danh sách và xuất Excel khách hàng theo mức Cao / Trung bình / Thấp",
    group: "Tính năng mới",
    updatedAt: "2026-10-11",
    requiredAnyPermission: ["customer.view"],
    sections: [
      {
        heading: "Cách dùng",
        steps: [
          "Vào Khách hàng → tab \"Tất cả\".",
          "Ở thanh lọc, chọn ô \"Mức độ ưu tiên\" → Cao, Trung bình hoặc Thấp. Có thể kết hợp với Tìm kiếm, Nhóm khách hàng, Tuyến giao hàng.",
          "Muốn xuất đúng danh sách đang lọc ra Excel, bấm Export — file xuất áp dụng cả bộ lọc mức độ ưu tiên.",
          "Chọn lại \"Tất cả mức ưu tiên\" để bỏ lọc.",
        ],
        notes: [
          "Mức độ ưu tiên của khách cũng quyết định sau bao lâu khách được đưa vào tab \"Khách cần nhắc\".",
        ],
        links: [
          { label: "Mở trang Khách hàng", href: "/customers" },
          { label: "Hướng dẫn quản lý khách hàng", href: "/help/quan-ly-khach-hang" },
        ],
      },
    ],
  },
  {
    slug: "phan-quyen-tung-bao-cao",
    title: "Phân quyền xem từng báo cáo",
    summary: "Chọn vai trò nào được xem báo cáo nào",
    group: "Tính năng mới",
    updatedAt: "2026-10-11",
    requiredAnyPermission: ["role.view"],
    sections: [
      {
        heading: "Cách cài đặt",
        steps: [
          "Vào Cài đặt → Vai trò → bấm vào vai trò cần chỉnh (vd Kế toán).",
          "Kéo tới nhóm \"Báo cáo\": mỗi ô tích là một báo cáo (Doanh thu, Lợi nhuận kế hoạch, Doanh thu theo xưởng…). Các ô \"Xuất DS … (backup)\" là quyền tải file backup dữ liệu.",
          "Bỏ tích báo cáo không muốn cho vai trò này xem, hoặc tích thêm báo cáo muốn cho xem.",
          "Bấm Lưu.",
        ],
        bullets: [
          "Vai trò không còn báo cáo nào sẽ không thấy mục \"Báo cáo\" trên menu.",
          "Trang Báo cáo chỉ hiện những báo cáo người dùng được phép xem.",
          "Sau khi đổi quyền, người dùng của vai trò đó cần tải lại trang (F5) để menu cập nhật.",
        ],
        notes: [
          "Bỏ quyền \"Lợi nhuận kế hoạch\" chưa ẩn hết số liệu giá vốn: báo cáo \"Tốc độ phát triển\" và file backup \"Xuất DS đơn hàng\" vẫn có cột lợi nhuận / giá vốn kế hoạch.",
        ],
        links: [
          { label: "Mở Cài đặt → Vai trò", href: "/settings/roles" },
          { label: "Hướng dẫn người dùng & phân quyền", href: "/help/nguoi-dung-va-phan-quyen" },
        ],
      },
    ],
  },
];
