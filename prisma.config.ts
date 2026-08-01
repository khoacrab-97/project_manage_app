/**
 * Cấu hình Prisma 7.
 * Từ bản 7, `url` không còn đặt trong schema.prisma nữa — đường dẫn cơ sở dữ liệu
 * khai báo ở đây cho CLI (migrate, studio, seed).
 */
// Prisma CLI không tự nạp .env như Next.js, phải nạp tay ở đây.
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// `prisma generate` chạy trong postinstall/build và không cần kết nối DB thật.
// Runtime vẫn chặn thiếu DATABASE_URL trong src/lib/prisma-client.ts.
const datasourceUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/prmana";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl,
  },
});
