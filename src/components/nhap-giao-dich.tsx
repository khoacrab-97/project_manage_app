"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { themNhieuGiaoDich, type KetQuaGiaoDich } from "@/app/cong-trinh/giao-dich-actions";
import { docSoVN } from "@/lib/so-vn";
import { nhanThang } from "@/lib/format";

const O = "rounded-md border border-vien bg-the px-2 py-1 text-xs";

interface MaChon {
  ma: string;
  ten: string;
  loai: "Doanh thu" | "Chi phí";
}

interface Dong {
  maBase: string;
  soHoaDon: string;
  ngayChungTu: string; // yyyy-MM-dd
  noiDung: string;
  dvt: string;
  donGia: string;
  soLuong: string;
  soTien: string;
  maDTCP: string;
  ghiChu: string;
}

const DONG_RONG: Dong = {
  maBase: "",
  soHoaDon: "",
  ngayChungTu: "",
  noiDung: "",
  dvt: "",
  donGia: "",
  soLuong: "",
  soTien: "",
  maDTCP: "",
  ghiChu: "",
};

/** Số sẽ lưu theo quy ước Việt. Rỗng -> null; không đọc được -> null. */
function docSo(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  return docSoVN(t);
}

/** Số tiền hiển thị dự kiến: nhập trực tiếp, hoặc tự tính Đơn giá × Số lượng. */
function soTienDuKien(d: Dong): { giaTri: number | null; tuTinh: boolean } {
  const truc = docSo(d.soTien);
  if (truc !== null) return { giaTri: truc, tuTinh: false };
  const dg = docSo(d.donGia);
  const sl = docSo(d.soLuong);
  if (dg !== null && sl !== null) return { giaTri: dg * sl, tuTinh: true };
  return { giaTri: null, tuTinh: false };
}

/**
 * Lưới nhập giao dịch như Excel — ghi thẳng vào sổ. Di chuyển giữa các ô bằng
 * phím mũi tên / Enter. Số tiền để trống mà có Đơn giá + Số lượng thì tự tính.
 */
