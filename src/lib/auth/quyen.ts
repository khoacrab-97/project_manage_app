/**
 * Vai trò và phạm vi truy cập.
 *
 * NGUYÊN TẮC: lọc phạm vi phải nằm trong repository, KHÔNG đặt ở component —
 * đặt ở component thì chỉ cần sót một trang là lộ dữ liệu.
 */
export const VAI_TRO = {
  ADMIN: "Quản trị hệ thống",
  BAN_GIAM_DOC: "Ban Giám đốc",
  CHI_HUY_TRUONG: "Chỉ huy trưởng",
  CHUYEN_VIEN_CAO: "Chuyên viên bậc cao",
  CAN_BO_KY_THUAT: "Cán bộ kỹ thuật",
  THU_KY: "Thư ký / trợ lý",
} as const;

export type VaiTro = keyof typeof VAI_TRO;

export const DS_VAI_TRO = Object.keys(VAI_TRO) as VaiTro[];

export interface NguoiDung {
  id: string;
  email: string;
  hoTen: string;
  vaiTro: VaiTro;
  /** Mã công trình được giao. Rỗng nghĩa là chưa gán công trình nào. */
  phamVi: string[];
}

/**
 * Vai trò thấy toàn công ty, không giới hạn theo công trình.
 * Chuyên viên bậc cao và Cán bộ kỹ thuật CỐ Ý không nằm ở đây — họ chỉ thấy
 * công trình được phân công.
 */
const TOAN_CONG_TY: VaiTro[] = ["ADMIN", "BAN_GIAM_DOC", "THU_KY"];

/**
 * Danh sách mã công trình người dùng được phép thấy.
 * Trả `null` nghĩa là KHÔNG giới hạn (toàn công ty).
 * Trả `[]` khi chưa đăng nhập — đóng chặt, không phải mở toang.
 */
export function phamViCongTrinh(u: NguoiDung | null): string[] | null {
  if (!u) return [];
  if (TOAN_CONG_TY.includes(u.vaiTro)) return null;
  return u.phamVi;
}

export type HanhDong =
  | "xem"
  | "sua_danh_muc"
  | "tao_cong_trinh"
  | "sua_ke_hoach"
  | "nhap_du_lieu"
  | "nhap_boq"
  | "quan_tri_nguoi_dung";

/**
 * Ai được làm gì.
 *
 * `sua_ke_hoach` để CHỈ ADMIN vì công ty chưa chốt vai trò nào được sửa ngân
 * sách. Đây là lựa chọn đóng chặt có chủ ý: mở nhầm thì có người sửa được ngân
 * sách, đóng nhầm thì chỉ bất tiện.
 */
const QUYEN: Record<HanhDong, VaiTro[]> = {
  xem: DS_VAI_TRO,
  sua_danh_muc: ["ADMIN"],
  tao_cong_trinh: ["ADMIN"],
  sua_ke_hoach: ["ADMIN"],
  nhap_du_lieu: ["ADMIN", "CHI_HUY_TRUONG", "CHUYEN_VIEN_CAO", "CAN_BO_KY_THUAT", "THU_KY"],
  // Nhập khối lượng BOQ: đúng ba vai trò hiện trường. THU_KY CỐ Ý không có —
  // khác với nhap_du_lieu, đây là số liệu kỹ thuật phải do người ngoài công trường ghi.
  nhap_boq: ["ADMIN", "CHI_HUY_TRUONG", "CHUYEN_VIEN_CAO", "CAN_BO_KY_THUAT"],
  quan_tri_nguoi_dung: ["ADMIN"],
};

export function coQuyen(u: NguoiDung | null, hanhDong: HanhDong): boolean {
  if (!u) return false;
  return QUYEN[hanhDong].includes(u.vaiTro);
}

/** Ném lỗi nếu thiếu quyền — dùng ở đầu mỗi Server Action. */
export function batBuocQuyen(u: NguoiDung | null, hanhDong: HanhDong): void {
  if (!coQuyen(u, hanhDong)) {
    throw new Error(`Không đủ quyền thực hiện: ${hanhDong}`);
  }
}

