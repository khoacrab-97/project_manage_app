import Link from "next/link";
import { LogOut, Shield } from "lucide-react";
import { nguoiDungHienTai, xoaPhien } from "@/lib/auth/phien";
import { coQuyen, VAI_TRO } from "@/lib/auth/quyen";
import { redirect } from "next/navigation";

/** Hiển thị người đang đăng nhập + nút đăng xuất, đặt ở thanh đầu trang. */
export async function ThanhNguoiDung() {
  const u = await nguoiDungHienTai();
  if (!u) return null;

  async function dangXuat() {
    "use server";
    await xoaPhien();
    redirect("/dang-nhap");
  }

  return (
    <div className="flex items-center gap-3">
      {coQuyen(u, "quan_tri_nguoi_dung") ? (
        <Link
          href="/quan-tri/nguoi-dung"
          className="inline-flex items-center gap-1 text-xs font-medium text-nhan hover:underline"
        >
          <Shield className="size-3.5" /> Quản trị
        </Link>
      ) : null}

      <div className="text-right leading-tight">
        <p className="text-xs font-medium">{u.hoTen}</p>
        <p className="text-[11px] text-chunhat">{VAI_TRO[u.vaiTro]}</p>
      </div>

      <form action={dangXuat}>
        <button
          type="submit"
          title="Đăng xuất"
          className="grid size-8 place-items-center rounded-md border border-vien text-chunhat hover:text-chu"
        >
          <LogOut className="size-3.5" />
        </button>
      </form>
    </div>
  );
}
