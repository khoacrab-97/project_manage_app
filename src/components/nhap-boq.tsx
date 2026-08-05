"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import {
  docFileBOQ,
  doiThangBill,
  luuKhoiLuong,
  luuThietLapVAT,
  themBillThang,
  themGiamGiaBOQ,
  themNhieuDongBOQ,
  xoaGiamGiaBOQ,
  type KetQuaBOQ,
} from "@/app/cong-trinh/boq-actions";
import { ONhapCot, TieuDeCot } from "./cot-boq";
import { khoiLuong as dinhDangKL, tien, tienLe } from "@/lib/format";
import { docSoVN } from "@/lib/so-vn";

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
        <input name="thang" defaultValue={goiY} placeholder="2026-08" className={`${O}`} required />
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

export interface DongBill {
  id: string;
  stt: string;
  noiDung: string;
  dvt: string;
  donGia: number;
  /** Luỹ kế khối lượng của các tháng TRƯỚC kỳ đang xem. */
  klKyTruoc: number;
  klHienTai: number;
  hoanThanh: boolean;
  /** Giá trị các cột tùy chỉnh, theo cotId. */
  giaTriCot: Record<string, string>;
}

/**
 * Hộp thoại Bill của MỘT tháng — GỘP xem + cập nhật. Mở khi bấm một tháng ở dải
 * "Kỳ Bill" (điều khiển qua URL `?bq=<thang>`), đóng thì về `?tab=boq`.
 *
 * Bảng dạng lưới gridlines như Excel: ô "Khối lượng kỳ này" và "Xong" sửa trực
 * tiếp, di chuyển bằng phím mũi tên, DÁN được một cột khối lượng từ Excel. Cột
 * tùy chỉnh (nếu có) vẫn sửa tại chỗ như cũ. Thành tiền tháng tính ngay bên phải.
 */
