# Build context PHẢI là gốc repo (pnpm monorepo dùng chung 1 lockfile):
#   docker build -f apps/api/Dockerfile -t erp-api .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
# prisma/ phải có mặt TRƯỚC `pnpm install` — postinstall của apps/api chạy
# `prisma generate` ngay lúc install, cần schema.prisma tồn tại tại thời điểm đó.
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter api build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api ./apps/api
WORKDIR /repo/apps/api
EXPOSE 3001
# migrate deploy áp dụng migration đã có — KHÔNG dùng `prisma db push` ở production
# (xem workbench/sprint-04/001-trien-khai-va-ban-giao.md mục 2.6).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
