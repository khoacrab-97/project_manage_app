"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Pencil, Plus, Redo2, Trash2, Undo2, X } from "lucide-react";
import { luuGiaoDich, type KetQuaGiaoDich } from "@/app/cong-trinh/giao-dich-actions";
import { docSoVN } from "@/lib/so-vn";
import { nhanThang, ngay as dinhDangNgay, tien } from "@/lib/format";

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
// `px` = độ rộng mặc định (kéo dãn được, lưu trong phiên qua state `rong`).
const COT: { key: keyof Dong; nhan: string; px: number; so?: boolean }[] = [
  { key: "maBase", nhan: "Mã Base", px: 96 },
  { key: "soHoaDon", nhan: "Số hóa đơn", px: 96 },
  { key: "ngayChungTu", nhan: "Ngày chứng từ", px: 112 },
  { key: "noiDung", nhan: "Nội dung thanh toán", px: 300 },
  { key: "dvt", nhan: "ĐVT", px: 64 },
  { key: "donGia", nhan: "Đơn giá", px: 112, so: true },
  { key: "soLuong", nhan: "Số lượng", px: 84, so: true },
  { key: "soTien", nhan: "Số tiền", px: 128, so: true },
  { key: "maDTCP", nhan: "Mã DT–CP", px: 150 },
  { key: "ghiChu", nhan: "Ghi chú", px: 150 },
];

const RONG_STT = 44; // cột "#"
const RONG_THANG = 96; // cột hiển thị "Tháng TH"
const RONG_NDCP = 200; // cột hiển thị "Nội dung chi phí" (tên theo mã)

interface O {
  r: number;
  c: number;
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
  // Mô hình chọn ô kiểu Excel: `neo` là ô neo, `cuoi` là ô góc kia của vùng chọn;
  // `sua` là ô đang gõ (chỉ khi double-click / F2 / gõ ký tự). Bấm một lần chỉ chọn.
  const [neo, setNeo] = useState<O | null>(null);
  const [cuoi, setCuoi] = useState<O | null>(null);
  const [sua, setSua] = useState<O | null>(null);
  const [rong, setRong] = useState<Record<string, number>>(
    () => Object.fromEntries(COT.map((c) => [c.key, c.px]))
  );
  // Undo/Redo: ngăn xếp trạng thái TRƯỚC mỗi thao tác sửa.
  const [past, setPast] = useState<Dong[][]>([]);
  const [future, setFuture] = useState<Dong[][]>([]);
  const keoRef = useRef(false); // đang kéo chọn vùng bằng chuột
  const boxRef = useRef<HTMLDivElement>(null); // khung cuộn, nhận phím
  const suaRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const lanBamRef = useRef<{ r: number; c: number; t: number } | null>(null); // nhận double-click

