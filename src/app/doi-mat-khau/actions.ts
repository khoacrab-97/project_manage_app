"use server";

/**
 * Tự đổi mật khẩu — người đang đăng nhập đổi mật khẩu của CHÍNH MÌNH.
 *
 * Khác với đặt lại mật khẩu ở trang quản trị (admin đặt cho người khác): ở đây bắt
 * buộc nhập đúng mật khẩu hiện tại rồi mới cho đổi, và KHÔNG huỷ phiên hiện tại để
 * người dùng không bị đá ra ngay sau khi đổi.
 */
import { db } from "@/lib/db";
import { bamMatKhau, kiemTraMatKhau } from "@/lib/auth/mat-khau";
import { nguoiDungHienTai } from "@/lib/auth/phien";

export interface KetQuaDoiMatKhau {
  ok: boolean;
  thongDiep: string;
}

const DAI_TOI_THIEU = 8;

export async function doiMatKhauCuaToi(formData: FormData): Promise<KetQuaDoiMatKhau> {
  const toi = await nguoiDungHienTai();
  if (!toi) return { ok: false, thongDiep: "Phiên đã hết hạn. Hãy đăng nhập lại." };

  const hienTai = String(formData.get("matKhauHienTai") ?? "");
  const moi = String(formData.get("matKhauMoi") ?? "");
  const nhapLai = String(formData.get("nhapLaiMoi") ?? "");

  if (moi.length < DAI_TOI_THIEU) {
    return { ok: false, thongDiep: `Mật khẩu mới phải dài ít nhất ${DAI_TOI_THIEU} ký tự.` };
  }
  if (moi !== nhapLai) return { ok: false, thongDiep: "Hai lần nhập mật khẩu mới không khớp." };

  const u = await db.user.findUnique({ where: { id: toi.id } });
  if (!u || !u.matKhauHash) return { ok: false, thongDiep: "Không tìm thấy tài khoản." };
  if (!(await kiemTraMatKhau(hienTai, u.matKhauHash))) {
    return { ok: false, thongDiep: "Mật khẩu hiện tại không đúng." };
  }

  await db.user.update({
    where: { id: u.id },
    data: { matKhauHash: await bamMatKhau(moi) },
  });

  return { ok: true, thongDiep: "Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới." };
}
