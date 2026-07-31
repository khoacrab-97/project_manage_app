/**
 * ÁNH XẠ HỆ MÃ CŨ (DA*) → HỆ MÃ MỚI (CP-*)
 *
 * Bối cảnh: sheet `KẾ HOẠCH TH` dùng hệ mã cũ (DA0, DA2XD, DA4HTT…) trong khi
 * sheet thực hiện và danh mục `DM_MA_DT_CP` dùng hệ mới (CP-001, 041-4, 043-1…).
 * Không có bảng này thì mọi KPI "Kế hoạch vs Thực hiện" đều vô nghĩa.
 *
 * ⚠️ Toàn bộ ánh xạ dưới đây là SUY LUẬN THEO TÊN HẠNG MỤC, do máy đề xuất.
 * Tài chính phải rà và duyệt (cột `daDuyet`) trước khi số liệu được coi là chính thức.
 *
 * ⚠️ BẪY: mã `TDA2` tồn tại ở CẢ HAI hệ nhưng KHÁC NGHĨA —
 *    hệ cũ: "Doanh thu từ các DA tư nhân"; hệ mới: nhóm "DOANH THU".
 *    Không được coi đây là cùng một mã.
 */
import type { AnhXaMa } from "./types";
import sourceData from "./data/source/source-data.json";

type MapDef = { maMoi: string | null; ghiChu: string };

const CAN_TAI_CHINH_DUYET = "Máy đề xuất theo tên hạng mục — cần Tài chính rà.";

