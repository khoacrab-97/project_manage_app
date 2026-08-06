"use server";

/**
 * Lưu bảng giao dịch (doanh thu / chi phí) — bảng tính nhập như Excel là NGUỒN
 * chính thức của công trình. Lưu = THAY TOÀN BỘ giao dịch của công trình bằng
 * nội dung bảng (xoá hết rồi ghi lại), nên sửa ô / xoá dòng đều có hiệu lực thật.
 * Doanh thu và Chi phí ở chi tiết công trình đọc lại từ đúng bảng này nên số
 * hiện ngay.
 *
 * Tự kiểm quyền (`nhap_du_lieu`) và phạm vi công trình — không dựa vào việc giao
 * diện đã khoá bảng. Trùng dòng y hệt trong bảng bị bỏ (khớp @@unique[rowHash,
 * projectId]).
 *
 * LƯU Ý: thay-toàn-bộ cũng xoá dữ liệu đã import Excel (nếu có) của công trình.
 * Đúng với mô hình bảng-tính cho công trình nhập tay.
 */
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { batBuocQuyen } from "@/lib/auth/quyen";
import { layCongTrinh } from "@/lib/data/repository";
import { withServerActionLogging } from "@/lib/logger";

export interface KetQuaGiaoDich {
  ok: boolean;
  thongDiep: string;
}

/** Đọc số theo quy ước Việt: "." ngăn nghìn, "," thập phân. */
const so = (t: string) => Number(String(t).replace(/\s/g, "").replace(/\./g, "").replace(",", "."));

const LA_NGAY = /^\d{4}-\d{2}-\d{2}$/;
const bam = (s: string) => createHash("sha1").update(s).digest("hex");

