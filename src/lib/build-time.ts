/**
 * Thời điểm tiến trình máy chủ khởi động (đánh giá một lần khi nạp module).
 *
 * Hiện trên giao diện để người vận hành TỰ KIỂM có đang chạy bản mới không: sau khi
 * `chay.cmd moi` (tắt bản cũ + chạy lại), mốc này phải đổi sang giờ hiện tại. Nếu
 * vẫn là giờ cũ nghĩa là tiến trình cũ chưa bị tắt — đang xem bản cũ.
 */
export const MAY_CHU_KHOI_DONG = new Date().toLocaleString("vi-VN", { hour12: false });
