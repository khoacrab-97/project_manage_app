"use server";

/**
 * Quản trị người dùng — chỉ ADMIN.
 *
 * Mọi hàm ở đây tự kiểm tra quyền. Không dựa vào việc giao diện đã ẩn nút, vì
 * Server Action có thể bị gọi thẳng.
 *
 * Mật khẩu do quản trị TỰ ĐẶT, hệ thống không sinh ngẫu nhiên. Mật khẩu chỉ được
 * lưu dưới dạng băm scrypt — sau khi lưu thì không ai đọc lại được, kể cả quản trị.
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { bamMatKhau } from "@/lib/auth/mat-khau";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { batBuocQuyen, DS_VAI_TRO, type VaiTro } from "@/lib/auth/quyen";
import { withServerActionLogging } from "@/lib/logger";

export interface KetQuaNguoiDung {
  ok: boolean;
  thongDiep: string;
}

/** Độ dài tối thiểu. Quản trị tự gõ nên phải có chốt chặn cơ bản. */
const DAI_TOI_THIEU = 8;

function kiemTraMatKhauMoi(matKhau: string, nhapLai: string): string | null {
  if (matKhau.length < DAI_TOI_THIEU) {
    return `Mật khẩu phải dài ít nhất ${DAI_TOI_THIEU} ký tự.`;
  }
  if (matKhau !== nhapLai) return "Hai lần nhập mật khẩu không khớp.";
  return null;
}

export async function taoNguoiDung(formData: FormData): Promise<KetQuaNguoiDung> {
  return withServerActionLogging("tao_nguoi_dung", [formData], async () => {
    batBuocQuyen(await nguoiDungHienTai(), "quan_tri_nguoi_dung");

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const hoTen = String(formData.get("hoTen") ?? "").trim();
    const vaiTro = String(formData.get("vaiTro") ?? "") as VaiTro;
    const matKhau = String(formData.get("matKhau") ?? "");
    const nhapLai = String(formData.get("nhapLai") ?? "");

    if (!email.includes("@")) return { ok: false, thongDiep: "Email không hợp lệ." };
    if (!hoTen) return { ok: false, thongDiep: "Họ tên không được để trống." };
    if (!DS_VAI_TRO.includes(vaiTro)) return { ok: false, thongDiep: "Vai trò không hợp lệ." };

    const loiMatKhau = kiemTraMatKhauMoi(matKhau, nhapLai);
    if (loiMatKhau) return { ok: false, thongDiep: loiMatKhau };

    if (await db.user.findUnique({ where: { email } })) {
      return { ok: false, thongDiep: `Email ${email} đã có tài khoản.` };
    }

    await db.user.create({
      data: { email, hoTen, vaiTro, matKhauHash: await bamMatKhau(matKhau) },
    });

    revalidatePath("/quan-tri/nguoi-dung");
    return { ok: true, thongDiep: `Đã tạo tài khoản ${email}. Báo mật khẩu cho người dùng.` };
  });
}

export async function doiVaiTro(formData: FormData): Promise<KetQuaNguoiDung> {
  return withServerActionLogging("doi_vai_tro", [formData], async () => {
    const toi = await nguoiDungHienTai();
    batBuocQuyen(toi, "quan_tri_nguoi_dung");

    const userId = String(formData.get("userId") ?? "");
    const vaiTro = String(formData.get("vaiTro") ?? "") as VaiTro;
    const isActive = formData.get("isActive") === "on";
    const phamVi = formData.getAll("phamVi").map(String);

    if (!DS_VAI_TRO.includes(vaiTro)) return { ok: false, thongDiep: "Vai trò không hợp lệ." };

    // Không cho tự hạ quyền hoặc tự khoá chính mình — tránh khoá hết đường vào hệ thống.
    if (toi!.id === userId && (vaiTro !== "ADMIN" || !isActive)) {
      return {
        ok: false,
        thongDiep: "Không thể tự hạ quyền hoặc tự khoá tài khoản đang đăng nhập.",
      };
    }

    // Phải luôn còn ít nhất một ADMIN đang hoạt động.
    if (vaiTro !== "ADMIN" || !isActive) {
      const soAdmin = await db.user.count({
        where: { vaiTro: "ADMIN", isActive: true, id: { not: userId } },
      });
      const dangLaAdmin = await db.user.findUnique({ where: { id: userId } });
      if (dangLaAdmin?.vaiTro === "ADMIN" && soAdmin === 0) {
        return { ok: false, thongDiep: "Phải còn ít nhất một tài khoản ADMIN đang hoạt động." };
      }
    }

    await db.user.update({ where: { id: userId }, data: { vaiTro, isActive } });

    // Gán lại phạm vi công trình: xoá hết rồi ghi lại cho đơn giản và đúng.
    await db.userProject.deleteMany({ where: { userId } });
    if (phamVi.length) {
      const ds = await db.project.findMany({
        where: { maCongTrinh: { in: phamVi } },
        select: { id: true },
      });
      await db.userProject.createMany({
        data: ds.map((p) => ({ userId, projectId: p.id })),
      });
    }

    // Vai trò đổi thì phiên đang mở phải mất hiệu lực, nếu không người dùng giữ
    // nguyên quyền cũ tới khi hết hạn cookie.
    await db.session.deleteMany({ where: { userId } });

    revalidatePath("/quan-tri/nguoi-dung");
    return { ok: true, thongDiep: "Đã cập nhật. Người dùng cần đăng nhập lại." };
  });
}

export async function datLaiMatKhau(formData: FormData): Promise<KetQuaNguoiDung> {
  return withServerActionLogging("dat_lai_mat_khau", [formData], async () => {
    batBuocQuyen(await nguoiDungHienTai(), "quan_tri_nguoi_dung");

    const userId = String(formData.get("userId") ?? "");
    const matKhau = String(formData.get("matKhauMoi") ?? "");
    const nhapLai = String(formData.get("nhapLaiMoi") ?? "");

    const loiMatKhau = kiemTraMatKhauMoi(matKhau, nhapLai);
    if (loiMatKhau) return { ok: false, thongDiep: loiMatKhau };

    const u = await db.user.findUnique({ where: { id: userId } });
    if (!u) return { ok: false, thongDiep: "Không tìm thấy người dùng." };

    await db.user.update({
      where: { id: userId },
      data: { matKhauHash: await bamMatKhau(matKhau) },
    });
    // Huỷ phiên đang mở để mật khẩu mới có hiệu lực ngay.
    await db.session.deleteMany({ where: { userId } });

    revalidatePath("/quan-tri/nguoi-dung");
    return {
      ok: true,
      thongDiep: `Đã đặt mật khẩu mới cho ${u.email}. Người dùng phải đăng nhập lại.`,
    };
  });
}
