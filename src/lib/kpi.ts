/**
 * Công thức KPI — bám đúng §21 của spec.
 * Hàm thuần, không phụ thuộc React/DB, để test được và tái dùng ở mọi trang.
 */
import { NGAY_HIEN_TAI, NGUONG } from "./thresholds";
import type { SucKhoe } from "./types";

/** Lợi nhuận gộp = Doanh thu thực hiện − Chi phí thực hiện. */
export function loiNhuanGop(doanhThu: number, chiPhi: number): number {
  return doanhThu - chiPhi;
}

/**
 * Biên lợi nhuận gộp = Lợi nhuận gộp / Doanh thu thực hiện.
 * Doanh thu = 0 -> null (KHÔNG phải 0). Hiển thị "—" thay vì "0%" để không
 * nhầm "chưa có doanh thu" thành "biên bằng không".
 */
export function bienLoiNhuan(doanhThu: number, chiPhi: number): number | null {
  if (!doanhThu) return null;
  return (doanhThu - chiPhi) / doanhThu;
}

/** Tỷ lệ hoàn thành doanh thu = DT lũy kế / DT kế hoạch lũy kế. */
export function tyLeHoanThanhDoanhThu(dtThucHien: number, dtKeHoach: number): number | null {
  if (!dtKeHoach) return null;
  return dtThucHien / dtKeHoach;
}

/** Tỷ lệ sử dụng ngân sách = CP lũy kế / CP kế hoạch. */
export function tyLeSuDungNganSach(cpThucHien: number, cpKeHoach: number): number | null {
  if (!cpKeHoach) return null;
  return cpThucHien / cpKeHoach;
}

/** Chênh lệch chi phí = Kế hoạch − Thực hiện (dương = tiết kiệm). */
export function chenhLechChiPhi(cpKeHoach: number, cpThucHien: number): number {
  return cpKeHoach - cpThucHien;
}

/**
 * Cost Progress Gap = Tỷ lệ sử dụng ngân sách − Tỷ lệ hoàn thành doanh thu.
 * Dương lớn = chi phí đang chạy nhanh hơn doanh thu.
 */
export function costProgressGap(
  tyLeNganSach: number | null,
  tyLeDoanhThu: number | null
): number | null {
  if (tyLeNganSach === null || tyLeDoanhThu === null) return null;
  return tyLeNganSach - tyLeDoanhThu;
}

