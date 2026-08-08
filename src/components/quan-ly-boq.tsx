"use client";

import { useEffect, useState } from "react";
import { Settings2, X } from "lucide-react";

/**
 * Gom các nút thao tác BOQ (thêm dòng, sửa, nhập nhiều, import, thêm cột, thiết
 * lập, giảm giá) vào MỘT nút "Quản lý BOQ". Bấm mở ra hộp chứa toàn bộ các nút đó
 * — mỗi nút giữ nguyên hành vi cũ, chỉ khác là nằm gọn trong hộp thay vì dàn hàng.
 */
export function QuanLyBOQ({ children }: { children: React.ReactNode }) {
  const [mo, setMo] = useState(false);

  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMo(false);
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
