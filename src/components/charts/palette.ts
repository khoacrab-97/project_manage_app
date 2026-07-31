/**
 * Bảng màu biểu đồ — ĐÃ QUA VALIDATOR, không sửa tay.
 *
 * Kiểm chứng bằng `scripts/validate_palette.js` của skill dataviz trên đúng nền
 * của app (light #ffffff, dark #141922):
 *   - 3 slot: PASS cả hai chế độ.
 *   - 8 slot: PASS cả hai chế độ (worst adjacent CVD ΔE 9.1 light / 8.4 dark).
 *   - Light mode có WARN tương phản ở magenta/vàng/aqua -> BẮT BUỘC áp dụng
 *     "relief rule": biểu đồ nào dùng các màu này phải kèm bảng số liệu hoặc
 *     nhãn trực tiếp. Đừng bỏ bảng đi cho gọn.
 *
 * Thứ tự slot là cơ chế an toàn cho người mù màu — gán theo thứ tự, KHÔNG xoay vòng.
 * Quá 8 nhóm thì gộp phần đuôi thành "Khác", không sinh thêm màu.
 */
export const SERIES_LIGHT = [
  "#2a78d6", // 1 xanh dương
  "#008300", // 2 xanh lá
  "#e87ba4", // 3 hồng sen
  "#eda100", // 4 vàng
  "#1baf7a", // 5 xanh ngọc
  "#eb6834", // 6 cam
  "#4a3aa7", // 7 tím
  "#e34948", // 8 đỏ
] as const;

export const SERIES_DARK = [
  "#3987e5",
  "#008300",
  "#d55181",
  "#c98500",
  "#199e70",
  "#d95926",
  "#9085e9",
  "#e66767",
] as const;

/** Trạng thái — KHÔNG bao giờ dùng làm màu series. Luôn đi kèm nhãn chữ. */
export const TRANG_THAI = {
  tot: "#0ca30c",
  canhBao: "#fab219",
  nghiemTrong: "#ec835a",
  nguyKich: "#d03b3b",
} as const;

export const CHROME_LIGHT = {
  luoi: "#e1e0d9",
  truc: "#c3c2b7",
  chuMo: "#898781",
  nen: "#ffffff",
};

export const CHROME_DARK = {
  luoi: "#2c2c2a",
  truc: "#383835",
  chuMo: "#898781",
  nen: "#141922",
};

export function bangMau(toi: boolean) {
  return toi ? SERIES_DARK : SERIES_LIGHT;
}

export function chrome(toi: boolean) {
  return toi ? CHROME_DARK : CHROME_LIGHT;
}

/** Số nhóm tối đa trước khi gộp "Khác". */
export const TOI_DA_NHOM = 8;
