# Build context PHẢI là gốc repo (pnpm monorepo dùng chung 1 lockfile):
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com -t erp-web .

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
# `pnpm install` cài cho CẢ workspace (kể cả khi chỉ build image web) — apps/api
# có postinstall chạy `prisma generate`, cần prisma/schema.prisma có mặt trước.
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
# NEXT_PUBLIC_* được Next.js nhúng thẳng vào bundle lúc build — phải truyền qua
# --build-arg, không thể chỉ set ENV lúc chạy container như biến server thường.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY apps/web apps/web
RUN pnpm --filter web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/web ./apps/web
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["./node_modules/.bin/next", "start"]
