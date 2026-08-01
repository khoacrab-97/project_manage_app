/**
 * Prisma client dùng chung.
 *
 * Prisma 7 bắt buộc dùng driver adapter thay vì để `url` trong schema, nên client
 * được tạo kèm adapter Postgres ở đây.
 *
 * Giữ một thể hiện duy nhất trên globalThis: ở chế độ dev, Next.js nạp lại module
 * mỗi lần sửa file, nếu không giữ lại sẽ sinh ra hàng chục kết nối tới Postgres.
 */
import { taoPrismaClient } from "@/lib/prisma-client";

type PrismaDb = ReturnType<typeof taoPrismaClient>;

const g = globalThis as unknown as { _prisma?: PrismaDb };
let client: PrismaDb | undefined;

function layClient() {
  if (!client) {
    client = process.env.NODE_ENV !== "production" ? (g._prisma ?? taoPrismaClient()) : taoPrismaClient();
    if (process.env.NODE_ENV !== "production") g._prisma = client;
  }
  return client;
}

export const db = new Proxy({} as PrismaDb, {
  get(_target, prop) {
    const value = Reflect.get(layClient(), prop);
    return typeof value === "function" ? value.bind(layClient()) : value;
  },
});
