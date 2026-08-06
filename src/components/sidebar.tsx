"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Banknote,
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
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

export function Sidebar({ menuDuocThay }: { menuDuocThay: string[] }) {
  const pathname = usePathname();
  // Mục bị Admin ẩn với vai trò này thì không hiện link. Việc chặn truy cập thật
  // nằm ở layout phía máy chủ, đây chỉ là phần nhìn.
  const mucHienThi = MENU.filter((m) => menuDuocThay.includes(m.id));
  const [mo, setMo] = useState(false);

  const noiDung = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-nhan text-sm font-bold text-white">
          DC
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-sidebarsang">Doanh thu – Chi phí</p>
          <p className="truncate text-[11px] text-sidebarchu">Quản trị thi công xây dựng</p>
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

      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-start gap-2 text-[11px] leading-relaxed text-sidebarchu">
          <FileSpreadsheet className="mt-px size-3.5 shrink-0" />
          <span>
            Số liệu dựng từ ma trận <strong className="text-sidebarsang">OUTPUT_NAM</strong> của file
            tổng hợp.
          </span>
        </div>
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