  // Kết thúc kéo chọn vùng khi thả chuột ở bất cứ đâu.
  useEffect(() => {
    const up = () => {
      keoRef.current = false;
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // Vào chế độ sửa: focus ô nhập, đưa con trỏ về cuối, và co giãn cao theo nội dung.
  useEffect(() => {
    if (!sua) return;
    const el = suaRef.current;
    if (!el) return;
    el.focus();
    const n = el.value.length;
    try {
      el.setSelectionRange(n, n);
    } catch {
      /* input số không hỗ trợ selectionRange */
    }
    if (el instanceof HTMLTextAreaElement) {
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [sua]);

  const suaO = (i: number, k: keyof Dong, v: string) =>
    setDongs((s) => s.map((d, j) => (j === i ? { ...d, [k]: v } : d)));

  // Chụp trạng thái hiện tại vào ngăn "quá khứ" TRƯỚC khi thao tác làm đổi bảng.
  // Dong luôn được thay bằng object/mảng mới nên chỉ cần lưu tham chiếu, không clone.
  const luuTruoc = () => {
    setPast((p) => [...p.slice(-99), dongs]);
    setFuture([]);
  };
  const hoanTac = () => {
    if (!past.length) return;
    setFuture((f) => [dongs, ...f]);
    setDongs(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setSua(null);
  };
  const lamLai = () => {
    if (!future.length) return;
    setPast((p) => [...p, dongs]);
    setDongs(future[0]);
    setFuture((f) => f.slice(1));
    setSua(null);
  };

  const themDong = () => {
    luuTruoc();
    setDongs((s) => [...s, { ...DONG_RONG }]);
  };
  const xoaDong = (i: number) => {
    luuTruoc();
    setDongs((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s));
    setChonDong(null);
  };
  const chenDongDuoi = (i: number) => {
    luuTruoc();
    setDongs((s) => {
      const n = [...s];
      n.splice(i + 1, 0, { ...DONG_RONG });
      return n;
    });
    setChonDong((c) => (c === null ? null : c + 1));
  };
  const chonDongNhap = (i: number) => {
    setChonDong(i);
    setNeo(null);
    setCuoi(null);
    setSua(null);
    boxRef.current?.focus();
  };

  // Co giãn chiều cao textarea theo nội dung (wrap + ngắt dòng đẩy dòng cao lên).
  const capNhatCao = (el: HTMLTextAreaElement) => {
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };

  const trongVung = (i: number, ci: number) => {
    if (!neo || !cuoi) return false;
    return (
      i >= Math.min(neo.r, cuoi.r) &&
      i <= Math.max(neo.r, cuoi.r) &&
      ci >= Math.min(neo.c, cuoi.c) &&
      ci <= Math.max(neo.c, cuoi.c)
    );
  };
  const laNeo = (i: number, ci: number) => neo?.r === i && neo?.c === ci;
  const laSua = (i: number, ci: number) => sua?.r === i && sua?.c === ci;

  // Xoá dữ liệu toàn bộ ô trong vùng đang chọn (Delete/Backspace).
  const xoaVung = () => {
    if (!neo || !cuoi) return;
    luuTruoc();
    const r0 = Math.min(neo.r, cuoi.r);
    const r1 = Math.max(neo.r, cuoi.r);
    const c0 = Math.min(neo.c, cuoi.c);
    const c1 = Math.max(neo.c, cuoi.c);
    setDongs((prev) =>
      prev.map((d, ri) => {
        if (ri < r0 || ri > r1) return d;
        const nd = { ...d };
        for (let ci = c0; ci <= c1; ci++) nd[COT[ci].key] = "";
        return nd;
      })
    );
  };

  // Chuột: bấm chọn ô (không hiện con trỏ), kéo để chọn vùng, bấm 2 lần để sửa.
  // Nhận double-click bằng THỜI GIAN trong chính mousedown thay vì sự kiện dblclick:
  // lần bấm đầu làm bảng render lại (đổi ô chọn) nên trình duyệt bỏ qua dblclick.
  // Ô hiển thị là <div> nên không có con trỏ nhấp nháy; bôi đen chữ khi kéo vùng đã
  // chặn bằng `select-none` trên ô — không cần preventDefault (nó lại chặn dblclick).
  const onXuongO = (e: React.MouseEvent, i: number, ci: number) => {
    if (laSua(i, ci)) return; // đang sửa chính ô này -> để chọn chữ trong ô
    const now = Date.now();
    const last = lanBamRef.current;
    if (!e.shiftKey && last && last.r === i && last.c === ci && now - last.t < 400) {
      lanBamRef.current = null;
      batDauSua(i, ci);
      return;
    }
    lanBamRef.current = { r: i, c: ci, t: now };
    setSua(null);
    setChonDong(null);
    if (e.shiftKey && neo) setCuoi({ r: i, c: ci });
    else {
      setNeo({ r: i, c: ci });
      setCuoi({ r: i, c: ci });
    }
    keoRef.current = true;
    boxRef.current?.focus();
  };
  const onVaoO = (i: number, ci: number) => {
    if (keoRef.current) setCuoi({ r: i, c: ci });
  };
  const batDauSua = (i: number, ci: number) => {
    luuTruoc(); // chụp trước khi vào sửa để Ctrl+Z quay lại nội dung cũ của ô
    setNeo({ r: i, c: ci });
    setCuoi({ r: i, c: ci });
    setChonDong(null);
    setSua({ r: i, c: ci });
  };

  // Phím tắt trên KHUNG (khi KHÔNG gõ trong ô).
  const onPhim = (e: React.KeyboardEvent) => {
    if (sua) return; // đang sửa -> để ô nhập tự xử lý (Enter, Alt+Enter, Esc…)
    // Undo/Redo: Ctrl+Z hoàn tác, Ctrl+Y hoặc Ctrl+Shift+Z làm lại.
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
    // Thao tác theo DÒNG khi đang chọn dòng qua cột "#".
    if (chonDong !== null) {
      if (e.key === "Delete") {
        e.preventDefault();
        xoaDong(chonDong);
        return;
      }
      if (e.key === "Insert") {
        e.preventDefault();
        chenDongDuoi(chonDong);
        return;
      }
    }
    if (!neo) return;
    const { r, c } = neo;
    const gR = (x: number) => Math.max(0, Math.min(dongs.length - 1, x));
    const gC = (x: number) => Math.max(0, Math.min(COT.length - 1, x));
    const di = (nr: number, nc: number, giuNeo = false) => {
      e.preventDefault();
      const p = { r: gR(nr), c: gC(nc) };
      if (giuNeo) setCuoi(p);
      else {
        setNeo(p);
        setCuoi(p);
      }
    };
    switch (e.key) {
      case "ArrowDown":
        return di(r + 1, c, e.shiftKey);
      case "ArrowUp":
        return di(r - 1, c, e.shiftKey);
      case "ArrowLeft":
        return di(r, c - 1, e.shiftKey);
      case "ArrowRight":
        return di(r, c + 1, e.shiftKey);
      case "Tab":
        return di(r, c + 1);
      case "Enter":
        return di(r + 1, c);
      case "F2":
        e.preventDefault();
        return batDauSua(r, c);
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
    // Gõ một ký tự in được -> vào chế độ sửa, thay nội dung ô bằng ký tự đó.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      luuTruoc();
      suaO(r, COT[c].key, e.key);
      setSua({ r, c });
    }
  };

  // Phím trong ô đang SỬA: Alt+Enter ngắt dòng (CHAR 10); Enter/Tab lưu & rời ô.
  const onPhimSua = (i: number, ci: number) => (e: React.KeyboardEvent) => {
    const el = e.currentTarget as HTMLTextAreaElement | HTMLInputElement;
    if (e.key === "Enter" && e.altKey && el instanceof HTMLTextAreaElement) {
      e.preventDefault();
      const s = el.selectionStart ?? el.value.length;
      const en = el.selectionEnd ?? el.value.length;
      suaO(i, COT[ci].key, `${el.value.slice(0, s)}\n${el.value.slice(en)}`);
      requestAnimationFrame(() => {
        try {
          el.setSelectionRange(s + 1, s + 1);
        } catch {
          /* noop */
        }
        capNhatCao(el);
      });
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setSua(null);
      const nr = Math.min(dongs.length - 1, i + 1);
      setNeo({ r: nr, c: ci });
      setCuoi({ r: nr, c: ci });
      boxRef.current?.focus();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      setSua(null);
      const nc = Math.min(COT.length - 1, ci + 1);
      setNeo({ r: i, c: nc });
      setCuoi({ r: i, c: nc });
      boxRef.current?.focus();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setSua(null);
      boxRef.current?.focus();
    }
  };

  // Kéo dãn cột: rê cạnh phải tiêu đề. Lưu trong phiên (không ghi vào DB).
  const batDauKeoCot = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const w0 = rong[key] ?? 100;
    const move = (ev: MouseEvent) => setRong((r) => ({ ...r, [key]: Math.max(48, w0 + ev.clientX - x0) }));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // Dán vùng dữ liệu từ Excel / Google Sheets bắt đầu từ ô neo (hoặc ô đang sửa).
  const dan = (e: React.ClipboardEvent) => {
    const goc = sua ?? neo;
    if (!goc) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return; // 1 ô -> để mặc định
    e.preventDefault();
    luuTruoc();
    const matrix = text
      .replace(/\r/g, "")
      .replace(/\n$/, "")
      .split("\n")
      .map((l) => l.split("\t"));
    const { r: r0, c: c0 } = goc;
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
    setSua(null);
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
        datLaiChon();
      }
    });
  };

  const datLaiChon = () => {
    setChonDong(null);
    setNeo(null);
    setCuoi(null);
    setSua(null);
    setPast([]);
    setFuture([]);
  };

  const suaLai = () => {
    setDongs(giaoDich.length ? giaoDich.map(tuGiaoDich) : Array.from({ length: SO_DONG_MOI }, () => ({ ...DONG_RONG })));
    datLaiChon();
    setKq(null);
    setKhoa(false);
  };

  const huy = () => {
    setDongs(giaoDich.length ? giaoDich.map(tuGiaoDich) : Array.from({ length: SO_DONG_MOI }, () => ({ ...DONG_RONG })));
    datLaiChon();
    setKq(null);
    if (giaoDich.length) setKhoa(true);
  };

  // ---------------- KHÓA: chỉ xem ----------------
  // Tra tên khoản mục theo mã (chỉ mã cho nhập trực tiếp). Không có = mã sai.
  const tenTheoMa = new Map(dsMa.map((m) => [m.ma, m.ten]));

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
              <Pencil className="size-3.5" /> Cập nhật
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
                  {["Mã Base", "Số HĐ", "Ngày CT", "Tháng", "Nội dung", "ĐVT", "Đơn giá", "SL", "Số tiền", "Mã DT–CP", "Nội dung chi phí", "Ghi chú"].map(
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
                {giaoDich.map((g, i) => {
                  const ma = (g.maDTCP ?? "").trim();
                  const ten = ma ? tenTheoMa.get(ma) : undefined;
                  const saiMa = ma !== "" && ten === undefined;
                  return (
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
                      <td
                        title={saiMa ? "Mã DT–CP không có trong danh mục" : ten}
                        className={`border border-vien px-2 py-1 text-xs ${saiMa ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300" : "text-chunhat"}`}
                      >
                        {ma === "" ? "—" : saiMa ? "⚠ Mã không có trong danh mục" : ten}
                      </td>
                      <td className="border border-vien px-2 py-1 text-xs">{g.ghiChu ?? "—"}</td>
                    </tr>
                  );
                })}
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
  const tongRong = RONG_STT + RONG_THANG + RONG_NDCP + COT.reduce((a, c) => a + (rong[c.key] ?? c.px), 0);
  return (
    <div>
      <div className="border-b border-vien bg-nhannhat px-4 py-2 text-[11px] text-chunhat">
        Thao tác như Excel: <strong>bấm</strong> chọn ô (kéo/Shift để chọn vùng),{" "}
        <strong>double-click</strong> hoặc gõ để sửa. <strong>Delete</strong> xoá dữ liệu vùng đang
        chọn, <strong>Alt+Enter</strong> ngắt dòng trong ô, <strong>dán (Ctrl+V)</strong> vùng từ
        Excel/Sheets. Rê cạnh phải tiêu đề để <strong>kéo dãn cột</strong>. Bấm ô <strong>#</strong>{" "}
        đầu dòng rồi <strong>Insert</strong>/<strong>Delete</strong> để thêm/xoá dòng.{" "}
        <strong>Ctrl+Z</strong> hoàn tác, <strong>Ctrl+Y</strong> làm lại. Số kiểu Việt (dấu{" "}
        <strong>,</strong> thập phân, <strong>.</strong> ngăn nghìn).
      </div>

      <datalist id="dsMaGiaoDich">
        {dsMa.map((c) => (
          <option key={c.ma} value={c.ma}>
            {c.loai} · {c.ten}
          </option>
        ))}
      </datalist>

      {/* Vùng bảng tính có phím tắt riêng (chọn ô, sửa, xoá vùng) nên cần nhận focus. */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: widget bảng tính tự xử lý bàn phím */}
      <div ref={boxRef} role="application" tabIndex={0} onKeyDown={onPhim} onPaste={dan} className="max-h-[60vh] overflow-auto outline-none">
        <table className="border-collapse text-sm" style={{ tableLayout: "fixed", width: tongRong }}>
          <colgroup>
            <col style={{ width: RONG_STT }} />
            {COT.flatMap((c) => {
              const col = <col key={c.key} style={{ width: rong[c.key] ?? c.px }} />;
              if (c.key === "ngayChungTu") return [col, <col key="thangTH" style={{ width: RONG_THANG }} />];
              if (c.key === "maDTCP") return [col, <col key="ndCP" style={{ width: RONG_NDCP }} />];
              return [col];
            })}
          </colgroup>
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
                    className={`relative border border-vien bg-nen px-2 py-1.5 text-xs font-semibold whitespace-nowrap text-chunhat ${c.so ? "text-right" : "text-left"}`}
                  >
                    {c.nhan}
                    {/* Tay kéo dãn cột ở cạnh phải tiêu đề. */}
                    <span
                      onMouseDown={(e) => batDauKeoCot(e, c.key)}
                      className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-nhan/50"
                    />
                  </th>
                );
                if (c.key === "ngayChungTu")
                  return [
                    th,
                    <th
                      key="thangTH"
                      className="border border-vien bg-nen px-2 py-1.5 text-left text-xs font-semibold whitespace-nowrap text-chunhat"
                    >
                      Tháng TH
                    </th>,
                  ];
                if (c.key === "maDTCP")
                  return [
                    th,
                    <th
                      key="ndCP"
                      className="border border-vien bg-nen px-2 py-1.5 text-left text-xs font-semibold whitespace-nowrap text-chunhat"
                    >
                      Nội dung chi phí
                    </th>,
                  ];
                return [th];
              })}
            </tr>
          </thead>
          <tbody>
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
                    const kqSo = so ? docSo(d[c.key]) : null;
                    const loiSo = so && d[c.key].trim() !== "" && kqSo === null;
                    const laMa = c.key === "maDTCP";
                    const laNgay = c.key === "ngayChungTu";
                    const loi = loiSo || (laNgay && loiNgay);
                    // Ô trống mà số tiền tự tính được thì hiện gợi ý mờ trong ô.
                    const goiY =
                      laNgay
                        ? "dd/mm/yyyy"
                        : c.key === "soTien" && st.tuTinh && st.giaTri !== null
                          ? `= ${st.giaTri.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}`
                          : "";
                    const dangSua = laSua(i, ci);
                    return (
                      <td
                        key={c.key}
                        onMouseDown={(e) => onXuongO(e, i, ci)}
                        onMouseEnter={() => onVaoO(i, ci)}
                        className={`border border-vien p-0 align-top ${so ? "text-right" : ""} ${
                          trongVung(i, ci) && !dangSua ? "bg-nhan/10 dark:bg-nhan/25" : ""
                        }`}
                      >
                        {dangSua ? (
                          laMa ? (
                            <input
                              ref={suaRef as React.RefObject<HTMLInputElement>}
                              value={d[c.key]}
                              onChange={(e) => suaO(i, c.key, e.target.value)}
                              onKeyDown={onPhimSua(i, ci)}
                              list="dsMaGiaoDich"
                              className="w-full bg-white px-2 py-1 text-xs ring-2 ring-nhan outline-none ring-inset dark:bg-black/50"
                            />
                          ) : (
                            <textarea
                              ref={suaRef as React.RefObject<HTMLTextAreaElement>}
                              rows={1}
                              value={d[c.key]}
                              onChange={(e) => suaO(i, c.key, e.target.value)}
                              onInput={(e) => capNhatCao(e.currentTarget)}
                              onKeyDown={onPhimSua(i, ci)}
                              inputMode={so ? "decimal" : undefined}
                              className={`w-full resize-none overflow-hidden bg-white px-2 py-1 text-xs whitespace-pre-wrap ring-2 ring-nhan outline-none ring-inset dark:bg-black/50 ${so ? "text-right" : ""}`}
                            />
                          )
                        ) : (
                          <div
                            className={`min-h-[1.75rem] px-2 py-1 text-xs break-words whitespace-pre-wrap select-none ${so ? "text-right" : ""} ${
                              laNeo(i, ci) ? "ring-2 ring-nhan ring-inset" : ""
                            } ${loi ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300" : ""}`}
                            title={loiSo ? "Không đọc được số" : undefined}
                          >
                            {d[c.key] !== "" ? (
                              d[c.key]
                            ) : goiY ? (
                              <span className="text-chunhat/50">{goiY}</span>
                            ) : null}
                          </div>
                        )}
                      </td>
                    );
                  }).flatMap((cell, ci) => {
                    const key = COT[ci]?.key;
                    if (key === "ngayChungTu") {
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
                    }
                    if (key === "maDTCP") {
                      // Cột KHOÁ: tự nhận diện tên khoản mục theo mã; mã sai thì báo tại ô.
                      const ma = d.maDTCP.trim();
                      const ten = ma ? tenTheoMa.get(ma) : undefined;
                      const saiMa = ma !== "" && ten === undefined;
                      return [
                        cell,
                        <td
                          key="ndCP"
                          title={saiMa ? "Mã DT–CP không có trong danh mục" : ten}
                          className={`border border-vien px-2 py-1 align-top text-xs break-words ${
                            saiMa
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                              : "bg-nen/40 text-chunhat"
                          }`}
                        >
                          {ma === "" ? "—" : saiMa ? "⚠ Mã không có trong danh mục" : ten}
                        </td>,
                      ];
                    }
                    return [cell];
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
        <button
          type="button"
          onClick={hoanTac}
          disabled={!past.length}
          title="Hoàn tác (Ctrl+Z)"
          className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs disabled:opacity-40"
        >
          <Undo2 className="size-3" /> Hoàn tác
        </button>
        <button
          type="button"
          onClick={lamLai}
          disabled={!future.length}
          title="Làm lại (Ctrl+Y)"
          className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs disabled:opacity-40"
        >
          <Redo2 className="size-3" /> Làm lại
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
