/**
 * Đặt mật khẩu cho một tài khoản từ dòng lệnh.
 * Dùng khi cấp mật khẩu lần đầu cho ADMIN, hoặc khi quản trị tự khoá mình ra ngoài.
 *
 *   npx tsx prisma/dat-mat-khau.ts <email> <matKhau>
 *
 * Mật khẩu bắt buộc truyền vào, ít nhất 8 ký tự.
 */
import "dotenv/config";
import { bamMatKhau } from "../src/lib/auth/mat-khau";
import { taoPrismaClient } from "../src/lib/prisma-client";

const db = taoPrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Cach dung: npx tsx prisma/dat-mat-khau.ts <email> <matKhau>");
    process.exit(1);
  }

  const u = await db.user.findUnique({ where: { email } });
  if (!u) {
    console.error(`Khong tim thay tai khoan ${email}.`);
    process.exit(1);
  }

  const matKhau = process.argv[3];
  if (!matKhau || matKhau.length < 8) {
    console.error("Phai truyen mat khau, it nhat 8 ky tu.");
    console.error("  npx tsx prisma/dat-mat-khau.ts <email> <matKhau>");
    process.exit(1);
  }
  await db.user.update({
    where: { email },
    data: { matKhauHash: await bamMatKhau(matKhau) },
  });
  // Huỷ phiên cũ để mật khẩu mới có hiệu lực ngay.
  await db.session.deleteMany({ where: { userId: u.id } });

  console.log(`Da dat mat khau cho ${email} (vai tro ${u.vaiTro}).`);
}

main().finally(() => db.$disconnect());
