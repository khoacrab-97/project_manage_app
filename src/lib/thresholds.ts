/**
 * Ngưỡng cảnh báo — TẬP TRUNG MỘT CHỖ.
 *
 * §6 của spec yêu cầu ngưỡng phải được CEO + Phòng Dự án + Tài chính thống nhất
 * trong workshop nghiệp vụ. Vì vậy tuyệt đối không rải hằng số này vào từng
 * component: khi công ty chốt lại ngưỡng, chỉ sửa đúng file này.
 */
export const NGUONG = {
  /** Biên lợi nhuận gộp mục tiêu mặc định (0–1) khi công trình chưa đặt riêng. */
  bienLNMucTieu: 0.15,

  /** Biên LN dưới mức này -> cảnh báo P0 "Biên lợi nhuận thấp". */
  bienLNToiThieu: 0.08,

  /** Tỷ lệ sử dụng ngân sách vượt mức này -> Đỏ. */
  tyLeNganSachDo: 1.0,

  /** Tỷ lệ sử dụng ngân sách vượt mức này -> Vàng. */
  tyLeNganSachVang: 0.9,

  /**
   * Cost Progress Gap = tỷ lệ dùng ngân sách − tỷ lệ hoàn thành doanh thu.
   * Dương lớn = chi phí chạy nhanh hơn doanh thu (§21).
   */
  costProgressGapVang: 0.1,
  costProgressGapDo: 0.25,

  /** Số ngày không cập nhật dữ liệu -> Vàng / Đỏ (Data Freshness §21). */
  soNgayTreVang: 15,
  soNgayTreDo: 35,

  /** Một mã chi phí chiếm quá tỷ trọng này trên tổng CP -> cảnh báo P0 #9. */
  tyTrongMaChiPhiToiDa: 0.25,

  /** Hạn công trình nộp dữ liệu (ngày của tháng kế tiếp) — §20. */
  ngayHanNopDuLieu: 2,
  /** Ngày khóa kỳ và phát hành báo cáo. */
  ngayKhoaKy: 5,
} as const;

/** Ngày chốt dữ liệu của bộ demo (dữ liệu nguồn là niên độ 2026). */
export const NGAY_HIEN_TAI = "2026-07-20";
export const NAM_BAO_CAO = 2026;

/**
 * Chỉ tiêu doanh thu dùng cho dashboard điều hành.
 *
 * §6.1 cấm cộng lẫn Tạm ứng / Thanh toán đợt / Quyết toán / Bill vì chúng
 * không đồng nghĩa. Bộ số liệu nguồn (OUTPUT_NAM) chỉ có phát sinh ở mã `Bill`,
 * nên mặc định lấy Bill nội bộ. CEO chốt lại ở workshop (§23 mục 2).
 */
export const MA_DOANH_THU_DIEU_HANH = "Bill";
