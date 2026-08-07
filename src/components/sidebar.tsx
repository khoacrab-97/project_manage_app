"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Banknote,
  Building2,
  ClipboardCheck,
  HardHat,
  LayoutDashboard,
  ListTree,
  Menu,
  PieChart,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { MENU } from "@/lib/menu";

/**
 * Biểu tượng theo mã mục. Nhãn và đường dẫn lấy từ `src/lib/menu.ts` để thanh
 * menu, màn hình phân quyền và chốt chặn phía máy chủ dùng chung một nguồn.
 */
const BIEU_TUONG: Record<string, LucideIcon> = {
  "tong-quan": LayoutDashboard,
  "cong-trinh": Building2,
  "chi-phi": PieChart,
  "dong-tien": Banknote,
  "ke-hoach": Wallet,
  "cong-nhan": HardHat,
  "nhap-du-lieu": Upload,
  "kiem-tra-du-lieu": ClipboardCheck,
  "danh-muc": ListTree,
};

function dangChon(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Đồng hồ Thứ · Ngày · Giờ cập nhật mỗi giây. null khi chưa mount (tránh lệch SSR). */
function useDongHo() {
  const [gio, setGio] = useState<{ thu: string; ngay: string; gio: string } | null>(null);
  useEffect(() => {
    const capNhat = () => {
      const d = new Date();
      setGio({
        thu: d.toLocaleDateString("vi-VN", { weekday: "long" }),
        ngay: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }),
        gio: d.toLocaleTimeString("vi-VN", { hour12: false }),
      });
    };
    capNhat();
    const id = setInterval(capNhat, 1000);
    return () => clearInterval(id);
  }, []);
  return gio;
}

export function Sidebar({ menuDuocThay }: { menuDuocThay: string[] }) {
  const pathname = usePathname();
  // Mục bị Admin ẩn với vai trò này thì không hiện link. Việc chặn truy cập thật
  // nằm ở layout phía máy chủ, đây chỉ là phần nhìn.
  const mucHienThi = MENU.filter((m) => menuDuocThay.includes(m.id));
  const [mo, setMo] = useState(false);
  const gio = useDongHo();

  const noiDung = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        {/* biome-ignore lint/performance/noImgElement: logo tĩnh trong public, không cần next/image */}
        <img
          src="/logo-hoang-lam.png"
          alt="Hoàng Lam"
          className="size-11 shrink-0 rounded-lg bg-white object-contain p-0.5"
        />
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold text-sidebarsang">CEM Platform</p>
          <p className="text-[11px] text-sidebarchu">
            Nền tảng Quản lý Chi phí &amp; Doanh thu Xây dựng
          </p>
          <p className="text-[11px] text-sidebarchu">Phòng Dự Án</p>
        </div>
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {mucHienThi.map((m) => {
          const chon = dangChon(pathname, m.href);
          const Icon = BIEU_TUONG[m.id];
          return (
            <li key={m.id}>
              <Link
                href={m.href}
                onClick={() => setMo(false)}
                aria-current={chon ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  chon
                    ? "bg-nhan font-medium text-white"
                    : "text-sidebarchu hover:bg-sidebarhover hover:text-sidebarsang"
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={2} />
                <span className="truncate">{m.nhan}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Đồng hồ Thứ · Ngày · Giờ ở góc dưới trái, cập nhật mỗi giây. */}
      <div className="border-t border-white/10 px-4 py-3">
        {gio ? (
          <div className="text-[11px] leading-relaxed text-sidebarchu">
            <p className="font-medium text-sidebarsang capitalize">{gio.thu}</p>
            <p>
              {gio.ngay} · <span className="tabular-nums">{gio.gio}</span>
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-sidebarchu">&nbsp;</p>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Nút mở menu trên màn hình hẹp */}
      <button
        type="button"
        onClick={() => setMo(true)}
        aria-label="Mở menu"
        className="fixed top-3 left-3 z-50 grid size-9 place-items-center rounded-lg border border-vien bg-the lg:hidden"
      >
        <Menu className="size-4" />
      </button>

      {/* Cố định trên desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 bg-sidebar lg:block">{noiDung}</aside>

      {/* Ngăn kéo trên tablet/mobile */}
      {mo ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMo(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar">
            <button
              type="button"
              onClick={() => setMo(false)}
              aria-label="Đóng menu"
              className="absolute top-4 right-3 grid size-8 place-items-center rounded-md text-sidebarchu hover:bg-sidebarhover"
            >
              <X className="size-4" />
            </button>
            {noiDung}
          </aside>
        </div>
      ) : null}
    </>
  );
}
