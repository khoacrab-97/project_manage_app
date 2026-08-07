"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { SucKhoe } from "@/lib/types";

/**
 * Nút cảnh báo nổi bật: hiện mức sức khỏe (Đỏ/Vàng), bấm mở hộp liệt kê lý do.
 * Thay cho dòng cảnh báo dài trong thân trang. Esc / bấm ngoài để đóng.
 */
export function CanhBaoNut({ mucDo, lyDo }: { mucDo: SucKhoe; lyDo: string[] }) {
  const [mo, setMo] = useState(false);
  const boc = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: MouseEvent) => {
      if (boc.current && !boc.current.contains(e.target as Node)) setMo(false);
    };
    const phim = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMo(false);
    };
    window.addEventListener("mousedown", ngoai);
    window.addEventListener("keydown", phim);
    return () => {
      window.removeEventListener("mousedown", ngoai);
      window.removeEventListener("keydown", phim);
    };
  }, [mo]);

  if (!lyDo.length) return null;

  const do_ = mucDo === "Đỏ";
  const nut = do_
    ? "bg-rose-600 hover:bg-rose-700 ring-rose-300 dark:ring-rose-900"
    : "bg-amber-500 hover:bg-amber-600 ring-amber-200 dark:ring-amber-900";

  return (
    <span ref={boc} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setMo((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm ring-2 ${nut} ${do_ ? "animate-pulse" : ""}`}
      >
        <AlertTriangle className="size-4" />
        Cảnh báo · {lyDo.length}
      </button>
      {mo ? (
        <span className="absolute top-full right-0 z-50 mt-1.5 w-72 max-w-[80vw] rounded-lg border border-vien bg-the p-3 text-left shadow-xl">
          <span className="mb-1 block text-xs font-semibold text-chu">
            Lý do công trình đang ở mức {mucDo}
          </span>
          <ul className="list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-chunhat">
            {lyDo.map((l) => (
              <li key={l}>{l as ReactNode}</li>
            ))}
          </ul>
        </span>
      ) : null}
    </span>
  );
}
