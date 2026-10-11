import type { HelpArticle } from "../types";

// Nhóm "Tiền & công nợ".
export const FINANCE_ARTICLES: HelpArticle[] = [
  {
    slug: "thu-tien-va-cong-no",
    title: "Thu tiền và theo dõi công nợ",
    summary: "Ghi nhận tiền khách trả, xem ai đang nợ, giảm trừ công nợ khi cần",
    group: "Tiền & công nợ",
    updatedAt: "2026-10-12",
    requiredAnyPermission: ["debt.view"],
    sections: [
      {
        heading: "Công nợ từ đâu ra",
        bullets: [
          "Mỗi đơn hàng có một khoản công nợ, tự tạo khi báo giá được bấm \"Khách đã duyệt\" (bằng tổng thanh toán của đơn).",
          "Khách có thể có thêm \"Công nợ đầu kỳ\" — số nợ cũ từ trước khi dùng phần mềm.",
          "Số còn nợ và trạng thái thanh toán của đơn tự cập nhật mỗi khi ghi nhận tiền, không chỉnh tay.",
          "Hạn thanh toán bắt đầu tính từ khi đơn chuyển sang Đã giao, cộng thêm Thời hạn công nợ (số ngày) của khách. Quá hạn mà còn nợ thì hiện trong cảnh báo công nợ quá hạn.",
        ],
      },
      {
        heading: "Xem công nợ",
        intro: "Vào Công nợ, chọn một trong 3 cách xem:",
        bullets: [
          "Theo khách hàng — tổng số mỗi khách còn nợ, khách nào quá hạn, vượt hạn mức.",
          "Theo đơn hàng — công nợ từng đơn. Bấm vào một dòng để xem chi tiết và lịch sử thu.",
          "Phiếu thu — toàn bộ các lần đã thu tiền.",
        ],
        links: [{ label: "Mở Công nợ", href: "/debts" }],
      },
      {
        heading: "Thu tiền theo khách (cách thường dùng)",
        intro: "Dùng khi khách chuyển một khoản để trả cho nhiều đơn.",
        steps: [
          "Vào Công nợ → \"Theo khách hàng\" → bấm \"Ghi nhận thanh toán\" (hoặc mở chi tiết khách hàng → \"Ghi nhận thanh toán\").",
          "Chọn khách, nhập số tiền khách trả.",
          "Hệ thống tự chia số tiền cho các khoản nợ CŨ NHẤT trước (công nợ đầu kỳ được trừ trước tiên). Có thể sửa tay số tiền cấn cho từng đơn — tổng phải bằng đúng số tiền thu.",
          "Chọn phương thức Tiền mặt hoặc Chuyển khoản, ghi chú nếu cần → \"Ghi nhận thanh toán\".",
        ],
      },
      {
        heading: "Thu tiền cho một đơn cụ thể",
        steps: [
          "Vào Công nợ → \"Theo đơn hàng\" → mở đơn cần thu.",
          "Bấm \"Ghi nhận thanh toán\" → nhập số tiền, phương thức, ghi chú → xác nhận.",
        ],
        notes: [
          "Không thu được nhiều hơn số đơn còn nợ. Đơn đã huỷ không ghi nhận thanh toán được.",
        ],
      },
      {
        heading: "Giảm trừ công nợ",
        intro: "Dùng khi bớt cho khách một khoản mà không có tiền thật về (vd làm tròn, bồi thường). Hàng hoàn có phần công ty hỗ trợ được giảm trừ tự động — không cần làm ở đây.",
        steps: [
          "Mở chi tiết công nợ của đơn → bấm \"Giảm trừ công nợ\".",
          "Nhập số tiền và lý do (bắt buộc) → xác nhận.",
        ],
        bullets: [
          "Nếu số tiền nhập lớn hơn số đơn còn nợ, hệ thống chỉ giảm đúng bằng số còn nợ.",
          "Khoản giảm trừ được tính trừ vào doanh thu ở Dashboard và báo cáo Doanh thu.",
          "Mọi lần giảm trừ đều lưu người làm, thời gian và lý do.",
        ],
      },
    ],
  },
  {
    slug: "hang-hoan",
    title: "Hàng hoàn: khách trả lại hàng",
    summary: "Lập phiếu hoàn, chia phần phí khách chịu / công ty hỗ trợ, theo dõi kho thu hồi",
    group: "Tiền & công nợ",
    updatedAt: "2026-10-12",
    requiredAnyPermission: ["return.view"],
    sections: [
      {
        heading: "Tạo phiếu hoàn",
        steps: [
          "Mở đơn hàng của khách → mục \"Hàng hoàn\" → \"Tạo phiếu hoàn\". Hoặc vào Hàng hoàn → \"Tạo phiếu hoàn\" → chọn đơn hàng (không chọn được đơn đã huỷ).",
          "Tích các sản phẩm khách trả, nhập số lượng trả (không vượt quá cột \"Còn lại tối đa\"), chọn lý do (Sai kích thước, Sai màu, Lỗi sản xuất…) và ghi chú từng dòng nếu cần.",
          "Nhập Ngày trả, Người nhận, Ghi chú chung.",
        ],
        links: [{ label: "Mở Hàng hoàn", href: "/returns" }],
      },
      {
        heading: "Chia chi phí: khách chịu và công ty hỗ trợ",
        bullets: [
          "\"Tổng giá trị phiếu hoàn\" = giá trị hàng trả theo giá đã bán.",
          "\"Phí khách\" (nhập theo % hoặc số tiền) là phần khách chịu — khách vẫn phải trả khoản này.",
          "Phần còn lại là \"Công ty hỗ trợ\" (tự tính). Nếu lớn hơn 0 thì bắt buộc nhập \"Lý do Công ty hỗ trợ\".",
        ],
        steps: [
          "Kiểm tra lại số liệu → bấm \"Tạo phiếu hoàn\".",
          "Nếu có phần Công ty hỗ trợ, hệ thống TỰ giảm công nợ của đơn đúng bằng số tiền đó.",
        ],
        notes: [
          "Nếu thông báo \"Giảm trừ công nợ tự động không thành công\", mở chi tiết phiếu hoàn để thử lại giảm trừ.",
          "Phần Công ty hỗ trợ được trừ vào doanh thu ở Dashboard và báo cáo Doanh thu; phần khách chịu thì không.",
        ],
      },
      {
        heading: "Kho thu hồi",
        bullets: [
          "Hàng khách trả được theo dõi ở Hàng hoàn → tab \"Kho thu hồi\" với trạng thái Còn trong kho / Đã sử dụng / Đã thanh lý.",
          "Dashboard có mục \"Tồn kho thu hồi lâu\" cho hàng nằm trong kho thu hồi quá lâu.",
        ],
      },
    ],
  },
];
