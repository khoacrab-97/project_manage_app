/**
 * Nạp dữ liệu ban đầu vào cơ sở dữ liệu.
 *
 * KHÔNG sinh số liệu mới — gọi thẳng `taoBoDuLieu()` đang có, tức là đúng bộ dữ
 * liệu đã nghiệm thu ở Phase 1 (tổng khớp tuyệt đối ma trận OUTPUT_NAM).
 *
 * ⚠️ AN TOÀN: script chỉ chạy khi bảng Transaction còn RỖNG. Sau khi go-live, chạy
 * lại `prisma db seed` sẽ không đụng vào dữ liệu thật. Muốn nạp lại từ đầu phải xoá
 * file DB một cách có chủ ý.
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { taoBoDuLieu } from "../src/lib/data/seed/index";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/prmana.db",
});
const db = new PrismaClient({ adapter });

/** Chia mảng thành từng khối — SQLite giới hạn số tham số mỗi câu lệnh. */
function khoi<T>(ds: T[], co: number): T[][] {
  const kq: T[][] = [];
  for (let i = 0; i < ds.length; i += co) kq.push(ds.slice(i, i + co));
  return kq;
}

const ngay = (s: string | null | undefined) => (s ? new Date(s) : null);

async function main() {
  const daCo = await db.transaction.count();
  if (daCo > 0) {
    console.log(`Bỏ qua: cơ sở dữ liệu đã có ${daCo} giao dịch. Không ghi đè.`);
    return;
  }

  const bo = taoBoDuLieu();
  console.log("Đang nạp dữ liệu...");

  // 1. Danh mục mã — nạp mã gốc trước rồi mới tới mã con (khóa ngoại tự tham chiếu).
  const maGoc = bo.danhMucMa.filter((c) => !c.maCha);
  const maCon = bo.danhMucMa.filter((c) => c.maCha);
  for (const nhom of [maGoc, maCon]) {
    await db.costRevenueCode.createMany({
      data: nhom.map((c, i) => ({
        ma: c.ma,
        ten: c.ten,
        loai: c.loai,
        maCha: c.maCha,
        capMa: c.maCha ? 2 : 1,
        choPhepNhapTrucTiep: c.choPhepNhapTrucTiep,
        thuTuHienThi: i,
      })),
    });
  }
  console.log(`  ${bo.danhMucMa.length} mã doanh thu – chi phí`);

  // 2. Công trình.
  await db.project.createMany({
    data: bo.congTrinh.map((c) => ({
      id: c.id,
      maCongTrinh: c.maCongTrinh,
      tenCongTrinh: c.tenCongTrinh,
      maBase: c.maBase,
      chuDauTu: c.chuDauTu,
      chiHuyTruong: c.chiHuyTruong,
      phongPhuTrach: c.phongPhuTrach,
      ngayBatDau: ngay(c.ngayBatDau),
      ngayKetThucKeHoach: ngay(c.ngayKetThucKeHoach),
      trangThai: c.trangThai,
      diaDiem: c.diaDiem,
      bienLNMucTieu: c.bienLNMucTieu,
      ngayCapNhatCuoi: ngay(c.ngayCapNhatCuoi),
      isActive: true,
    })),
  });
  const traProject = new Map(bo.congTrinh.map((c) => [c.maCongTrinh, c.id]));
  console.log(`  ${bo.congTrinh.length} công trình`);

  // 3. Lô nhập.
  await db.importBatch.createMany({
    data: bo.loNhap.map((l) => ({
      id: l.id,
      tenFile: l.tenFile,
      hashFile: l.hashFile,
      nguon: "excel",
      projectId: l.maCongTrinh ? (traProject.get(l.maCongTrinh) ?? null) : null,
      kyDuLieu: l.kyDuLieu,
      nguoiTai: l.nguoiTai,
      thoiDiemTai: new Date(l.thoiDiemTai),
      soDong: l.soDong,
      soDongHopLe: l.soDongHopLe,
      soDongLoi: l.soDongLoi,
      trangThai: l.trangThai,
      nguoiDuyet: l.nguoiDuyet,
      thoiDiemDuyet: ngay(l.thoiDiemDuyet),
    })),
  });
  console.log(`  ${bo.loNhap.length} lô nhập`);

  // 4. Sổ giao dịch chính thức.
  for (const phan of khoi(bo.giaoDich, 500)) {
    await db.transaction.createMany({
      data: phan.map((g) => ({
        id: g.id,
        sttNguon: g.sttNguon,
        projectId: traProject.get(g.maCongTrinh)!,
        tenCongTrinhNguon: g.tenCongTrinhNguon,
        maBase: g.maBase,
        soHoaDon: g.soHoaDon,
        ngayChungTu: ngay(g.ngayChungTu),
        thangThucHien: g.thangThucHien!,
        tuanThucHien: g.tuanThucHien,
        noiDung: g.noiDungThanhToan,
        dvt: g.dvt,
        donGia: g.donGia,
        soLuong: g.soLuong,
        soTien: g.soTien,
        maDTCP: g.maDTCP!,
        ghiChu: g.ghiChu,
        importBatchId: g.importBatchId,
        sourceFileName: g.sourceFileName,
        trangThai: g.trangThai,
        rowHash: g.rowHash,
      })),
    });
  }
  console.log(`  ${bo.giaoDich.length} giao dịch chính thức`);

  // 5. Vùng chờ xử lý + lỗi (KHÔNG vào sổ chính thức — §17.1).
  await db.transactionStaging.createMany({
    data: bo.giaoDichChoXuLy.map((g) => ({
      id: g.id,
      importBatchId: g.importBatchId,
      dongExcel: g.sttNguon + 2,
      maCongTrinh: g.maCongTrinh,
      tenCongTrinh: g.tenCongTrinhNguon,
      soHoaDon: g.soHoaDon,
      ngayChungTu: ngay(g.ngayChungTu),
      thangThucHien: g.thangThucHien,
      tuanThucHien: g.tuanThucHien,
      noiDung: g.noiDungThanhToan,
      dvt: g.dvt,
      donGia: g.donGia,
      soLuong: g.soLuong,
      soTien: g.soTien,
      maDTCP: g.maDTCP,
      ghiChu: g.ghiChu,
      rowHash: g.rowHash,
    })),
  });
  await db.importError.createMany({
    data: bo.loiDuLieu.map((l) => ({
      id: l.id,
      importBatchId: l.importBatchId,
      dong: l.dong,
      cot: l.cot,
      maLoi: l.maLoi,
      mucDo: l.mucDo,
      thongDiep: l.thongDiep,
      cachXuLy: l.cachXuLy,
    })),
  });
  console.log(`  ${bo.giaoDichChoXuLy.length} dòng chờ xử lý, ${bo.loiDuLieu.length} lỗi`);

  // 6. Kế hoạch.
  for (const phan of khoi(bo.keHoach, 500)) {
    await db.planLine.createMany({
      data: phan.map((k) => ({
        id: k.id,
        projectId: traProject.get(k.maCongTrinh)!,
        maDTCP: k.maDTCP,
        maGoc: k.maGoc,
        loaiKeHoach: k.maDTCP === "Bill" ? "Doanh thu" : "Chi phí",
        thang: k.thang,
        giaTri: k.giaTri,
        phienBan: k.phienBan,
        trangThaiDuyet: "APPROVED",
      })),
    });
  }
  console.log(`  ${bo.keHoach.length} dòng kế hoạch`);

  // 7. Bảng ánh xạ hệ mã.
  await db.codeCrosswalk.createMany({
    data: bo.anhXaMa.map((a) => ({
      maCu: a.maCu,
      tenCu: a.tenCu,
      maMoi: a.maMoi,
      nguonMap: a.nguonMap,
      daDuyet: a.daDuyet,
      ghiChu: a.ghiChu,
    })),
  });
  console.log(`  ${bo.anhXaMa.length} dòng ánh xạ hệ mã`);

  // 8. Tài khoản quản trị đầu tiên.
  // Email lấy từ biến môi trường để không cắm cứng email cá nhân vào mã nguồn.
  const emailAdmin = process.env.ADMIN_EMAIL;
  if (emailAdmin) {
    await db.user.create({
      data: { email: emailAdmin, hoTen: "Quản trị hệ thống", vaiTro: "ADMIN" },
    });
    console.log(`  Tài khoản ADMIN: ${emailAdmin}`);
  } else {
    console.log("  ⚠ Chưa đặt ADMIN_EMAIL trong .env — chưa tạo tài khoản quản trị.");
  }

  console.log("Nạp dữ liệu xong.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