export function NhapGiaoDich({ maCongTrinh, dsMa }: { maCongTrinh: string; dsMa: MaChon[] }) {
  const [mo, setMo] = useState(false);
  const [dongs, setDongs] = useState<Dong[]>(() => Array.from({ length: 6 }, () => ({ ...DONG_RONG })));
  const [kq, setKq] = useState<KetQuaGiaoDich | null>(null);
  const [dangLuu, batDau] = useTransition();
  const luoiRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMo(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [mo]);

  const maDT = dsMa.filter((c) => c.loai === "Doanh thu");
  const maCP = dsMa.filter((c) => c.loai === "Chi phí");

  const suaO = (i: number, k: keyof Dong, v: string) =>
    setDongs((s) => s.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const xoaDong = (i: number) => setDongs((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s));
  const themDong = () => setDongs((s) => [...s, { ...DONG_RONG }]);

  // Di chuyển giữa các ô như bảng tính. Bỏ qua ô select/date (điều hướng riêng).
  const diChuyen = (e: React.KeyboardEvent) => {
    const inp = e.target as HTMLInputElement;
    const r = Number(inp.dataset.r);
    const c = Number(inp.dataset.c);
    if (Number.isNaN(r) || Number.isNaN(c)) return;
    const den = (rr: number, cc: number) => {
      const t = luoiRef.current?.querySelector<HTMLElement>(`[data-r="${rr}"][data-c="${cc}"]`);
      if (t) {
        e.preventDefault();
        t.focus();
      }
    };
    const dauO = inp.selectionStart === 0 && inp.selectionEnd === 0;
    const cuoiO = inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length;
    if (e.key === "ArrowDown" || e.key === "Enter") den(r + 1, c);
    else if (e.key === "ArrowUp") den(r - 1, c);
    else if (e.key === "ArrowLeft" && dauO) den(r, c - 1);
    else if (e.key === "ArrowRight" && cuoiO) den(r, c + 1);
  };

  const luu = () => {
    const fd = new FormData();
    fd.set("maCongTrinh", maCongTrinh);
    for (const d of dongs) {
      fd.append("maBase", d.maBase);
      fd.append("soHoaDon", d.soHoaDon);
      fd.append("ngayChungTu", d.ngayChungTu);
      fd.append("noiDung", d.noiDung);
      fd.append("dvt", d.dvt);
      fd.append("donGia", d.donGia);
      fd.append("soLuong", d.soLuong);
      fd.append("soTien", d.soTien);
      fd.append("maDTCP", d.maDTCP);
      fd.append("ghiChu", d.ghiChu);
    }
    batDau(async () => {
      const r = await themNhieuGiaoDich(fd);
      setKq(r);
      if (r.ok) {
        setDongs(Array.from({ length: 6 }, () => ({ ...DONG_RONG })));
        setTimeout(() => setMo(false), 1200);
      }
    });
  };

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-nhan px-3 py-1.5 text-xs font-medium text-white"
      >
        <Plus className="size-3.5" /> Nhập giao dịch
      </button>
    );
  }

  // Ô nhập số dùng chung: hiển thị preview số đọc được.
  const oSo = (i: number, k: "donGia" | "soLuong" | "soTien", c: number, rong: string) => {
    const v = dongs[i][k];
    const n = docSo(v);
    const loiSo = v.trim() !== "" && n === null;
    return (
      <td className="border border-vien px-1 py-1 align-top">
        <input
          data-r={i}
          data-c={c}
          value={v}
          onChange={(e) => suaO(i, k, e.target.value)}
          onKeyDown={diChuyen}
          inputMode="decimal"
          className={`${O} ${rong} text-right ${loiSo ? "border-rose-400" : ""}`}
          placeholder="0"
        />
        {loiSo ? (
          <span className="mt-0.5 block text-right text-[10px] text-rose-600 dark:text-rose-400">
            không đọc được
          </span>
        ) : null}
      </td>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-6xl rounded-xl border border-vien bg-the shadow-xl">
        <div className="flex items-center justify-between border-b border-vien px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Nhập giao dịch — {maCongTrinh}</h2>
            <p className="mt-0.5 text-xs text-chunhat">
              Ghi thẳng vào sổ. Tháng thực hiện tự lấy theo Ngày chứng từ. Số tiền để trống mà có
              Đơn giá + Số lượng thì tự tính (dấu <strong>,</strong> là thập phân,{" "}
              <strong>.</strong> là ngăn nghìn). Di chuyển bằng phím mũi tên. Dòng thiếu Mã DT–CP,
              Nội dung hoặc Ngày sẽ bị bỏ.
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

        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-the">
              <tr>
                {[
                  "Mã Base",
                  "Số hóa đơn",
                  "Ngày chứng từ *",
                  "Tháng TH",
                  "Nội dung thanh toán *",
                  "ĐVT",
                  "Đơn giá",
                  "Số lượng",
                  "Số tiền",
                  "Mã DT–CP *",
                  "Ghi chú",
                ].map((h) => (
                  <th
                    key={h}
                    className="border border-vien bg-nen px-2 py-1.5 text-left text-xs font-semibold whitespace-nowrap text-chunhat"
                  >
                    {h}
                  </th>
                ))}
                <th className="border border-vien bg-nen px-2 py-1.5" />
              </tr>
            </thead>
            <tbody ref={luoiRef}>
              {dongs.map((d, i) => {
                const st = soTienDuKien(d);
                const thieu = !d.maDTCP || !d.noiDung.trim() || !d.ngayChungTu;
                const coDl =
                  d.maDTCP || d.noiDung.trim() || d.ngayChungTu || d.soTien.trim() || d.donGia.trim();
                return (
                  <tr key={i} className={coDl && thieu ? "bg-rose-50 dark:bg-rose-950/20" : ""}>
                    {/* Mã Base */}
                    <td className="border border-vien px-1 py-1 align-top">
                      <input
                        data-r={i}
                        data-c={0}
                        value={d.maBase}
                        onChange={(e) => suaO(i, "maBase", e.target.value)}
                        onKeyDown={diChuyen}
                        className={`${O} w-24`}
                      />
                    </td>
                    {/* Số hóa đơn */}
                    <td className="border border-vien px-1 py-1 align-top">
                      <input
                        data-r={i}
                        data-c={1}
                        value={d.soHoaDon}
                        onChange={(e) => suaO(i, "soHoaDon", e.target.value)}
                        onKeyDown={diChuyen}
                        className={`${O} w-24`}
                      />
                    </td>
                    {/* Ngày chứng từ */}
                    <td className="border border-vien px-1 py-1 align-top">
                      <input
                        type="date"
                        value={d.ngayChungTu}
                        onChange={(e) => suaO(i, "ngayChungTu", e.target.value)}
                        className={`${O} w-36`}
                      />
                    </td>
                    {/* Tháng thực hiện (tự tính) */}
                    <td className="border border-vien px-2 py-1 align-top text-xs whitespace-nowrap text-chunhat">
                      {d.ngayChungTu ? nhanThang(d.ngayChungTu.slice(0, 7)) : "—"}
                    </td>
                    {/* Nội dung */}
                    <td className="border border-vien px-1 py-1 align-top">
                      <input
                        data-r={i}
                        data-c={4}
                        value={d.noiDung}
                        onChange={(e) => suaO(i, "noiDung", e.target.value)}
                        onKeyDown={diChuyen}
                        className={`${O} w-full min-w-[220px]`}
                      />
                    </td>
                    {/* ĐVT */}
                    <td className="border border-vien px-1 py-1 align-top">
                      <input
                        data-r={i}
                        data-c={5}
                        value={d.dvt}
                        onChange={(e) => suaO(i, "dvt", e.target.value)}
                        onKeyDown={diChuyen}
                        className={`${O} w-16`}
                      />
                    </td>
                    {/* Đơn giá / Số lượng / Số tiền */}
                    {oSo(i, "donGia", 6, "w-28")}
                    {oSo(i, "soLuong", 7, "w-20")}
                    <td className="border border-vien px-1 py-1 align-top">
                      <input
                        data-r={i}
                        data-c={8}
                        value={d.soTien}
                        onChange={(e) => suaO(i, "soTien", e.target.value)}
                        onKeyDown={diChuyen}
                        inputMode="decimal"
                        className={`${O} w-32 text-right`}
                        placeholder={st.tuTinh ? "tự tính" : "0"}
                      />
                      {st.tuTinh && st.giaTri !== null ? (
                        <span className="mt-0.5 block text-right text-[10px] text-chunhat">
                          = {st.giaTri.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
                        </span>
                      ) : null}
                    </td>
                    {/* Mã DT-CP */}
                    <td className="border border-vien px-1 py-1 align-top">
                      <select
                        value={d.maDTCP}
                        onChange={(e) => suaO(i, "maDTCP", e.target.value)}
                        className={`${O} w-40`}
                      >
                        <option value="">— chọn mã —</option>
                        {maDT.length ? (
                          <optgroup label="Doanh thu">
                            {maDT.map((c) => (
                              <option key={c.ma} value={c.ma}>
                                {c.ma} — {c.ten}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        {maCP.length ? (
                          <optgroup label="Chi phí">
                            {maCP.map((c) => (
                              <option key={c.ma} value={c.ma}>
                                {c.ma} — {c.ten}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>
                    </td>
                    {/* Ghi chú */}
                    <td className="border border-vien px-1 py-1 align-top">
                      <input
                        data-r={i}
                        data-c={10}
                        value={d.ghiChu}
                        onChange={(e) => suaO(i, "ghiChu", e.target.value)}
                        onKeyDown={diChuyen}
                        className={`${O} w-40`}
                      />
                    </td>
                    <td className="border border-vien px-1 py-1 text-center align-top">
                      <button
                        type="button"
                        onClick={() => xoaDong(i)}
                        title="Xoá dòng"
                        className="rounded p-1 text-rose-600 hover:bg-nen dark:text-rose-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-vien px-4 py-3">
          <button
            type="button"
            onClick={themDong}
            className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs"
          >
            <Plus className="size-3" /> Thêm dòng
          </button>
          <button
            type="button"
            onClick={luu}
            disabled={dangLuu}
            className="inline-flex items-center gap-1 rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            <Check className="size-3.5" /> {dangLuu ? "Đang ghi…" : "Ghi vào sổ"}
          </button>
          {kq ? (
            <span className={`text-xs ${kq.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {kq.thongDiep}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
