import type { HelpArticle } from "../types";

// Nhóm "Quản trị".
export const ADMIN_ARTICLES: HelpArticle[] = [
  {
    slug: "nguoi-dung-va-phan-quyen",
    title: "Người dùng và phân quyền",
    summary: "Tạo tài khoản cho nhân viên, cấp lại mật khẩu, chọn ai được làm gì",
    group: "Quản trị",
    updatedAt: "2026-10-12",
    requiredAnyPermission: ["user.view", "role.view"],
    sections: [
      {
        heading: "Cách phân quyền hoạt động",
        bullets: [
          "Mỗi nhân viên có 1 tài khoản và thuộc đúng 1 Vai trò (vd Kế toán, Kinh doanh, Sản xuất).",
          "Vai trò quyết định người đó được xem / làm gì. Đổi quyền của vai trò là đổi cho tất cả nhân viên thuộc vai trò đó.",
          "Menu và nút bấm tự ẩn với người không có quyền.",
        ],
      },
      {
        heading: "Tạo tài khoản cho nhân viên mới",
        steps: [
          "Vào Cài đặt → Người dùng → \"Tạo người dùng\".",
          "Nhập Email, Số điện thoại, Tên hiển thị và chọn Vai trò → bấm \"Tạo\".",
          "Hệ thống hiện MẬT KHẨU TẠM — chỉ hiện một lần. Sao chép và gửi ngay cho nhân viên.",
          "Nhân viên đăng nhập bằng email hoặc số điện thoại cùng mật khẩu tạm, sau đó bắt buộc đặt mật khẩu mới trước khi dùng.",
        ],
        links: [{ label: "Mở Cài đặt → Người dùng", href: "/settings/users" }],
      },
      {
        heading: "Nhân viên quên mật khẩu hoặc nghỉ việc",
        bullets: [
          "Quên mật khẩu: ở danh sách Người dùng, bấm biểu tượng \"Cấp lại mật khẩu tạm\" ở dòng của nhân viên → gửi mật khẩu tạm mới cho họ.",
          "Nghỉ việc: mở người dùng → bỏ tích \"Đang hoạt động\" → Lưu. Tài khoản không đăng nhập được nữa nhưng lịch sử thao tác của họ vẫn giữ nguyên.",
          "Đổi vai trò: mở người dùng → chọn Vai trò khác → Lưu.",
          "Tự đổi mật khẩu của mình: bấm vào tên tài khoản ở góc màn hình → \"Đổi mật khẩu\".",
        ],
      },
      {
        heading: "Chỉnh quyền của một vai trò",
        steps: [
          "Vào Cài đặt → Vai trò → bấm vào vai trò cần chỉnh.",
          "Quyền được chia theo nhóm (Khách hàng, Báo giá, Đơn hàng, Công nợ, Báo cáo…). Tích / bỏ tích từng quyền, hoặc tích cả nhóm.",
          "Bấm Lưu. Nhân viên thuộc vai trò đó cần tải lại trang (F5) để menu cập nhật.",
        ],
        bullets: [
          "\"Xem giá vốn\" là quyền nhạy cảm: thấy giá vốn, lãi/lỗ của báo giá và số liệu kinh doanh trên Dashboard.",
          "Nhóm \"Báo cáo\": mỗi ô là một báo cáo — xem bài \"Phân quyền xem từng báo cáo\".",
          "Mọi lần cấp / bỏ quyền đều được hệ thống ghi lại.",
        ],
        links: [{ label: "Mở Cài đặt → Vai trò", href: "/settings/roles" }],
      },
      {
        heading: "Tạo hoặc ngừng dùng vai trò",
        bullets: [
          "Tạo vai trò mới: Cài đặt → Vai trò → \"Tạo vai trò\" → nhập mã và tên → bấm \"Tạo\", sau đó mở vai trò để tích quyền.",
          "Không dùng nữa: mở vai trò → \"Vô hiệu hoá vai trò\". Vai trò không bị xoá để giữ lịch sử.",
        ],
      },
    ],
  },
];
