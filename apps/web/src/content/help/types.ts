// Mục "Hướng dẫn & cập nhật" (workbench/sprint-04/030) — nội dung tách khỏi
// giao diện: các file trong thư mục này chỉ chứa DỮ LIỆU, trang /help chỉ đọc
// và hiển thị. Mỗi đợt cập nhật tính năng: thêm 1 mục vào changelog.ts và
// sửa/thêm bài trong articles/ — trong cùng commit với tính năng.

export interface HelpLink {
  label: string;
  href: string;
}

export interface HelpSection {
  heading: string;
  // Đoạn mở đầu ngắn của mục.
  intro?: string;
  // Các bước làm theo thứ tự (hiển thị đánh số).
  steps?: string[];
  // Ý liệt kê không theo thứ tự.
  bullets?: string[];
  // Lưu ý quan trọng (hiển thị trong khung nổi bật).
  notes?: string[];
  // Nút mở thẳng màn hình liên quan.
  links?: HelpLink[];
}

export type HelpGroup =
  | "Tính năng mới"
  | "Khách hàng & bán hàng"
  | "Sản xuất & giao hàng"
  | "Tiền & công nợ"
  | "Quản trị";

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  group: HelpGroup;
  // Ngày cập nhật nội dung gần nhất (yyyy-mm-dd).
  updatedAt: string;
  // Chỉ hiện bài cho người có ÍT NHẤT 1 quyền trong danh sách. Bỏ trống =
  // ai đăng nhập cũng thấy.
  requiredAnyPermission?: string[];
  sections: HelpSection[];
}

export interface ChangelogItem {
  title: string;
  description: string;
  bullets?: string[];
  // Ẩn dòng này với người không có quyền dùng tính năng tương ứng.
  requiredAnyPermission?: string[];
  // Bài hướng dẫn chi tiết của tính năng (nếu có).
  articleSlug?: string;
}

export interface ChangelogRelease {
  // yyyy-mm-dd
  date: string;
  title: string;
  items: ChangelogItem[];
  notes?: string[];
}

export function canSeeHelp(
  requiredAnyPermission: string[] | undefined,
  hasPermission: (key: string) => boolean,
): boolean {
  return !requiredAnyPermission || requiredAnyPermission.some(hasPermission);
}

export function formatHelpDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
