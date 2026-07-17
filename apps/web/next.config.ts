import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Giới hạn phạm vi output file tracing về riêng apps/web — mặc định Next.js
  // suy ra tracing root là thư mục chứa pnpm-lock.yaml (root monorepo), kéo
  // theo cả node_modules nặng của apps/api (NestJS, Prisma...) vào quá trình
  // trace, gây OOM khi build trên Netlify (bước "Collecting build traces").
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
