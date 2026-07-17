import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";

// UX gate: chỉ kiểm tra có cookie hay không, KHÔNG verify chữ ký/hạn JWT ở
// edge — an ninh thật vẫn do BE (Authorization header + AuthGuard, xem
// workbench/sprint-02/003-fe-dang-nhap.md mục "Nợ kỹ thuật"). Proxy này
// chỉ tránh render trang nội bộ khi rõ ràng chưa đăng nhập.
export function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!token && !isLoginPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (token && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
