"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

/**
 * Chỉ dẫn (i): icon thông tin nhỏ, bấm vào hiện hộp giải thích ngắn. Dùng để dồn
 * các ghi chú/mô tả dài ra khỏi thân trang cho gọn — nội dung chỉ hiện khi cần.
 *
 * Bấm ngoài hoặc Esc để đóng. Đặt cạnh nhãn/tiêu đề cần giải thích.
 */
export function ChiDan({ tieuDe, children }: { tieuDe?: ReactNode; children: ReactNode }) {
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

  return (
    <span ref={boc} className="relative inline-flex shrink-0 align-middle">
      <button
        type="button"
        onClick={(e) => {
          // Chặn nổi bọt để không kích hoạt thao tác của phần tử cha (vd: mở/đóng
          // <summary> của TheGap, hay chọn ô/hàng của bảng bao ngoài).
          e.preventDefault();
          e.stopPropagation();
          setMo((v) => !v);
        }}
        aria-label="Giải thích"
        title="Giải thích"
        className={`inline-flex size-4 items-center justify-center rounded-full transition-colors ${
          mo ? "text-nhan" : "text-chunhat hover:text-nhan"
        }`}
      >
        <Info className="size-3.5" />
      </button>
      {mo ? (
        <span
          role="tooltip"
          className="absolute top-full left-1/2 z-50 mt-1.5 w-64 max-w-[80vw] -translate-x-1/2 rounded-lg border border-vien bg-the p-3 text-left text-xs leading-relaxed font-normal whitespace-normal text-chunhat shadow-xl"
        >
          {tieuDe ? (
            <span className="mb-1 block text-[11px] font-semibold text-chu">{tieuDe}</span>
          ) : null}
          {children}
        </span>
      ) : null}
    </span>
  );
}