/**
 * Vai trò này thấy mọi công trình hay chỉ những công trình được giao.
 * Dùng hàm này thay vì so sánh chuỗi hiển thị — đổi chữ trên giao diện sẽ không
 * làm hỏng logic.
 */
export function laTatCaCongTrinh(vaiTro: VaiTro): boolean {
  return TOAN_CONG_TY.includes(vaiTro);
}

/** Mô tả phạm vi để hiển thị trên màn hình quản trị. */
export function moTaPhamVi(vaiTro: VaiTro): string {
  return laTatCaCongTrinh(vaiTro) ? "Tất cả công trình" : "Công trình được giao";
}

// ============================================================================
// PHÂN QUYỀN THEO TAB — MODULE QUẢN LÝ CÔNG NHÂN
//
// "Người phụ trách" = CHT/CBKT/CVBC (có mặt tại công trình, chấm công).
// "Cán bộ quản lý" = người trong nhóm đó ĐƯỢC CỬ làm quản lý công nhân — suy từ
// cột Người quản lý của danh sách công nhân (`laCanBoQuanLyCN` ở data layer),
// KHÔNG phải cả vai trò. Chỉ cán bộ quản lý mới thao tác Hồ sơ + Phân công.
// Thư ký giữ Hồ sơ + Tổng hợp. ADMIN toàn quyền; Ban Giám đốc không thấy module.
// ============================================================================
export type MucCongNhan = "ho-so" | "phan-cong" | "cham-cong" | "tong-hop" | "doi-chieu";

/** Nhóm "Người phụ trách" — có mặt tại công trình. */
const NHOM_PHU_TRACH: VaiTro[] = ["CHI_HUY_TRUONG", "CAN_BO_KY_THUAT", "CHUYEN_VIEN_CAO"];

/**
 * Ai XEM được từng tab. `laCanBoQL` = người này có được cử làm cán bộ quản lý
 * công nhân không (tên nằm ở cột Người quản lý). ADMIN luôn thấy hết.
 */
export function xemTabCongNhan(
  u: NguoiDung | null,
  tab: MucCongNhan,
  laCanBoQL: boolean
): boolean {
  if (!u) return false;
  if (u.vaiTro === "ADMIN") return true;
  const phuTrach = NHOM_PHU_TRACH.includes(u.vaiTro);
  const thuKy = u.vaiTro === "THU_KY";
  if (tab === "ho-so") return phuTrach || thuKy;
  if (tab === "phan-cong") return laCanBoQL || thuKy;
  if (tab === "cham-cong") return phuTrach;
  if (tab === "tong-hop") return thuKy;
  return phuTrach; // doi-chieu
}

/** Ai THAO TÁC (ghi) được từng tab. Tổng hợp/Đối chiếu là báo cáo — không có ghi. */
export function thaoTacTabCongNhan(
  u: NguoiDung | null,
  tab: MucCongNhan,
  laCanBoQL: boolean
): boolean {
  if (!u) return false;
  if (u.vaiTro === "ADMIN") return true;
  const phuTrach = NHOM_PHU_TRACH.includes(u.vaiTro);
  const thuKy = u.vaiTro === "THU_KY";
  if (tab === "ho-so") return laCanBoQL || thuKy;
  if (tab === "phan-cong") return laCanBoQL;
  if (tab === "cham-cong") return phuTrach;
  if (tab === "tong-hop") return thuKy;
  return false; // doi-chieu — báo cáo
}

/** Có thấy module Quản lý công nhân không (ít nhất một tab, không phụ thuộc cử). */
export function xemModuleCongNhan(vaiTro: VaiTro): boolean {
  return vaiTro === "ADMIN" || NHOM_PHU_TRACH.includes(vaiTro) || vaiTro === "THU_KY";
}
