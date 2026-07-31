/**
 * Bộ quy tắc kiểm tra dữ liệu nhập.
 *
 * Nguồn quy tắc: sheet "KIỂM TRA INPUT" của bộ chuẩn hóa (5 chỉ tiêu gốc) cộng
 * các kiểm tra logic ở §8.3. Không tự nghĩ thêm luật ngoài đặc tả.
 *
 * Ba mức theo §8.3:
 *   Error       -> KHÔNG cho phê duyệt, không ghi sổ.
 *   Warning     -> cho phê duyệt nhưng phải giải trình.
 *   Information -> chỉ thông báo.
 */
import type { MucDoLoi } from "./types";
import { COT_CHUAN, type DongThô, type KetQuaDoc, type TenCot } from "./excel/parse-chitiet-th";

export interface LoiDong {
  dongExcel: number;
  cot: TenCot | null;
  maLoi: string;
  mucDo: MucDoLoi;
  thongDiep: string;
  cachXuLy: string;
}

export interface DongDaChuan {
  dongExcel: number;
  maCongTrinh: string | null;
  tenCongTrinh: string | null;
  soHoaDon: string | null;
  ngayChungTu: string | null;
  thangThucHien: string | null;
  tuanThucHien: number | null;
  noiDungThanhToan: string | null;
  dvt: string | null;
  donGia: number | null;
  soLuong: number | null;
  soTien: number | null;
  maDTCP: string | null;
  ghiChu: string | null;
  rowHash: string;
}

export interface KetQuaKiemTra {
  doc: KetQuaDoc;
  dong: DongDaChuan[];
  loi: LoiDong[];
  tomTat: {
    tongDong: number;
    dongCoSoTien: number;
    dongHopLe: number;
    dongLoi: number;
    soError: number;
    soWarning: number;
  };
  /** Lỗi ở mức cấu trúc file, không gắn với dòng nào. */
  loiCauTruc: { maLoi: string; mucDo: MucDoLoi; thongDiep: string }[];
}

