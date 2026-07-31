/**
 * Đối chiếu dữ liệu trong cơ sở dữ liệu với ma trận OUTPUT_NAM gốc.
 * Chạy: npx tsx prisma/kiemtra-db.ts
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { taoBoDuLieu } from "../src/lib/data/seed/index";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});
const f = (n: number) => Math.round(n).toLocaleString("vi-VN");

async function main() {
  const bo = taoBoDuLieu();
  const goc = new Map(bo.maTranGoc.map((o) => [`${o.maCode}|${o.maCongTrinh}`, o.giaTri]));

  const rows = await db.transaction.groupBy({
    by: ["maDTCP", "projectId"],
    _sum: { soTien: true },
  });
  const projects = await db.project.findMany({ select: { id: true, maCongTrinh: true } });
  const traMa = new Map(projects.map((p) => [p.id, p.maCongTrinh]));

  let lech = 0;
  let tong = 0;
  for (const r of rows) {
    const k = `${r.maDTCP}|${traMa.get(r.projectId)}`;
    const s = r._sum.soTien ?? 0;
    tong += s;
    const mongDoi = goc.get(k);
    if (mongDoi === undefined) {
      console.log("THUA:", k);
      lech++;
      continue;
    }
    if (Math.round(s) !== mongDoi) {
      console.log(`LECH ${k}: DB=${s} goc=${mongDoi}`);
      lech++;
    }
  }
  console.log(`O so lieu trong DB: ${rows.length} | trong ma tran goc: ${goc.size}`);
  console.log(`So o lech: ${lech}`);
  console.log(`Tong toan bo tu DB: ${f(tong)}`);

  const dt = await db.transaction.aggregate({
    _sum: { soTien: true },
    where: { maDTCP: "Bill" },
  });
  const cpCodes = await db.costRevenueCode.findMany({
    where: { loai: "Chi phí" },
    select: { ma: true },
  });
  const cp = await db.transaction.aggregate({
    _sum: { soTien: true },
    where: { maDTCP: { in: cpCodes.map((c) => c.ma) } },
  });
  const D = dt._sum.soTien ?? 0;
  const C = cp._sum.soTien ?? 0;
  console.log("\nKPI tu DB:");
  console.log(`  Doanh thu (Bill): ${f(D)}`);
  console.log(`  Chi phi         : ${f(C)}`);
  console.log(`  Loi nhuan gop   : ${f(D - C)}`);
  console.log(`  Bien LN         : ${(((D - C) / D) * 100).toFixed(1)}%`);
}

main().finally(() => db.$disconnect());
