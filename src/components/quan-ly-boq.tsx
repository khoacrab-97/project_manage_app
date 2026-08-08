"use client";

import { useEffect, useState } from "react";
import { Settings2, X } from "lucide-react";

/**
 * Hộp thoại nổi dùng chung cho các chức năng BOQ (thêm dòng, thêm cột, thiết lập,
 * giảm giá). Hiện đè lên trên (fixed), KHÔNG đẩy bảng BOQ xuống. Esc để đóng nhanh.
 *
 * Gắn `data-boq-modal` để nút "Quản lý BOQ" biết đang có hộp con mở mà nhường phím
 * Esc: Esc lần 1 đóng hộp con, Esc lần 2 mới đóng khối Quản lý BOQ.
 */
export function HopBOQ({
  tieuDe,
  onClose,
  children,
  rong = "max-w-lg",
}: {
  tieuDe: string;
  onClose: () => void;
  children: React.ReactNode;
  rong?: string;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);

  return (
    <div
      data-boq-modal
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
    >
      <div className={`my-6 w-full ${rong} rounded-xl border border-vien bg-the shadow-xl`}>
        <div className="flex items-center justify-between border-b border-vien px-4 py-3">
          <h2 className="text-sm font-semibold">{tieuDe}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-vien p-1.5"
            title="Đóng (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/**
 * Gom các nút thao tác BOQ (thêm dòng, sửa, nhập nhiều, import, thêm cột, thiết
 * lập, giảm giá) vào MỘT nút "Quản lý BOQ". Bấm mở ra hộp chứa toàn bộ các nút đó
 * — mỗi nút mở hộp thoại nổi riêng (không đẩy bảng BOQ).
 */
export function QuanLyBOQ({ children }: { children: React.ReactNode }) {
  const [mo, setMo] = useState(false);

  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Đang mở một hộp thoại con thì nhường Esc cho nó (Esc lần 2 mới đóng khối này).
      if (document.querySelector("[data-boq-modal]")) return;
      setMo(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [mo]);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setMo((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-vien px-3 py-1.5 text-xs font-medium hover:bg-nen"
      >
        <Settings2 className="size-3.5" /> Quản lý BOQ
      </button>
      {mo ? (
        <div className="mt-2 rounded-lg border border-vien bg-the p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-chunhat">Quản lý BOQ</span>
            <button
              type="button"
              onClick={() => setMo(false)}
              className="rounded-md border border-vien p-1"
              title="Đóng (Esc)"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap items-start gap-2">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
