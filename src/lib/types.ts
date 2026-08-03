/**
 * Kiểu dữ liệu lõi — bám sát §9 của PLAN_XAY_DUNG_APP.
 * Đây là hợp đồng dữ liệu chung cho cả prototype (in-memory) và Phase 2 (Prisma).
 * Tên trường giữ tiếng Việt không dấu để khớp ngôn ngữ nghiệp vụ của người dùng.
 */

export type LoaiMa = "Doanh thu" | "Chi phí";

/** Danh mục mã doanh thu – chi phí (55 mã, nguồn: sheet DM_MA_DT_CP). */
export interface MaDTCP {
  ma: string;
  ten: string;
  loai: LoaiMa;
  /** Mã cha trong cây phân cấp 2 cấp; null nếu là mã gốc. */
  maCha: string | null;
  /** Mã nhóm (false) không được ghi giao dịch trực tiếp — quy tắc §3.4. */
  choPhepNhapTrucTiep: boolean;
}

/**
 * Chỉ hai trạng thái. "Đã nghiệm thu" = công trình hoàn thành: ĐÓNG BĂNG dữ liệu,
 * chỉ được xem, không thêm hay sửa bất cứ thứ gì nữa.
 */
export type TrangThaiDuAn = "Đang thi công" | "Đã nghiệm thu";

/** Danh mục công trình. */
export interface CongTrinh {
  id: string;
  maCongTrinh: string;
  tenCongTrinh: string;
  /** Tên rút gọn để nhận diện nhanh; rỗng thì dùng mã công trình. */
  tenRutGon: string;
  maBase: string | null;
  chuDauTu: string;
  chiHuyTruong: string;
  phongPhuTrach: string;
  ngayBatDau: string; // ISO yyyy-mm-dd
  ngayKetThucKeHoach: string;
  /** Ngày nghiệm thu thực tế; rỗng khi công trình chưa hoàn thành. */
  ngayHoanThanh: string;
  trangThai: TrangThaiDuAn;
  diaDiem: string;
  /** Biên lợi nhuận mục tiêu (0–1). Dùng cho quy tắc sức khỏe §4.2. */
  bienLNMucTieu: number;
  /** Ngày cập nhật dữ liệu gần nhất — cho chỉ số Data Freshness §21. */
  ngayCapNhatCuoi: string;
  /**
   * Hai trường dưới đây có mặt để form sửa công trình nạp lại được giá trị cũ.
   * Thiếu chúng thì mỗi lần sửa sẽ ghi đè bằng rỗng và mất dữ liệu.
   */
  giaTriHopDong: number | null;
  googleSheetUrl: string;
}

export type TrangThaiGhiSo = "CHINH_THUC" | "CHO_DUYET" | "LOI";

/** Sổ giao dịch chính thức — 15 cột nguồn + trường hệ thống (§9.4). */
export interface GiaoDich {
  id: string;
  sttNguon: number;
  maCongTrinh: string;
  tenCongTrinhNguon: string;
  maBase: string | null;
  soHoaDon: string | null;
  ngayChungTu: string | null; // ISO
  thangThucHien: string | null; // yyyy-mm (ngày đầu tháng theo 0. CẤU HÌNH)
  tuanThucHien: number | null;
  noiDungThanhToan: string;
  dvt: string | null;
  donGia: number | null;
  soLuong: number | null;
  soTien: number;
  maDTCP: string | null;
  ghiChu: string | null;
  // --- trường hệ thống ---
  importBatchId: string;
  sourceFileName: string;
  trangThai: TrangThaiGhiSo;
  /** Băm chống trùng §11.3. */
  rowHash: string;
}

/** Dòng kế hoạch / ngân sách (§8.4). */
export interface DongKeHoach {
  id: string;
  maCongTrinh: string;
  /** Mã theo hệ MỚI (đã qua crosswalk). null = chưa map được. */
  maDTCP: string | null;
  /** Mã gốc trong file KẾ HOẠCH TH (hệ cũ DA*). */
  maGoc: string;
  thang: string; // yyyy-mm
  giaTri: number;
  phienBan: number;
}

export type NguonMap = "auto" | "manual";

/** Ánh xạ hệ mã cũ (DA*) sang hệ mã mới (CP-*) — xử lý phát hiện §4. */
export interface AnhXaMa {
  maCu: string;
  tenCu: string;
  maMoi: string | null;
  nguonMap: NguonMap;
  daDuyet: boolean;
  ghiChu: string;
}

export type TrangThaiLoNhap =
  | "UPLOADED"
  | "VALIDATING"
  | "ERROR"
  | "READY_FOR_REVIEW"
  | "APPROVED"
  | "POSTED"
  | "REPLACED"
  | "CANCELLED";

/** Lô nhập dữ liệu (§8.2). */
export interface LoNhap {
  id: string;
  tenFile: string;
  hashFile: string;
  maCongTrinh: string | null;
  kyDuLieu: string | null;
  nguoiTai: string;
  thoiDiemTai: string; // ISO datetime
  soDong: number;
  soDongHopLe: number;
  soDongLoi: number;
  trangThai: TrangThaiLoNhap;
  nguoiDuyet: string | null;
  thoiDiemDuyet: string | null;
}

export type MucDoLoi = "Error" | "Warning" | "Information";

/** Lỗi dữ liệu theo dòng/cột (§8.3). */
export interface LoiDuLieu {
  id: string;
  importBatchId: string;
  /** Số dòng trong file nguồn (1-based, tính cả header). */
  dong: number;
  cot: string | null;
  maLoi: string;
  mucDo: MucDoLoi;
  thongDiep: string;
  cachXuLy: string;
}

/** Trạng thái khóa kỳ (§8.7) — schema sẵn, UI ở Phase 2. */
export interface KhoaKy {
  ky: string; // yyyy-mm
  daKhoa: boolean;
  nguoiKhoa: string | null;
  thoiDiemKhoa: string | null;
}

export type MucDoCanhBao = "P0" | "P1" | "P2";
export type TrangThaiCanhBao = "Mới" | "Đang xử lý" | "Đã giải trình" | "Đã đóng";

/** Cảnh báo ngoại lệ (§4.6). */
export interface CanhBao {
  id: string;
  loai: string;
  mucDo: MucDoCanhBao;
  maCongTrinh: string | null;
  tieuDe: string;
  moTa: string;
  trangThai: TrangThaiCanhBao;
  nguoiChiuTrachNhiem: string;
  ngayPhatSinh: string;
}

/** Đèn giao thông sức khỏe công trình (§4.2). */
export type SucKhoe = "Xanh" | "Vàng" | "Đỏ";
