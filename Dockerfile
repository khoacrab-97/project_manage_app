# Ảnh chạy ứng dụng Quản lý Doanh thu – Chi phí Thi công Xây dựng.
# Dùng output "standalone" của Next.js: ảnh cuối chỉ chứa server và đúng những
# node_modules cần thiết, không mang theo toàn bộ dependency dev.

# ---------- Giai đoạn 1: cài dependency ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci cài đúng theo lockfile, tái lập được giữa các lần build.
RUN npm ci

# ---------- Giai đoạn 2: build ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- Giai đoạn 3: chạy ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# 0.0.0.0 để container nhận được kết nối từ ngoài; nếu để 127.0.0.1 thì
# publish cổng ra ngoài sẽ không ăn thua.
ENV HOSTNAME=0.0.0.0

# Không chạy bằng root.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Thứ tự copy đúng theo yêu cầu của standalone:
# server.js và node_modules rút gọn nằm ở .next/standalone,
# còn .next/static và public phải copy vào đúng chỗ thì CSS/ảnh mới lên.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

# Báo sống bằng chính trang chủ; không thêm endpoint /health chỉ để phục vụ việc này.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
