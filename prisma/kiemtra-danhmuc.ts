/**
 * Kiểm chứng quy tắc sửa danh mục mã (§3.4, §17.2).
 * Chạy: npx tsx prisma/kiemtra-danhmuc.ts
 *
 * Script này kiểm tra ĐIỀU KIỆN DỮ LIỆU mà Server Action `suaMa` dựa vào, và
 * kiểm tra ghi/khôi phục thật xuống cơ sở dữ liệu.
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});

async function main() {
  let loi = 0;
  const ok = (dieuKien: boolean, nhan: string) => {
    console.log(`  ${dieuKien ? "DAT " : "HONG"} ${nhan}`);
    if (!dieuKien) loi++;
  };

  // --- 1. Mã ĐÃ có giao dịch: guard phải chặn đổi loại ---
  const daDung = await db.transaction.groupBy({
    by: ["maDTCP"],
    _count: { _all: true },
    orderBy: { _count: { maDTCP: "desc" } },
    take: 1,
  });
  const maDaDung = daDung[0].maDTCP;
  const soGD = daDung[0]._count._all;
  ok(soGD > 0, `Ma "${maDaDung}" co ${soGD} giao dich -> guard doi loai PHAI kich hoat`);

  // --- 2. Mã CHƯA có giao dịch: được phép sửa tự do ---
  const tatCaMa = await db.costRevenueCode.findMany({ select: { ma: true } });
  const maCoGD = new Set((await db.transaction.groupBy({ by: ["maDTCP"] })).map((r) => r.maDTCP));
  const maTrong = tatCaMa.find((c) => !maCoGD.has(c.ma))!.ma;
  ok(!!maTrong, `Ma "${maTrong}" chua co giao dich -> duoc phep sua loai`);

  // --- 3. Ghi thật xuống DB rồi đọc lại ---
  const truoc = await db.costRevenueCode.findUnique({ where: { ma: maTrong } });
  const tenThu = `${truoc!.ten} [KIEM THU]`;
  await db.costRevenueCode.update({ where: { ma: maTrong }, data: { ten: tenThu } });
  const sau = await db.costRevenueCode.findUnique({ where: { ma: maTrong } });
  ok(sau!.ten === tenThu, "Sua ten -> ghi xuong DB va doc lai dung");

  // --- 4. Trả lại nguyên trạng ---
  await db.costRevenueCode.update({ where: { ma: maTrong }, data: { ten: truoc!.ten } });
  const hoanNguyen = await db.costRevenueCode.findUnique({ where: { ma: maTrong } });
  ok(hoanNguyen!.ten === truoc!.ten, "Da hoan nguyen du lieu kiem thu");

  // --- 5. Tổng số liệu không đổi sau khi sửa danh mục ---
  const tong = await db.transaction.aggregate({ _sum: { soTien: true } });
  ok(
    Math.round(tong._sum.soTien ?? 0) === 51_389_152_161,
    `Tong giao dich van la 51.389.152.161 (thuc te ${Math.round(tong._sum.soTien ?? 0).toLocaleString("vi-VN")})`
  );

  console.log(loi === 0 ? "\nTAT CA DAT" : `\n${loi} MUC HONG`);
  if (loi) process.exitCode = 1;
}

main().finally(() => db.$disconnect());
