/** Định dạng số/tiền theo chuẩn Việt Nam. Dùng chung toàn app. */

const nfFull = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const nf2 = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nfKL = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

/** Số tiền đầy đủ: 2.653.083.252 */
export function tien(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return nfFull.format(Math.round(v));
}

const nfTienLe = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });

/**
 * Số tiền GIỮ số lẻ (không làm tròn): 24.666,42 · 55.000. Dùng cho cột Thành tiền
 * BOQ khi công trình tắt làm tròn — số nguyên vẫn hiện gọn, số lẻ hiện đủ.
 */
export function tienLe(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return nfTienLe.format(v);
}

/** Số tiền kèm đơn vị: 2.653.083.252 đ */
export function tienDon(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${nfFull.format(Math.round(v))} đ`;
}

/**
 * Rút gọn cho KPI card: 2,65 tỷ · 145,3 tr · 12.500
 * Giữ dấu âm để component tự tô màu.
 */
export function tienGon(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const dau = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${dau}${nf2.format(abs / 1_000_000_000)} tỷ`;
  if (abs >= 1_000_000) return `${dau}${nf1.format(abs / 1_000_000)} tr`;
  if (abs >= 1_000) return `${dau}${nfFull.format(abs / 1_000)} ng`;
  return `${dau}${nfFull.format(abs)}`;
}

/** Tỷ lệ 0–1 -> "11,2%". null -> "—" (KHÔNG hiển thị 0%). */
export function phanTram(v: number | null | undefined, soLe = 1): string {
  if (v === null || v === undefined || Number.isNaN(v) || !Number.isFinite(v)) return "—";
  const f = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: soLe,
    maximumFractionDigits: soLe,
  });
  return `${f.format(v * 100)}%`;
}

/** Số nguyên có phân cách: 9.932 */
export function so(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return nfFull.format(v);
}

/**
 * Khối lượng BOQ: giữ tối đa 2 chữ số thập phân, bỏ số 0 thừa. "7,35" · "105"
 * KHÔNG dùng `so()` cho khối lượng — nó làm tròn về số nguyên, biến 7,35 thành 7.
 */
export function khoiLuong(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return nfKL.format(v);
}

/** "2026-03" -> "T3/2026" */
export function nhanThang(ky: string | null | undefined): string {
  if (!ky) return "—";
  const [y, m] = ky.split("-");
  return `T${Number(m)}/${y}`;
}

/** "2026-03" -> "Quý I/2026" */
/**
 * Nhãn quý. Nhận cả hai dạng khóa đang dùng trong app:
 *   "2026-03"  (khóa tháng)  -> Quý I/2026
 *   "2026-Q1"  (khóa quý, do khoaQuy sinh ra) -> Quý I/2026
 */
export function nhanQuy(ky: string): string {
  const [y, phan] = ky.split("-");
  const q = phan?.startsWith("Q")
    ? Number(phan.slice(1))
    : Math.floor((Number(phan) - 1) / 3) + 1;
  const so = ["I", "II", "III", "IV"][q - 1];
  return so ? `Quý ${so}/${y}` : "—";
}

/** "2026-03" -> "2026-Q1" (dùng làm khóa gộp) */
export function khoaQuy(ky: string): string {
  const [y, m] = ky.split("-");
  return `${y}-Q${Math.floor((Number(m) - 1) / 3) + 1}`;
}

/** ISO date -> "15/03/2026" */
export function ngay(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Số âm hiển thị trong ngoặc đơn theo quy ước kế toán: (1.234.567)
 * Component gọi kèm class text-rose-600.
 */
export function tienKeToan(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const r = Math.round(v);
  return r < 0 ? `(${nfFull.format(Math.abs(r))})` : nfFull.format(r);
}

/** true nếu giá trị nên được tô màu âm. */
export function laAm(v: number | null | undefined): boolean {
  return typeof v === "number" && v < 0;
}
