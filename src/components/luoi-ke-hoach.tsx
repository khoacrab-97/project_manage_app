"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Download, Pencil, Upload, X } from "lucide-react";
import { luuKeHoach, nhapKeHoachExcel, type KetQuaKeHoach } from "@/app/ke-hoach/actions";
import { tien } from "@/lib/format";

const O = "rounded-md border border-vien bg-the px-2 py-1 text-xs";

function ThongBao({ kq }: { kq: KetQuaKeHoach | null }) {
  if (!kq) return null;
  return (
    <p
      className={`mt-2 text-xs ${kq.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
    >
      {kq.thongDiep}
    </p>
  );
}

export interface MaNhap {
  ma: string;
  ten: string;
  loai: "Doanh thu" | "Chi phí";
  /** Mã con thì thụt vào, giống bảng chi phí ở màn hình công trình. */
  capCon: boolean;
  /** Mã nhóm (không nhận giao dịch trực tiếp) — vẫn cho lập ngân sách cấp nhóm. */
  laNhom: boolean;
}

/**
 * Lưới nhập kế hoạch của MỘT công trình, mở trong HỘP THOẠI riêng.
 *
 * Mỗi mã một ô — kế hoạch lập cho cả dự án, không chia theo tháng, đúng như cột
 * "KẾ HOẠCH CHI PHÍ TỔNG DỰ ÁN" của biểu mẫu công ty. Liệt kê TOÀN BỘ danh mục
 * theo cây 2 cấp (mã con thụt vào), kể cả mã nhóm — ngân sách hiện có đang nằm
 * ở cả cấp nhóm, bỏ chúng khỏi lưới là khi lưu sẽ xoá mất.
 */
export function LuoiKeHoach({
  maCongTrinh,
  tenCongTrinh,
  dsMa,
  giaTriHienTai,
}: {
  maCongTrinh: string;
  tenCongTrinh: string;
  dsMa: MaNhap[];
  giaTriHienTai: Record<string, number>;
}) {
  const [mo, setMo] = useState(false);
  const [v, setV] = useState<Record<string, string>>(
    Object.fromEntries(dsMa.map((m) => [m.ma, giaTriHienTai[m.ma] ? String(giaTriHienTai[m.ma]) : ""]))
  );
  const [kq, setKq] = useState<KetQuaKeHoach | null>(null);
  const [dangChay, batDau] = useTransition();
  const [dangNhap, batDauNhap] = useTransition();

  // Đóng bằng Esc — hộp nổi mà không thoát được bằng bàn phím thì rất bí.
  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMo(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [mo]);

  const so = (s: string) => {
    const n = Number(s.replace(/[\s.]/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const tongTheoLoai = (loai: MaNhap["loai"]) =>
    dsMa.filter((m) => m.loai === loai).reduce((a, m) => a + so(v[m.ma] ?? ""), 0);
  const tongDT = tongTheoLoai("Doanh thu");
  const tongCP = tongTheoLoai("Chi phí");
  const soMaCoSo = dsMa.filter((m) => so(v[m.ma] ?? "") > 0).length;

  if (!mo) {
    return (
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={() => setMo(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-nhan px-3 py-1.5 text-xs font-medium text-white"
        >
          <Pencil className="size-3.5" /> Nhập kế hoạch
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-4xl rounded-xl border border-vien bg-the shadow-xl">
        <div className="flex items-center justify-between border-b border-vien px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Nhập kế hoạch — {maCongTrinh}</h2>
            <p className="mt-0.5 text-xs text-chunhat">
              {tenCongTrinh} · {soMaCoSo}/{dsMa.length} mã có ngân sách · lập cho cả dự án, không
              chia theo tháng
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMo(false)}
            title="Đóng (Esc)"
            className="rounded-md border border-vien p-1.5"
          >
            <X className="size-4" />
          </button>
        </div>

      {/* ---- Nhập từ Excel ---- */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          batDauNhap(async () => {
            const r = await nhapKeHoachExcel(fd);
            setKq(r);
            // Nhập xong phải tải lại để lưới hiện số vừa ghi.
            if (r.ok) setTimeout(() => window.location.reload(), 1200);
          });
        }}
        className="flex flex-wrap items-end gap-2 border-b border-vien px-4 py-3"
      >
        <input type="hidden" name="maCongTrinh" value={maCongTrinh} />
        <label className="text-xs">
          <span className="mb-0.5 block text-chunhat">Nhập từ Excel</span>
          <input type="file" name="file" accept=".xlsx" className={`${O} w-72`} required />
        </label>
        <button
          type="submit"
          disabled={dangNhap}
          className="inline-flex items-center gap-1 rounded-md border border-vien px-3 py-1.5 text-xs font-medium disabled:opacity-60"
        >
          <Upload className="size-3.5" /> {dangNhap ? "Đang đọc…" : "Tải lên"}
        </button>
        <a
          href="/api/mau-ke-hoach"
          className="inline-flex items-center gap-1 rounded-md border border-vien px-3 py-1.5 text-xs font-medium hover:bg-nen"
        >
          <Download className="size-3.5" /> Tải file mẫu
        </a>
        <p className="w-full text-[11px] text-chunhat">
          File dùng mã theo danh mục hiện hành. Nhập từ Excel sẽ <strong>thay thế</strong> toàn bộ
          kế hoạch cũ của công trình này; mã không có trong danh mục bị bỏ qua chứ không gộp ngầm.
          Dòng in đậm là <strong>mã nhóm</strong> — dữ liệu cũ có ngân sách lập ở cấp nhóm, đặt số ở
          cả nhóm lẫn mã con của nó sẽ bị cộng đôi.
        </p>
      </form>

      {/* ---- Lưới nhập tay ---- */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          batDau(async () => setKq(await luuKeHoach(fd)));
        }}
      >
        <input type="hidden" name="maCongTrinh" value={maCongTrinh} />
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-the">
              <tr className="border-b border-vien text-left">
                <th className="px-3 py-2 text-xs font-medium text-chunhat">Mã</th>
                <th className="px-3 py-2 text-xs font-medium text-chunhat">Hạng mục</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-chunhat">Kế hoạch (đ)</th>
              </tr>
            </thead>
            <tbody>
              {dsMa.map((m) => (
                <tr key={m.ma} className={`border-b border-vien/60 ${m.laNhom ? "bg-nen/50" : ""}`}>
                  <td
                    className={`px-3 py-1.5 text-xs whitespace-nowrap ${m.capCon ? "pl-8" : ""} ${m.laNhom ? "font-semibold" : ""}`}
                  >
                    {m.ma}
                  </td>
                  <td
                    className={`max-w-95 truncate px-3 py-1.5 text-xs ${m.laNhom ? "font-semibold" : ""}`}
                    title={m.ten}
                  >
                    {m.loai === "Doanh thu" ? <span className="text-nhan">{m.ten}</span> : m.ten}
                    {m.laNhom ? <span className="ml-1.5 font-normal text-chunhat">(mã nhóm)</span> : null}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      name={`kh_${m.ma}`}
                      value={v[m.ma] ?? ""}
                      onChange={(e) => setV({ ...v, [m.ma]: e.target.value })}
                      inputMode="numeric"
                      placeholder="0"
                      className={`${O} w-36 text-right`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-vien px-4 py-3">
          <p className="text-xs">
            <span className="text-chunhat">Doanh thu KH: </span>
            <strong className="so">{tien(tongDT)}</strong>
            <span className="mx-2 text-chunhat">·</span>
            <span className="text-chunhat">Chi phí KH: </span>
            <strong className="so">{tien(tongCP)}</strong>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMo(false)}
              className="rounded-md border border-vien px-3 py-1.5 text-xs"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={dangChay}
              className="inline-flex items-center gap-1 rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              <Check className="size-3.5" /> {dangChay ? "Đang lưu…" : "Lưu kế hoạch"}
            </button>
          </div>
        </div>
        <div className="px-4 pb-3">
          <ThongBao kq={kq} />
        </div>
      </form>
      </div>
    </div>
  );
}