export function HopThoaiBill({
  maCongTrinh,
  thang,
  nhan,
  base,
  nguoiNhap,
  dongs,
  cots,
  duocNhap,
  lamTronThanhTien,
}: {
  maCongTrinh: string;
  thang: string;
  nhan: string;
  base: string;
  nguoiNhap: string;
  dongs: DongBill[];
  cots: { id: string; ten: string }[];
  duocNhap: boolean;
  lamTronThanhTien: boolean;
}) {
  const router = useRouter();
  const dong = useCallback(() => router.push(`${base}?tab=boq`), [base, router]);
  const [kl, setKl] = useState<Record<string, string>>(
    Object.fromEntries(dongs.map((d) => [d.id, d.klHienTai ? String(d.klHienTai) : ""]))
  );
  const [xong, setXong] = useState<Record<string, boolean>>(
    Object.fromEntries(dongs.map((d) => [d.id, d.hoanThanh]))
  );
  const [kq, setKq] = useState<KetQuaBOQ | null>(null);
  const [dangChay, batDau] = useTransition();
  const luoiRef = useRef<HTMLTableSectionElement>(null);
  // Mở ra là chế độ XEM; bấm "Sửa" mới cập nhật được.
  const [khoa, setKhoa] = useState(true);
  const capNhat = duocNhap && !khoa;
  // Đổi tháng của Bill (dời cả khối lượng đã nhập sang tháng mới).
  const [thangMoi, setThangMoi] = useState(thang);
  const [dangDoi, doiTransition] = useTransition();

  const doiThang = () => {
    const fd = new FormData();
    fd.set("maCongTrinh", maCongTrinh);
    fd.set("thangCu", thang);
    fd.set("thangMoi", thangMoi.trim());
    doiTransition(async () => {
      const r = await doiThangBill(fd);
      setKq(r);
      if (r.ok) router.push(`${base}?tab=boq&bq=${thangMoi.trim()}`);
    });
  };

  const datLaiTuProps = () => {
    setKl(Object.fromEntries(dongs.map((d) => [d.id, d.klHienTai ? String(d.klHienTai) : ""])));
    setXong(Object.fromEntries(dongs.map((d) => [d.id, d.hoanThanh])));
  };

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") dong();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [dong]);

  const soCua = (v: string) => {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const ttThang = (d: DongBill) => {
    const v = soCua(kl[d.id] ?? "") * d.donGia;
    return lamTronThanhTien ? Math.round(v) : v;
  };
  const tongTien = dongs.reduce((a, d) => a + ttThang(d), 0);

  // Di chuyển dọc cột Khối lượng bằng mũi tên / Enter.
  const diChuyen = (e: React.KeyboardEvent) => {
    const inp = e.target as HTMLInputElement;
    const r = Number(inp.dataset.r);
    if (Number.isNaN(r)) return;
    const den = (rr: number) => {
      const t = luoiRef.current?.querySelector<HTMLElement>(`input[data-r="${rr}"][data-kl]`);
      if (t) {
        e.preventDefault();
        t.focus();
      }
    };
    if (e.key === "ArrowDown" || e.key === "Enter") den(r + 1);
    else if (e.key === "ArrowUp") den(r - 1);
  };

  // Dán một cột khối lượng từ Excel/Sheets, điền xuống từ dòng đang chọn.
  const dan = (e: React.ClipboardEvent) => {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLInputElement) || t.dataset.kl === undefined) return;
    const r0 = Number(t.dataset.r);
    const text = e.clipboardData.getData("text/plain");
    if (!text?.includes("\n")) return; // 1 ô -> để mặc định
    e.preventDefault();
    const cot = text
      .replace(/\r/g, "")
      .replace(/\n$/, "")
      .split("\n")
      .map((l) => l.split("\t")[0].trim());
    setKl((prev) => {
      const next = { ...prev };
      cot.forEach((v, i) => {
        const d = dongs[r0 + i];
        if (d) next[d.id] = v;
      });
      return next;
    });
  };

  const luu = () => {
    const fd = new FormData();
    fd.set("maCongTrinh", maCongTrinh);
    fd.set("thang", thang);
    for (const d of dongs) {
      fd.set(`kl_${d.id}`, kl[d.id] ?? "");
      if (xong[d.id]) fd.set(`xong_${d.id}`, "on");
    }
    batDau(async () => {
      const r = await luuKhoiLuong(fd);
      setKq(r);
      if (r.ok) setTimeout(dong, 700);
    });
  };

  const oTh = "border border-vien bg-nen px-2 py-1.5 text-xs font-semibold whitespace-nowrap text-chunhat";
  const oTd = "border border-vien px-2 py-1 text-xs";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-6xl rounded-xl border border-vien bg-the shadow-xl">
        <div className="flex items-center justify-between border-b border-vien px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">Bill {nhan}</h2>
            {nguoiNhap ? <span className="text-xs text-chunhat">Người nhập {nguoiNhap}</span> : null}
          </div>
          <button type="button" onClick={dong} className="rounded-md border border-vien p-1.5" title="Đóng (Esc)">
            <X className="size-4" />
          </button>
        </div>

        {capNhat ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-vien bg-nhannhat/50 px-4 py-2 text-xs">
            <span className="text-chunhat">Đổi tháng Bill:</span>
            <input
              value={thangMoi}
              onChange={(e) => setThangMoi(e.target.value)}
              placeholder="2026-08"
              className={`${O} w-28`}
            />
            <button
              type="button"
              onClick={doiThang}
              disabled={dangDoi || thangMoi.trim() === thang}
              className="rounded-md border border-nhan px-2.5 py-1 text-xs font-medium text-nhan disabled:opacity-40"
            >
              {dangDoi ? "Đang đổi…" : "Đổi tháng"}
            </button>
            <span className="text-[11px] text-chunhat">Dời toàn bộ khối lượng đã nhập sang tháng mới.</span>
          </div>
        ) : null}

        <div className="max-h-[60vh] overflow-auto" onPaste={dan}>
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-the">
              <tr>
                <th className={oTh}>STT</th>
                <th className={`${oTh} text-left`}>Nội dung công việc</th>
                <th className={oTh}>ĐVT</th>
                {cots.map((c, i) => (
                  <th key={c.id} className={oTh}>
                    {duocNhap ? (
                      <TieuDeCot
                        maCongTrinh={maCongTrinh}
                        cotId={c.id}
                        ten={c.ten}
                        dauTien={i === 0}
                        cuoiCung={i === cots.length - 1}
                      />
                    ) : (
                      c.ten
                    )}
                  </th>
                ))}
                <th className={`${oTh} text-right`}>Đơn giá</th>
                <th className={`${oTh} text-right`}>Lũy kế kỳ trước</th>
                <th className={`${oTh} bg-nhannhat text-right`}>KL {nhan}</th>
                <th className={oTh}>Xong</th>
                <th className={`${oTh} bg-nhannhat text-right`}>Thành tiền {nhan}</th>
              </tr>
            </thead>
            <tbody ref={luoiRef}>
              {dongs.map((d, i) => (
                <tr key={d.id} className={xong[d.id] ? "bg-nen/50" : ""}>
                  <td className={`${oTd} whitespace-nowrap`}>
                    {d.stt}
                    {d.hoanThanh ? <span className="ml-1 text-emerald-600 dark:text-emerald-400">✓</span> : null}
                  </td>
                  <td className={`${oTd} max-w-65 truncate`} title={d.noiDung}>
                    {d.noiDung}
                  </td>
                  <td className={`${oTd} whitespace-nowrap`}>{d.dvt}</td>
                  {cots.map((c) => (
                    <td key={c.id} className={oTd}>
                      {capNhat ? (
                        <ONhapCot maCongTrinh={maCongTrinh} cotId={c.id} boqLineId={d.id} giaTri={d.giaTriCot[c.id] ?? ""} />
                      ) : (
                        d.giaTriCot[c.id] || <span className="text-chunhat">—</span>
                      )}
                    </td>
                  ))}
                  <td className={`${oTd} text-right`}>{tienLe(d.donGia)}</td>
                  <td className={`${oTd} text-right text-chunhat`}>
                    {d.klKyTruoc ? dinhDangKL(d.klKyTruoc) : "—"}
                  </td>
                  <td className={`${oTd} bg-nhannhat/40 text-right`}>
                    {capNhat ? (
                      <input
                        data-r={i}
                        data-kl=""
                        value={kl[d.id] ?? ""}
                        onChange={(e) => setKl({ ...kl, [d.id]: e.target.value })}
                        onKeyDown={diChuyen}
                        inputMode="decimal"
                        placeholder="0"
                        className={`${O} w-24 text-right`}
                      />
                    ) : (
                      <span>{kl[d.id] ? dinhDangKL(soCua(kl[d.id])) : "—"}</span>
                    )}
                  </td>
                  <td className={`${oTd} text-center`}>
                    {capNhat ? (
                      <input
                        type="checkbox"
                        checked={xong[d.id] ?? false}
                        onChange={(e) => setXong({ ...xong, [d.id]: e.target.checked })}
                        title="Công tác đã thi công xong"
                      />
                    ) : d.hoanThanh ? (
                      "✓"
                    ) : (
                      <span className="text-chunhat">—</span>
                    )}
                  </td>
                  <td className={`${oTd} bg-nhannhat/40 text-right font-medium`}>
                    {kl[d.id] ? tienLe(ttThang(d)) : <span className="text-chunhat">—</span>}
                  </td>
                </tr>
              ))}
              <tr className="bg-nen font-semibold">
                <td className={oTd} colSpan={3 + cots.length + 3}>
                  TỔNG
                </td>
                <td className={`${oTd} text-right`}>{tienLe(tongTien)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-vien px-4 py-3">
          <p className="text-xs">
            <span className="text-chunhat">Giá trị Bill {nhan}: </span>
            <strong className="so text-sm">{tien(tongTien)} đ</strong>
            {capNhat ? (
              <span className="ml-2 text-[11px] text-chunhat">
                Sửa ô Khối lượng như Excel · dán được một cột từ ngoài vào.
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/api/bill/${encodeURIComponent(maCongTrinh)}/${thang}`}
              className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1.5 text-xs font-medium hover:bg-nen"
            >
              <Download className="size-3.5" /> Xuất Bill .xlsx
            </a>
            <button type="button" onClick={dong} className="rounded-md border border-vien px-3 py-1.5 text-xs">
              Đóng
            </button>
            {duocNhap && khoa ? (
              <button
                type="button"
                onClick={() => setKhoa(false)}
                className="inline-flex items-center gap-1 rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white"
              >
                <Pencil className="size-3.5" /> Sửa
              </button>
            ) : null}
            {capNhat ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    datLaiTuProps();
                    setKq(null);
                    setKhoa(true);
                  }}
                  className="rounded-md border border-vien px-3 py-1.5 text-xs"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={luu}
                  disabled={dangChay}
                  className="inline-flex items-center gap-1 rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                >
                  <Check className="size-3.5" />
                  {dangChay ? "Đang lưu…" : "Lưu"}
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div className="px-4 pb-3">
          <ThongBao kq={kq} />
        </div>
      </div>
    </div>
  );
}

/**
 * Lưới nhập NHIỀU dòng BOQ một lượt — để tạo bảng khối lượng ban đầu hoặc bổ
 * sung công tác. Mở dạng hộp nổi; các ô uncontrolled, gửi theo mảng cùng tên.
 * `nhan` cho phép đổi nhãn nút (mạnh hơn ở trạng thái chưa có BOQ).
 */
export function LuoiNhapBOQ({
  maCongTrinh,
  nhan = "Nhập nhiều dòng",
  noiBat = false,
}: {
  maCongTrinh: string;
  nhan?: string;
  noiBat?: boolean;
}) {
  const [mo, setMo] = useState(false);
  const [soDong, setSoDong] = useState(8);
  const [kq, setKq] = useState<KetQuaBOQ | null>(null);
  const [dangChay, batDau] = useTransition();

  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMo(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [mo]);

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className={
          noiBat
            ? "inline-flex items-center gap-1.5 rounded-lg bg-nhan px-3 py-1.5 text-xs font-medium text-white"
            : "inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs font-medium hover:bg-nen"
        }
      >
        <Plus className="size-3.5" /> {nhan}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-4xl rounded-xl border border-vien bg-the shadow-xl">
        <div className="flex items-center justify-between border-b border-vien px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Nhập bảng khối lượng (BOQ)</h2>
            <p className="mt-0.5 text-xs text-chunhat">
              Mỗi dòng một công tác. Thành tiền = Khối lượng × Đơn giá (tự tính khi lưu). Dòng để
              trống STT và nội dung sẽ bỏ qua.
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
              const r = await themNhieuDongBOQ(fd);
              setKq(r);
              if (r.ok && !r.thongDiep.includes("Bỏ qua")) setTimeout(() => setMo(false), 900);
            });
          }}
          className="p-4"
        >
          <input type="hidden" name="maCongTrinh" value={maCongTrinh} />
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-the">
                <tr>
                  <th className="border-b border-vien px-2 py-1.5 text-left text-xs font-semibold text-chunhat">
                    STT *
                  </th>
                  <th className="border-b border-vien px-2 py-1.5 text-left text-xs font-semibold text-chunhat">
                    Nội dung công việc *
                  </th>
                  <th className="border-b border-vien px-2 py-1.5 text-left text-xs font-semibold text-chunhat">
                    ĐVT
                  </th>
                  <th className="border-b border-vien px-2 py-1.5 text-right text-xs font-semibold text-chunhat">
                    Khối lượng
                  </th>
                  <th className="border-b border-vien px-2 py-1.5 text-right text-xs font-semibold text-chunhat">
                    Đơn giá
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: soDong }).map((_, i) => (
                  <tr key={i}>
                    <td className="border-b border-vien px-1 py-1">
                      <input name="stt" className={`${O} w-16`} placeholder="1" />
                    </td>
                    <td className="border-b border-vien px-1 py-1">
                      <input name="noiDung" className={`${O} w-full min-w-55`} />
                    </td>
                    <td className="border-b border-vien px-1 py-1">
                      <input name="dvt" className={`${O} w-20`} placeholder="m³" />
                    </td>
                    <td className="border-b border-vien px-1 py-1">
                      <input name="khoiLuong" inputMode="decimal" className={`${O} w-24 text-right`} placeholder="0" />
                    </td>
                    <td className="border-b border-vien px-1 py-1">
                      <input name="donGia" inputMode="decimal" className={`${O} w-28 text-right`} placeholder="0" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoDong((n) => n + 5)}
              className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs"
            >
              <Plus className="size-3" /> Thêm dòng
            </button>
            <button
              type="submit"
              disabled={dangChay}
              className="inline-flex items-center gap-1 rounded-md bg-nhan px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              <Check className="size-3" /> {dangChay ? "Đang lưu…" : "Lưu tất cả"}
            </button>
            <span className="text-[11px] text-chunhat">Dòng trống STT và nội dung sẽ bỏ qua.</span>
          </div>
          <ThongBao kq={kq} />
        </form>
      </div>
    </div>
  );
}

interface ODongBOQ {
  stt: string;
  noiDung: string;
  dvt: string;
  khoiLuong: string;
  donGia: string;
}

/**
 * Import BOQ từ file Excel: tải file mẫu → điền → upload → app đọc → **review sửa
 * được** → xác nhận & lưu (NỐI vào cuối BOQ theo thứ tự import).
 *
 * Hai bước trong một hộp nổi: chưa đọc file thì hiện ô chọn file; đọc xong chuyển
 * sang lưới review controlled, sửa/xoá dòng thoải mái rồi bấm lưu.
 */
/** 5 cột BOQ + cờ "là cột số". */
const COT_BOQ: { key: keyof ODongBOQ; nhan: string; so: boolean }[] = [
  { key: "stt", nhan: "STT", so: false },
  { key: "noiDung", nhan: "Nội dung hạng mục", so: false },
  { key: "dvt", nhan: "ĐVT", so: false },
  { key: "khoiLuong", nhan: "Khối lượng", so: true },
  { key: "donGia", nhan: "Đơn giá", so: true },
];

/** Xem trước số sẽ lưu theo quy ước Việt. loi=true khi không đọc được. */
function xemSo(raw: string): { hienThi: string; loi: boolean } {
  const t = raw.trim();
  if (t === "") return { hienThi: "", loi: false };
  const n = docSoVN(t);
  if (n === null) return { hienThi: "", loi: true };
  return { hienThi: n.toLocaleString("vi-VN", { maximumFractionDigits: 6 }), loi: false };
}

export function ImportBOQ({
  maCongTrinh,
  daCoBOQ = false,
}: {
  maCongTrinh: string;
  /** Công trình đã có BOQ — hiện lựa chọn Ghi đè / Nối tiếp. */
  daCoBOQ?: boolean;
}) {
  const [mo, setMo] = useState(false);
  const [dongs, setDongs] = useState<ODongBOQ[] | null>(null);
  const [ghiDe, setGhiDe] = useState(false);
  const [kqDoc, setKqDoc] = useState<KetQuaBOQ | null>(null);
  const [kqLuu, setKqLuu] = useState<KetQuaBOQ | null>(null);
  const [dangDoc, batDauDoc] = useTransition();
  const [dangLuu, batDauLuu] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const luoiRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMo(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [mo]);

  const dong = () => {
    setMo(false);
    setDongs(null);
    setGhiDe(false);
    setKqDoc(null);
    setKqLuu(null);
  };

  const doc = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setKqDoc({ ok: false, thongDiep: "Chưa chọn file." });
      return;
    }
    const fd = new FormData();
    fd.append("maCongTrinh", maCongTrinh);
    fd.append("file", file);
    batDauDoc(async () => {
      const r = await docFileBOQ(fd);
      setKqDoc({ ok: r.ok, thongDiep: r.thongDiep });
      if (r.ok) setDongs(r.dongs);
    });
  };

  const luu = () => {
    if (!dongs) return;
    const fd = new FormData();
    fd.append("maCongTrinh", maCongTrinh);
    if (ghiDe) fd.append("ghiDe", "1");
    // Gửi GIÁ TRỊ THÔ; server so() đọc theo quy ước Việt. Ô số Excel đã được đọc
    // chính xác ở tầng parse ("0,444"), nên qua so() ra đúng 0.444.
    for (const d of dongs) {
      COT_BOQ.forEach((c) => {
        fd.append(c.key, d[c.key]);
      });
    }
    batDauLuu(async () => {
      const r = await themNhieuDongBOQ(fd);
      setKqLuu(r);
      if (r.ok) setTimeout(dong, 1000);
    });
  };

  const suaO = (i: number, k: keyof ODongBOQ, v: string) =>
    setDongs((s) => s!.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const xoaDong = (i: number) => setDongs((s) => s!.filter((_, j) => j !== i));
  const themDong = () =>
    setDongs((s) => [...(s ?? []), { stt: "", noiDung: "", dvt: "", khoiLuong: "", donGia: "" }]);

  // Di chuyển giữa các ô bằng phím mũi tên / Enter như bảng tính Excel.
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

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs font-medium hover:bg-nen"
      >
        <Upload className="size-3.5" /> Import từ Excel
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-4xl rounded-xl border border-vien bg-the shadow-xl">
        <div className="flex items-center justify-between border-b border-vien px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Import BOQ từ Excel</h2>
            <p className="mt-0.5 text-xs text-chunhat">
              Tải file mẫu, điền BOQ, rồi upload. Bước xem trước là <strong>bảng tính sửa được</strong>{" "}
              (di chuyển bằng phím mũi tên). Ô số Excel được đọc <strong>giữ nguyên</strong> giá trị.
            </p>
          </div>
          <button type="button" onClick={dong} className="rounded-md border border-vien p-1.5" title="Đóng (Esc)">
            <X className="size-4" />
          </button>
        </div>

        {dongs === null ? (
          // --- Bước 1: chọn file ---
          <div className="p-4">
            <a
              href="/api/mau-boq"
              className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-vien px-2.5 py-1 text-xs font-medium hover:bg-nen"
            >
              <Download className="size-3.5" /> Tải file mẫu
            </a>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                className="text-xs file:mr-2 file:rounded-md file:border file:border-vien file:bg-the file:px-2 file:py-1 file:text-xs"
              />
              <button
                type="button"
                onClick={doc}
                disabled={dangDoc}
                className="inline-flex items-center gap-1 rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                <Upload className="size-3.5" /> {dangDoc ? "Đang đọc…" : "Đọc file"}
              </button>
            </div>
            {kqDoc && !kqDoc.ok ? (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{kqDoc.thongDiep}</p>
            ) : null}
          </div>
        ) : (
          // --- Bước 2: bảng tính sửa được ---
          <div>
            <div className="border-b border-vien bg-nhannhat px-4 py-2 text-xs">
              <p>
                Đã đọc <strong>{dongs.length}</strong> dòng. Sửa trực tiếp như bảng tính; dòng{" "}
                <span className="text-chunhat">= …</span> là giá trị số sẽ lưu (dấu <strong>,</strong> là
                thập phân, <strong>.</strong> là ngăn nghìn). Dòng{" "}
                <span className="rounded bg-rose-100 px-1 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  thiếu STT hoặc nội dung
                </span>{" "}
                bị bỏ khi lưu.
              </p>
              {daCoBOQ ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="font-medium text-chunhat">Công trình đã có BOQ:</span>
                  <label className="inline-flex items-center gap-1">
                    <input type="radio" name="cheDoImport" checked={!ghiDe} onChange={() => setGhiDe(false)} />
                    Nối tiếp (thêm vào cuối)
                  </label>
                  <label className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <input type="radio" name="cheDoImport" checked={ghiDe} onChange={() => setGhiDe(true)} />
                    Ghi đè (xoá BOQ cũ + dữ liệu Bill)
                  </label>
                </div>
              ) : null}
            </div>
            <div className="max-h-[55vh] overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-the">
                  <tr>
                    {COT_BOQ.map((c) => (
                      <th
                        key={c.key}
                        className={`border border-vien bg-nen px-2 py-1.5 text-xs font-semibold text-chunhat ${c.so ? "text-right" : "text-left"}`}
                      >
                        {c.nhan}
                      </th>
                    ))}
                    <th className="border border-vien bg-nen px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody ref={luoiRef}>
                  {dongs.map((d, i) => {
                    const thieu = !d.stt.trim() || !d.noiDung.trim();
                    return (
                      <tr key={i} className={thieu ? "bg-rose-50 dark:bg-rose-950/20" : ""}>
                        {COT_BOQ.map((c, ci) => {
                          const kq = c.so ? xemSo(d[c.key]) : null;
                          const loiSo = !!kq?.loi;
                          const rong =
                            c.key === "noiDung"
                              ? "w-full min-w-55"
                              : c.key === "stt"
                                ? "w-16"
                                : c.key === "dvt"
                                  ? "w-20"
                                  : "w-28 text-right";
                          return (
                            <td key={c.key} className="border border-vien px-1 py-1 align-top">
                              <div className={`flex flex-col ${c.so ? "items-end" : ""}`}>
                                <input
                                  data-r={i}
                                  data-c={ci}
                                  value={d[c.key]}
                                  onChange={(e) => suaO(i, c.key, e.target.value)}
                                  onKeyDown={diChuyen}
                                  inputMode={c.so ? "decimal" : undefined}
                                  className={`${O} ${rong} ${loiSo ? "border-rose-400" : ""}`}
                                />
                                {c.so ? (
                                  loiSo ? (
                                    <span className="mt-0.5 text-[10px] text-rose-600 dark:text-rose-400">
                                      không đọc được số
                                    </span>
                                  ) : kq!.hienThi !== "" ? (
                                    <span className="mt-0.5 text-[10px] text-chunhat">= {kq!.hienThi}</span>
                                  ) : null
                                ) : null}
                              </div>
                            </td>
                          );
                        })}
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
              <button type="button" onClick={themDong} className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs">
                <Plus className="size-3" /> Thêm dòng
              </button>
              <button
                type="button"
                onClick={luu}
                disabled={dangLuu}
                className="inline-flex items-center gap-1 rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
              >
                <Check className="size-3.5" />
                {dangLuu ? "Đang lưu…" : `${ghiDe ? "Ghi đè" : "Lưu"} ${dongs.length} dòng`}
              </button>
              <button type="button" onClick={() => { setDongs(null); setKqDoc(null); }} className="rounded-md border border-vien px-2.5 py-1 text-xs">
                ← Chọn file khác
              </button>
              {kqLuu ? (
                <span className={`text-xs ${kqLuu.ok ? "text-emerald-600" : "text-rose-600"}`}>{kqLuu.thongDiep}</span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Thiết lập VAT của BOQ: đơn giá đã gồm VAT chưa + thuế suất (%). Đổi thì dòng TỔNG
 * và giá trị Bill (chưa VAT) tính lại theo đó.
 */
export function ThietLapVAT({
  maCongTrinh,
  donGiaGomVAT,
  vatPhanTram,
  lamTronThanhTien,
}: {
  maCongTrinh: string;
  donGiaGomVAT: boolean;
  vatPhanTram: number;
  lamTronThanhTien: boolean;
}) {
  const [mo, setMo] = useState(false);
  const [gom, setGom] = useState(donGiaGomVAT);
  const [vat, setVat] = useState(String(vatPhanTram));
  const [lamTron, setLamTron] = useState(lamTronThanhTien);
  const [kq, setKq] = useState<KetQuaBOQ | null>(null);
  const [dangChay, batDau] = useTransition();

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs font-medium hover:bg-nen"
      >
        Thiết lập BOQ
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        batDau(async () => {
          const r = await luuThietLapVAT(fd);
          setKq(r);
          if (r.ok) setTimeout(() => setMo(false), 700);
        });
      }}
      className="rounded-lg border border-nhan bg-nhannhat p-3"
    >
      <input type="hidden" name="maCongTrinh" value={maCongTrinh} />
      <p className="mb-2 text-xs font-semibold">Thiết lập BOQ</p>
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" name="lamTronThanhTien" checked={lamTron} onChange={(e) => setLamTron(e.target.checked)} />
        Làm tròn cột Thành tiền về đồng
      </label>
      <label className="mt-2 flex items-center gap-1.5 text-xs">
        <input type="checkbox" name="donGiaGomVAT" checked={gom} onChange={(e) => setGom(e.target.checked)} />
        Đơn giá trên đã bao gồm VAT
      </label>
      <label className="mt-2 flex items-center gap-1.5 text-xs">
        VAT (%)
        <input
          name="vatPhanTram"
          value={vat}
          onChange={(e) => setVat(e.target.value)}
          inputMode="decimal"
          className={`${O} w-20 text-right`}
        />
      </label>
      <p className="mt-1 text-[11px] text-chunhat">
        Bỏ tích làm tròn = giữ nguyên số lẻ (khối lượng × đơn giá). Giá trị Bill (doanh thu) luôn lấy
        theo giá CHƯA VAT.
      </p>
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={dangChay} className="rounded-md bg-nhan px-3 py-1 text-xs font-medium text-white disabled:opacity-60">
          {dangChay ? "Đang lưu…" : "Lưu"}
        </button>
        <button type="button" onClick={() => setMo(false)} className="rounded-md border border-vien px-3 py-1 text-xs">
          Đóng
        </button>
      </div>
      <ThongBao kq={kq} />
    </form>
  );
}

export interface ODongGiamGia {
  id: string;
  moTa: string;
  tuStt: number;
  denStt: number;
  phanTram: number;
  /** Số tiền giảm đã tính sẵn ở server. */
  giaTri: number;
}

/**
 * Quản lý giảm giá BOQ: liệt kê các dòng giảm, xoá, và thêm dòng mới (giảm %/toàn
 * bộ hoặc một phạm vi dòng). Giá trị hiển thị dưới TỔNG CỘNG ở bảng BOQ.
 */
export function GiamGiaBOQ({
  maCongTrinh,
  danhSach,
  soDong,
}: {
  maCongTrinh: string;
  danhSach: ODongGiamGia[];
  soDong: number;
}) {
  const [mo, setMo] = useState(false);
  const [toanBo, setToanBo] = useState(true);
  const [kq, setKq] = useState<KetQuaBOQ | null>(null);
  const [dangChay, batDau] = useTransition();

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs font-medium hover:bg-nen"
      >
        Giảm giá{danhSach.length ? ` (${danhSach.length})` : ""}
      </button>
    );
  }

  return (
    <div className="w-full max-w-lg rounded-lg border border-nhan bg-nhannhat p-3">
      <p className="mb-2 text-xs font-semibold">Giảm giá BOQ (chiết khấu)</p>

      {danhSach.length ? (
        <ul className="mb-2 space-y-1">
          {danhSach.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 text-xs">
              <span>
                {g.moTa ? <span className="text-chunhat">{g.moTa} · </span> : null}
                Giảm {g.phanTram}% (dòng {g.tuStt}–{g.denStt}) ={" "}
                <strong className="text-rose-600 dark:text-rose-400">−{tien(g.giaTri)}</strong>
              </span>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  batDau(async () => setKq(await xoaGiamGiaBOQ(fd)));
                }}
              >
                <input type="hidden" name="maCongTrinh" value={maCongTrinh} />
                <input type="hidden" name="id" value={g.id} />
                <button type="submit" title="Xoá" className="rounded p-1 text-rose-600 hover:bg-nen dark:text-rose-400">
                  <Trash2 className="size-3.5" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-xs text-chunhat">Chưa có dòng giảm giá.</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          batDau(async () => {
            const r = await themGiamGiaBOQ(fd);
            setKq(r);
            if (r.ok) (e.target as HTMLFormElement).reset();
          });
        }}
        className="flex flex-wrap items-end gap-2 border-t border-vien pt-2"
      >
        <input type="hidden" name="maCongTrinh" value={maCongTrinh} />
        <input type="hidden" name="toanBo" value={toanBo ? "1" : ""} />
        <label className="text-xs">
          <span className="mb-0.5 block text-chunhat">% giảm</span>
          <input name="phanTram" inputMode="decimal" required className={`${O} w-16 text-right`} placeholder="5" />
        </label>
        <label className="flex items-center gap-1 pb-1.5 text-xs">
          <input type="checkbox" checked={toanBo} onChange={(e) => setToanBo(e.target.checked)} />
          Toàn bộ BOQ
        </label>
        {!toanBo ? (
          <>
            <label className="text-xs">
              <span className="mb-0.5 block text-chunhat">Từ dòng</span>
              <input name="tuStt" inputMode="numeric" className={`${O} w-16 text-right`} placeholder="1" />
            </label>
            <label className="text-xs">
              <span className="mb-0.5 block text-chunhat">Đến dòng</span>
              <input name="denStt" inputMode="numeric" className={`${O} w-16 text-right`} placeholder={String(soDong)} />
            </label>
          </>
        ) : null}
        <label className="text-xs">
          <span className="mb-0.5 block text-chunhat">Nhãn (tuỳ chọn)</span>
          <input name="moTa" className={`${O} w-40`} placeholder="Chiết khấu…" />
        </label>
        <button
          type="submit"
          disabled={dangChay}
          className="rounded-md bg-nhan px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {dangChay ? "…" : "Thêm"}
        </button>
      </form>

      <p className="mt-1 text-[11px] text-chunhat">
        Số dòng BOQ hiện tại: {soDong}. Dòng theo cột ID. Bill/doanh thu tính theo giá đã giảm.
      </p>
      <ThongBao kq={kq} />
      <button type="button" onClick={() => setMo(false)} className="mt-2 rounded-md border border-vien px-3 py-1 text-xs">
        Đóng
      </button>
    </div>
  );
}
