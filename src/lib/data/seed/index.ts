/**
 * SINH BỘ DỮ LIỆU DEMO
 *
 * Nguyên tắc: KHÔNG bịa số tổng. Ma trận (mã DT–CP × công trình) được trích
 * nguyên từ sheet OUTPUT_NAM của file tổng hợp thật; seed chỉ "phân rã ngược"
 * mỗi ô tổng thành các giao dịch chi tiết.
 *
 * BẤT BIẾN BẮT BUỘC (có test kiểm chứng):
 *   SUM(giaoDich theo mã × công trình) === giá trị ô OUTPUT_NAM tương ứng
 *
 * Dòng LỖI được đưa vào vùng CHỜ XỬ LÝ (staging) riêng, KHÔNG vào sổ chính thức
 * — đúng tiêu chí §17.1 "Không ghi dữ liệu Error vào sổ chính thức". Nhờ vậy
 * việc cấy lỗi để demo không phá bất biến tổng.
 *
 * Toàn bộ sinh ngẫu nhiên dùng PRNG có seed cố định -> chạy lại luôn ra số cũ.
 */
import sourceData from "../source/source-data.json";
import { anhXa, bangAnhXa } from "../../crosswalk";
import { MA_DOANH_THU_DIEU_HANH, NAM_BAO_CAO, NGAY_HIEN_TAI, NGUONG } from "../../thresholds";
import type {
  AnhXaMa,
  CanhBao,
  CongTrinh,
  DongKeHoach,
  GiaoDich,
  LoNhap,
  LoiDuLieu,
  MaDTCP,
} from "../../types";
import {
  chonTheoMa,
  chuDauTuCua,
  DS_DIA_DIEM,
  DS_HO_TEN,
  DS_PHONG,
  tenCongTrinhCua,
} from "./danh-muc-cong-trinh";

// ---------------------------------------------------------------- PRNG
/** mulberry32 — nhỏ, nhanh, deterministic. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260720;

/** Băm chuỗi ổn định (không dùng node:crypto để an toàn khi bundle client). */
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

