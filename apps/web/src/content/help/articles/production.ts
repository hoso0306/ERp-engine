import type { HelpArticle } from "../types";

// Nhóm "Sản xuất & giao hàng".
export const PRODUCTION_ARTICLES: HelpArticle[] = [
  {
    slug: "san-xuat",
    title: "Sản xuất: in phiếu, bắt đầu, hoàn thành",
    summary: "Theo dõi phiếu sản xuất của từng xưởng, in phiếu và báo hoàn thành",
    group: "Sản xuất & giao hàng",
    updatedAt: "2026-10-12",
    requiredAnyPermission: ["production.view"],
    sections: [
      {
        heading: "Phiếu sản xuất từ đâu ra",
        bullets: [
          "Khi báo giá được bấm \"Khách đã duyệt\", hệ thống tự tạo phiếu sản xuất cho từng xưởng có sản phẩm trong đơn.",
          "Trạng thái phiếu: Chờ sản xuất → Đang sản xuất → Đã hoàn thành. Phiếu chỉ bị huỷ khi đơn hàng bị huỷ lúc phiếu còn đang chờ.",
        ],
      },
      {
        heading: "Tìm phiếu cần làm",
        steps: [
          "Vào Sản xuất.",
          "Dùng các tab Tất cả / Chờ SX / Đang SX / Hoàn thành / Đã huỷ.",
          "Lọc theo xưởng, người phụ trách, ngày tạo, hạn hoàn thành; hoặc gõ mã phiếu / mã đơn / tên khách để tìm.",
        ],
        links: [{ label: "Mở Sản xuất", href: "/production" }],
      },
      {
        heading: "In phiếu và bắt đầu sản xuất",
        steps: [
          "In 1 phiếu: mở phiếu → bấm \"In và bắt đầu SX\" → trang in mở ra → bấm \"In và bắt đầu SX / Tải PDF\".",
          "In nhiều phiếu cùng lúc: ở danh sách, tích chọn các phiếu → bấm \"In và bắt đầu SX (số phiếu)\".",
          "Phiếu đang Chờ sản xuất sẽ TỰ chuyển sang Đang sản xuất khi in.",
        ],
        bullets: [
          "Không cần in: mở phiếu và bấm \"Bắt đầu sản xuất\".",
          "In lại phiếu đang làm hoặc đã xong chỉ ghi nhận lần in, không đổi trạng thái.",
          "Trên trang in có thể sửa thông tin nhà xe của đơn (biểu tượng bút chì ở phần Nhà xe) trước khi in.",
        ],
        notes: [
          "Muốn in phiếu, tài khoản cần có quyền \"Bắt đầu sản xuất\" vì in phiếu sẽ bắt đầu sản xuất luôn.",
        ],
      },
      {
        heading: "Báo hoàn thành",
        steps: [
          "Làm xong: mở phiếu → bấm \"Hoàn thành\" → xác nhận.",
          "Khi TẤT CẢ phiếu của một đơn hàng đã hoàn thành, đơn hàng tự chuyển sang \"Hoàn thành SX\" để bộ phận giao hàng gửi xe.",
        ],
        notes: [
          "Phiếu chưa hoàn thành sau một số ngày (mặc định 2 ngày kể từ khi tạo) sẽ hiện trong cảnh báo \"Phiếu SX trễ hạn\" trên Dashboard.",
        ],
      },
    ],
  },
  {
    slug: "giao-hang",
    title: "Giao hàng: gửi xe, khách nhận, huỷ đơn",
    summary: "Theo dõi đơn hàng từ lúc sản xuất xong tới khi khách nhận",
    group: "Sản xuất & giao hàng",
    updatedAt: "2026-10-12",
    requiredAnyPermission: ["sales-order.view"],
    sections: [
      {
        heading: "Trạng thái đơn hàng",
        bullets: [
          "Đang sản xuất → Hoàn thành SX (tự chuyển khi mọi phiếu sản xuất xong) → Đã gửi xe → Đã giao.",
          "Trạng thái thanh toán (Chưa thanh toán / Thanh toán một phần / Đã thanh toán) tự cập nhật theo tiền đã thu, không chỉnh tay.",
        ],
        links: [{ label: "Mở danh sách Đơn hàng", href: "/orders" }],
      },
      {
        heading: "Trước khi giao",
        steps: [
          "Mở đơn hàng → kiểm tra mục \"Địa chỉ giao hàng\". Giao tới địa chỉ khác (vd công trình khác): bấm biểu tượng bút chì để sửa riêng cho đơn này.",
          "Thông tin nhà xe: sửa ở trang in phiếu sản xuất. Mặc định lấy theo nhà xe đã lưu ở khách hàng.",
          "Cần in đơn: bấm \"In / Tải PDF\".",
        ],
      },
      {
        heading: "Gửi xe và khách nhận",
        steps: [
          "Khi đơn ở trạng thái Hoàn thành SX và đã giao cho nhà xe: bấm \"Gửi xe\" → xác nhận. Đơn chuyển Đã gửi xe.",
          "Khi khách báo đã nhận hàng: bấm \"Khách đã nhận\" → xác nhận. Đơn chuyển Đã giao.",
        ],
        notes: [
          "Mọi thao tác đều được ghi lại kèm người làm và thời gian trong mục \"Lịch sử hoạt động\" cuối trang đơn hàng.",
        ],
      },
      {
        heading: "Huỷ đơn",
        steps: [
          "Mở đơn → bấm \"Huỷ đơn\" → nhập lý do → xác nhận.",
        ],
        bullets: [
          "Chỉ huỷ được khi CHƯA có phiếu sản xuất nào bắt đầu làm (kể cả đã in phiếu). Đơn đã giao cũng không huỷ được.",
          "Các phiếu sản xuất đang chờ của đơn được huỷ theo.",
          "Nếu đơn đã thu cọc, hệ thống đóng công nợ của đơn; việc hoàn tiền cho khách làm ngoài phần mềm.",
          "Khách trả lại một phần hàng sau khi giao: dùng Hàng hoàn, không huỷ đơn.",
        ],
      },
    ],
  },
];
