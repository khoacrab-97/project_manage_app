import { redirect } from "next/navigation";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { VAI_TRO } from "@/lib/auth/quyen";
import { DoiMatKhauToi } from "@/components/doi-mat-khau-toi";

export const metadata = { title: "Đổi mật khẩu" };

export default async function TrangDoiMatKhau() {
  const u = await nguoiDungHienTai();
  if (!u) redirect("/dang-nhap?tiep=/doi-mat-khau");

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold">Đổi mật khẩu</h1>
        <p className="mt-1 text-xs text-chunhat">
          {u.hoTen} · {VAI_TRO[u.vaiTro]}
        </p>
      </div>

      <DoiMatKhauToi />

      <p className="mt-4 text-center text-xs leading-relaxed text-chunhat">
        Đổi mật khẩu của chính bạn. Quên mật khẩu, liên hệ quản trị để cấp lại.
      </p>
    </div>
  );
}
