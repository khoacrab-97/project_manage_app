"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Download, Pencil, Plus, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import {
  docFileBOQ,
  luuKhoiLuong,
  themBillThang,
  themNhieuDongBOQ,
  xacNhanBill,
  type KetQuaBOQ,
} from "@/app/cong-trinh/boq-actions";
import { khoiLuong as dinhDangKL, tien } from "@/lib/format";
import { chuyenTheoKieu, NHAN_KIEU, type KieuCot } from "@/lib/so-linh-hoat";

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
                      <input name="stt" className={`${O} w-16 font-mono`} placeholder="1" />
                    </td>
                    <td className="border-b border-vien px-1 py-1">
                      <input name="noiDung" className={`${O} w-full min-w-[220px]`} />
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
/** 5 cột BOQ + cờ "là cột số" (cột số mới hiện transform/kiểu số). */
const COT_BOQ: { key: keyof ODongBOQ; nhan: string; so: boolean }[] = [
  { key: "stt", nhan: "STT", so: false },
  { key: "noiDung", nhan: "Nội dung hạng mục", so: false },
  { key: "dvt", nhan: "ĐVT", so: false },
  { key: "khoiLuong", nhan: "Khối lượng", so: true },
  { key: "donGia", nhan: "Đơn giá", so: true },
];
const KIEU_MAC_DINH: KieuCot[] = ["text", "text", "text", "thapphan", "nguyen"];
const KIEU_CHON: KieuCot[] = ["text", "nguyen", "thapphan", "phantram"];

export function ImportBOQ({ maCongTrinh }: { maCongTrinh: string }) {
  const [mo, setMo] = useState(false);
  const [dongs, setDongs] = useState<ODongBOQ[] | null>(null);
  // Kiểu dữ liệu từng cột (transform data) — mặc định theo bản chất cột BOQ.
  const [kieu, setKieu] = useState<KieuCot[]>(KIEU_MAC_DINH);
  const [kqDoc, setKqDoc] = useState<KetQuaBOQ | null>(null);
  const [kqLuu, setKqLuu] = useState<KetQuaBOQ | null>(null);
  const [dangDoc, batDauDoc] = useTransition();
  const [dangLuu, batDauLuu] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

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
    setKieu(KIEU_MAC_DINH);
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
    // Áp KIỂU từng cột (transform) rồi gửi giá trị canonical để so() lưu đọc đúng.
    for (const d of dongs) {
      COT_BOQ.forEach((c, i) => fd.append(c.key, chuyenTheoKieu(d[c.key], kieu[i]).canonical));
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
              Tải file mẫu, điền BOQ, rồi upload để app đọc. Kiểm tra và sửa ở bước xem trước trước
              khi lưu. Dữ liệu import được <strong>nối vào cuối</strong> BOQ hiện có.
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
          // --- Bước 2: review sửa được ---
          <div>
            <p className="border-b border-vien bg-nhannhat px-4 py-2 text-xs">
              Đã đọc <strong>{dongs.length}</strong> dòng. Chọn <strong>kiểu</strong> ở đầu mỗi cột để
              app đọc đúng (số thập phân/số nguyên tự nhận diện dấu); dòng <span className="text-chunhat">= …</span> là
              giá trị sẽ lưu — sửa ô nếu sai. Dòng <span className="rounded bg-rose-100 px-1 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">thiếu STT hoặc nội dung</span> bị bỏ khi lưu.
            </p>
            <div className="max-h-[55vh] overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-the">
                  <tr>
                    {COT_BOQ.map((c, ci) => (
                      <th
                        key={c.key}
                        className={`border-b border-vien px-2 py-1.5 align-bottom text-xs font-semibold text-chunhat ${c.so ? "text-right" : "text-left"}`}
                      >
                        <div className={`flex flex-col gap-1 ${c.so ? "items-end" : "items-start"}`}>
                          <span>{c.nhan}</span>
                          <select
                            value={kieu[ci]}
                            onChange={(e) =>
                              setKieu((k) => k.map((x, j) => (j === ci ? (e.target.value as KieuCot) : x)))
                            }
                            className="rounded border border-vien bg-the px-1 py-0.5 text-[11px] font-normal"
                            title="Kiểu dữ liệu cột (transform)"
                          >
                            {KIEU_CHON.map((kc) => (
                              <option key={kc} value={kc}>
                                {NHAN_KIEU[kc]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </th>
                    ))}
                    <th className="border-b border-vien px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {dongs.map((d, i) => {
                    const thieu = !d.stt.trim() || !d.noiDung.trim();
                    return (
                      <tr key={i} className={thieu ? "bg-rose-50 dark:bg-rose-950/20" : ""}>
                        {COT_BOQ.map((c, ci) => {
                          const kq = c.so ? chuyenTheoKieu(d[c.key], kieu[ci]) : null;
                          const loiSo = !!kq?.loi && d[c.key].trim() !== "";
                          const rong =
                            c.key === "noiDung"
                              ? "w-full min-w-[220px]"
                              : c.key === "stt"
                                ? "w-16 font-mono"
                                : c.key === "dvt"
                                  ? "w-20"
                                  : "w-28 text-right";
                          return (
                            <td key={c.key} className="border-b border-vien px-1 py-1 align-top">
                              <div className={`flex flex-col ${c.so ? "items-end" : ""}`}>
                                <input
                                  value={d[c.key]}
                                  onChange={(e) => suaO(i, c.key, e.target.value)}
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
                        <td className="border-b border-vien px-1 py-1 text-center align-top">
                          <button type="button" onClick={() => xoaDong(i)} title="Xoá dòng" className="rounded p-1 text-rose-600 hover:bg-nen dark:text-rose-400">
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
                <Check className="size-3.5" /> {dangLuu ? "Đang lưu…" : `Xác nhận & Lưu ${dongs.length} dòng`}
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
