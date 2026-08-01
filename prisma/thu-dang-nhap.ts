/**
 * Chẩn đoán đăng nhập: kiểm tra đúng những gì Server Action làm.
 *   npx tsx prisma/thu-dang-nhap.ts <email> <matKhau>
 */
import "dotenv/config";
import { kiemTraMatKhau } from "../src/lib/auth/mat-khau";
import { taoPrismaClient } from "../src/lib/prisma-client";

const db = taoPrismaClient();

async function main() {
  console.log("  DATABASE_URL da cau hinh:", process.env.DATABASE_URL ? "CO" : "KHONG");

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
    console.log("  Mat khau truyen vao  :", dung ? "DUNG" : "SAI");
  }
}

main().finally(() => db.$disconnect());
