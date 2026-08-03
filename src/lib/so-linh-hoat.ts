/**
 * Đọc số linh hoạt cho bước IMPORT (transform data kiểu Power Query).
 *
 * Vấn đề: một file BOQ có thể dùng dấu thập phân/phân cách nghìn khác nhau
 * ("1.234,56" kiểu Việt vs "1,234.56" kiểu Anh). Không thể chốt cứng một quy ước.
 * Hàm dưới TỰ NHẬN DIỆN dấu nào là thập phân, dấu nào là phân cách nghìn, rồi để
 * người dùng sửa ở màn review nếu đoán sai (kèm ô chọn KIỂU cột).
 *
 * Riêng file này KHÔNG động tới `so()` của boq-actions — nhập tay vẫn theo quy ước
 * Việt (chấm = nghìn) như cũ; chỉ luồng import mới dùng bộ đọc thông minh này.
 */
export type KieuCot = "text" | "nguyen" | "thapphan" | "phantram";

export const NHAN_KIEU: Record<KieuCot, string> = {
  text: "Văn bản",
  nguyen: "Số nguyên",
  thapphan: "Số thập phân",
  phantram: "Phần trăm",
};

/**
 * Đọc một số, tự đoán dấu thập phân vs dấu phân cách nghìn. Trả null nếu không ra số.
 *
 * Quy tắc đoán:
 *  - Có CẢ chấm lẫn phẩy: dấu XUẤT HIỆN SAU CÙNG là thập phân, dấu kia là nghìn.
 *  - Chỉ một loại dấu: xuất hiện >1 lần → phân cách nghìn; đúng 1 lần và phần đuôi
 *    KHÁC 3 chữ số → thập phân; đúng 1 lần và đuôi = 3 chữ số → coi là nghìn (kiểu
 *    Việt phổ biến; đây là ca nhập nhằng, người dùng sửa tay nếu sai).
 */
export function docSoLinhHoat(raw: string): number | null {
  let s = String(raw).trim().replace(/[^\d.,-]/g, "");
  if (s === "" || s === "-") return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let dec = "";
  if (lastDot >= 0 && lastComma >= 0) {
    dec = lastDot > lastComma ? "." : ",";
  } else if (lastComma >= 0) {
    const nhieu = (s.match(/,/g) || []).length > 1;
    const duoi3 = s.length - lastComma - 1 === 3;
    dec = nhieu || duoi3 ? "" : ",";
  } else if (lastDot >= 0) {
    const nhieu = (s.match(/\./g) || []).length > 1;
    const duoi3 = s.length - lastDot - 1 === 3;
    dec = nhieu || duoi3 ? "" : ".";
  }
  if (dec) {
    s = s.split(dec === "." ? "," : ".").join(""); // bỏ dấu phân cách nghìn
    s = s.replace(dec, "."); // dấu thập phân về chấm chuẩn JS
  } else {
    s = s.replace(/[.,]/g, ""); // tất cả là dấu phân cách nghìn
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface KetQuaChuyen {
  /** Để hiện ở review cho người xem (định dạng Việt). */
  hienThi: string;
  /** Để LƯU — dạng `so()` của boq-actions đọc đúng: nguyên không dấu, lẻ dùng phẩy. */
  canonical: string;
  /** true = không đọc được số (đánh dấu đỏ để người dùng sửa). */
  loi: boolean;
}

/** Chuyển một ô theo KIỂU cột đã chọn. Ô số rỗng là hợp lệ (coi như 0/bỏ khi lưu). */
export function chuyenTheoKieu(raw: string, kieu: KieuCot): KetQuaChuyen {
  const t = String(raw).trim();
  if (kieu === "text") return { hienThi: t, canonical: t, loi: false };
  if (t === "") return { hienThi: "", canonical: "", loi: false };

  if (kieu === "nguyen") {
    const digits = t.replace(/[^\d-]/g, "");
    const n = digits === "" || digits === "-" ? NaN : parseInt(digits, 10);
    if (!Number.isFinite(n)) return { hienThi: t, canonical: t, loi: true };
    return { hienThi: n.toLocaleString("vi-VN"), canonical: String(n), loi: false };
  }

  // thapphan / phantram
  let n = docSoLinhHoat(t);
  if (n === null) return { hienThi: t, canonical: t, loi: true };
  if (kieu === "phantram") n = n / 100;
  return {
    hienThi: n.toLocaleString("vi-VN", { maximumFractionDigits: 6 }),
    canonical: String(n).replace(".", ","),
    loi: false,
  };
}
