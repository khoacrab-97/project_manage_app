import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { ChiDan } from "@/components/chi-dan";
import { cn } from "@/lib/cn";
import { phanTram, tienGon } from "@/lib/format";

/**
 * Thẻ KPI.
 *
 * `tot` cho biết chiều tăng có phải là tốt hay không: doanh thu tăng là tốt,
 * chi phí tăng là xấu. Không có tham số này thì mũi tên xanh/đỏ sẽ đọc sai
 * nghĩa ở thẻ chi phí.
 */
export function TheKPI({
  nhan,
  giaTri,
  delta,
  tangLaTot = true,
  phuChu,
  dinhDang = "tien",
  nhanMuc,
  chiDan,
}: {
  nhan: string;
  giaTri: number | null;
  delta?: number | null;
  tangLaTot?: boolean;
  phuChu?: ReactNode;
  /** `so`: tỷ số hoặc số đếm — CPI, số công trình… không mang đơn vị tiền lẫn %. */
  dinhDang?: "tien" | "phanTram" | "so";
  nhanMuc?: ReactNode;
  /** Giải thích ngắn dồn vào icon (i) cạnh nhãn, thay cho ghi chú dài. */
  chiDan?: ReactNode;
}) {
  const hienGiaTri =
    giaTri === null
      ? "—"
      : dinhDang === "tien"
        ? tienGon(giaTri)
        : dinhDang === "so"
          ? giaTri.toLocaleString("vi-VN", { maximumFractionDigits: 2 })
          : phanTram(giaTri);
  const am = typeof giaTri === "number" && giaTri < 0;

  const co = delta !== null && delta !== undefined && Number.isFinite(delta);
  const tang = co && (delta as number) > 0;
  const phang = co && Math.abs(delta as number) < 0.0005;
  const tot = tang === tangLaTot;

  return (
    <div className="rounded-xl border border-vien bg-the p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-medium text-chunhat">
          {nhan}
          {chiDan ? <ChiDan tieuDe={nhan}>{chiDan}</ChiDan> : null}
        </p>
        {nhanMuc}
      </div>
      <p
        className={cn(
          "so mt-2 text-2xl font-semibold tracking-tight",
          am && "text-rose-600 dark:text-rose-400"
        )}
      >
        {hienGiaTri}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
        {co ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 font-medium",
              phang
                ? "text-chunhat"
                : tot
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
            )}
          >
            {phang ? (
              <Minus className="size-3" />
            ) : tang ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {phanTram(Math.abs(delta as number))}
          </span>
        ) : null}
        {phuChu ? <span className="text-chunhat">{phuChu}</span> : null}
      </div>
    </div>
  );
}
