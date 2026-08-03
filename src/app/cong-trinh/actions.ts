"use server";

/**
 * Tạo và sửa công trình ngay trên app (§8.1).
 *
 * CHỐT CHẶN NGHIỆP VỤ:
 *   - `maCongTrinh` là duy nhất và KHÔNG đổi được sau khi tạo. Toàn bộ giao dịch,
 *     lô nhập và phân quyền đều trỏ về công trình qua mã này; đổi mã là mất dấu
 *     dữ liệu quá khứ.
 *   - KHÔNG xoá cứng. Công trình ngừng theo dõi thì đặt `isActive = false`.
 *
 * Kiểm quyền ngay trong từng hàm, không dựa vào việc giao diện đã ẩn nút — Server
 * Action gọi thẳng được.
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { batBuocQuyen } from "@/lib/auth/quyen";
import type { TrangThaiDuAn } from "@/lib/types";

export interface KetQuaCongTrinh {
  ok: boolean;
  thongDiep: string;
}

/**
 * Trạng thái suy từ ô tích "Đã hoàn thành" chứ không phải ô chọn: chỉ còn hai
 * giá trị, và tích vào là công trình bị ĐÓNG BĂNG (xem `boq-actions.ts`).
 */
function docTrangThai(fd: FormData): TrangThaiDuAn {
  return fd.get("hoanThanh") === "on" ? "Đã nghiệm thu" : "Đang thi công";
}