// ---------------------------------------------------------------- Nội dung tiếng Việt
/** Mẫu nội dung thanh toán theo mã, để dòng giao dịch đọc như thật. */
const NOI_DUNG: Record<string, string[]> = {
  Bill: ["Bill nội bộ khối lượng hoàn thành", "Xác nhận khối lượng nghiệm thu nội bộ"],
  "CP-001-1": ["Quà tặng tri ân chủ đầu tư", "Chi phí chăm sóc khách hàng đợt"],
  "CP-001-2": ["Chi phí chăm sóc khách hàng ngoài ngân sách"],
  "CP-002-1": ["Tiếp khách chủ đầu tư", "Chi phí ngoại giao công trình"],
  "CP-003-1": ["Lương Ban chỉ huy công trường tháng", "Phụ cấp Ban chỉ huy tháng"],
  "CP-003-2": ["Lương công nhân thi công tháng", "Thanh toán lương đội thi công tháng"],
  "CP-003-3": ["Lương tăng ca Ban chỉ huy tháng"],
  "CP-003-4": ["Lương tăng ca công nhân tháng"],
  "CP-005": ["Trích nộp BHXH, BHYT, BHTN tháng"],
  "CP-008": ["Chi thưởng lễ, tết cho công nhân"],
  "CP-018": ["Chi phí thí nghiệm vật liệu (1%)", "Kiểm định chất lượng vật liệu"],
  "CP-020-1": ["Chi phí giám sát công trình (1%)"],
  "CP-020-2": ["Chi phí theo sổ công trình (0,5%)"],
  "CP-020-3": ["Chi phí khác theo sổ (0,5%)"],
  "CP-021": ["Thuê xe vận chuyển rác thải xây dựng", "Thuê container chứa phế thải"],
  "CP-022": ["Chi phí truyền thông, marketing dự án"],
  "CP-023": ["Chi phí chưa phân bổ chờ xác định"],
  "041-1": ["Mua cây xanh, hoa kiểng đợt", "Cung cấp cây bóng mát và kiểng lá"],
  "041-2": ["Mua cây chống, con bọ, đai buộc", "Vật tư cây xanh phụ trợ"],
  "041-3": ["Mua đất trồng cây, giá thể", "Cung cấp đất màu trồng cây"],
  "041-4": ["Mua vật tư xây dựng (xi măng, cát, đá)", "Vật tư xây dựng bó vỉa"],
  "041-6": ["Mua vật tư hệ thống tưới tự động", "Ống PVC, béc tưới, van điện từ"],
  "041-7": ["Mua thiết bị chiếu sáng cảnh quan", "Đèn LED sân vườn và phụ kiện"],
  "041-8": ["Mua công cụ dụng cụ thi công", "Dụng cụ cầm tay phục vụ thi công"],
  "041-9": ["Mua phân bón chăm sóc cây"],
  "041-10": ["Mua thuốc bảo vệ thực vật"],
  "041-11": ["Vật tư khác phục vụ công trình"],
  "CP-042": ["Thanh toán chi phí thầu phụ"],
  "043-1": ["Khoán thi công hệ thống tưới đợt"],
  "043-2": ["Khoán trồng cây xanh, kiểng cỏ đợt"],
  "043-3": ["Khoán thi công phần xây dựng đợt"],
  "043-4": ["Khoán thi công hệ chiếu sáng đợt"],
  "043-5": ["Khoán thi công hạng mục khác đợt"],
  "CP-044": ["Chi phí lán trại, điện nước công trường", "Thuê container văn phòng công trường"],
  "045-1": ["Thuê xe cơ giới thi công", "Thuê xe cuốc, xe ben theo ca"],
  "045-2": ["Phân bổ chi phí xe cơ giới nội bộ"],
  "045-3": ["Chi phí xăng dầu xe cơ giới"],
  "CP-047": ["Phí bảo hiểm, bảo lãnh công trình (1%)"],
  "CP-054": ["Phân bổ chi phí xăng dầu cơ giới"],
};

const DVT_THEO_MA: Record<string, string[]> = {
  "041-1": ["cây", "chậu"],
  "041-2": ["bộ", "cái"],
  "041-3": ["m3", "bao"],
  "041-4": ["m3", "tấn"],
  "041-6": ["m", "bộ"],
  "041-7": ["bộ", "cái"],
  "041-8": ["cái", "bộ"],
  "041-9": ["kg", "bao"],
  "041-10": ["chai", "kg"],
  "045-1": ["ca", "ngày"],
};

// ---------------------------------------------------------------- Kiểu kết quả
export interface BoDuLieu {
  danhMucMa: MaDTCP[];
  congTrinh: CongTrinh[];
  /** Sổ chính thức — tổng khớp tuyệt đối OUTPUT_NAM. */
  giaoDich: GiaoDich[];
  /** Vùng chờ xử lý: dòng có lỗi, CHƯA vào sổ chính thức. */
  giaoDichChoXuLy: GiaoDich[];
  loiDuLieu: LoiDuLieu[];
  loNhap: LoNhap[];
  keHoach: DongKeHoach[];
  anhXaMa: AnhXaMa[];
  canhBao: CanhBao[];
  /** Ma trận gốc dùng để đối chiếu/nghiệm thu. */
  maTranGoc: { maCode: string; maCongTrinh: string; giaTri: number }[];
}

// ---------------------------------------------------------------- Sinh dữ liệu
/** Các tháng có phát sinh: T1..T7/2026 (dữ liệu nguồn là niên độ đang chạy). */
const CAC_THANG = Array.from({ length: 7 }, (_, i) => `${NAM_BAO_CAO}-${String(i + 1).padStart(2, "0")}`);
/** Trọng số theo tháng — thi công tăng dần giữa năm, thực tế hơn phân bổ đều. */
const TRONG_SO_THANG = [0.9, 0.8, 1.2, 1.35, 1.5, 1.4, 0.85];