// ---------------------------------------------------------------- Chuẩn hóa giá trị
function chuoi(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

function soTien(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  // Chấp nhận "1.234.567", "1,234,567", "1 234 567", và dấu "-" nghĩa là 0.
  const s = String(v).trim();
  if (s === "-" || s === "—") return 0;
  const sach = s.replace(/[^\d,.\-]/g, "");
  if (!sach) return null;
  // Kiểu VN: dấu chấm phân nhóm nghìn, dấu phẩy phần thập phân.
  const n = Number(sach.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function ngayISO(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Serial date của Excel, gốc 1899-12-30.
    const ms = (v - 25569) * 86400 * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** "Tháng thực hiện" phải quy về yyyy-MM (0. CẤU HÌNH: luôn là ngày đầu tháng). */
function kyThang(v: unknown): string | null {
  const iso = ngayISO(v);
  if (iso) return iso.slice(0, 7);
  const s = chuoi(v);
  if (!s) return null;
  const m1 = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, "0")}`;
  const m2 = s.match(/^(?:T|tháng\s*)?(\d{1,2})[/.](\d{4})$/i);
  if (m2) return `${m2[2]}-${m2[1].padStart(2, "0")}`;
  return null;
}

function bam(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (((h2 >>> 0) * 4294967296 + (h1 >>> 0)) >>> 0).toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------- Bộ kiểm tra
export interface NguCanh {
  /** Mã hợp lệ trong danh mục công ty. */
  maHopLe: Set<string>;
  /** Mã được phép ghi giao dịch trực tiếp (§3.4). */
  maNhapTrucTiep: Set<string>;
  /** Mã công trình có trong danh mục. */
  congTrinhHopLe: Set<string>;
  /** Hash các giao dịch đã ghi sổ, để chống nhập trùng (§11.3). */
  hashDaCo: Set<string>;
  /** Các kỳ đã khóa sổ. */
  kyDaKhoa: Set<string>;
}

export function kiemTra(doc: KetQuaDoc, nc: NguCanh): KetQuaKiemTra {
  const loi: LoiDong[] = [];
  const dong: DongDaChuan[] = [];
  const loiCauTruc: KetQuaKiemTra["loiCauTruc"] = [];

  // ---- Kiểm tra cấu trúc ----
  for (const m of doc.loiCauTruc) {
    loiCauTruc.push({ maLoi: "CAU_TRUC", mucDo: "Warning", thongDiep: m });
  }
  if (doc.cotThieu.length) {
    loiCauTruc.push({
      maLoi: "THIEU_COT",
      mucDo: doc.cotThieu.some((c) => c === "Số tiền" || c === "Mã công trình") ? "Error" : "Warning",
      thongDiep: `Thiếu ${doc.cotThieu.length}/${COT_CHUAN.length} cột chuẩn: ${doc.cotThieu.join(", ")}.`,
    });
  }
  if (doc.cotBoQua.length) {
    loiCauTruc.push({
      maLoi: "COT_THUA",
      mucDo: "Information",
      thongDiep: `Bỏ qua ${doc.cotBoQua.length} cột ngoài 15 cột chuẩn: ${doc.cotBoQua.slice(0, 12).join(", ")}${doc.cotBoQua.length > 12 ? "…" : ""}.`,
    });
  }

  const hashTrongFile = new Map<string, number>();

  for (const d of doc.dong) {
    const g = d.giaTri;
    const tien = soTien(g["Số tiền"]);
    const maCT = chuoi(g["Mã công trình"]);
    const ky = kyThang(g["Tháng thực hiện"]);
    const ma = chuoi(g["Mã DT–CP"]);
    const nd = chuoi(g["Nội dung thanh toán"]);
    const ngayCT = ngayISO(g["Ngày chứng từ"]);
    const soHD = chuoi(g["Số hóa đơn"]);
    const dg = soTien(g["Đơn giá"]);
    const sl = soTien(g["Số lượng"]);
    const tuanRaw = soTien(g["Tuần thực hiện"]);

    const them = (
      cot: TenCot | null,
      maLoi: string,
      mucDo: MucDoLoi,
      thongDiep: string,
      cachXuLy: string
    ) => loi.push({ dongExcel: d.dongExcel, cot, maLoi, mucDo, thongDiep, cachXuLy });

    // Các luật gốc chỉ áp cho dòng CÓ SỐ TIỀN — đúng như sheet KIỂM TRA INPUT.
    const coTien = tien !== null && tien !== 0;

    if (coTien) {
      if (!maCT)
        them("Mã công trình", "THIEU_CT", "Error", "Dòng có số tiền nhưng trống Mã công trình.", "Bổ sung mã công trình ở file nguồn.");
      else if (nc.congTrinhHopLe.size && !nc.congTrinhHopLe.has(maCT))
        them("Mã công trình", "CT_NGOAI_DM", "Error", `Mã công trình "${maCT}" không có trong danh mục.`, "Kiểm tra lại mã hoặc bổ sung công trình vào danh mục.");

      if (!ky)
        them("Tháng thực hiện", "THIEU_THANG", "Error", "Dòng có số tiền nhưng trống Tháng thực hiện.", "Nhập ngày đầu tháng vào cột Tháng thực hiện.");
      else if (nc.kyDaKhoa.has(ky))
        them("Tháng thực hiện", "KY_DA_KHOA", "Error", `Kỳ ${ky} đã khóa sổ.`, "Đề nghị mở kỳ theo quy trình trước khi nhập.");

      if (!ma)
        them("Mã DT–CP", "THIEU_MA", "Error", "Dòng có số tiền nhưng trống Mã doanh thu – chi phí.", "Chọn mã trong danh mục của công ty.");
      else if (!nc.maHopLe.has(ma))
        them("Mã DT–CP", "MA_NGOAI_DM", "Error", `Mã "${ma}" không tồn tại trong danh mục.`, "Sửa về mã hợp lệ; không tự đặt mã mới.");
      else if (!nc.maNhapTrucTiep.has(ma))
        them("Mã DT–CP", "MA_KHONG_NHAP_TRUC_TIEP", "Error", `Mã "${ma}" là mã nhóm, không được ghi giao dịch trực tiếp.`, "Chọn mã con cấp dưới.");

      if (!nd)
        them("Nội dung thanh toán", "THIEU_ND", "Warning", "Dòng có số tiền nhưng trống Nội dung thanh toán.", "Bổ sung diễn giải để truy vết được.");

      if (!ngayCT && !soHD)
        them("Số hóa đơn", "THIEU_CHUNG_TU", "Warning", "Trống cả Ngày chứng từ và Số hóa đơn.", "Bổ sung chứng từ hoặc ghi chú lý do.");
    }

    if (tien === null && Object.values(g).some((v) => v !== null && v !== ""))
      them("Số tiền", "TIEN_KHONG_HOP_LE", "Warning", "Không đọc được Số tiền thành số.", "Kiểm tra định dạng ô, bỏ ký tự lạ.");

    if (tuanRaw !== null && (tuanRaw < 1 || tuanRaw > 53))
      them("Tuần thực hiện", "TUAN_NGOAI_PHAM_VI", "Warning", `Tuần thực hiện "${tuanRaw}" nằm ngoài 1–53.`, "Sửa về số tuần hợp lệ.");

    if (dg !== null && sl !== null && tien !== null && Math.abs(dg * sl - tien) > 1)
      them(null, "SAI_TICH", "Warning", "Đơn giá × Số lượng không khớp Số tiền.", "Kiểm tra lại đơn giá, số lượng hoặc số tiền.");

    const hash = bam(`${maCT}|${ngayCT}|${soHD}|${ma}|${tien}|${nd}`);

    if (coTien) {
      if (nc.hashDaCo.has(hash))
        them(null, "TRUNG_DA_GHI_SO", "Error", "Trùng với giao dịch đã ghi sổ (cùng công trình, ngày, số HĐ, mã và số tiền).", "Xóa dòng trùng, hoặc xác nhận là phát sinh riêng bằng cách ghi rõ ở Ghi chú.");
      const truocDo = hashTrongFile.get(hash);
      if (truocDo)
        them(null, "TRUNG_TRONG_FILE", "Error", `Trùng với dòng ${truocDo} trong cùng file này.`, "Xóa một trong hai dòng.");
      else hashTrongFile.set(hash, d.dongExcel);
    }

    dong.push({
      dongExcel: d.dongExcel,
      maCongTrinh: maCT,
      tenCongTrinh: chuoi(g["Tên công trình"]),
      soHoaDon: soHD,
      ngayChungTu: ngayCT,
      thangThucHien: ky,
      tuanThucHien: tuanRaw !== null ? Math.round(tuanRaw) : null,
      noiDungThanhToan: nd,
      dvt: chuoi(g["ĐVT"]),
      donGia: dg,
      soLuong: sl,
      soTien: tien,
      maDTCP: ma,
      ghiChu: chuoi(g["Ghi chú"]),
      rowHash: hash,
    });
  }

  const dongLoiSet = new Set(loi.filter((l) => l.mucDo === "Error").map((l) => l.dongExcel));
  const dongCoSoTien = dong.filter((d) => d.soTien !== null && d.soTien !== 0).length;

  return {
    doc,
    dong,
    loi,
    tomTat: {
      tongDong: dong.length,
      dongCoSoTien,
      dongHopLe: dong.length - dongLoiSet.size,
      dongLoi: dongLoiSet.size,
      soError: loi.filter((l) => l.mucDo === "Error").length,
      soWarning: loi.filter((l) => l.mucDo === "Warning").length,
    },
    loiCauTruc,
  };
}
