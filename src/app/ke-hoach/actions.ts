"use server";

/**
 * Nhập kế hoạch – ngân sách cho một công trình.
 *
 * Kế hoạch lập cho CẢ DỰ ÁN theo từng mã, không chia theo tháng — đúng như cột
 * "KẾ HOẠCH CHI PHÍ TỔNG DỰ ÁN" trong biểu mẫu công ty. Model `PlanLine` bắt
 * buộc có `thang` nên dồn hết vào tháng đầu niên độ; mọi chỗ đọc kế hoạch trong
 * app đều cộng gộp toàn kỳ nên cách lưu này không làm lệch con số nào.
 *
 * LƯU LÀ THAY THẾ: xoá sạch dòng cũ của công trình rồi ghi lại. Nếu cộng thêm
 * bản mới mà giữ bản cũ thì `keHoachVsThucHien` (không lọc phiên bản) sẽ cộng
 * đôi. Đổi lại, bản này CHƯA giữ lịch sử ngân sách như §8.4 mong muốn.
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { batBuocQuyen } from "@/lib/auth/quyen";
import { layCongTrinh, layDanhMucMa } from "@/lib/data/repository";
import { docKeHoachTuExcel } from "@/lib/excel/parse-ke-hoach";
import { NAM_BAO_CAO } from "@/lib/thresholds";
import type { CongTrinh } from "@/lib/types";
import { withServerActionLogging } from "@/lib/logger";

export interface KetQuaKeHoach {
  ok: boolean;
  thongDiep: string;
}

/** Kế hoạch cả dự án được dồn vào tháng này. */
const THANG_GOM = `${NAM_BAO_CAO}-01`;

/**
 * Công trình dùng để ghi kế hoạch: phải trong phạm vi VÀ chưa nghiệm thu.
 * Công trình đã hoàn thành thì đóng băng, giống mọi thao tác ghi khác.
 */
async function congTrinhChoGhi(
  maCongTrinh: string
): Promise<{ ct: CongTrinh } | { loi: string }> {
  const ct = (await layCongTrinh()).find((c) => c.maCongTrinh === maCongTrinh);
  if (!ct) return { loi: `Không tìm thấy công trình ${maCongTrinh}.` };
  if (ct.trangThai === "Đã nghiệm thu") {
    return { loi: `Công trình ${maCongTrinh} đã hoàn thành — chỉ được xem, không sửa kế hoạch.` };
  }
  return { ct };
}

/** Ghi đè toàn bộ kế hoạch của một công trình bằng danh sách mã → giá trị. */
async function ghiDe(projectId: string, giaTri: Map<string, number>, email: string) {
  await db.planLine.deleteMany({ where: { projectId } });
  for (const [ma, v] of giaTri) {
    if (v <= 0) continue;
    await db.planLine.create({
      data: {
        projectId,
        maDTCP: ma,
        // Không còn hệ mã cũ, nên mã gốc chính là mã hiện hành.
        maGoc: ma,
        thang: THANG_GOM,
        giaTri: v,
        nguoiSua: email,
      },
    });
  }
}

export async function luuKeHoach(formData: FormData): Promise<KetQuaKeHoach> {
  return withServerActionLogging("luu_ke_hoach", [formData], async () => {
    const u = await nguoiDungHienTai();
    batBuocQuyen(u, "sua_ke_hoach");

    const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
    const kq = await congTrinhChoGhi(maCongTrinh);
    if ("loi" in kq) return { ok: false, thongDiep: kq.loi };

    const danhMuc = await layDanhMucMa();
    const giaTri = new Map<string, number>();
    for (const c of danhMuc) {
      const raw = String(formData.get(`kh_${c.ma}`) ?? "")
        .trim()
        .replace(/[\s.]/g, "")
        .replace(",", ".");
      if (raw === "") continue;
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 0) {
        return { ok: false, thongDiep: `Giá trị của mã ${c.ma} phải là số không âm.` };
      }
      giaTri.set(c.ma, v);
    }

    await ghiDe(kq.ct.id, giaTri, u!.email);

    revalidatePath("/ke-hoach");
    revalidatePath("/cong-trinh");
    revalidatePath("/");
    const soMa = [...giaTri.values()].filter((v) => v > 0).length;
    return { ok: true, thongDiep: `Đã lưu kế hoạch ${maCongTrinh}: ${soMa} mã có ngân sách.` };
  });
}

export async function nhapKeHoachExcel(formData: FormData): Promise<KetQuaKeHoach> {
  return withServerActionLogging("nhap_ke_hoach_excel", [formData], async () => {
    const u = await nguoiDungHienTai();
    batBuocQuyen(u, "sua_ke_hoach");

    const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
    const kq = await congTrinhChoGhi(maCongTrinh);
    if ("loi" in kq) return { ok: false, thongDiep: kq.loi };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, thongDiep: "Chưa chọn file Excel." };
    }

    const danhMuc = await layDanhMucMa();
    const maHopLe = new Set(danhMuc.map((c) => c.ma));

    const doc = await docKeHoachTuExcel(await file.arrayBuffer(), maHopLe);
    if (doc.loi) return { ok: false, thongDiep: doc.loi };
    if (!doc.dongs.length) {
      return { ok: false, thongDiep: "File không có dòng nào dùng mã hợp lệ trong danh mục." };
    }

    await ghiDe(kq.ct.id, new Map(doc.dongs.map((d) => [d.ma, d.giaTri])), u!.email);

    revalidatePath("/ke-hoach");
    revalidatePath("/cong-trinh");
    revalidatePath("/");

    // Mã lạ bị LOẠI chứ không gộp ngầm vào mã khác — phải nói rõ cho người nhập.
    const canhBao = doc.maLa.length
      ? ` Bỏ qua ${doc.maLa.length} mã không có trong danh mục: ${doc.maLa.slice(0, 5).join(", ")}${doc.maLa.length > 5 ? "…" : ""}.`
      : "";
    return {
      ok: true,
      thongDiep: `Đã nhập kế hoạch ${maCongTrinh}: ${doc.dongs.length} mã.${canhBao}`,
    };
  });
}