export function taoBoDuLieu(): BoDuLieu {
  const rnd = prng(SEED);

  // ---- Danh mục mã (nguyên từ DM_MA_DT_CP) ----
  // TDA2 bị loại theo yêu cầu nghiệp vụ: nó là phân khúc doanh thu tư nhân /
  // nhà nước chứ không phải một mã hạch toán. Mã này chưa từng có giao dịch hay
  // dòng kế hoạch nào nên loại đi không mất số liệu.
  const danhMucMa: MaDTCP[] = sourceData.danhMucMa
    .filter((c) => c.ma !== "TDA2")
    .map((c) => ({
      ma: c.ma,
      ten: c.ten,
      loai: c.loai === "Doanh thu" ? "Doanh thu" : "Chi phí",
      maCha: c.maCha,
      choPhepNhapTrucTiep: c.choPhepNhapTrucTiep,
    }));
  const traMa = new Map(danhMucMa.map((c) => [c.ma, c]));

  // ---- Ma trận gốc, làm tròn về đồng nguyên ----
  const maTranGoc: { maCode: string; maCongTrinh: string; giaTri: number }[] = [];
  for (const hang of sourceData.maTranNam) {
    for (const [maCongTrinh, giaTri] of Object.entries(hang.byProject)) {
      maTranGoc.push({ maCode: hang.maCode, maCongTrinh, giaTri: Math.round(giaTri as number) });
    }
  }

  // ---- Danh mục công trình ----
  const dsMa: string[] = sourceData.congTrinh;
  const congTrinh: CongTrinh[] = dsMa.map((ma, i) => {
    /*
     * Tháng khởi công phải NẰM TRONG dải dữ liệu (CAC_THANG). Công thức cũ
     * `1 + (i % 10)` sinh ra cả tháng 8, 9, 10 — tức công trình khởi công sau
     * "hôm nay" của bộ dữ liệu mà vẫn mang đủ 7 tháng chi phí.
     */
    const thangBatDau = 1 + (i % CAC_THANG.length);
    const namBatDau = i % 3 === 0 ? NAM_BAO_CAO - 1 : NAM_BAO_CAO;
    // Công trình cập nhật gần đây trừ vài trường hợp cố tình để trễ -> có cảnh báo.
    const treNgay = i % 7 === 3 ? 40 : i % 5 === 2 ? 18 : 2 + (i % 6);
    const capNhat = new Date(NGAY_HIEN_TAI);
    capNhat.setDate(capNhat.getDate() - treNgay);
    return {
      id: `ct-${i + 1}`,
      maCongTrinh: ma,
      tenCongTrinh: tenCongTrinhCua(ma),
      tenRutGon: "",
      maBase: null,
      chuDauTu: chuDauTuCua(ma),
      chiHuyTruong: chonTheoMa(ma, DS_HO_TEN),
      phongPhuTrach: chonTheoMa(ma + "p", DS_PHONG),
      ngayBatDau: `${namBatDau}-${String(thangBatDau).padStart(2, "0")}-01`,
      ngayKetThucKeHoach: `${NAM_BAO_CAO + 1}-${String(1 + ((i + 5) % 12)).padStart(2, "0")}-28`,
      trangThai: i % 13 === 7 ? "Đã nghiệm thu" : "Đang thi công",
      // Ngày nghiệm thu chỉ có ở công trình đã hoàn thành; lấy mốc "hôm nay" của
      // bộ dữ liệu để biểu đồ có mốc cuối hợp lệ.
      ngayHoanThanh: i % 13 === 7 ? NGAY_HIEN_TAI : "",
      diaDiem: chonTheoMa(ma + "d", DS_DIA_DIEM),
      // Biên mục tiêu thực tế ngành 6–14%; toàn công ty đang ở 11,2% nên đặt
      // một dải quanh mức đó để danh mục có cả công trình đạt và chưa đạt.
      bienLNMucTieu: Math.round((0.06 + (i % 9) * 0.01) * 100) / 100,
      ngayCapNhatCuoi: capNhat.toISOString().slice(0, 10),
      // Dữ liệu gốc không có hai trường này; công trình cũ để trống, người dùng
      // tự bổ sung trên màn hình sửa công trình.
      giaTriHopDong: null,
      googleSheetUrl: "",
    };
  });

  // ---- Lô nhập: mỗi công trình 1 lô/tháng ----
  const loNhap: LoNhap[] = [];
  for (const ct of congTrinh) {
    for (const ky of CAC_THANG) {
      const id = `lo-${ct.maCongTrinh}-${ky}`;
      loNhap.push({
        id,
        tenFile: `MẪU DOANH THU - CHI PHÍ_${ct.maCongTrinh}_${ky}.xlsx`,
        hashFile: bam(id),
        maCongTrinh: ct.maCongTrinh,
        kyDuLieu: ky,
        nguoiTai: ct.chiHuyTruong,
        thoiDiemTai: `${ky}-28T09:15:00`,
        soDong: 0,
        soDongHopLe: 0,
        soDongLoi: 0,
        trangThai: "POSTED",
        nguoiDuyet: "Phòng Tài chính",
        thoiDiemDuyet: `${ky}-28T16:40:00`,
      });
    }
  }
  const traLo = new Map(loNhap.map((l) => [l.id, l]));

  // ---- Phân rã ngược ma trận thành giao dịch ----
  const giaoDich: GiaoDich[] = [];
  let stt = 0;

  for (const o of maTranGoc) {
    const ct = congTrinh.find((c) => c.maCongTrinh === o.maCongTrinh)!;
    const maInfo = traMa.get(o.maCode);
    const laDoanhThu = maInfo?.loai === "Doanh thu";

    // Số giao dịch tỷ lệ thô theo độ lớn của ô, kẹp trong [3, 40].
    const doLon = Math.abs(o.giaTri);
    const soGD = Math.max(3, Math.min(40, Math.round(3 + Math.log10(Math.max(doLon, 10)) * (2 + rnd() * 3))));

    // Trọng số ngẫu nhiên có thiên lệch theo tháng.
    const w: number[] = [];
    for (let i = 0; i < soGD; i++) {
      const thangIdx = i % CAC_THANG.length;
      w.push((0.4 + rnd()) * TRONG_SO_THANG[thangIdx]);
    }
    const tongW = w.reduce((a, b) => a + b, 0);

    let daPhan = 0;
    for (let i = 0; i < soGD; i++) {
      const cuoi = i === soGD - 1;
      // Dòng cuối hấp thụ phần dư -> tổng khớp TUYỆT ĐỐI.
      const soTien = cuoi ? o.giaTri - daPhan : Math.round((o.giaTri * w[i]) / tongW);
      daPhan += soTien;
      if (soTien === 0 && !cuoi) continue;

      const thangIdx = i % CAC_THANG.length;
      /*
       * Giao dịch không thể phát sinh trước khi khởi công: phần rơi vào trước
       * tháng khởi công được dồn về chính tháng khởi công. Tổng theo mã × công
       * trình không đổi nên bất biến đối chiếu OUTPUT_NAM vẫn giữ.
       */
      const thangKhoiCong = ct.ngayBatDau.slice(0, 7);
      const kyTho = CAC_THANG[thangIdx];
      const ky = kyTho < thangKhoiCong ? thangKhoiCong : kyTho;
      const ngayTrongThang = 1 + Math.floor(rnd() * 27);
      const ngayCT = `${ky}-${String(ngayTrongThang).padStart(2, "0")}`;
      const tuan = Math.min(5, Math.ceil(ngayTrongThang / 7));

      const mauND = NOI_DUNG[o.maCode] ?? [maInfo?.ten ?? "Chi phí phát sinh"];
      // Nhãn tháng lấy theo `ky` đã kẹp, không theo chỉ số vòng lặp — nếu không
      // sẽ có dòng ghi "tháng 1" mà kỳ thực hiện là tháng 5.
      const noiDung = `${mauND[Math.floor(rnd() * mauND.length)]} ${Number(ky.slice(5))}/${ky.slice(0, 4)}`;

      // Đơn giá × Số lượng = Số tiền (khi có ĐVT).
      const dsDvt = DVT_THEO_MA[o.maCode];
      let dvt: string | null = null;
      let soLuong: number | null = null;
      let donGia: number | null = null;
      if (dsDvt && soTien > 0) {
        dvt = dsDvt[Math.floor(rnd() * dsDvt.length)];
        const sl = 1 + Math.floor(rnd() * 200);
        if (soTien % sl === 0) {
          soLuong = sl;
          donGia = soTien / sl;
        } else {
          soLuong = 1;
          donGia = soTien;
        }
      }

      const loId = `lo-${o.maCongTrinh}-${ky}`;
      const lo = traLo.get(loId);
      if (lo) {
        lo.soDong++;
        lo.soDongHopLe++;
      }

      stt++;
      const soHoaDon = laDoanhThu ? null : `HD${String(100000 + Math.floor(rnd() * 899999))}`;
      giaoDich.push({
        id: `gd-${stt}`,
        sttNguon: stt,
        maCongTrinh: o.maCongTrinh,
        tenCongTrinhNguon: ct.tenCongTrinh,
        maBase: null,
        soHoaDon,
        ngayChungTu: ngayCT,
        thangThucHien: ky,
        tuanThucHien: tuan,
        noiDungThanhToan: noiDung,
        dvt,
        donGia,
        soLuong,
        soTien,
        maDTCP: o.maCode,
        ghiChu: null,
        importBatchId: loId,
        sourceFileName: lo?.tenFile ?? "không rõ",
        trangThai: "CHINH_THUC",
        rowHash: bam(`${o.maCongTrinh}|${ngayCT}|${soHoaDon}|${o.maCode}|${soTien}|${noiDung}`),
      });
    }
  }

  // ---- Vùng CHỜ XỬ LÝ: dòng lỗi để demo Kiểm tra dữ liệu (KHÔNG vào sổ) ----
  const giaoDichChoXuLy: GiaoDich[] = [];
  const loiDuLieu: LoiDuLieu[] = [];
  const loChoXuLy: LoNhap[] = [];
  let sttLoi = 0;

  const themLoi = (
    gd: GiaoDich,
    maLoi: string,
    cot: string | null,
    mucDo: LoiDuLieu["mucDo"],
    thongDiep: string,
    cachXuLy: string
  ) => {
    loiDuLieu.push({
      id: `loi-${loiDuLieu.length + 1}`,
      importBatchId: gd.importBatchId,
      dong: gd.sttNguon + 2,
      cot,
      maLoi,
      mucDo,
      thongDiep,
      cachXuLy,
    });
  };

  // Mỗi công trình có 1 lô "đang chờ xử lý" với vài dòng lỗi kiểu thật.
  const KICH_BAN = [
    { maLoi: "THIEU_THANG", cot: "Tháng thực hiện", mucDo: "Error" as const, td: "Dòng có số tiền nhưng trống Tháng thực hiện.", xl: "Nhập ngày đầu tháng vào cột G ở file nguồn." },
    { maLoi: "THIEU_MA", cot: "Mã DT–CP", mucDo: "Error" as const, td: "Dòng có số tiền nhưng trống Mã doanh thu – chi phí.", xl: "Chọn mã trong danh mục 55 mã của công ty." },
    { maLoi: "THIEU_CHUNG_TU", cot: "Số hóa đơn", mucDo: "Warning" as const, td: "Trống cả Ngày chứng từ và Số hóa đơn.", xl: "Bổ sung chứng từ hoặc ghi chú lý do." },
    { maLoi: "MA_NGOAI_DM", cot: "Mã DT–CP", mucDo: "Error" as const, td: "Mã không tồn tại trong danh mục công ty.", xl: "Sửa về mã hợp lệ; không tự đặt mã mới." },
    { maLoi: "MA_KHONG_NHAP_TRUC_TIEP", cot: "Mã DT–CP", mucDo: "Error" as const, td: "Mã nhóm không được ghi giao dịch trực tiếp.", xl: "Chọn mã con cấp dưới." },
    { maLoi: "TRUNG_DONG", cot: null, mucDo: "Error" as const, td: "Trùng với giao dịch đã ghi sổ (cùng công trình, ngày, số HĐ, mã và số tiền).", xl: "Xóa dòng trùng hoặc xác nhận là phát sinh riêng." },
  ];

  for (const [idx, ct] of congTrinh.entries()) {
    if (idx % 2 === 1) continue; // chỉ ~1/2 công trình có lô chờ xử lý
    const ky = CAC_THANG[CAC_THANG.length - 1];
    const loId = `lo-cho-${ct.maCongTrinh}`;
    const lo: LoNhap = {
      id: loId,
      tenFile: `MẪU DOANH THU - CHI PHÍ_${ct.maCongTrinh}_${ky}.xlsx`,
      hashFile: bam(loId),
      maCongTrinh: ct.maCongTrinh,
      kyDuLieu: ky,
      nguoiTai: ct.chiHuyTruong,
      thoiDiemTai: `${ky}-30T11:05:00`,
      soDong: 0,
      soDongHopLe: 0,
      soDongLoi: 0,
      trangThai: "ERROR",
      nguoiDuyet: null,
      thoiDiemDuyet: null,
    };

    const soKichBan = 1 + (idx % 3);
    for (let k = 0; k < soKichBan; k++) {
      const kb = KICH_BAN[(idx + k) % KICH_BAN.length];
      sttLoi++;
      const soTien = Math.round((1 + rnd() * 90) * 1_000_000);
      const gd: GiaoDich = {
        id: `gdx-${sttLoi}`,
        sttNguon: sttLoi,
        maCongTrinh: ct.maCongTrinh,
        tenCongTrinhNguon: ct.tenCongTrinh,
        maBase: null,
        soHoaDon: `HD${String(100000 + Math.floor(rnd() * 899999))}`,
        ngayChungTu: `${ky}-15`,
        thangThucHien: ky,
        tuanThucHien: 3,
        noiDungThanhToan: "Chi phí phát sinh cuối kỳ",
        dvt: null,
        donGia: null,
        soLuong: null,
        soTien,
        maDTCP: "041-1",
        ghiChu: null,
        importBatchId: loId,
        sourceFileName: lo.tenFile,
        trangThai: "LOI",
        rowHash: "",
      };

      // Áp kịch bản lỗi lên dòng.
      switch (kb.maLoi) {
        case "THIEU_THANG":
          gd.thangThucHien = null;
          break;
        case "THIEU_MA":
          gd.maDTCP = null;
          break;
        case "THIEU_CHUNG_TU":
          gd.soHoaDon = null;
          gd.ngayChungTu = null;
          break;
        case "MA_NGOAI_DM":
          gd.maDTCP = "CP-999";
          break;
        case "MA_KHONG_NHAP_TRUC_TIEP":
          gd.maDTCP = "CP-041";
          break;
        case "TRUNG_DONG": {
          const goc = giaoDich.find((g) => g.maCongTrinh === ct.maCongTrinh);
          if (goc) {
            gd.soHoaDon = goc.soHoaDon;
            gd.ngayChungTu = goc.ngayChungTu;
            gd.thangThucHien = goc.thangThucHien;
            gd.maDTCP = goc.maDTCP;
            gd.soTien = goc.soTien;
            gd.noiDungThanhToan = goc.noiDungThanhToan;
            gd.rowHash = goc.rowHash;
          }
          break;
        }
      }
      if (!gd.rowHash) {
        gd.rowHash = bam(
          `${gd.maCongTrinh}|${gd.ngayChungTu}|${gd.soHoaDon}|${gd.maDTCP}|${gd.soTien}|${gd.noiDungThanhToan}`
        );
      }

      giaoDichChoXuLy.push(gd);
      themLoi(gd, kb.maLoi, kb.cot, kb.mucDo, kb.td, kb.xl);
      lo.soDong++;
      lo.soDongLoi++;
    }
    loChoXuLy.push(lo);
  }

  // ---- Kế hoạch: từ KẾ HOẠCH TH (hệ DA*) qua crosswalk ----
  const anhXaMa = bangAnhXa();
  const keHoach: DongKeHoach[] = [];
  const tongThucHienTheoCT = new Map<string, number>();
  for (const g of giaoDich) {
    const info = traMa.get(g.maDTCP ?? "");
    if (info?.loai !== "Chi phí") continue;
    tongThucHienTheoCT.set(g.maCongTrinh, (tongThucHienTheoCT.get(g.maCongTrinh) ?? 0) + g.soTien);
  }

  // File KẾ HOẠCH TH chỉ có 1 bộ kế hoạch mẫu; phân bổ cho từng công trình theo
  // quy mô chi phí thực hiện để so sánh KH–TH có ý nghĩa.
  const tongKHGoc = sourceData.keHoachHeMaCu
    .filter((p) => !["TDA", "TDA1", "TDA2", "TDA3"].includes(p.maCu))
    .reduce((a, p) => a + p.keHoachTong, 0);

  let khId = 0;
  const daXetMaCu = new Set<string>();
  for (const [idxCT, ct] of congTrinh.entries()) {
    const thucHien = tongThucHienTheoCT.get(ct.maCongTrinh) ?? 0;
    if (thucHien === 0) continue;
    /**
     * Hệ số ngân sách = ngân sách duyệt / chi phí đã thực hiện.
     * >1 nghĩa là còn dư ngân sách. Phân bổ có chủ đích để danh mục demo phản
     * ánh thực tế: đa số công trình còn ngân sách, một nhóm nhỏ đã vượt.
     * Khoảng 1/6 công trình vượt ngân sách -> đèn Đỏ.
     */
    const heSo = idxCT % 6 === 2 ? 0.86 + (idxCT % 3) * 0.04 : 1.06 + ((idxCT * 7) % 30) / 100;
    const nganSach = thucHien * heSo;

    daXetMaCu.clear();
    for (const p of sourceData.keHoachHeMaCu) {
      if (["TDA", "TDA1", "TDA2", "TDA3"].includes(p.maCu)) continue;
      if (p.keHoachTong <= 0) continue;
      if (daXetMaCu.has(p.maCu)) continue;
      daXetMaCu.add(p.maCu);

      const tyTrong = p.keHoachTong / tongKHGoc;
      const giaTriNam = nganSach * tyTrong;
      const maMoi = anhXa(p.maCu);

      for (const [i, ky] of CAC_THANG.entries()) {
        khId++;
        keHoach.push({
          id: `kh-${khId}`,
          maCongTrinh: ct.maCongTrinh,
          maDTCP: maMoi,
          maGoc: p.maCu,
          thang: ky,
          giaTri: Math.round((giaTriNam * TRONG_SO_THANG[i]) / TRONG_SO_THANG.reduce((a, b) => a + b, 0)),
          phienBan: 1,
        });
      }
    }

    // Kế hoạch doanh thu: đặt theo biên lợi nhuận mục tiêu.
    const dtKeHoach = nganSach / (1 - ct.bienLNMucTieu);
    for (const [i, ky] of CAC_THANG.entries()) {
      khId++;
      keHoach.push({
        id: `kh-${khId}`,
        maCongTrinh: ct.maCongTrinh,
        maDTCP: MA_DOANH_THU_DIEU_HANH,
        maGoc: "TDA1",
        thang: ky,
        giaTri: Math.round((dtKeHoach * TRONG_SO_THANG[i]) / TRONG_SO_THANG.reduce((a, b) => a + b, 0)),
        phienBan: 1,
      });
    }
  }

  return {
    danhMucMa,
    congTrinh,
    giaoDich,
    giaoDichChoXuLy,
    loiDuLieu,
    loNhap: [...loNhap.filter((l) => l.soDong > 0), ...loChoXuLy],
    keHoach,
    anhXaMa,
    canhBao: [], // sinh động từ KPI trong repository
    maTranGoc,
  };
}
