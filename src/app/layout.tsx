import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { ThanhNguoiDung } from "@/components/thanh-nguoi-dung";
import { nguoiDungHienTai, xoaPhien } from "@/lib/auth/phien";
import { menuChoVaiTro } from "@/lib/auth/menu-quyen";
import { MENU, timMucMenu, tieuDeTrang } from "@/lib/menu";
import { VAI_TRO, xemModuleCongNhan } from "@/lib/auth/quyen";

export const metadata: Metadata = {
  title: "CEM Platform — Quản lý Chi phí & Doanh thu Xây dựng",
  description:
    "Nền tảng Quản lý Chi phí & Doanh thu Xây dựng — Phòng Dự Án. Theo dõi chi phí, doanh thu và hiệu quả thi công theo công trình, tháng, quý và năm.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Đường dẫn do proxy gắn vào header; layout không tự biết mình đang ở đâu.
  const duongDan = (await headers()).get("x-duong-dan") ?? "/";
  const laTrangDangNhap = duongDan.startsWith("/dang-nhap");

  /*
   * ★ CHỐT CHẶN XÁC THỰC THẬT ★
   *
   * Middleware chỉ kiểm tra CÓ cookie hay không (edge runtime, không truy vấn được
   * cơ sở dữ liệu). Nếu dừng ở đó thì một cookie cũ đã bị xoá khỏi bảng Session vẫn
   * lọt qua: người dùng vào thẳng app, `nguoiDungHienTai()` trả null, phạm vi rỗng,
   * và mọi con số hiển thị 0 thay vì bị đá về trang đăng nhập.
   *
   * Vì vậy phải đối chiếu token với cơ sở dữ liệu TẠI ĐÂY, một chỗ duy nhất bao
   * trùm mọi trang — đặt ở từng trang thì chỉ cần sót một trang là thủng.
   */
  const nguoiDung = laTrangDangNhap ? null : await nguoiDungHienTai();
  if (!laTrangDangNhap && !nguoiDung) {
    const tiep = duongDan !== "/" ? `?tiep=${encodeURIComponent(duongDan)}` : "";
    redirect(`/dang-nhap${tiep}`);
  }

  /*
   * Chặn mục menu bị Admin ẩn với vai trò này.
   *
   * Ẩn link ở thanh menu KHÔNG đủ — gõ thẳng URL vẫn vào được. Chặn ở đây vì
   * layout bao trùm mọi trang và đã biết đường dẫn, nên không thể sót trang nào.
   *
   * CHUYỂN HƯỚNG chứ không trả 404. Trang đích sau đăng nhập là "/" (Tổng quan);
   * nếu Admin ẩn mục đó thì 404 sẽ đẩy người dùng vào trang trắng không sidebar,
   * không còn đường đi tiếp. Đưa họ tới mục đầu tiên được phép thì vẫn chặn đúng
   * mà không kẹt.
   */
  let menuDuocThay = nguoiDung ? await menuChoVaiTro(nguoiDung.vaiTro) : [];
  // Quản lý công nhân ẩn với vai trò không có tab nào (VD: Ban Giám đốc) — chốt
  // chặn thật, gõ URL vẫn bị chuyển hướng vì mục không nằm trong menuDuocThay.
  if (nguoiDung && !xemModuleCongNhan(nguoiDung.vaiTro)) {
    menuDuocThay = menuDuocThay.filter((id) => id !== "cong-nhan");
  }
  const mucDangXem = nguoiDung ? timMucMenu(duongDan) : undefined;

  if (nguoiDung && mucDangXem && !menuDuocThay.includes(mucDangXem.id)) {
    const mucDauTien = MENU.find((m) => menuDuocThay.includes(m.id));
    // Còn ít nhất một mục -> đưa về đó. Không còn mục nào thì KHÔNG chuyển hướng
    // (sẽ lặp vô hạn), mà hiện thông báo ở dưới.
    if (mucDauTien) redirect(mucDauTien.href);
  }

  // Tài khoản bị ẩn sạch mọi mục: hiện lối thoát thay vì trang trắng.
  if (nguoiDung && menuDuocThay.length === 0) {
    async function dangXuat() {
      "use server";
      await xoaPhien();
      redirect("/dang-nhap");
    }
    return (
      <html lang="vi">
        <body className="min-h-full">
          <div className="mx-auto mt-24 max-w-md rounded-xl border border-vien bg-the p-6 text-center">
            <h1 className="text-base font-semibold">Tài khoản chưa được cấp quyền xem mục nào</h1>
            <p className="mt-2 text-sm text-chunhat">
              Quản trị hệ thống đã ẩn toàn bộ các mục với vai trò{" "}
              <strong className="text-chu">{VAI_TRO[nguoiDung.vaiTro]}</strong>. Liên hệ quản trị để
              được mở quyền.
            </p>
            <form action={dangXuat} className="mt-4">
              <button
                type="submit"
                className="rounded-lg bg-nhan px-4 py-2 text-sm font-medium text-white"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </body>
      </html>
    );
  }

  // Trang đăng nhập không có sidebar và thanh trên.
  if (laTrangDangNhap) {
    return (
      <html lang="vi">
        <body className="min-h-full">{children}</body>
      </html>
    );
  }

  return (
    <html lang="vi">
      <body className="min-h-full">
        <Sidebar menuDuocThay={menuDuocThay} />
        <div className="lg:pl-60">
          <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-vien bg-the/90 px-4 py-2.5 pl-14 backdrop-blur lg:pl-4">
            <div className="flex min-w-0 items-center gap-2">
              {/* Trang chi tiết công trình: nút quay lại. Các trang khác: tiêu đề (in hoa). */}
              {duongDan.startsWith("/cong-trinh/") ? (
                <Link
                  href="/cong-trinh"
                  className="inline-flex items-center gap-1 text-xs font-medium text-nhan hover:underline"
                >
                  <ArrowLeft className="size-3.5" /> Danh mục công trình
                </Link>
              ) : tieuDeTrang(duongDan) ? (
                <h1 className="truncate text-sm font-semibold tracking-wide uppercase">
                  {tieuDeTrang(duongDan)}
                </h1>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              <ThanhNguoiDung />
            </div>
          </header>
          <main className="mx-auto w-full max-w-400 px-4 py-5">{children}</main>
        </div>
      </body>
    </html>
  );
}
