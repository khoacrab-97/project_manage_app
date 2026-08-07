/**
 * Kiểu đơn giá BOQ và các thành phần của nó.
 *
 * Đơn giá hợp đồng có thể là MỘT số (kiểu "DON", mặc định), hoặc TÁCH thành nhiều
 * thành phần cộng lại (vật tư, nhân công, máy…). Mỗi công trình chọn một kiểu; mọi
 * dòng BOQ của công trình đó dùng chung bộ cột thành phần.
 *
 * Đây là nguồn dùng chung cho cả server (repository, actions, parser) lẫn client
 * (form nhập, bảng hiển thị) — sửa một chỗ, mọi nơi khớp.
 */

/** Mã kiểu đơn giá — khớp giá trị lưu ở Project.kieuDonGiaBOQ. */
export type MaKieuDonGia = "DON" | "VT_VTK_NCMTC" | "VT_NCMTC" | "VT_NC_MTC" | "VT_NC";

/** Mã một thành phần đơn giá. */
export type MaThanhPhan = "VT" | "VTK" | "NC" | "MTC" | "NCMTC";

/** Tên đầy đủ từng thành phần (hiển thị tiêu đề cột). */
export const TEN_THANH_PHAN: Record<MaThanhPhan, string> = {
  VT: "Vật tư",
  VTK: "Vật tư khác",
  NC: "Nhân công",
  MTC: "Máy thi công",
  NCMTC: "Nhân công & Máy thi công",
};

/** Các thành phần của từng kiểu, theo đúng thứ tự hiển thị. DON = không tách. */
export const THANH_PHAN_THEO_KIEU: Record<MaKieuDonGia, MaThanhPhan[]> = {
  DON: [],
  VT_VTK_NCMTC: ["VT", "VTK", "NCMTC"],
  VT_NCMTC: ["VT", "NCMTC"],
  VT_NC_MTC: ["VT", "NC", "MTC"],
  VT_NC: ["VT", "NC"],
};

/** Nhãn kiểu để chọn trong thiết lập. */
export const TEN_KIEU: Record<MaKieuDonGia, string> = {
  DON: "Đơn giá đơn (một số)",
  VT_VTK_NCMTC: "Vật tư · Vật tư khác · Nhân công & Máy thi công",
  VT_NCMTC: "Vật tư · Nhân công & Máy thi công",
  VT_NC_MTC: "Vật tư · Nhân công · Máy thi công",
  VT_NC: "Vật tư · Nhân công",
};

/** Danh sách kiểu để dựng dropdown (giữ thứ tự). */
export const CAC_KIEU: MaKieuDonGia[] = ["DON", "VT_VTK_NCMTC", "VT_NCMTC", "VT_NC_MTC", "VT_NC"];

/** Chuẩn hoá chuỗi bất kỳ về một MaKieuDonGia hợp lệ (mặc định DON). */
export function kieuHopLe(raw: unknown): MaKieuDonGia {
  return CAC_KIEU.includes(raw as MaKieuDonGia) ? (raw as MaKieuDonGia) : "DON";
}

/** Tên field đơn giá thành phần trên BOQLine: VT → dgVT. */
export function truongDonGia(tp: MaThanhPhan): "dgVT" | "dgVTK" | "dgNC" | "dgMTC" | "dgNCMTC" {
  return `dg${tp}` as "dgVT" | "dgVTK" | "dgNC" | "dgMTC" | "dgNCMTC";
}

/** Tên field VAT thành phần trên Project: VT → vatVT. */
export function truongVAT(tp: MaThanhPhan): "vatVT" | "vatVTK" | "vatNC" | "vatMTC" | "vatNCMTC" {
  return `vat${tp}` as "vatVT" | "vatVTK" | "vatNC" | "vatMTC" | "vatNCMTC";
}