/** Ô ngày để trống thì là null, không phải Invalid Date. */
function docNgay(fd: FormData, ten: string): Date | null {
  const v = String(fd.get(ten) ?? "").trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Ô số để trống thì là null. Trả `undefined` khi gõ vào chữ, để báo lỗi. */
function docSo(fd: FormData, ten: string): number | null | undefined {
  const v = String(fd.get(ten) ?? "").trim().replace(/[.,\s]/g, "");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function docChu(fd: FormData, ten: string): string | null {
  const v = String(fd.get(ten) ?? "").trim();
  return v === "" ? null : v;
}

async function ghiAudit(
  banGhiId: string,
  hanhDong: string,
  truong: string | null,
  truoc: string | null,
  sau: string | null
) {
  const u = await nguoiDungHienTai();
  await db.auditLog.create({
    data: {
      bang: "Project",
      banGhiId,
      hanhDong,
      truong,
      giaTriTruoc: truoc,
      giaTriSau: sau,
      nguoiThucHien: u?.email ?? "không rõ",
    },
  });
}

/**
 * Các trường dùng chung giữa tạo mới và sửa.
 * Trả về chuỗi lỗi nếu dữ liệu không hợp lệ.
 */
function docTruongChung(fd: FormData) {
  const tenCongTrinh = String(fd.get("tenCongTrinh") ?? "").trim();
  if (!tenCongTrinh) return "Tên công trình không được để trống." as const;

  const trangThai = docTrangThai(fd);

  const giaTriHopDong = docSo(fd, "giaTriHopDong");
  if (giaTriHopDong === undefined) return "Giá trị hợp đồng phải là số." as const;
  if (giaTriHopDong !== null && giaTriHopDong < 0) {
    return "Giá trị hợp đồng không được âm." as const;
  }

  const bienPhanTram = docSo(fd, "bienLNMucTieu");
  if (bienPhanTram === undefined) return "Biên lợi nhuận mục tiêu phải là số." as const;
  if (bienPhanTram !== null && (bienPhanTram < 0 || bienPhanTram > 100)) {
    return "Biên lợi nhuận mục tiêu phải nằm trong khoảng 0–100%." as const;
  }

  const ngayBatDau = docNgay(fd, "ngayBatDau");
  const ngayKetThucKeHoach = docNgay(fd, "ngayKetThucKeHoach");
  if (ngayBatDau && ngayKetThucKeHoach && ngayKetThucKeHoach < ngayBatDau) {
    return "Ngày kết thúc kế hoạch phải sau ngày bắt đầu." as const;
  }

  // Đánh dấu hoàn thành thì BẮT BUỘC có ngày nghiệm thu — đây là mốc cuối của
  // biểu đồ theo tháng, thiếu nó thì không biết vẽ tới đâu.
  const ngayHoanThanh = docNgay(fd, "ngayHoanThanh");
  if (trangThai === "Đã nghiệm thu" && !ngayHoanThanh) {
    return "Đã tích hoàn thành thì phải nhập Ngày hoàn thành." as const;
  }
  if (ngayHoanThanh && ngayBatDau && ngayHoanThanh < ngayBatDau) {
    return "Ngày hoàn thành phải sau ngày bắt đầu." as const;
  }

  return {
    tenCongTrinh,
    tenRutGon: docChu(fd, "tenRutGon"),
    trangThai,
    chuDauTu: docChu(fd, "chuDauTu"),
    chiHuyTruong: docChu(fd, "chiHuyTruong"),
    diaDiem: docChu(fd, "diaDiem"),
    googleSheetUrl: docChu(fd, "googleSheetUrl"),
    giaTriHopDong,
    // Giao diện nhập theo phần trăm cho dễ đọc; DB lưu tỷ lệ như các mã KPI khác.
    bienLNMucTieu: bienPhanTram === null ? null : bienPhanTram / 100,
    ngayBatDau,
    ngayKetThucKeHoach,
    // Bỏ tích hoàn thành thì xoá luôn ngày, tránh để lại ngày nghiệm thu mồ côi.
    ngayHoanThanh: trangThai === "Đã nghiệm thu" ? ngayHoanThanh : null,
  };
}

export async function taoCongTrinh(formData: FormData): Promise<KetQuaCongTrinh> {
  batBuocQuyen(await nguoiDungHienTai(), "tao_cong_trinh");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim().toUpperCase();
  if (!maCongTrinh) return { ok: false, thongDiep: "Mã công trình không được để trống." };

  const chung = docTruongChung(formData);
  if (typeof chung === "string") return { ok: false, thongDiep: chung };

  if (await db.project.findUnique({ where: { maCongTrinh } })) {
    return { ok: false, thongDiep: `Mã công trình ${maCongTrinh} đã tồn tại.` };
  }

  const ct = await db.project.create({ data: { maCongTrinh, ...chung } });
  await ghiAudit(ct.id, "CREATE", null, null, `${maCongTrinh} — ${chung.tenCongTrinh}`);

  revalidatePath("/cong-trinh");
  revalidatePath("/");
  return { ok: true, thongDiep: `Đã tạo công trình ${maCongTrinh}.` };
}

/** Bật lại theo dõi một công trình đã ngừng (isActive = true). */
export async function moLaiTheoDoi(formData: FormData): Promise<KetQuaCongTrinh> {
  batBuocQuyen(await nguoiDungHienTai(), "tao_cong_trinh");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const cu = await db.project.findUnique({ where: { maCongTrinh } });
  if (!cu) return { ok: false, thongDiep: `Không tìm thấy công trình ${maCongTrinh}.` };
  if (cu.isActive) return { ok: true, thongDiep: `${maCongTrinh} đang được theo dõi.` };

  await db.project.update({ where: { maCongTrinh }, data: { isActive: true } });
  await ghiAudit(cu.id, "UPDATE", "isActive", "false", "true");

  revalidatePath("/cong-trinh");
  revalidatePath("/");
  return { ok: true, thongDiep: `Đã mở lại theo dõi ${maCongTrinh}.` };
}

export async function suaCongTrinh(formData: FormData): Promise<KetQuaCongTrinh> {
  batBuocQuyen(await nguoiDungHienTai(), "tao_cong_trinh");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const cu = await db.project.findUnique({ where: { maCongTrinh } });
  if (!cu) return { ok: false, thongDiep: `Không tìm thấy công trình ${maCongTrinh}.` };

  const chung = docTruongChung(formData);
  if (typeof chung === "string") return { ok: false, thongDiep: chung };

  const isActive = formData.get("isActive") === "on";

  await db.project.update({ where: { maCongTrinh }, data: { ...chung, isActive } });

  if (cu.tenCongTrinh !== chung.tenCongTrinh) {
    await ghiAudit(cu.id, "UPDATE", "tenCongTrinh", cu.tenCongTrinh, chung.tenCongTrinh);
  }
  if (cu.trangThai !== chung.trangThai) {
    await ghiAudit(cu.id, "UPDATE", "trangThai", cu.trangThai, chung.trangThai);
  }
  if (cu.isActive !== isActive) {
    await ghiAudit(cu.id, "UPDATE", "isActive", String(cu.isActive), String(isActive));
  }

  revalidatePath("/cong-trinh");
  revalidatePath("/");
  return {
    ok: true,
    thongDiep: isActive
      ? `Đã cập nhật ${maCongTrinh}.`
      : `Đã cập nhật ${maCongTrinh} và chuyển sang ngừng theo dõi.`,
  };
}
