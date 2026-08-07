"use server";

/**
 * Sửa danh mục mã doanh thu – chi phí.
 *
 * CHỐT CHẶN NGHIỆP VỤ (§3.4 và tiêu chí §17.2):
 *   - Mã đã phát sinh giao dịch thì KHÔNG được đổi `loai` (Doanh thu ↔ Chi phí).
 *     Đổi sẽ làm sai toàn bộ báo cáo quá khứ, kể cả các kỳ đã chốt.
 *   - Mã đã phát sinh giao dịch thì KHÔNG được xoá. Chỉ ngừng hiệu lực.
 *
 * Chặn ở đây chứ không chỉ ẩn nút trên giao diện — người dùng có thể gọi thẳng
 * Server Action.
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { batBuocQuyen } from "@/lib/auth/quyen";
import { withServerActionLogging } from "@/lib/logger";

export interface KetQuaAction {
  ok: boolean;
  thongDiep: string;
}

const LOAI_HOP_LE = ["Doanh thu", "Chi phí", "Giá trị thực hiện"];
const nhanLoai = LOAI_HOP_LE.join(", ");

async function ghiAudit(
  ma: string,
  hanhDong: string,
  truong: string | null,
  truoc: string | null,
  sau: string | null
) {
  await db.auditLog.create({
    data: {
      bang: "CostRevenueCode",
      banGhiId: ma,
      hanhDong,
      truong,
      giaTriTruoc: truoc,
      giaTriSau: sau,
      // Chưa có đăng nhập nên chưa biết ai thao tác. Khi làm xong phân quyền
      // (Đ1.3) thì thay bằng email người dùng thật.
      nguoiThucHien: "chưa đăng nhập",
    },
  });
}

export async function suaMa(formData: FormData): Promise<KetQuaAction> {
  return withServerActionLogging("sua_ma", [formData], async () => {
    batBuocQuyen(await nguoiDungHienTai(), "sua_danh_muc");
    const ma = String(formData.get("ma") ?? "").trim();
    const ten = String(formData.get("ten") ?? "").trim();
    const loai = String(formData.get("loai") ?? "").trim();
    const choPhepNhapTrucTiep = formData.get("choPhepNhapTrucTiep") === "on";
    const isActive = formData.get("isActive") === "on";

    if (!ma) return { ok: false, thongDiep: "Thiếu mã." };
    if (!ten) return { ok: false, thongDiep: "Tên mã không được để trống." };
    if (!LOAI_HOP_LE.includes(loai)) {
      return { ok: false, thongDiep: `Loại phải là một trong: ${nhanLoai}.` };
    }

    const cu = await db.costRevenueCode.findUnique({ where: { ma } });
    if (!cu) return { ok: false, thongDiep: `Không tìm thấy mã ${ma}.` };

    const soGiaoDich = await db.transaction.count({ where: { maDTCP: ma } });

    if (soGiaoDich > 0 && cu.loai !== loai) {
      return {
        ok: false,
        thongDiep: `Không đổi được loại của mã ${ma}: đã có ${soGiaoDich.toLocaleString("vi-VN")} giao dịch ghi theo loại "${cu.loai}". Đổi sẽ làm sai toàn bộ báo cáo quá khứ.`,
      };
    }

    if (soGiaoDich > 0 && cu.choPhepNhapTrucTiep && !choPhepNhapTrucTiep) {
      return {
        ok: false,
        thongDiep: `Không chuyển mã ${ma} thành mã nhóm: đã có ${soGiaoDich.toLocaleString("vi-VN")} giao dịch ghi trực tiếp vào mã này.`,
      };
    }

    await db.costRevenueCode.update({
      where: { ma },
      data: { ten, loai, choPhepNhapTrucTiep, isActive },
    });

    if (cu.ten !== ten) await ghiAudit(ma, "UPDATE", "ten", cu.ten, ten);
    if (cu.loai !== loai) await ghiAudit(ma, "UPDATE", "loai", cu.loai, loai);
    if (cu.isActive !== isActive) {
      await ghiAudit(ma, "UPDATE", "isActive", String(cu.isActive), String(isActive));
    }

    revalidatePath("/danh-muc");
    revalidatePath("/cong-trinh");
    revalidatePath("/chi-phi");
    return { ok: true, thongDiep: `Đã cập nhật mã ${ma}.` };
  });
}

/**
 * Xoá hẳn một mã khỏi danh mục.
 *
 * Chỉ cho xoá mã CHƯA ĐƯỢC DÙNG Ở ĐÂU. Ba cửa chặn, kiểm ở máy chủ chứ không
 * chỉ ẩn nút: giao dịch đã ghi theo mã, dòng kế hoạch đã cấp ngân sách, và mã
 * con đang treo dưới. Thiếu một cửa nào cũng dẫn tới số liệu mồ côi không truy
 * ngược được. Mã đang dùng mà muốn ngừng thì bỏ chọn “Còn hiệu lực”.
 */