/** Data Freshness = số ngày kể từ lần cập nhật gần nhất. */
export function soNgayChuaCapNhat(ngayCapNhatCuoi: string, homNay = NGAY_HIEN_TAI): number {
  const a = new Date(ngayCapNhatCuoi).getTime();
  const b = new Date(homNay).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Tỷ lệ % thay đổi so kỳ trước; kỳ trước = 0 -> null. */
export function bienDong(hienTai: number, truoc: number): number | null {
  if (!truoc) return null;
  return (hienTai - truoc) / Math.abs(truoc);
}

export interface DauVaoSucKhoe {
  doanhThu: number;
  chiPhi: number;
  cpKeHoach: number;
  dtKeHoach: number;
  ngayCapNhatCuoi: string;
  bienLNMucTieu: number;
  soLoiDuLieu: number;
}

export interface KetQuaSucKhoe {
  sucKhoe: SucKhoe;
  /** Các lý do dẫn tới màu hiện tại — hiển thị khi hover/drill. */
  lyDo: string[];
  bienLN: number | null;
  tyLeNganSach: number | null;
  tyLeDoanhThu: number | null;
  gap: number | null;
  ngayTre: number;
}

/**
 * Quy tắc đèn giao thông §4.2.
 * Đỏ: chi phí vượt kế hoạch, lợi nhuận âm, quá hạn cập nhật, hoặc gap rất lớn.
 * Vàng: chi phí chạy nhanh hơn doanh thu, biên dưới mục tiêu, báo cáo chậm, có lỗi.
 */
export function danhGiaSucKhoe(d: DauVaoSucKhoe): KetQuaSucKhoe {
  const bienLN = bienLoiNhuan(d.doanhThu, d.chiPhi);
  const tyLeNganSach = tyLeSuDungNganSach(d.chiPhi, d.cpKeHoach);
  const tyLeDoanhThu = tyLeHoanThanhDoanhThu(d.doanhThu, d.dtKeHoach);
  const gap = costProgressGap(tyLeNganSach, tyLeDoanhThu);
  const ngayTre = soNgayChuaCapNhat(d.ngayCapNhatCuoi);

  const lyDoDo: string[] = [];
  const lyDoVang: string[] = [];

  if (tyLeNganSach !== null && tyLeNganSach > NGUONG.tyLeNganSachDo) {
    lyDoDo.push("Chi phí thực hiện đã vượt ngân sách được duyệt");
  }
  if (d.doanhThu > 0 && loiNhuanGop(d.doanhThu, d.chiPhi) < 0) {
    lyDoDo.push("Lợi nhuận gộp đang âm");
  }
  if (ngayTre > NGUONG.soNgayTreDo) {
    lyDoDo.push(`Đã ${ngayTre} ngày không cập nhật dữ liệu`);
  }
  // Có chi phí nhưng chưa ghi nhận đồng doanh thu nào là trường hợp riêng, cần
  // nói thẳng thay vì gộp vào thông điệp "gap" khó hiểu. Đây là cảnh báo P0 #10.
  if (d.doanhThu === 0 && d.chiPhi > 0) {
    lyDoDo.push("Đã phát sinh chi phí nhưng chưa ghi nhận doanh thu nào");
  } else if (gap !== null && gap > NGUONG.costProgressGapDo) {
    lyDoDo.push("Chi phí chạy nhanh hơn doanh thu ở mức nghiêm trọng");
  }

  if (tyLeNganSach !== null && tyLeNganSach > NGUONG.tyLeNganSachVang) {
    lyDoVang.push("Đã dùng trên 90% ngân sách");
  }
  if (bienLN !== null && bienLN < d.bienLNMucTieu) {
    lyDoVang.push("Biên lợi nhuận thấp hơn mục tiêu");
  }
  if (gap !== null && gap > NGUONG.costProgressGapVang) {
    lyDoVang.push("Chi phí chạy nhanh hơn doanh thu");
  }
  if (ngayTre > NGUONG.soNgayTreVang) {
    lyDoVang.push(`Báo cáo chậm ${ngayTre} ngày`);
  }
  if (d.soLoiDuLieu > 0) {
    lyDoVang.push(`Còn ${d.soLoiDuLieu} dòng dữ liệu chưa xử lý`);
  }

  const sucKhoe: SucKhoe = lyDoDo.length ? "Đỏ" : lyDoVang.length ? "Vàng" : "Xanh";
  return {
    sucKhoe,
    lyDo: lyDoDo.length ? lyDoDo : lyDoVang,
    bienLN,
    tyLeNganSach,
    tyLeDoanhThu,
    gap,
    ngayTre,
  };
}

/** Màu Tailwind theo trạng thái sức khỏe — dùng chung để không lệch màu giữa các trang. */
export const MAU_SUC_KHOE: Record<SucKhoe, { nen: string; chu: string; cham: string }> = {
  Xanh: {
    nen: "bg-emerald-50 dark:bg-emerald-950/40",
    chu: "text-emerald-700 dark:text-emerald-300",
    cham: "bg-emerald-500",
  },
  "Vàng": {
    nen: "bg-amber-50 dark:bg-amber-950/40",
    chu: "text-amber-700 dark:text-amber-300",
    cham: "bg-amber-500",
  },
  "Đỏ": {
    nen: "bg-rose-50 dark:bg-rose-950/40",
    chu: "text-rose-700 dark:text-rose-300",
    cham: "bg-rose-500",
  },
};
