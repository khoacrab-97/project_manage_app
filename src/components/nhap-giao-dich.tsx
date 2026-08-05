"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { luuGiaoDich, type KetQuaGiaoDich } from "@/app/cong-trinh/giao-dich-actions";
import { docSoVN } from "@/lib/so-vn";
import { nhanThang, ngay as dinhDangNgay, tien } from "@/lib/format";

const O = "rounded-md border border-vien bg-the px-2 py-1 text-xs";

interface MaChon {
  ma: string;
  ten: string;
  loai: "Doanh thu" | "Chi phí";
}

/** Một giao dịch đã lưu (đọc từ sổ). */
export interface GiaoDichLuu {
  id: string;
  maBase: string | null;
  soHoaDon: string | null;
  ngayChungTu: string | null; // yyyy-MM-dd
  noiDung: string;
  dvt: string | null;
  donGia: number | null;
  soLuong: number | null;
  soTien: number;
  maDTCP: string;
  ghiChu: string | null;
}

interface Dong {
  maBase: string;
  soHoaDon: string;
  ngayChungTu: string; // dd/MM/yyyy (kiểu Việt, dán từ Excel vẫn được)
  noiDung: string;
  dvt: string;
  donGia: string;
  soLuong: string;
  soTien: string;
  maDTCP: string;
  ghiChu: string;
}

// Cột nhập (data-c = vị trí trong mảng này). Cột "Tháng TH" là hiển thị, KHÔNG
// nằm ở đây — dán dữ liệu bỏ qua nó vì Tháng tự tính theo Ngày chứng từ.
const COT: { key: keyof Dong; nhan: string; w: string; so?: boolean }[] = [
  { key: "maBase", nhan: "Mã Base", w: "w-24" },
  { key: "soHoaDon", nhan: "Số hóa đơn", w: "w-24" },
  { key: "ngayChungTu", nhan: "Ngày chứng từ", w: "w-28" },
  { key: "noiDung", nhan: "Nội dung thanh toán", w: "w-full min-w-55" },
  { key: "dvt", nhan: "ĐVT", w: "w-16" },
  { key: "donGia", nhan: "Đơn giá", w: "w-28", so: true },
  { key: "soLuong", nhan: "Số lượng", w: "w-20", so: true },
  { key: "soTien", nhan: "Số tiền", w: "w-32", so: true },
  { key: "maDTCP", nhan: "Mã DT–CP", w: "w-40" },
  { key: "ghiChu", nhan: "Ghi chú", w: "w-40" },
];

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

const SO_DONG_MOI = 20;

function soRaVN(n: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 6 });
}

