"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, Pencil, Redo2, Undo2, Upload, X } from "lucide-react";
import { luuKeHoach, nhapKeHoachExcel, type KetQuaKeHoach } from "@/app/ke-hoach/actions";
import { tien } from "@/lib/format";
import type { LoaiMa } from "@/lib/types";

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
  loai: LoaiMa;
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
 *
 * Cột "Kế hoạch" thao tác như Excel giống Bảng giao dịch: bấm chọn ô (kéo/Shift
 * chọn vùng), double-click / gõ để sửa, Delete xoá vùng, Ctrl+C sao chép,
 * Ctrl+V dán cột số từ Excel, phím mũi tên di chuyển, Ctrl+Z/Y hoàn tác/làm lại.
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
  const router = useRouter();
  const [mo, setMo] = useState(false);
  const [v, setV] = useState<Record<string, string>>(
    Object.fromEntries(dsMa.map((m) => [m.ma, giaTriHienTai[m.ma] ? String(giaTriHienTai[m.ma]) : ""]))
  );
  const [kq, setKq] = useState<KetQuaKeHoach | null>(null);
  const [dangChay, batDau] = useTransition();
  const [dangNhap, batDauNhap] = useTransition();

  // Mô hình chọn ô kiểu Excel cho MỘT cột "Kế hoạch": chỉ số là VỊ TRÍ DÒNG.
  // `neo` là ô neo, `cuoi` là góc kia của vùng, `sua` là dòng đang gõ.
  const [neo, setNeo] = useState<number | null>(null);
  const [cuoi, setCuoi] = useState<number | null>(null);
  const [sua, setSua] = useState<number | null>(null);
  // Undo/Redo: ngăn xếp bản chụp `v` TRƯỚC mỗi thao tác sửa.
  const [past, setPast] = useState<Record<string, string>[]>([]);
  const [future, setFuture] = useState<Record<string, string>[]>([]);
  const keoRef = useRef(false); // đang kéo chọn vùng bằng chuột
  const boxRef = useRef<HTMLDivElement>(null); // khung cuộn, nhận phím
  const suaRef = useRef<HTMLInputElement>(null);
  const lanBamRef = useRef<{ i: number; t: number } | null>(null); // nhận double-click

  // Đóng modal bằng Esc — nhưng chỉ khi KHÔNG đang sửa ô / không có vùng chọn
  // (Esc lúc đó dành cho việc thoát sửa / bỏ chọn trong lưới).
  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sua === null && neo === null) setMo(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [mo, sua, neo]);

  // Kết thúc kéo chọn vùng khi thả chuột ở bất cứ đâu.
  useEffect(() => {
    const up = () => {
      keoRef.current = false;
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // Vào chế độ sửa: focus ô nhập, đưa con trỏ về cuối.
  useEffect(() => {
    if (sua === null) return;
    const el = suaRef.current;
    if (!el) return;
    el.focus();
    const n = el.value.length;
    try {
      el.setSelectionRange(n, n);
    } catch {
      /* noop */
    }
  }, [sua]);

  const so = (s: string) => {
    const n = Number(s.replace(/[\s.]/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const tongTheoLoai = (loai: MaNhap["loai"]) =>
    dsMa.filter((m) => m.loai === loai).reduce((a, m) => a + so(v[m.ma] ?? ""), 0);
  const tongDT = tongTheoLoai("Doanh thu");
  const tongCP = tongTheoLoai("Chi phí");
  const soMaCoSo = dsMa.filter((m) => so(v[m.ma] ?? "") > 0).length;

  // ---- Chụp trạng thái để Undo/Redo ----
  const luuTruoc = () => {
    setPast((p) => [...p.slice(-99), v]);
    setFuture([]);
  };
  const hoanTac = () => {
    if (!past.length) return;
    setFuture((f) => [v, ...f]);
    setV(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setSua(null);
  };
  const lamLai = () => {
    if (!future.length) return;
    setPast((p) => [...p, v]);
    setV(future[0]);
    setFuture((f) => f.slice(1));
    setSua(null);
  };

  const datGiaTri = (i: number, val: string) =>
    setV((s) => ({ ...s, [dsMa[i].ma]: val }));

  const trongVung = (i: number) => {
    if (neo === null || cuoi === null) return false;
    return i >= Math.min(neo, cuoi) && i <= Math.max(neo, cuoi);
  };

  // Xoá dữ liệu mọi ô trong vùng đang chọn (Delete/Backspace).
  const xoaVung = () => {
    if (neo === null || cuoi === null) return;
    luuTruoc();
    const r0 = Math.min(neo, cuoi);
    const r1 = Math.max(neo, cuoi);
    setV((prev) => {
      const next = { ...prev };
      for (let i = r0; i <= r1; i++) next[dsMa[i].ma] = "";
      return next;
    });
  };

  const batDauSua = (i: number) => {
    luuTruoc(); // chụp trước khi vào sửa để Ctrl+Z quay lại giá trị cũ
    setNeo(i);
    setCuoi(i);
    setSua(i);
  };

  // Chuột: bấm chọn ô (không hiện con trỏ), kéo để chọn vùng, bấm 2 lần để sửa.
  const onXuongO = (e: React.MouseEvent, i: number) => {
    if (sua === i) return; // đang sửa chính ô này -> để chọn chữ trong ô
    const now = Date.now();
    const last = lanBamRef.current;
    if (!e.shiftKey && last && last.i === i && now - last.t < 400) {
      lanBamRef.current = null;
      batDauSua(i);
      return;
    }
    lanBamRef.current = { i, t: now };
    setSua(null);
    if (e.shiftKey && neo !== null) setCuoi(i);
    else {
      setNeo(i);
      setCuoi(i);
    }
    keoRef.current = true;
    boxRef.current?.focus();
  };
  const onVaoO = (i: number) => {
    if (keoRef.current) setCuoi(i);
  };

  // Phím tắt trên KHUNG (khi KHÔNG gõ trong ô).
  const onPhim = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      if (e.shiftKey) lamLai();
      else hoanTac();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
      e.preventDefault();
      lamLai();
      return;
    }
    if (sua !== null) return; // đang sửa -> để ô nhập tự xử lý
    if (neo === null) return;
    const g = (x: number) => Math.max(0, Math.min(dsMa.length - 1, x));
    const di = (ni: number, giuNeo: boolean) => {
      e.preventDefault();
      const p = g(ni);
      if (giuNeo) setCuoi(p);
      else {
        setNeo(p);
        setCuoi(p);
      }
    };
    switch (e.key) {
      case "ArrowDown":
        return di(neo + 1, e.shiftKey);
      case "ArrowUp":
        return di(neo - 1, e.shiftKey);
      case "Enter":
      case "Tab":
        return di(neo + 1, false);
      case "F2":
        e.preventDefault();
        return batDauSua(neo);
      case "Delete":
      case "Backspace":
        e.preventDefault();
        return xoaVung();
      case "Escape":
        e.preventDefault();
        setNeo(null);
        setCuoi(null);
        return;
    }
    // Gõ ký tự số -> vào sửa, thay nội dung ô bằng ký tự đó.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      luuTruoc();
      datGiaTri(neo, e.key);
      setSua(neo);
    }
  };

  // Phím trong ô đang SỬA: Enter/Tab lưu & xuống dòng dưới; Esc thoát sửa.
  const onPhimSua = (i: number) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      setSua(null);
      const ni = Math.min(dsMa.length - 1, i + 1);
      setNeo(ni);
      setCuoi(ni);
      boxRef.current?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSua(null);
      boxRef.current?.focus();
    }
  };

  // Sao chép (Ctrl+C) cột giá trị đang chọn ra clipboard (mỗi dòng một số).
  const sao = (e: React.ClipboardEvent) => {
    if (sua !== null || neo === null || cuoi === null) return;
    const r0 = Math.min(neo, cuoi);
    const r1 = Math.max(neo, cuoi);
    const hang: string[] = [];
    for (let i = r0; i <= r1; i++) hang.push(v[dsMa[i].ma] ?? "");
    e.clipboardData.setData("text/plain", hang.join("\n"));
    e.preventDefault();
  };

  // Dán (Ctrl+V) cột số từ Excel/Sheets, điền xuống từ ô đang chọn. Nhiều cột thì
  // lấy cột cuối (thường là giá trị). Đang sửa & dán 1 ô đơn thì để ô tự dán.
  const dan = (e: React.ClipboardEvent) => {
    const goc = sua ?? neo;
    if (goc === null) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    if (sua !== null && !text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    luuTruoc();
    const hang = text.replace(/\r/g, "").replace(/\n$/, "").split("\n");
    setV((prev) => {
      const next = { ...prev };
      hang.forEach((line, k) => {
        const i = goc + k;
        if (i >= dsMa.length) return;
        const cells = line.split("\t");
        next[dsMa[i].ma] = (cells[cells.length - 1] ?? "").trim();
      });
      return next;
    });
    setSua(null);
  };

  const luu = () => {
    const fd = new FormData();
    fd.set("maCongTrinh", maCongTrinh);
    for (const m of dsMa) fd.set(`kh_${m.ma}`, v[m.ma] ?? "");
    batDau(async () => {
      const r = await luuKeHoach(fd);
      setKq(r);
      // Lưu xong: hiện thông báo một nhịp rồi tự đóng hộp thoại và làm mới số liệu.
      if (r.ok) setTimeout(() => {
        setMo(false);
        router.refresh();
      }, 900);
    });
  };

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

      {/* ---- Lưới nhập tay (Data Grid như Bảng giao dịch) ---- */}
      <div className="border-b border-vien bg-nhannhat px-4 py-2 text-[11px] text-chunhat">
        Thao tác như Excel ở cột <strong>Kế hoạch</strong>: <strong>bấm</strong> chọn ô (kéo/Shift để
        chọn vùng), <strong>double-click</strong> hoặc gõ để sửa. <strong>Delete</strong> xoá vùng,{" "}
        <strong>sao chép (Ctrl+C)</strong>/<strong>dán (Ctrl+V)</strong> cột số với Excel/Sheets, phím{" "}
        <strong>mũi tên</strong> di chuyển, <strong>Ctrl+Z</strong> hoàn tác, <strong>Ctrl+Y</strong>{" "}
        làm lại. Số kiểu Việt (dấu <strong>,</strong> thập phân, <strong>.</strong> ngăn nghìn).
      </div>

      {/* Vùng lưới có phím tắt riêng (chọn ô, sửa, xoá vùng) nên cần nhận focus. */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: widget bảng tính tự xử lý bàn phím */}
      <div ref={boxRef} role="application" tabIndex={0} onKeyDown={onPhim} onCopy={sao} onPaste={dan} className="max-h-[60vh] overflow-auto outline-none">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-the">
            <tr>
              <th className="border border-vien bg-nen px-3 py-1.5 text-left text-xs font-semibold text-chunhat">
                Mã
              </th>
              <th className="border border-vien bg-nen px-3 py-1.5 text-left text-xs font-semibold text-chunhat">
                Hạng mục
              </th>
              <th className="border border-vien bg-nen px-3 py-1.5 text-right text-xs font-semibold text-chunhat">
                Kế hoạch (đ)
              </th>
            </tr>
          </thead>
          <tbody>
            {dsMa.map((m, i) => (
              <tr key={m.ma} className={m.laNhom ? "bg-nen/50" : ""}>
                <td
                  className={`border border-vien px-3 py-1.5 text-xs whitespace-nowrap ${m.capCon ? "pl-8" : ""} ${m.laNhom ? "font-semibold" : ""}`}
                >
                  {m.ma}
                </td>
                <td
                  className={`border border-vien max-w-95 truncate px-3 py-1.5 text-xs ${m.laNhom ? "font-semibold" : ""}`}
                  title={m.ten}
                >
                  {m.loai === "Doanh thu" ? <span className="text-nhan">{m.ten}</span> : m.ten}
                  {m.laNhom ? <span className="ml-1.5 font-normal text-chunhat">(mã nhóm)</span> : null}
                </td>
                <td
                  onMouseDown={(e) => onXuongO(e, i)}
                  onMouseEnter={() => onVaoO(i)}
                  className={`border border-vien p-0 text-right align-middle ${
                    trongVung(i) && sua !== i ? "bg-nhan/10 dark:bg-nhan/25" : ""
                  }`}
                >
                  {sua === i ? (
                    <input
                      ref={suaRef}
                      value={v[m.ma] ?? ""}
                      onChange={(e) => datGiaTri(i, e.target.value)}
                      onKeyDown={onPhimSua(i)}
                      inputMode="decimal"
                      className="w-full bg-white px-3 py-1.5 text-right text-xs ring-2 ring-nhan outline-none ring-inset dark:bg-black/50"
                    />
                  ) : (
                    <div
                      className={`min-h-[1.75rem] px-3 py-1.5 text-right text-xs select-none ${
                        neo === i ? "ring-2 ring-nhan ring-inset" : ""
                      }`}
                    >
                      {v[m.ma] ? v[m.ma] : <span className="text-chunhat/40">0</span>}
                    </div>
                  )}
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
            onClick={hoanTac}
            disabled={!past.length}
            title="Hoàn tác (Ctrl+Z)"
            className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1.5 text-xs disabled:opacity-40"
          >
            <Undo2 className="size-3" /> Hoàn tác
          </button>
          <button
            type="button"
            onClick={lamLai}
            disabled={!future.length}
            title="Làm lại (Ctrl+Y)"
            className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1.5 text-xs disabled:opacity-40"
          >
            <Redo2 className="size-3" /> Làm lại
          </button>
          <button
            type="button"
            onClick={() => setMo(false)}
            className="rounded-md border border-vien px-3 py-1.5 text-xs"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={luu}
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
      </div>
    </div>
  );
}