export async function luuGiaoDich(formData: FormData): Promise<KetQuaGiaoDich> {
  return withServerActionLogging("luu_giao_dich", [formData], async () => {
    const u = await nguoiDungHienTai();
    batBuocQuyen(u, "nhap_du_lieu");

    const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
    const ct = (await layCongTrinh()).find((c) => c.maCongTrinh === maCongTrinh);
    if (!ct) return { ok: false, thongDiep: `Không tìm thấy công trình ${maCongTrinh}.` };
    if (ct.trangThai === "Đã nghiệm thu") {
      return { ok: false, thongDiep: `Công trình ${maCongTrinh} đã nghiệm thu — chỉ được xem, không nhập.` };
    }

    // Tập mã được ghi trực tiếp: đang hiệu lực và không phải mã nhóm (§3.4).
    const maHopLe = new Set(
      (await db.costRevenueCode.findMany({ where: { isActive: true, choPhepNhapTrucTiep: true } })).map(
        (c) => c.ma
      )
    );

    const cot = (k: string) => formData.getAll(k).map((v) => String(v).trim());
    const maBases = cot("maBase");
    const soHoaDons = cot("soHoaDon");
    const ngayCTs = cot("ngayChungTu");
    const noiDungs = cot("noiDung");
    const dvts = cot("dvt");
    const donGias = cot("donGia");
    const soLuongs = cot("soLuong");
    const soTiens = cot("soTien");
    const maDTCPs = cot("maDTCP");
    const ghiChus = cot("ghiChu");

    const loi: string[] = [];
    const rows: {
      maBase: string | null;
      soHoaDon: string | null;
      ngayChungTu: Date;
      thangThucHien: string;
      noiDung: string;
      dvt: string | null;
      donGia: number | null;
      soLuong: number | null;
      soTien: number;
      maDTCP: string;
      ghiChu: string | null;
      rowHash: string;
    }[] = [];

    for (let i = 0; i < noiDungs.length; i++) {
      const noiDung = noiDungs[i] ?? "";
      const maDTCP = maDTCPs[i] ?? "";
      const ngayCT = ngayCTs[i] ?? "";
      const soTienRaw = soTiens[i] ?? "";
      const donGiaRaw = donGias[i] ?? "";
      const soLuongRaw = soLuongs[i] ?? "";

      // Dòng trống hoàn toàn thì bỏ qua, không báo lỗi.
      if (!noiDung && !maDTCP && !ngayCT && !soTienRaw && !donGiaRaw && !soLuongRaw) continue;

      const nhan = `Dòng ${i + 1}`;
      if (!maDTCP) {
        loi.push(`${nhan}: thiếu Mã DT–CP`);
        continue;
      }
      if (!maHopLe.has(maDTCP)) {
        loi.push(`${nhan}: mã ${maDTCP} không ghi trực tiếp được (đã khóa hoặc là mã nhóm)`);
        continue;
      }
      if (!noiDung) {
        loi.push(`${nhan}: thiếu Nội dung thanh toán`);
        continue;
      }
      if (!LA_NGAY.test(ngayCT)) {
        loi.push(`${nhan}: thiếu hoặc sai Ngày chứng từ`);
        continue;
      }
      const thangThucHien = ngayCT.slice(0, 7);

      const donGia = donGiaRaw ? so(donGiaRaw) : null;
      const soLuong = soLuongRaw ? so(soLuongRaw) : null;
      // Số tiền: nhập trực tiếp, hoặc tự tính Đơn giá × Số lượng khi cả hai có dữ liệu.
      let soTien: number;
      if (soTienRaw) soTien = so(soTienRaw);
      else if (donGia !== null && soLuong !== null) soTien = donGia * soLuong;
      else {
        loi.push(`${nhan}: thiếu Số tiền (nhập trực tiếp, hoặc điền cả Đơn giá và Số lượng)`);
        continue;
      }

      if (!Number.isFinite(soTien)) {
        loi.push(`${nhan}: Số tiền không hợp lệ`);
        continue;
      }
      if (donGia !== null && !Number.isFinite(donGia)) {
        loi.push(`${nhan}: Đơn giá không hợp lệ`);
        continue;
      }
      if (soLuong !== null && !Number.isFinite(soLuong)) {
        loi.push(`${nhan}: Số lượng không hợp lệ`);
        continue;
      }

      rows.push({
        maBase: maBases[i] || null,
        soHoaDon: soHoaDons[i] || null,
        ngayChungTu: new Date(ngayCT),
        thangThucHien,
        noiDung,
        dvt: dvts[i] || null,
        donGia,
        soLuong,
        soTien,
        maDTCP,
        ghiChu: ghiChus[i] || null,
        rowHash: bam(`${ct.id}|${ngayCT}|${soHoaDons[i] ?? ""}|${maDTCP}|${soTien}|${noiDung}`),
      });
    }

    // Có lỗi validate mà không còn dòng hợp lệ nào -> KHÔNG lưu (tránh xoá trắng do nhầm).
    if (!rows.length && loi.length) {
      return { ok: false, thongDiep: `Không có dòng hợp lệ. ${loi.join("; ")}.` };
    }

    // Bỏ dòng trùng y hệt trong bảng (khớp @@unique[rowHash, projectId]).
    const trongLo = new Set<string>();
    const moi = rows.filter((r) => {
      if (trongLo.has(r.rowHash)) return false;
      trongLo.add(r.rowHash);
      return true;
    });
    const soTrung = rows.length - moi.length;

    // THAY TOÀN BỘ: xoá hết giao dịch của công trình rồi ghi lại theo bảng (một
    // giao dịch DB để không có trạng thái nửa vời nếu lỗi giữa chừng).
    await db.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { projectId: ct.id } });
      await tx.importBatch.deleteMany({ where: { projectId: ct.id, nguon: "thu-cong" } });
      if (moi.length) {
        const lo = await tx.importBatch.create({
          data: {
            tenFile: `Nhập tay ${maCongTrinh}`,
            hashFile: bam(`thu-cong|${ct.id}|${moi.map((r) => r.rowHash).join(",")}`),
            nguon: "thu-cong",
            projectId: ct.id,
            nguoiTai: u?.email ?? "không rõ",
            soDong: moi.length,
            soDongHopLe: moi.length,
            trangThai: "POSTED",
          },
        });
        await tx.transaction.createMany({
          data: moi.map((r, idx) => ({
            sttNguon: idx + 1,
            projectId: ct.id,
            tenCongTrinhNguon: ct.tenCongTrinh,
            maBase: r.maBase,
            soHoaDon: r.soHoaDon,
            ngayChungTu: r.ngayChungTu,
            thangThucHien: r.thangThucHien,
            noiDung: r.noiDung,
            dvt: r.dvt,
            donGia: r.donGia,
            soLuong: r.soLuong,
            soTien: r.soTien,
            maDTCP: r.maDTCP,
            ghiChu: r.ghiChu,
            importBatchId: lo.id,
            sourceFileName: `Nhập tay (${u?.email ?? "không rõ"})`,
            trangThai: "CHINH_THUC",
            rowHash: r.rowHash,
          })),
        });
      }
    });

    revalidatePath(`/cong-trinh/${maCongTrinh}`);
    revalidatePath("/");
    const phu = [soTrung ? `${soTrung} dòng trùng đã bỏ` : "", loi.length ? `Lỗi: ${loi.join("; ")}` : ""]
      .filter(Boolean)
      .join(". ");
    return {
      ok: true,
      thongDiep: moi.length
        ? `Đã lưu ${moi.length} giao dịch.${phu ? ` ${phu}.` : ""}`
        : "Đã lưu bảng trống — công trình chưa có giao dịch.",
    };
  });
}
