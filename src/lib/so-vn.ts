/**
 * Đọc số theo quy ước VIỆT cố định: dấu "." = ngăn nghìn, "," = thập phân.
 *
 * KHÔNG tự đoán dấu (bộ đoán cũ biến 0.444 → 444). Ô Excel kiểu SỐ đã được đọc
 * chính xác từ trước ở tầng parse (giữ nguyên giá trị, chỉ đổi "." → "," cho khớp
 * quy ước này); hàm này chỉ áp cho CHUỖI (ô chữ / người dùng gõ tay ở review).
 *
 * Là đúng logic `so()` trong boq-actions, tách ra để client dùng chung.
 */
export function docSoVN(raw: string): number | null {
  const s = String(raw).trim().replace(/[^\d.,-]/g, "");
  if (s === "" || s === "-") return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
