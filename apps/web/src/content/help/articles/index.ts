import type { HelpArticle, HelpGroup } from "../types";
import { NEW_FEATURE_ARTICLES } from "./new-features";
import { SALES_ARTICLES } from "./sales";
import { PRODUCTION_ARTICLES } from "./production";
import { FINANCE_ARTICLES } from "./finance";
import { ADMIN_ARTICLES } from "./admin";

// Thứ tự nhóm hiển thị ở tab "Hướng dẫn sử dụng".
export const HELP_GROUP_ORDER: HelpGroup[] = [
  "Tính năng mới",
  "Khách hàng & bán hàng",
  "Sản xuất & giao hàng",
  "Tiền & công nợ",
  "Quản trị",
];

export const HELP_ARTICLES: HelpArticle[] = [
  ...NEW_FEATURE_ARTICLES,
  ...SALES_ARTICLES,
  ...PRODUCTION_ARTICLES,
  ...FINANCE_ARTICLES,
  ...ADMIN_ARTICLES,
];