const BANG: Record<string, MapDef> = {
  // ----- DOANH THU: đổi CHIỀU phân loại, không phải đổi tên -----
  TDA: {
    maMoi: null,
    ghiChu:
      "Nhóm doanh thu tổng. Hệ cũ phân theo LOẠI KHÁCH HÀNG, hệ mới phân theo GIAI ĐOẠN THANH TOÁN. Không map vào TDA2 vì TDA2 hệ mới đã bị loại khỏi danh mục hạch toán.",
  },
  TDA1: {
    maMoi: "Bill",
    ghiChu:
      "⚠️ Khác chiều phân loại: 'DA nhà nước' (loại khách hàng) không tương đương mã nào theo giai đoạn thanh toán. Tạm quy về Bill nội bộ. CEO chốt tại §23 mục 2.",
  },
  TDA2: {
    maMoi: "Bill",
    ghiChu:
      "⚠️ TRÙNG KÝ HIỆU, KHÁC NGHĨA: TDA2 hệ cũ = 'DA tư nhân'; TDA2 hệ mới = nhóm 'DOANH THU'. Tuyệt đối không nối trực tiếp theo mã.",
  },
  TDA3: {
    maMoi: "Bill",
    ghiChu: "⚠️ 'Khác' — khác chiều phân loại, tạm quy về Bill nội bộ.",
  },

  // ----- LƯƠNG -----
  DA0: { maMoi: "CP-001-1", ghiChu: "Trùng tên 'Chi phí CSKH'." },
  DA1: {
    maMoi: "CP-003-1",
    ghiChu: "'CHI PHÍ LƯƠNG D.A' hiểu là lương Ban chỉ huy. Cần xác nhận có gồm công nhân không.",
  },
  DA3: { maMoi: "CP-003", ghiChu: "Nhóm 'NHÂN CÔNG' → nhóm 'CHI PHÍ LƯƠNG'." },
  DA3TC: { maMoi: "CP-003-2", ghiChu: "'lương Đội thi công' → 'lương công nhân'." },
  DA3DT: { maMoi: "CP-003-4", ghiChu: "'lương tăng cường' → 'lương công nhân - Tăng Ca'." },

  // ----- VẬT TƯ -----
  DA2: { maMoi: "CP-041", ghiChu: "Nhóm VẬT TƯ, trùng tên." },
  DA2XD: { maMoi: "041-4", ghiChu: "Trùng tên 'Vật tư Xây dựng'." },
  DA2TBTD: { maMoi: "041-5", ghiChu: "Trùng tên 'Vật tư thiết bị trò chơi/thể dục'." },
  DA2HTT: { maMoi: "041-6", ghiChu: "Trùng tên 'Vật tư Hệ thống tưới'." },
  DA2CS: { maMoi: "041-7", ghiChu: "Trùng tên 'Vật tư thiết bị Chiếu sáng'." },
  DA2CX: { maMoi: "041-1", ghiChu: "Trùng tên 'Vật tư cây xanh, hoa kiểng'." },
  DA2CXHL: {
    maMoi: "041-1",
    ghiChu: "⚠️ GỘP: hệ mới không tách nguồn 'vườn HL' — mất chi tiết nội bộ/mua ngoài.",
  },
  DA2CXMN: {
    maMoi: "041-1",
    ghiChu: "⚠️ GỘP: hệ mới không tách nguồn 'mua ngoài' — mất chi tiết nội bộ/mua ngoài.",
  },
  DA2CXK: { maMoi: "041-2", ghiChu: "Trùng tên 'Vật tư CX khác'." },
  DA2DAT: { maMoi: "041-3", ghiChu: "Trùng tên 'Vật tư Đất trồng cây'." },
  DA2CCDC: { maMoi: "041-8", ghiChu: "Trùng tên 'công cụ dụng cụ thi công'." },
  DA2PHAN: {
    maMoi: "041-9",
    ghiChu: "⚠️ Hệ mới TÁCH 041-9 (phân thuốc) và 041-10 (thuốc BVTV); hệ cũ gộp một dòng.",
  },
  DA2K: { maMoi: "041-11", ghiChu: "Trùng tên 'Vật tư khác'." },

  // ----- KHOÁN THI CÔNG -----
  DA4: { maMoi: "CP-043", ghiChu: "Nhóm KHOÁN THI CÔNG, trùng tên." },
  DA4HTT: { maMoi: "043-1", ghiChu: "Trùng tên 'Thầu phụ khoán Hệ thống tưới'." },
  DA4CX: { maMoi: "043-2", ghiChu: "Trùng tên 'Thầu phụ khoán Cây xanh, kiểng cỏ'." },
  DA4XD: { maMoi: "043-3", ghiChu: "Trùng tên 'Thầu phụ khoán Xây dựng'." },
  DA4CS: { maMoi: "043-4", ghiChu: "Trùng tên 'Thầu phụ khoán Chiếu sáng'." },
  DA4K: { maMoi: "043-5", ghiChu: "Trùng tên 'Thầu phụ khoán khác'." },

  // ----- CÒN LẠI -----
  DA5: { maMoi: "CP-044", ghiChu: "Trùng tên 'lán trại, container, điện nước'." },
  DA6: { maMoi: "CP-020", ghiChu: "Nhóm 'CHI PHÍ KHÁC', trùng tên." },
  DA6TN: {
    maMoi: "CP-018",
    ghiChu: "⚠️ ĐỔI CẤP: hệ cũ 'thí nghiệm' nằm trong nhóm CHI PHÍ KHÁC; hệ mới CP-018 đứng độc lập.",
  },
  DA6GS: { maMoi: "CP-020-1", ghiChu: "Trùng tên 'Chi phí Giám sát (1%)'." },
  DA6SCT: { maMoi: "CP-020-2", ghiChu: "Trùng tên 'theo sổ công trình (0,5%)'." },
  DA6XANG: {
    maMoi: "CP-054",
    ghiChu: "⚠️ ĐỔI CẤP: 'xăng dầu theo sổ CT' → CP-054 độc lập ở hệ mới.",
  },
  DA6K: { maMoi: "CP-020-3", ghiChu: "Trùng tên 'CP khác (0,5%)'." },
  DA7: { maMoi: "CP-045", ghiChu: "Nhóm 'MÁY MÓC THIẾT BỊ', trùng tên." },
  DA7TN: { maMoi: "045-1", ghiChu: "Trùng tên 'Chi phí thuê xe, cơ giới'." },
  DA7NB: { maMoi: "045-2", ghiChu: "Trùng tên 'phân bổ xe cơ giới nội bộ'." },
  DA8: { maMoi: "CP-002-1", ghiChu: "'TIẾP KHÁCH' → 'CP ngoại giao/tiếp khách'." },
  DA9: { maMoi: "CP-046", ghiChu: "Trùng tên 'CP AN NINH, GIAO THÔNG'." },
  DA10: { maMoi: "CP-047", ghiChu: "Trùng tên 'CP BẢO HIỂM, BẢO LÃNH CT'." },

  // ----- KHÔNG MAP ĐƯỢC -----
  DA11: {
    maMoi: null,
    ghiChu:
      "❌ 'TIỀN ĐB CQT BỊ CẮT TRỪ' không có mã tương ứng trong danh mục 55 mã. Cần Tài chính quyết: thêm mã mới hay gộp vào CP-020-3.",
  },
};

/** Bảng ánh xạ đầy đủ, dựng từ danh sách mã cũ có thật trong KẾ HOẠCH TH. */
export function bangAnhXa(): AnhXaMa[] {
  const daCo = new Set<string>();
  const kq: AnhXaMa[] = [];

  for (const dong of sourceData.keHoachHeMaCu) {
    const maCu = dong.maCu;
    if (daCo.has(maCu)) continue; // file nguồn có mã lặp (DA3DT, DA5, DA8…)
    daCo.add(maCu);

    const def = BANG[maCu];
    kq.push({
      maCu,
      tenCu: dong.ten,
      maMoi: def?.maMoi ?? null,
      nguonMap: "auto",
      daDuyet: false,
      ghiChu: def ? def.ghiChu : `❌ Chưa có đề xuất ánh xạ. ${CAN_TAI_CHINH_DUYET}`,
    });
  }
  return kq;
}

/** Tra nhanh mã cũ -> mã mới. Trả null nếu chưa map được. */
export function anhXa(maCu: string): string | null {
  return BANG[maCu]?.maMoi ?? null;
}
