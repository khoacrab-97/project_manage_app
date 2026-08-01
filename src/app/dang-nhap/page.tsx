import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { kiemTraMatKhau } from "@/lib/auth/mat-khau";
import { donPhienHetHan, nguoiDungHienTai, taoPhien } from "@/lib/auth/phien";
import { NutDangNhap } from "@/components/nut-dang-nhap";

export const metadata = { title: "Đăng nhập" };

export default async function TrangDangNhap({
  searchParams,
}: {
  searchParams: Promise<{ loi?: string; tiep?: string }>;
}) {
  const sp = await searchParams;
  if (await nguoiDungHienTai()) redirect(sp.tiep || "/");

  async function dangNhap(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const matKhau = String(formData.get("matKhau") ?? "");
    const tiep = String(formData.get("tiep") ?? "/");

    const u = await db.user.findUnique({ where: { email } });

    // Thông báo giống hệt nhau cho mọi trường hợp sai: không tiết lộ email nào
    // có tồn tại trong hệ thống.
    const sai = () => redirect(`/dang-nhap?loi=1${tiep !== "/" ? `&tiep=${encodeURIComponent(tiep)}` : ""}`);

    if (!u || !u.isActive || !u.matKhauHash) sai();
    if (!(await kiemTraMatKhau(matKhau, u!.matKhauHash))) sai();

    await donPhienHetHan();
    await taoPhien(u!.id);
    redirect(tiep);
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-nhan text-sm font-bold text-white">
          DC
        </div>
        <h1 className="text-lg font-semibold">Quản lý Doanh thu – Chi phí</h1>
        <p className="mt-1 text-xs text-chunhat">Quản trị thi công xây dựng</p>
      </div>

      <form
        action={dangNhap}
        className="rounded-xl border border-vien bg-the p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      >
        <input type="hidden" name="tiep" value={sp.tiep ?? "/"} />

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-chunhat">Email</span>
          <input
            name="email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            className="w-full rounded-md border border-vien bg-nen px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-xs font-medium text-chunhat">Mật khẩu</span>
          <input
            name="matKhau"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-vien bg-nen px-3 py-2 text-sm"
          />
        </label>

        {sp.loi ? (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
            Email hoặc mật khẩu không đúng.
          </p>
        ) : null}

        <NutDangNhap />
      </form>

      <p className="mt-4 text-center text-xs leading-relaxed text-chunhat">
        Tài khoản do quản trị hệ thống cấp. Hệ thống không cho tự đăng ký.
        <br />
        Quên mật khẩu, liên hệ quản trị để cấp lại.
      </p>
    </div>
  );
}
