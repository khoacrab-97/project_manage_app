"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Mã công trình + nút "Thông tin" bật/tắt một hộp nổi (popover) chứa tên đầy đủ,
 * địa điểm, chủ đầu tư, chỉ huy trưởng, ngày khởi công — mỗi dòng có định danh mờ
 * + nội dung nổi bật. Hộp hiện dạng absolute nên KHÔNG đẩy trang, giúp vùng xem
 * BOQ rộng hơn. Dùng span (không dùng div) vì nằm trong thẻ <p> của DauTrang.
 */
export function ThongTinCongTrinh({
  ma,
  hienMa,
  tenCongTrinh,
  diaDiem,
  chuDauTu,
  chiHuyTruong,
  ngayKhoiCong,
}: {
  ma: string;
  /** Hiện mã ở đây không — false khi tiêu đề trang đã chính là mã (chưa có tên rút gọn). */
  hienMa: boolean;
  tenCongTrinh: string;
  diaDiem?: string;
  chuDauTu?: string;
  chiHuyTruong?: string;
  ngayKhoiCong: string;
}) {
  const [mo, setMo] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!mo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMo(false);
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMo(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [mo]);

  const dong: [string, string | undefined][] = [
    ["Công trình", tenCongTrinh],
    ["Địa điểm", diaDiem],
    ["Chủ đầu tư", chuDauTu],
    ["Chỉ huy trưởng", chiHuyTruong],
    ["Ngày khởi công", ngayKhoiCong],
  ];

  return (
    <span ref={ref} className="relative inline-flex items-center gap-2">
      {hienMa ? <span className="text-chunhat">{ma}</span> : null}
      <button
        type="button"
        onClick={() => setMo((v) => !v)}
        className="inline-flex items-center gap-0.5 rounded border border-vien px-1.5 py-0.5 text-xs text-chunhat hover:bg-nen"
      >
        Thông tin
        <ChevronDown className={`size-3 transition-transform ${mo ? "rotate-180" : ""}`} />
      </button>
      {mo ? (
        <span className="absolute top-full left-0 z-30 mt-1 block w-max max-w-lg space-y-0.5 rounded-lg border border-vien bg-the p-3 shadow-lg">
          {dong.map(([nhan, gt]) =>
            gt ? (
              <span key={nhan} className="block text-xs leading-relaxed">
                <span className="text-chunhat">{nhan}: </span>
                <span className="font-medium text-chu">{gt}</span>
              </span>
            ) : null
          )}
        </span>
      ) : null}
    </span>
  );
}
