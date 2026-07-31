/**
 * Prisma client dùng chung.
 *
 * Prisma 7 bắt buộc dùng driver adapter thay vì để `url` trong schema, nên client
 * được tạo kèm adapter SQLite ở đây.
 *
 * Giữ một thể hiện duy nhất trên globalThis: ở chế độ dev, Next.js nạp lại module
 * mỗi lần sửa file, nếu không giữ lại sẽ sinh ra hàng chục kết nối tới file DB.
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const duongDan = process.env.DATABASE_URL ?? "file:./prisma/prmana.db";

function taoClient() {
  const adapter = new PrismaBetterSqlite3({ url: duongDan });
  return new PrismaClient({ adapter });
}

const g = globalThis as unknown as { _prisma?: ReturnType<typeof taoClient> };

export const db = g._prisma ?? taoClient();

if (process.env.NODE_ENV !== "production") g._prisma = db;
