"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

/** Logo Hoàng Lam (thu gọn thành icon): mái nhà đỏ + vòng tròn HL vàng/xanh. */
function LogoHoangLam({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-label="Hoàng Lam" role="img">
      <path d="M32 5 L60 39 H52 V56 H12 V39 H4 Z" fill="#ED1C24" />
      <circle cx="32" cy="33" r="15.5" fill="#fff" />
      <circle cx="32" cy="33" r="13.5" fill="#FFD200" />
      <path d="M32 33 V46.5 A13.5 13.5 0 0 1 18.5 33 Z" fill="#009444" />
      <text
        x="32"
        y="30"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        fontWeight="700"
        fontSize="11"
        fill="#ED1C24"
      >
        HL
      </text>
    </svg>
  );
}

export function Sidebar({ menuDuocThay }: { menuDuocThay: string[] }) {
  const pathname = usePathname();
  // Mục bị Admin ẩn với vai trò này thì không hiện link. Việc chặn truy cập thật
  // nằm ở layout phía máy chủ, đây chỉ là phần nhìn.
  const mucHienThi = MENU.filter((m) => menuDuocThay.includes(m.id));
  const [mo, setMo] = useState(false);

  const noiDung = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white p-0.5">
          <LogoHoangLam className="size-full" />
        </div>
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
