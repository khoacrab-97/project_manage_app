/**
 * Chẩn đoán đăng nhập: kiểm tra đúng những gì Server Action làm.
 *   npx tsx prisma/thu-dang-nhap.ts <email> <matKhau>
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { kiemTraMatKhau } from "../src/lib/auth/mat-khau";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});

async function main() {
  console.log("  DATABASE_URL =", process.env.DATABASE_URL);

  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const matKhau = process.argv[3] ?? "";

  const u = await db.user.findUnique({ where: { email } });
  console.log("  Tim thay tai khoan   :", u ? "CO" : "KHONG");
  if (!u) {
    console.log("  Cac email dang co:");
    for (const x of await db.user.findMany({ select: { email: true } })) {
      console.log("    -", x.email);
    }
    return;
  }

  console.log("  isActive             :", u.isActive);
  console.log("  Do dai matKhauHash    :", u.matKhauHash.length, u.matKhauHash ? "" : "(RONG!)");
  console.log("  Dinh dang hash dung   :", u.matKhauHash.includes(":") ? "CO" : "KHONG");

  if (matKhau) {
    const dung = await kiemTraMatKhau(matKhau, u.matKhauHash);
    console.log(`  Mat khau "${matKhau}" :`, dung ? "DUNG" : "SAI");
  }
}

main().finally(() => db.$disconnect());