/** yyyy-MM-dd -> dd/MM/yyyy để hiện trong ô nhập. */
function ngayRaVN(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Đọc ngày kiểu Việt / ISO -> yyyy-MM-dd, hoặc null nếu không đọc được. */
function docNgay(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

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

function tuGiaoDich(g: GiaoDichLuu): Dong {
  return {
    maBase: g.maBase ?? "",
    soHoaDon: g.soHoaDon ?? "",
    ngayChungTu: ngayRaVN(g.ngayChungTu),
    noiDung: g.noiDung,
    dvt: g.dvt ?? "",
    donGia: soRaVN(g.donGia),
    soLuong: soRaVN(g.soLuong),
    soTien: soRaVN(g.soTien),
    maDTCP: g.maDTCP,
    ghiChu: g.ghiChu ?? "",
  };
}

/**
 * Bảng giao dịch = bảng tính nhập như Excel, hiện thẳng trong tab Giao dịch.
 *
 * - Công trình mới (chưa có giao dịch) mở ra là bảng sửa được, sẵn 20 dòng trống.
 * - Có dữ liệu thì KHÓA (chỉ xem); bấm "Sửa" để chỉnh/thêm/xoá rồi "Lưu" (thay
 *   toàn bộ giao dịch của công trình bằng nội dung bảng).
 * - Chọn dòng bằng cách bấm ô số thứ tự (#) đầu dòng: Insert thêm dòng dưới,
 *   Delete xoá dòng đó. Đang gõ trong ô thì hai phím này giữ nghĩa gõ chữ.
 * - Dán (Ctrl+V) một vùng từ Excel / Google Sheets: điền vào các ô từ ô đang chọn.
 * - Tiêu đề bảng khóa cứng khi cuộn.
 */
export function BangGiaoDich({
  maCongTrinh,
  dsMa,
  giaoDich,
  duocNhap,
}: {
  maCongTrinh: string;
  dsMa: MaChon[];
  giaoDich: GiaoDichLuu[];
  duocNhap: boolean;
}) {
  const [khoa, setKhoa] = useState(() => !duocNhap || giaoDich.length > 0);
  const [dongs, setDongs] = useState<Dong[]>(() =>
    giaoDich.length
      ? giaoDich.map(tuGiaoDich)
      : Array.from({ length: SO_DONG_MOI }, () => ({ ...DONG_RONG }))
  );
  const [chonDong, setChonDong] = useState<number | null>(null);
  const [kq, setKq] = useState<KetQuaGiaoDich | null>(null);
  const [dangLuu, batDau] = useTransition();
  const luoiRef = useRef<HTMLTableSectionElement>(null);

  // Insert / Delete theo dòng đang chọn — chỉ khi KHÔNG đang gõ trong ô.
  useEffect(() => {
    if (khoa) return;
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "SELECT" || ae.tagName === "TEXTAREA")) return;
      if (chonDong === null) return;
      if (e.key === "Delete") {
        e.preventDefault();
        setDongs((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== chonDong) : prev));
        setChonDong(null);
      } else if (e.key === "Insert") {
        e.preventDefault();
        setDongs((prev) => {
          const n = [...prev];
          n.splice(chonDong + 1, 0, { ...DONG_RONG });
          return n;
        });
        setChonDong((c) => (c === null ? null : c + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [khoa, chonDong]);

  const suaO = (i: number, k: keyof Dong, v: string) =>
    setDongs((s) => s.map((d, j) => (j === i ? { ...d, [k]: v } : d)));

  const themDong = () => setDongs((s) => [...s, { ...DONG_RONG }]);
  const xoaDong = (i: number) => {
    setDongs((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s));
    setChonDong(null);
  };
  const chonDongNhap = (i: number) => {
    setChonDong(i);
    (document.activeElement as HTMLElement | null)?.blur?.();
  };

  // Di chuyển giữa các ô bằng phím mũi tên / Enter như bảng tính.
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

  // Dán vùng dữ liệu từ Excel / Google Sheets bắt đầu từ ô đang chọn.
  const dan = (e: React.ClipboardEvent) => {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLInputElement)) return;
    const r0 = Number(t.dataset.r);
    const c0 = Number(t.dataset.c);
    if (Number.isNaN(r0) || Number.isNaN(c0)) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return; // 1 ô -> để mặc định
    e.preventDefault();
    const matrix = text
      .replace(/\r/g, "")
      .replace(/\n$/, "")
      .split("\n")
      .map((l) => l.split("\t"));
    setDongs((prev) => {
      const next = prev.map((d) => ({ ...d }));
      while (next.length < r0 + matrix.length) next.push({ ...DONG_RONG });
      matrix.forEach((cells, i) => {
        cells.forEach((val, j) => {
          const col = COT[c0 + j];
          if (col) next[r0 + i][col.key] = val.trim();
        });
      });
      return next;
    });
  };

  const luu = () => {
    const fd = new FormData();
    fd.set("maCongTrinh", maCongTrinh);
    for (const d of dongs) {
      fd.append("maBase", d.maBase);
      fd.append("soHoaDon", d.soHoaDon);
      fd.append("ngayChungTu", docNgay(d.ngayChungTu) ?? "");
      fd.append("noiDung", d.noiDung);
      fd.append("dvt", d.dvt);
      fd.append("donGia", d.donGia);
      fd.append("soLuong", d.soLuong);
      fd.append("soTien", d.soTien);
      fd.append("maDTCP", d.maDTCP);
      fd.append("ghiChu", d.ghiChu);
    }
    batDau(async () => {
      const r = await luuGiaoDich(fd);
      setKq(r);
      if (r.ok) {
        setKhoa(true);
        setChonDong(null);
      }
    });
  };

  const suaLai = () => {
    setDongs(giaoDich.length ? giaoDich.map(tuGiaoDich) : Array.from({ length: SO_DONG_MOI }, () => ({ ...DONG_RONG })));
    setChonDong(null);
    setKq(null);
    setKhoa(false);
  };

  const huy = () => {
    setDongs(giaoDich.length ? giaoDich.map(tuGiaoDich) : Array.from({ length: SO_DONG_MOI }, () => ({ ...DONG_RONG })));
    setChonDong(null);
    setKq(null);
    if (giaoDich.length) setKhoa(true);
  };

  // ---------------- KHÓA: chỉ xem ----------------
  if (khoa) {
    const tong = giaoDich.reduce((a, g) => a + g.soTien, 0);
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-vien px-4 py-2.5">
          <p className="text-xs text-chunhat">
            {giaoDich.length.toLocaleString("vi-VN")} giao dịch · Tổng{" "}
            <strong className="so text-chu">{tien(tong)} đ</strong>
          </p>
          {duocNhap ? (
            <button
              type="button"
              onClick={suaLai}
              className="inline-flex items-center gap-1.5 rounded-lg bg-nhan px-3 py-1.5 text-xs font-medium text-white"
            >
              <Pencil className="size-3.5" /> Sửa
            </button>
          ) : null}
        </div>
        {giaoDich.length ? (
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-the">
                <tr>
                  <th className="sticky top-0 left-0 z-30 border border-vien bg-nen px-2 py-1.5 text-xs font-semibold text-chunhat">
                    #
                  </th>
                  {["Mã Base", "Số HĐ", "Ngày CT", "Tháng", "Nội dung", "ĐVT", "Đơn giá", "SL", "Số tiền", "Mã DT–CP", "Ghi chú"].map(
                    (h) => (
                      <th
                        key={h}
                        className="border border-vien bg-nen px-2 py-1.5 text-left text-xs font-semibold whitespace-nowrap text-chunhat"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {giaoDich.map((g, i) => (
                  <tr key={g.id} className="hover:bg-nen">
                    <td className="sticky left-0 z-10 border border-vien bg-the px-2 py-1 text-center text-[11px] text-chunhat">
                      {i + 1}
                    </td>
                    <td className="border border-vien px-2 py-1 text-xs">{g.maBase ?? "—"}</td>
                    <td className="border border-vien px-2 py-1 text-xs whitespace-nowrap">{g.soHoaDon ?? "—"}</td>
                    <td className="border border-vien px-2 py-1 text-xs whitespace-nowrap">{dinhDangNgay(g.ngayChungTu)}</td>
                    <td className="border border-vien px-2 py-1 text-xs whitespace-nowrap">{nhanThang(g.ngayChungTu?.slice(0, 7))}</td>
                    <td className="border border-vien px-2 py-1 text-xs">{g.noiDung}</td>
                    <td className="border border-vien px-2 py-1 text-xs">{g.dvt ?? "—"}</td>
                    <td className="so border border-vien px-2 py-1 text-right text-xs">{g.donGia !== null ? tien(g.donGia) : "—"}</td>
                    <td className="so border border-vien px-2 py-1 text-right text-xs">{g.soLuong ?? "—"}</td>
                    <td className="so border border-vien px-2 py-1 text-right text-xs font-medium">{tien(g.soTien)}</td>
                    <td className="border border-vien px-2 py-1 text-xs whitespace-nowrap">{g.maDTCP}</td>
                    <td className="border border-vien px-2 py-1 text-xs">{g.ghiChu ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-chunhat">Chưa có giao dịch.</p>
        )}
      </div>
    );
  }

  // ---------------- SỬA: bảng tính ----------------
  return (
    <div>
      <div className="border-b border-vien bg-nhannhat px-4 py-2 text-[11px] text-chunhat">
        Thao tác như Excel: gõ trực tiếp, di chuyển bằng phím mũi tên, <strong>dán (Ctrl+V)</strong> vùng
        dữ liệu từ Excel/Google Sheets. Bấm ô <strong>#</strong> đầu dòng để chọn dòng rồi{" "}
        <strong>Insert</strong> thêm dòng / <strong>Delete</strong> xoá dòng. Tháng thực hiện tự theo
        Ngày chứng từ. Số tiền để trống mà có Đơn giá + Số lượng thì tự tính. Số kiểu Việt (dấu{" "}
        <strong>,</strong> thập phân, <strong>.</strong> ngăn nghìn).
      </div>

      <datalist id="dsMaGiaoDich">
        {dsMa.map((c) => (
          <option key={c.ma} value={c.ma}>
            {c.loai} · {c.ten}
          </option>
        ))}
      </datalist>

      <div className="max-h-[60vh] overflow-auto" onPaste={dan}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-the">
            <tr>
              <th className="sticky top-0 left-0 z-30 border border-vien bg-nen px-2 py-1.5 text-xs font-semibold text-chunhat">
                #
              </th>
              {/* Chèn "Tháng TH" ngay sau Ngày chứng từ để khớp đúng cột ở thân bảng. */}
              {COT.flatMap((c) => {
                const th = (
                  <th
                    key={c.key}
                    className={`border border-vien bg-nen px-2 py-1.5 text-xs font-semibold whitespace-nowrap text-chunhat ${c.so ? "text-right" : "text-left"}`}
                  >
                    {c.nhan}
                  </th>
                );
                if (c.key !== "ngayChungTu") return [th];
                return [
                  th,
                  <th
                    key="thangTH"
                    className="border border-vien bg-nen px-2 py-1.5 text-left text-xs font-semibold whitespace-nowrap text-chunhat"
                  >
                    Tháng TH
                  </th>,
                ];
              })}
            </tr>
          </thead>
          <tbody ref={luoiRef}>
            {dongs.map((d, i) => {
              const st = soTienDuKien(d);
              const isoNgay = docNgay(d.ngayChungTu);
              const loiNgay = d.ngayChungTu.trim() !== "" && isoNgay === null;
              return (
                <tr key={i} className={chonDong === i ? "bg-nhannhat" : ""}>
                  <td
                    className={`sticky left-0 z-10 border border-vien p-0 text-center text-[11px] ${chonDong === i ? "bg-nhan font-semibold text-white" : "bg-the text-chunhat hover:bg-nen"}`}
                  >
                    <button
                      type="button"
                      onClick={() => chonDongNhap(i)}
                      title="Bấm để chọn dòng (Insert thêm / Delete xoá)"
                      className="block h-full w-full cursor-pointer px-2 py-1 text-current select-none"
                    >
                      {i + 1}
                    </button>
                  </td>
                  {COT.map((c, ci) => {
                    const so = !!c.so;
                    const kq = so ? docSo(d[c.key]) : null;
                    const loiSo = so && d[c.key].trim() !== "" && kq === null;
                    const laMa = c.key === "maDTCP";
                    const laNgay = c.key === "ngayChungTu";
                    return (
                      <td
                        key={c.key}
                        className={`border border-vien px-1 py-1 align-top ${so ? "text-right" : ""}`}
                      >
                        <input
                          data-r={i}
                          data-c={ci}
                          value={d[c.key]}
                          onChange={(e) => suaO(i, c.key, e.target.value)}
                          onKeyDown={diChuyen}
                          inputMode={so ? "decimal" : undefined}
                          list={laMa ? "dsMaGiaoDich" : undefined}
                          placeholder={laNgay ? "dd/mm/yyyy" : c.key === "soTien" && st.tuTinh ? "tự tính" : ""}
                          className={`${O} ${c.w} ${so ? "text-right" : ""} ${loiSo || (laNgay && loiNgay) ? "border-rose-400" : ""}`}
                        />
                        {c.key === "soTien" && st.tuTinh && st.giaTri !== null ? (
                          <span className="mt-0.5 block text-right text-[10px] text-chunhat">
                            = {st.giaTri.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
                          </span>
                        ) : null}
                        {loiSo ? (
                          <span className="mt-0.5 block text-right text-[10px] text-rose-600 dark:text-rose-400">
                            không đọc được
                          </span>
                        ) : null}
                        {/* Chèn cột Tháng TH ngay sau Ngày chứng từ. */}
                      </td>
                    );
                  }).flatMap((cell, ci) => {
                    if (COT[ci]?.key !== "ngayChungTu") return [cell];
                    const thang = isoNgay ? nhanThang(isoNgay.slice(0, 7)) : "—";
                    return [
                      cell,
                      <td
                        key="thangTH"
                        className="border border-vien bg-nen/40 px-2 py-1 align-top text-xs whitespace-nowrap text-chunhat"
                      >
                        {thang}
                      </td>,
                    ];
                  })}
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
          onClick={() => chonDong !== null && xoaDong(chonDong)}
          disabled={chonDong === null}
          className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs text-rose-600 disabled:opacity-40 dark:text-rose-400"
        >
          <Trash2 className="size-3" /> Xoá dòng
        </button>
        <div className="grow" />
        {giaoDich.length ? (
          <button
            type="button"
            onClick={huy}
            className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs"
          >
            <X className="size-3" /> Hủy
          </button>
        ) : null}
        <button
          type="button"
          onClick={luu}
          disabled={dangLuu}
          className="inline-flex items-center gap-1 rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          <Check className="size-3.5" /> {dangLuu ? "Đang lưu…" : "Lưu vào sổ"}
        </button>
      </div>
      {kq ? (
        <p
          className={`px-4 pb-3 text-xs ${kq.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
        >
          {kq.thongDiep}
        </p>
      ) : null}
    </div>
  );
}