export async function xoaMa(formData: FormData): Promise<KetQuaAction> {
  return withServerActionLogging("xoa_ma", [formData], async () => {
    batBuocQuyen(await nguoiDungHienTai(), "sua_danh_muc");
    const ma = String(formData.get("ma") ?? "").trim();
    if (!ma) return { ok: false, thongDiep: "Thiếu mã." };

    const cu = await db.costRevenueCode.findUnique({ where: { ma } });
    if (!cu) return { ok: false, thongDiep: `Không tìm thấy mã ${ma}.` };

    const [soGiaoDich, soKeHoach, soCon] = await Promise.all([
      db.transaction.count({ where: { maDTCP: ma } }),
      db.planLine.count({ where: { maDTCP: ma } }),
      db.costRevenueCode.count({ where: { maCha: ma } }),
    ]);

    if (soGiaoDich > 0) {
      return {
        ok: false,
        thongDiep: `Không xoá được mã ${ma}: đã có ${soGiaoDich.toLocaleString("vi-VN")} giao dịch ghi theo mã này. Muốn ngừng dùng thì bỏ chọn “Còn hiệu lực” ở nút sửa.`,
      };
    }
    if (soKeHoach > 0) {
      return {
        ok: false,
        thongDiep: `Không xoá được mã ${ma}: đang có ${soKeHoach.toLocaleString("vi-VN")} dòng kế hoạch cấp ngân sách theo mã này.`,
      };
    }
    if (soCon > 0) {
      return {
        ok: false,
        thongDiep: `Không xoá được mã ${ma}: còn ${soCon} mã con thuộc nhóm này. Xoá hoặc chuyển nhóm cho các mã con trước.`,
      };
    }

    await db.costRevenueCode.delete({ where: { ma } });
    await ghiAudit(ma, "DELETE", null, `${ma} — ${cu.ten} (${cu.loai})`, null);

    revalidatePath("/danh-muc");
    revalidatePath("/cong-trinh");
    revalidatePath("/chi-phi");
    return { ok: true, thongDiep: `Đã xoá mã ${ma}.` };
  });
}

/**
 * Lưu thứ tự hiển thị danh mục mã sau khi kéo-thả. Nhận danh sách `ma` theo đúng
 * thứ tự mới rồi đặt `thuTuHienThi` = vị trí. Cây (cha–con) do `maCha` quyết định
 * nên đổi thứ tự không phá cấu trúc, chỉ đổi trình tự hiển thị anh em.
 */
export async function sapXepDanhMuc(formData: FormData): Promise<KetQuaAction> {
  return withServerActionLogging("sap_xep_danh_muc", [formData], async () => {
    batBuocQuyen(await nguoiDungHienTai(), "sua_danh_muc");
    const thuTu = formData.getAll("ma").map(String);
    if (!thuTu.length) return { ok: false, thongDiep: "Danh sách rỗng." };

    const co = new Set((await db.costRevenueCode.findMany({ select: { ma: true } })).map((c) => c.ma));
    const ops = thuTu
      .filter((m) => co.has(m))
      .map((m, i) => db.costRevenueCode.update({ where: { ma: m }, data: { thuTuHienThi: i } }));
    if (!ops.length) return { ok: false, thongDiep: "Không có mã hợp lệ." };

    await db.$transaction(ops);
    revalidatePath("/danh-muc");
    return { ok: true, thongDiep: "Đã lưu thứ tự." };
  });
}

export async function themMa(formData: FormData): Promise<KetQuaAction> {
  return withServerActionLogging("them_ma", [formData], async () => {
    batBuocQuyen(await nguoiDungHienTai(), "sua_danh_muc");
    const ma = String(formData.get("ma") ?? "").trim();
    const ten = String(formData.get("ten") ?? "").trim();
    const loai = String(formData.get("loai") ?? "").trim();
    const maChaRaw = String(formData.get("maCha") ?? "").trim();
    const maCha = maChaRaw === "" ? null : maChaRaw;
    const choPhepNhapTrucTiep = formData.get("choPhepNhapTrucTiep") === "on";

    if (!ma) return { ok: false, thongDiep: "Mã không được để trống." };
    if (!ten) return { ok: false, thongDiep: "Tên mã không được để trống." };
    if (!LOAI_HOP_LE.includes(loai)) {
      return { ok: false, thongDiep: `Loại phải là một trong: ${nhanLoai}.` };
    }

    if (await db.costRevenueCode.findUnique({ where: { ma } })) {
      return { ok: false, thongDiep: `Mã ${ma} đã tồn tại.` };
    }

    if (maCha) {
      const cha = await db.costRevenueCode.findUnique({ where: { ma: maCha } });
      if (!cha) return { ok: false, thongDiep: `Mã cha ${maCha} không tồn tại.` };
      if (cha.loai !== loai) {
        return {
          ok: false,
          thongDiep: `Mã cha ${maCha} thuộc loại "${cha.loai}", không khớp loại "${loai}".`,
        };
      }
    }

    const thuTu = await db.costRevenueCode.count();
    await db.costRevenueCode.create({
      data: { ma, ten, loai, maCha, capMa: maCha ? 2 : 1, choPhepNhapTrucTiep, thuTuHienThi: thuTu },
    });
    await ghiAudit(ma, "CREATE", null, null, `${ma} — ${ten} (${loai})`);

    revalidatePath("/danh-muc");
    return { ok: true, thongDiep: `Đã thêm mã ${ma}.` };
  });
}
