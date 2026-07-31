"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Pencil, Plus, ShieldCheck, X } from "lucide-react";
import {
  luuKhoiLuong,
  themBillThang,
  xacNhanBill,
  type KetQuaBOQ,
} from "@/app/cong-trinh/boq-actions";
import { khoiLuong as dinhDangKL, tien } from "@/lib/format";

const O = "rounded-md border border-vien bg-the px-2 py-1 text-xs";

function ThongBao({ kq }: { kq: KetQuaBOQ | null }) {
  if (!kq) return null;
  return (
    <p
      className={`mt-2 text-xs ${kq.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
    >
      {kq.thongDiep}
    </p>
  );
}

/**
 * Nút tạo Bill cho một tháng mới.
 * Tạo xong nhảy thẳng sang tháng đó và mở sẵn box nhập khối lượng.
 */
export function NutThemBill({
  maCongTrinh,
  goiY,
  base,
}: {
  maCongTrinh: string;
  goiY: string;
  base: string;
}) {
  const [mo, setMo] = useState(false);
  const [kq, setKq] = useState<KetQuaBOQ | null>(null);
  const [dangChay, batDau] = useTransition();

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-nhan px-3 py-1.5 text-xs font-medium text-white"
      >
        <Plus className="size-3.5" /> Thêm Bill tháng
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const thang = String(fd.get("thang") ?? "");
        batDau(async () => {
          const r = await themBillThang(fd);
          setKq(r);
          // Tạo xong là mở luôn box nhập, đúng luồng "thêm bill -> nhập khối lượng".
          if (r.ok) window.location.href = `${base}?tab=boq&bq=${thang}&nhap=1`;
        });
      }}
      className="rounded-lg border border-nhan bg-nhannhat p-3"
    >
      <input type="hidden" name="maCongTrinh" value={maCongTrinh} />
      <label className="text-xs">
        <span className="mb-0.5 block text-chunhat">Tháng cần ra Bill</span>
        <input name="thang" defaultValue={goiY} placeholder="2026-08" className={`${O} font-mono`} required />
      </label>
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={dangChay}
          className="rounded-md bg-nhan px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {dangChay ? "Đang tạo…" : "Tạo Bill"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMo(false);
            setKq(null);
          }}
          className="rounded-md border border-vien px-3 py-1 text-xs"
        >
          Đóng
        </button>
      </div>
      <ThongBao kq={kq} />
    </form>
  );
}

export interface DongNhap {
  id: string;
  stt: string;
  noiDung: string;
  dvt: string;
  donGia: number;
  /** Luỹ kế khối lượng của các tháng TRƯỚC kỳ đang nhập. */
  klKyTruoc: number;
  klHienTai: number;
  hoanThanh: boolean;
}

/**
 * Box nhập khối lượng của MỘT tháng, mở dạng hộp nổi.
 *
 * Cố ý chỉ có 5 cột (STT, nội dung, ĐVT, luỹ kế kỳ trước, khối lượng kỳ này) cộng
 * ô tích hoàn thành — người ngoài công trường chỉ cần bấy nhiêu để ghi khối lượng.
 * Đơn giá và thành tiền từng dòng KHÔNG hiện ở đây; chỉ giữ tổng giá trị Bill ở
 * chân box vì đó là con số phải thấy trước khi lưu.
 */
export function BoxNhapBOQ({
  maCongTrinh,
  thang,
  nhanThang,
  dongs,
  duocXacNhan,
  moSan,
}: {
  maCongTrinh: string;
  thang: string;
  nhanThang: string;
  dongs: DongNhap[];
  duocXacNhan: boolean;
  /** Mở sẵn ngay khi vào trang (sau khi vừa tạo Bill tháng). */
  moSan: boolean;
}) {
  const [mo, setMo] = useState(moSan);
  const [kl, setKl] = useState<Record<string, string>>(
    Object.fromEntries(dongs.map((d) => [d.id, d.klHienTai ? String(d.klHienTai) : ""]))
  );
  const [xong, setXong] = useState<Record<string, boolean>>(
    Object.fromEntries(dongs.map((d) => [d.id, d.hoanThanh]))
  );
  const [kq, setKq] = useState<KetQuaBOQ | null>(null);
  const [dangChay, batDau] = useTransition();

  // Đóng bằng phím Esc — hộp nổi mà không thoát được bằng bàn phím thì rất bí.
  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMo(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [mo]);

  const soCua = (v: string) => {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const tongTien = dongs.reduce((a, d) => a + Math.round(soCua(kl[d.id] ?? "") * d.donGia), 0);

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs font-medium hover:bg-nen"
      >
        <Pencil className="size-3.5" /> Cập nhật khối lượng
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-4xl rounded-xl border border-vien bg-the shadow-xl">
        <div className="flex items-center justify-between border-b border-vien px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Cập nhật khối lượng {nhanThang}</h2>
            <p className="mt-0.5 text-xs text-chunhat">
              Nhập khối lượng thực hiện trong kỳ. Tích “Xong” khi công tác đã thi công hoàn tất.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMo(false)}
            className="rounded-md border border-vien p-1.5"
            title="Đóng (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            batDau(async () => {
              const r = await luuKhoiLuong(fd);
              setKq(r);
              if (r.ok) setTimeout(() => setMo(false), 800);
            });
          }}
        >
          <input type="hidden" name="maCongTrinh" value={maCongTrinh} />
          <input type="hidden" name="thang" value={thang} />

          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-the">
                <tr className="border-b border-vien text-left">
                  <th className="px-3 py-2 text-xs font-medium text-chunhat">STT</th>
                  <th className="px-3 py-2 text-xs font-medium text-chunhat">Nội dung công việc</th>
                  <th className="px-3 py-2 text-xs font-medium text-chunhat">ĐVT</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-chunhat">
                    Lũy kế đến kỳ trước
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-chunhat">
                    Khối lượng kỳ này
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-chunhat">Xong</th>
                </tr>
              </thead>
              <tbody>
                {dongs.map((d) => (
                  <tr key={d.id} className={`border-b border-vien/60 ${xong[d.id] ? "bg-nen/50" : ""}`}>
                    <td className="px-3 py-1.5 font-mono text-xs">{d.stt}</td>
                    <td className="max-w-[300px] truncate px-3 py-1.5 text-xs" title={d.noiDung}>
                      {d.noiDung}
                    </td>
                    <td className="px-3 py-1.5 text-xs whitespace-nowrap">{d.dvt}</td>
                    <td className="px-3 py-1.5 text-right text-xs text-chunhat">
                      {d.klKyTruoc ? dinhDangKL(d.klKyTruoc) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <input
                        name={`kl_${d.id}`}
                        value={kl[d.id] ?? ""}
                        onChange={(e) => setKl({ ...kl, [d.id]: e.target.value })}
                        inputMode="decimal"
                        placeholder="0"
                        className={`${O} w-28 text-right`}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        name={`xong_${d.id}`}
                        checked={xong[d.id] ?? false}
                        onChange={(e) => setXong({ ...xong, [d.id]: e.target.checked })}
                        title="Công tác đã thi công xong"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-vien px-4 py-3">
            <p className="text-xs">
              <span className="text-chunhat">Giá trị Bill {nhanThang}: </span>
              <strong className="so text-sm">{tien(tongTien)} đ</strong>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMo(false)}
                className="rounded-md border border-vien px-3 py-1.5 text-xs"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={dangChay}
                className="inline-flex items-center gap-1 rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                <Check className="size-3.5" />
                {dangChay ? "Đang lưu…" : duocXacNhan ? "Lưu và xác nhận" : "Lưu (chờ xác nhận)"}
              </button>
            </div>
          </div>
          {!duocXacNhan ? (
            <p className="px-4 pb-3 text-[11px] text-chunhat">
              Bạn không có quyền xác nhận — chỉ huy trưởng duyệt thì số liệu mới vào KPI.
            </p>
          ) : null}
          <div className="px-4 pb-3">
            <ThongBao kq={kq} />
          </div>
        </form>
      </div>
    </div>
  );
}

/** Nút duyệt một tháng đang chờ xác nhận. */
export function NutXacNhan({ maCongTrinh, thang }: { maCongTrinh: string; thang: string }) {
  const [kq, setKq] = useState<KetQuaBOQ | null>(null);
  const [dangChay, batDau] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        batDau(async () => setKq(await xacNhanBill(fd)));
      }}
      className="inline"
    >
      <input type="hidden" name="maCongTrinh" value={maCongTrinh} />
      <input type="hidden" name="thang" value={thang} />
      <button
        type="submit"
        disabled={dangChay}
        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
      >
        <ShieldCheck className="size-3.5" /> {dangChay ? "Đang duyệt…" : "Xác nhận Bill"}
      </button>
      <ThongBao kq={kq} />
    </form>
  );
}
