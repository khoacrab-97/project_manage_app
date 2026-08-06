"use server";

/**
 * Cấp phép vai trò nào được thấy mục menu nào. Chỉ ADMIN.
 *
 * Bảng `MenuBiAn` lưu các mục BỊ ẨN, nên lưu = xoá hết rồi ghi lại đúng những ô
 * người dùng bỏ tích. Cách này đơn giản và luôn khớp với những gì trên màn hình.
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { batBuocQuyen, DS_VAI_TRO } from "@/lib/auth/quyen";
import { MENU } from "@/lib/menu";
import { withServerActionLogging } from "@/lib/logger";

export interface KetQuaMenu {
  ok: boolean;
  thongDiep: string;
}

export async function luuQuyenMenu(formData: FormData): Promise<KetQuaMenu> {
  return withServerActionLogging("luu_quyen_menu", [formData], async () => {
    batBuocQuyen(await nguoiDungHienTai(), "quan_tri_nguoi_dung");

    // Ô được tích gửi lên dạng "VAI_TRO|ma-menu"; ô không tích thì trình duyệt
    // không gửi gì, nên phần bù chính là danh sách bị ẩn.
    const duocThay = new Set(formData.getAll("thay").map(String));

    const biAn: { vaiTro: string; maMenu: string }[] = [];
    for (const vaiTro of DS_VAI_TRO) {
      // ADMIN luôn thấy tất cả, không ghi dòng ẩn nào.
      if (vaiTro === "ADMIN") continue;
      for (const m of MENU) {
        if (!duocThay.has(`${vaiTro}|${m.id}`)) biAn.push({ vaiTro, maMenu: m.id });
      }
    }

    await db.menuBiAn.deleteMany({});
    if (biAn.length) await db.menuBiAn.createMany({ data: biAn });

    // Mọi trang đều đọc cấu hình này qua layout nên phải làm mới toàn bộ.
    revalidatePath("/", "layout");

    const soAn = biAn.length;
    return {
      ok: true,
      thongDiep: soAn
        ? `Đã lưu. Đang ẩn ${soAn} mục trên tổng ${(DS_VAI_TRO.length - 1) * MENU.length} ô.`
        : "Đã lưu. Mọi vai trò thấy đủ các mục.",
    };
  });
}

/** Cấu hình hiện tại để dựng bảng tích chọn. */
export async function layCauHinhMenu(): Promise<Record<string, string[]>> {
  return withServerActionLogging("lay_cau_hinh_menu", [], async () => {
    const biAn = await db.menuBiAn.findMany();
    const tap = new Set(biAn.map((r) => `${r.vaiTro}|${r.maMenu}`));

    const kq: Record<string, string[]> = {};
    for (const vaiTro of DS_VAI_TRO) {
      kq[vaiTro] =
        vaiTro === "ADMIN"
          ? MENU.map((m) => m.id)
          : MENU.filter((m) => !tap.has(`${vaiTro}|${m.id}`)).map((m) => m.id);
    }
    return kq;
  });
}

