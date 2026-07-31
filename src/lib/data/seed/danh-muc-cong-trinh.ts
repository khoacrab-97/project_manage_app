/**
 * Thông tin mô tả công trình.
 *
 * Mã công trình là THẬT (trích từ header OUTPUT_NAM của file tổng hợp).
 * Tên, chủ đầu tư, chỉ huy trưởng, ngày tháng là DỮ LIỆU DEMO — file Excel nguồn
 * không có danh mục công trình, đây chính là trường spec §8.1 yêu cầu bổ sung.
 */

export const CHU_DAU_TU: Record<string, string> = {
  BGT: "Ban Quản lý Dự án Đầu tư Xây dựng Công trình Giao thông",
  HL: "Nội bộ – Khối Hoa Lâm",
  BHT: "Ban QLDA Bình Hưng Tây",
  TSLA: "Công ty CP Đầu tư Tân Sơn Long An",
  TTTL: "Trung tâm Quản lý Hạ tầng Thủy lợi",
  KHL: "Nội bộ – Khối Hoa Lâm",
  "BGĐ": "Nội bộ – Ban Giám đốc",
  "DA-UBNDXCA": "UBND Xã Cần Ánh",
  SWIC: "Công ty CP Xây dựng SWIC",
  NPN: "Công ty TNHH Ngọc Phú Nam",
  BDS: "Tổng Công ty Bất động sản Miền Trung",
  CII: "Công ty CP Đầu tư Hạ tầng Kỹ thuật CII",
};

/** Gợi ý loại công việc theo hậu tố mã. */
const LOAI_CONG_VIEC: [RegExp, string][] = [
  [/HTT/, "hệ thống tưới"],
  [/CXHTT/, "cây xanh và hệ thống tưới"],
  [/CX/, "cây xanh"],
  [/XL/, "xây lắp"],
  [/TL/, "thủy lợi"],
  [/MT/, "mảng xanh môi trường"],
  [/SUKIEN/, "trang trí sự kiện"],
  [/PSBD/, "phát sinh bảo dưỡng"],
  [/HTK/, "hạ tầng kỹ thuật"],
  [/VHCT/, "vận hành công trình"],
  [/TC/, "thi công"],
  [/CC/, "chăm sóc cảnh quan"],
  [/NGT/, "nâng cấp giao thông"],
  [/TQH/, "trồng và quản lý hoa viên"],
  [/TKTQ/, "thiết kế tổng quan"],
  [/DQH/, "duy tu quy hoạch"],
  [/XDCQ/, "xây dựng cảnh quan"],
  [/TCX/, "trồng cây xanh"],
];

const DIA_DIEM = [
  "TP. Hồ Chí Minh",
  "Long An",
  "Bình Dương",
  "Đồng Nai",
  "Tây Ninh",
  "Bà Rịa – Vũng Tàu",
];

const HO_TEN = [
  "Nguyễn Văn Hải",
  "Trần Quốc Bảo",
  "Lê Minh Tuấn",
  "Phạm Thị Ngọc Lan",
  "Võ Thanh Sơn",
  "Đặng Hoài Nam",
  "Bùi Kim Anh",
  "Huỳnh Tấn Phát",
  "Ngô Gia Khiêm",
  "Đỗ Thị Mai Trâm",
  "Trương Công Định",
  "Lý Hoàng Long",
];

const PHONG = ["Phòng Dự án 1", "Phòng Dự án 2", "Phòng Cảnh quan", "Phòng Hạ tầng"];

/** Lấy tiền tố định danh chủ đầu tư từ mã công trình. */
export function tienTo(ma: string): string {
  const m = ma.trim();
  for (const k of Object.keys(CHU_DAU_TU).sort((a, b) => b.length - a.length)) {
    if (m.toUpperCase().startsWith(k.toUpperCase())) return k;
  }
  return m.split(/[-. ]/)[0];
}

export function chuDauTuCua(ma: string): string {
  return CHU_DAU_TU[tienTo(ma)] ?? "Chủ đầu tư khác";
}

export function tenCongTrinhCua(ma: string): string {
  const upper = ma.toUpperCase();
  const loai = LOAI_CONG_VIEC.find(([re]) => re.test(upper))?.[1] ?? "thi công hạ tầng";
  const cdt = tienTo(ma);
  if (cdt === "HL" || cdt === "KHL" || cdt === "BGĐ") {
    return `Công trình nội bộ ${ma} – ${loai}`;
  }
  return `Gói thầu ${loai} – ${ma}`;
}

/** Chọn phần tử theo mã (ổn định, không phụ thuộc thứ tự chạy). */
export function chonTheoMa<T>(ma: string, ds: readonly T[]): T {
  let h = 0;
  for (let i = 0; i < ma.length; i++) h = (h * 31 + ma.charCodeAt(i)) >>> 0;
  return ds[h % ds.length];
}

export const DS_HO_TEN = HO_TEN;
export const DS_PHONG = PHONG;
export const DS_DIA_DIEM = DIA_DIEM;
