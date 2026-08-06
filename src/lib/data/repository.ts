/**
 * ★ RANH GIỚI DỮ LIỆU ★
 *
 * Toàn bộ UI chỉ đọc dữ liệu qua file này. Từ Phase 2, thân hàm truy vấn
 * qua Prisma; tên hàm và kiểu trả về giữ nguyên như bản prototype để các trang
 * không phải viết lại — chỉ thêm `await`.
 *
 * Dữ liệu tham chiếu (danh mục mã, công trình) dùng `cache()` của React: gọi bao
 * nhiêu lần trong một request cũng chỉ truy vấn một lần.
 */
import { cache } from "react";
import { db } from "../db";
import { nguoiDungHienTai } from "../auth/phien";
import { phamViCongTrinh } from "../auth/quyen";
import {
  bienLoiNhuan,
  danhGiaSucKhoe,
  loiNhuanGop,
  soNgayChuaCapNhat,
  tyLeHoanThanhDoanhThu,
  tyLeSuDungNganSach,
  type KetQuaSucKhoe,
} from "../kpi";
import { khoaQuy } from "../format";
import { MA_DOANH_THU_DIEU_HANH, NGUONG } from "../thresholds";
import type {
  CanhBao,
  CongTrinh,
  GiaoDich,
  LoNhap,
  LoaiMa,
  LoiDuLieu,
  MaDTCP,
  SucKhoe,
  TrangThaiDuAn,
} from "../types";

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

// ------------------------------------------------------------ Phạm vi truy cập
/**
 * Điều kiện lọc theo phạm vi của người đang đăng nhập.
 *
 * ĐẶT Ở ĐÂY, KHÔNG ĐẶT Ở COMPONENT. Mọi truy vấn công trình và giao dịch đều đi
 * qua hai chỗ dùng hàm này, nên không thể sót một trang nào — kể cả khi người dùng
 * gõ thẳng URL của công trình ngoài phạm vi.
 *
 * Trả `null` = không giới hạn (ADMIN, Ban Giám đốc, Tài chính).
 */
const phamViHienTai = cache(async (): Promise<string[] | null> => {
  const u = await nguoiDungHienTai();
  return phamViCongTrinh(u);
});

/** Điều kiện `where` cho bảng Project theo phạm vi. */
async function locProject() {
  const pv = await phamViHienTai();
  return pv === null ? {} : { maCongTrinh: { in: pv } };
}

/** Điều kiện `where` cho các bảng có `projectId` theo phạm vi. */
async function locTheoProjectId() {
  const pv = await phamViHienTai();
  if (pv === null) return {};
  const { maSangId } = await banDoCongTrinh();
  return { projectId: { in: pv.map((m) => maSangId.get(m)).filter(Boolean) as string[] } };
}

// ------------------------------------------------------------ Dữ liệu tham chiếu
export const layDanhMucMa = cache(async (): Promise<MaDTCP[]> => {
  const ds = await db.costRevenueCode.findMany({ orderBy: { thuTuHienThi: "asc" } });
  return ds.map((c) => ({
    ma: c.ma,
    ten: c.ten,
    loai: c.loai as LoaiMa,
    maCha: c.maCha,
    choPhepNhapTrucTiep: c.choPhepNhapTrucTiep,
  }));
});

/**
 * Danh mục mã xếp theo CÂY 2 CẤP: mã gốc rồi tới các mã con của nó.
 *
 * Thứ tự lưu trong bảng (`thuTuHienThi`) xen kẽ cha con lộn xộn — dùng thẳng thì
 * lưới nhập và file mẫu đọc rất rối. Hàm này cho ra đúng bố cục như bảng chi phí
 * ở màn hình công trình, để mọi nơi nhìn danh mục theo cùng một trật tự.
 */
export const layDanhMucTheoCay = cache(
  async (): Promise<(MaDTCP & { capCon: boolean })[]> => {
    const ds = await layDanhMucMa();
    const hang: (MaDTCP & { capCon: boolean })[] = [];
    for (const goc of ds.filter((c) => !c.maCha)) {
      hang.push({ ...goc, capCon: false });
      for (const con of ds.filter((c) => c.maCha === goc.ma)) {
        hang.push({ ...con, capCon: true });
      }
    }
    return hang;
  }
);

/** Đọc công trình đang hoạt động theo điều kiện `where` cho sẵn rồi ánh xạ. */
async function dsCongTrinhTheoWhere(
  them: Record<string, unknown>
): Promise<CongTrinh[]> {
  const ds = await db.project.findMany({
    where: { isActive: true, ...them },
    orderBy: { maCongTrinh: "asc" },
  });
  return ds.map((p) => ({
    id: p.id,
    maCongTrinh: p.maCongTrinh,
    tenCongTrinh: p.tenCongTrinh,
    tenRutGon: p.tenRutGon ?? "",
    maBase: p.maBase,
    chuDauTu: p.chuDauTu ?? "",
    chiHuyTruong: p.chiHuyTruong ?? "",
    phongPhuTrach: p.phongPhuTrach ?? "",
    ngayBatDau: iso(p.ngayBatDau) ?? "",
    ngayKetThucKeHoach: iso(p.ngayKetThucKeHoach) ?? "",
    ngayHoanThanh: iso(p.ngayHoanThanh) ?? "",
    trangThai: p.trangThai as TrangThaiDuAn,
    diaDiem: p.diaDiem ?? "",
    bienLNMucTieu: p.bienLNMucTieu ?? NGUONG.bienLNMucTieu,
    ngayCapNhatCuoi: iso(p.ngayCapNhatCuoi) ?? "",
    giaTriHopDong: p.giaTriHopDong,
    googleSheetUrl: p.googleSheetUrl ?? "",
  }));
}

export const layCongTrinh = cache(async (): Promise<CongTrinh[]> =>
  dsCongTrinhTheoWhere(await locProject())
);

/**
 * TẤT CẢ công trình đang hoạt động, KHÔNG lọc phạm vi. Chỉ dùng cho danh mục
 * công trình — nơi user thấy được cả công trình ngoài phạm vi nhưng không bấm vào
 * chi tiết được (chặn ở trang chi tiết qua `timCongTrinh`). Đừng dùng cho báo cáo.
 */
export const layCongTrinhTatCa = cache(async (): Promise<CongTrinh[]> =>
  dsCongTrinhTheoWhere({})
);

/** Công trình đã NGỪNG theo dõi (isActive=false) — cho mục "Mở lại theo dõi". */
export async function layCongTrinhNgung(): Promise<
  { maCongTrinh: string; tenCongTrinh: string }[]
> {
  const ds = await db.project.findMany({
    where: { isActive: false, ...(await locProject()) },
    orderBy: { maCongTrinh: "asc" },
    select: { maCongTrinh: true, tenCongTrinh: true },
  });
  return ds.map((p) => ({ maCongTrinh: p.maCongTrinh, tenCongTrinh: p.tenCongTrinh }));
}

/** id nội bộ ↔ mã công trình, dùng để dịch kết quả groupBy. */
const banDoCongTrinh = cache(async () => {
  const ds = await db.project.findMany({ select: { id: true, maCongTrinh: true } });
  return {
    idSangMa: new Map(ds.map((p) => [p.id, p.maCongTrinh])),
    maSangId: new Map(ds.map((p) => [p.maCongTrinh, p.id])),
  };
});

export async function traMa(ma: string | null): Promise<MaDTCP | undefined> {
  if (!ma) return undefined;
  return (await layDanhMucMa()).find((c) => c.ma === ma);
}

export async function loaiCua(ma: string | null): Promise<LoaiMa | undefined> {
  return (await traMa(ma))?.loai;
}

/** Bảng tra loại theo mã — tránh gọi traMa() trong vòng lặp. */
const banDoLoai = cache(async () => {
  const ds = await layDanhMucMa();
  return new Map(ds.map((c) => [c.ma, c.loai]));
});

export async function timCongTrinh(maCongTrinh: string): Promise<CongTrinh | undefined> {
  return (await layCongTrinh()).find((c) => c.maCongTrinh === maCongTrinh);
}

// ------------------------------------------------------------ BOQ
export interface GiamGiaBOQ {
  id: string;
  moTa: string;
  /** Vị trí dòng đầu/cuối (1-based theo thứ tự BOQ = cột ID). */
  tuStt: number;
  denStt: number;
  phanTram: number;
}

/**
 * Giá trị của MỘT chiết khấu: %`phanTram` trên tổng thành tiền các dòng trong
 * phạm vi [tuStt, denStt]. `tt` là mảng thành tiền từng dòng theo thứ tự (0-based).
 * Cùng công thức này dùng cho cả TỔNG lẫn Bill từng tháng để không lệch làm tròn.
 */
/** Thành tiền một dòng = khối lượng × đơn giá; làm tròn về đồng nếu `lamTron`. */
export function ttThanhTien(khoiLuong: number, donGia: number, lamTron: boolean): number {
  const v = khoiLuong * donGia;
  return lamTron ? Math.round(v) : v;
}

export function giaTriMotGiamGia(
  tt: number[],
  g: { tuStt: number; denStt: number; phanTram: number }
): number {
  const a = Math.max(1, Math.min(g.tuStt, g.denStt));
  const b = Math.min(tt.length, Math.max(g.tuStt, g.denStt));
  let s = 0;
  for (let i = a; i <= b; i++) s += tt[i - 1] ?? 0;
  return Math.round((s * g.phanTram) / 100);
}

/**
 * Bill lấy từ BOQ, thay cho sổ giao dịch — CHỈ tháng đã xác nhận.
 *
 * Quy tắc: công trình ĐÃ CÓ BOQ thì doanh thu Bill không đọc từ bảng Transaction
 * nữa mà tính từ khối lượng thực hiện đã được xác nhận. Công trình chưa có BOQ
 * giữ nguyên cách cũ. Tháng chờ duyệt coi như CHƯA có doanh thu.
 *
 * Bill lấy theo giá ĐÃ giảm giá và CHƯA VAT: trừ chiết khấu (theo vị trí dòng)
 * rồi mới chia (1+vat%) nếu đơn giá đã gồm VAT.
 */
const billTuBOQ = cache(async () => {
  const lines = await db.bOQLine.findMany({
    select: { id: true, projectId: true, donGia: true },
    orderBy: { thuTu: "asc" },
  });
  const duAnCoBOQ = new Set(lines.map((l) => l.projectId));
  const theoThang = new Map<string, number>(); // khóa `projectId|thang`
  if (!duAnCoBOQ.size) return { duAnCoBOQ, theoThang };

  // Vị trí 1-based của mỗi dòng trong công trình + số dòng mỗi công trình.
  const viTri = new Map<string, number>();
  const soDong = new Map<string, number>();
  for (const l of lines) {
    const n = (soDong.get(l.projectId) ?? 0) + 1;
    soDong.set(l.projectId, n);
    viTri.set(l.id, n);
  }
  const tra = new Map(lines.map((l) => [l.id, l]));

  // Thiết lập theo công trình: hệ số quy chưa-VAT + có làm tròn thành tiền không.
  const projs = await db.project.findMany({
    select: { id: true, donGiaGomVAT: true, vatPhanTram: true, lamTronThanhTien: true },
  });
  const heSo = new Map(
    projs.map((p) => [p.id, p.donGiaGomVAT ? 1 / (1 + (p.vatPhanTram || 0) / 100) : 1])
  );
  const lamTron = new Map(projs.map((p) => [p.id, p.lamTronThanhTien]));

  // Không còn bước xác nhận: mọi khối lượng thực hiện đã nhập đều vào KPI.
  const ttTheoThang = new Map<string, number[]>();
  const ds = await db.bOQThucHien.findMany({
    select: { boqLineId: true, thang: true, khoiLuong: true },
  });
  for (const t of ds) {
    const l = tra.get(t.boqLineId);
    if (!l) continue;
    const k = `${l.projectId}|${t.thang}`;
    let arr = ttTheoThang.get(k);
    if (!arr) {
      arr = new Array(soDong.get(l.projectId) ?? 0).fill(0);
      ttTheoThang.set(k, arr);
    }
    arr[viTri.get(l.id)! - 1] += ttThanhTien(t.khoiLuong, l.donGia, lamTron.get(l.projectId) ?? true);
  }

  // Chiết khấu theo công trình.
  const ggByProject = new Map<string, GiamGiaBOQ[]>();
  for (const g of await db.bOQGiamGia.findMany({ orderBy: { thuTu: "asc" } })) {
    const arr = ggByProject.get(g.projectId) ?? [];
    arr.push({ id: g.id, moTa: g.moTa ?? "", tuStt: g.tuStt, denStt: g.denStt, phanTram: g.phanTram });
    ggByProject.set(g.projectId, arr);
  }

  for (const [k, arr] of ttTheoThang) {
    const pid = k.split("|")[0];
    const gom = arr.reduce((a, b) => a + b, 0);
    const giam = (ggByProject.get(pid) ?? []).reduce((a, g) => a + giaTriMotGiamGia(arr, g), 0);
    const sauGiam = gom - giam;
    const f = heSo.get(pid) ?? 1;
    theoThang.set(k, f === 1 ? sauGiam : Math.round(sauGiam * f));
  }
  return { duAnCoBOQ, theoThang };
});

/** Tổng bill BOQ đã xác nhận, đã lọc theo phạm vi người dùng và (tùy chọn) tháng. */
async function billBOQTrongPhamVi(thang?: string): Promise<number> {
  const { theoThang } = await billTuBOQ();
  const pv = await phamViHienTai();
  const { maSangId } = await banDoCongTrinh();
  const choPhep =
    pv === null ? null : new Set(pv.map((m) => maSangId.get(m)).filter(Boolean) as string[]);

  let tong = 0;
  for (const [k, v] of theoThang) {
    const [pid, t] = k.split("|");
    if (choPhep && !choPhep.has(pid)) continue;
    if (thang && t !== thang) continue;
    tong += v;
  }
  return tong;
}

export interface ThangBill {
  thang: string;
  trangThai: "CHO_XAC_NHAN" | "DA_XAC_NHAN";
  nguoiNhap: string;
  nguoiXacNhan: string;
}

export interface DongBOQ {
  id: string;
  stt: string;
  noiDung: string;
  dvt: string;
  /** Khối lượng và giá trị theo hợp đồng. */
  klHopDong: number;
  donGia: number;
  ttHopDong: number;
  /** Khối lượng thực hiện theo từng tháng, khóa là yyyy-MM. */
  klTheoThang: Record<string, number>;
  klLuyKe: number;
  ttLuyKe: number;
  /** Giá trị các cột tùy chỉnh, khóa là id cột. Dạng general nên luôn là chuỗi. */
  giaTriCot: Record<string, string>;
  /** Công tác đã thi công xong. */
  hoanThanh: boolean;
}

export interface CotBOQ {
  id: string;
  ten: string;
}

/**
 * Bảng khối lượng hợp đồng và tiến độ thực hiện của một công trình.
 *
 * Thành tiền LUÔN tính từ khối lượng × đơn giá rồi làm tròn về đồng — không đọc
 * giá trị lưu sẵn, đúng công thức ROUND(D*E,0) của sheet gốc.
 *
 * Phạm vi truy cập đi qua `layCongTrinh()` (đã lọc theo quyền), nên công trình
 * ngoài phạm vi trả về rỗng chứ không lộ khối lượng.
 */
export async function layBOQ(
  maCongTrinh: string
): Promise<{
  thangs: ThangBill[];
  dongs: DongBOQ[];
  cots: CotBOQ[];
  donGiaGomVAT: boolean;
  vatPhanTram: number;
  lamTronThanhTien: boolean;
  giamGia: GiamGiaBOQ[];
}> {
  const ct = (await layCongTrinh()).find((c) => c.maCongTrinh === maCongTrinh);
  if (!ct)
    return {
      thangs: [],
      dongs: [],
      cots: [],
      donGiaGomVAT: false,
      vatPhanTram: 10,
      lamTronThanhTien: true,
      giamGia: [],
    };

  const tls = await db.project.findUnique({
    where: { id: ct.id },
    select: { donGiaGomVAT: true, vatPhanTram: true, lamTronThanhTien: true },
  });
  const lamTron = tls?.lamTronThanhTien ?? true;

  const ds = await db.bOQLine.findMany({
    where: { projectId: ct.id },
    orderBy: { thuTu: "asc" },
    include: { thucHien: true, giaTriCot: true },
  });

  const cots = (
    await db.bOQCot.findMany({
      where: { projectId: ct.id },
      // Thêm id làm khóa phụ để thứ tự luôn tất định, kể cả khi dữ liệu cũ có
      // hai cột trùng thuTu — phải khớp cách sắp xếp trong chuyenCot().
      orderBy: [{ thuTu: "asc" }, { id: "asc" }],
    })
  ).map((c) => ({ id: c.id, ten: c.ten }));

  // Danh sách tháng lấy từ BillThang: một tháng "tồn tại" khi đã được tạo Bill.
  const thangs: ThangBill[] = (
    await db.billThang.findMany({ where: { projectId: ct.id }, orderBy: { thang: "asc" } })
  ).map((b) => ({
    thang: b.thang,
    trangThai: b.trangThai as ThangBill["trangThai"],
    nguoiNhap: b.nguoiNhap ?? "",
    nguoiXacNhan: b.nguoiXacNhan ?? "",
  }));

  const dongs = ds.map((l) => {
    const klTheoThang: Record<string, number> = {};
    for (const t of l.thucHien) klTheoThang[t.thang] = t.khoiLuong;
    const klLuyKe = l.thucHien.reduce((a, t) => a + t.khoiLuong, 0);
    return {
      id: l.id,
      stt: l.stt,
      noiDung: l.noiDung,
      dvt: l.dvt ?? "",
      klHopDong: l.khoiLuong,
      donGia: l.donGia,
      ttHopDong: ttThanhTien(l.khoiLuong, l.donGia, lamTron),
      klTheoThang,
      klLuyKe,
      ttLuyKe: ttThanhTien(klLuyKe, l.donGia, lamTron),
      giaTriCot: Object.fromEntries(l.giaTriCot.map((g) => [g.cotId, g.giaTri])),
      hoanThanh: l.hoanThanh,
    };
  });

  const giamGia: GiamGiaBOQ[] = (
    await db.bOQGiamGia.findMany({ where: { projectId: ct.id }, orderBy: { thuTu: "asc" } })
  ).map((g) => ({
    id: g.id,
    moTa: g.moTa ?? "",
    tuStt: g.tuStt,
    denStt: g.denStt,
    phanTram: g.phanTram,
  }));

  return {
    thangs,
    dongs,
    cots,
    donGiaGomVAT: tls?.donGiaGomVAT ?? false,
    vatPhanTram: tls?.vatPhanTram ?? 10,
    lamTronThanhTien: lamTron,
    giamGia,
  };
}

/**
 * Giá trị Bill của một tháng = tổng thành tiền khối lượng thực hiện tháng đó.
 * `heSoChuaVAT` < 1 khi đơn giá đã gồm VAT (Bill lấy chưa VAT); mặc định 1.
 */
export function giaTriBillThang(
  dongs: DongBOQ[],
  thang: string,
  heSoChuaVAT = 1,
  giamGia: GiamGiaBOQ[] = [],
  lamTron = true
): number {
  // `dongs` phải theo thứ tự BOQ (thuTu) để khớp vị trí chiết khấu — layBOQ đã sắp.
  const tt = dongs.map((d) => ttThanhTien(d.klTheoThang[thang] ?? 0, d.donGia, lamTron));
  const gom = tt.reduce((a, b) => a + b, 0);
  const giam = giamGia.reduce((a, g) => a + giaTriMotGiamGia(tt, g), 0);
  const sauGiam = gom - giam;
  return heSoChuaVAT === 1 ? sauGiam : Math.round(sauGiam * heSoChuaVAT);
}

/**
 * Giá trị Bill (giá trị thực hiện = doanh thu dự kiến) theo từng tháng của MỘT
 * công trình. Công trình ĐÃ CÓ BOQ lấy từ khối lượng thực hiện (BOQ) — CÙNG nguồn
 * với KPI doanh thu, tab Tổng quan và Danh mục sức khỏe. Công trình chưa có BOQ
 * giữ cách cũ: cộng giao dịch mã Bill theo tháng.
 *
 * Trước đây tab Doanh thu tự cộng mã "Bill" từ sổ giao dịch nên công trình có BOQ
 * (Bill nằm ở BOQThucHien, không phải Transaction) hiện "chưa ghi nhận" dù đã nhập.
 */
export async function billDoanhThuTheoThang(maCongTrinh: string): Promise<Map<string, number>> {
  const ct = (await layCongTrinh()).find((c) => c.maCongTrinh === maCongTrinh);
  if (!ct) return new Map();
  const { duAnCoBOQ, theoThang } = await billTuBOQ();
  if (duAnCoBOQ.has(ct.id)) {
    const m = new Map<string, number>();
    for (const [k, v] of theoThang) {
      const [pid, thang] = k.split("|");
      if (pid === ct.id) m.set(thang, v);
    }
    return m;
  }
  const rows = await db.transaction.groupBy({
    by: ["thangThucHien"],
    _sum: { soTien: true },
    where: { projectId: ct.id, maDTCP: MA_DOANH_THU_DIEU_HANH },
  });
  return new Map(rows.map((r) => [r.thangThucHien, r._sum.soTien ?? 0]));
}

// ------------------------------------------------------------ Giao dịch
export interface BoLocGiaoDich {
  maCongTrinh?: string;
  maDTCP?: string;
  thang?: string;
  loai?: LoaiMa;
}

async function dieuKien(loc: BoLocGiaoDich) {
  // Nền là phạm vi của người đăng nhập; bộ lọc của trang chỉ thu hẹp thêm.
  const w: Record<string, unknown> = { ...(await locTheoProjectId()) };
  if (loc.maCongTrinh) {
    const { maSangId } = await banDoCongTrinh();
    w.projectId = maSangId.get(loc.maCongTrinh) ?? "__khong_ton_tai__";
  }
  if (loc.maDTCP) w.maDTCP = loc.maDTCP;
  if (loc.thang) w.thangThucHien = loc.thang;
  if (loc.loai) {
    const ds = await layDanhMucMa();
    w.maDTCP = { in: ds.filter((c) => c.loai === loc.loai).map((c) => c.ma) };
  }
  return w;
}

export async function layGiaoDich(loc: BoLocGiaoDich = {}): Promise<GiaoDich[]> {
  const { idSangMa } = await banDoCongTrinh();
  const ds = await db.transaction.findMany({
    where: await dieuKien(loc),
    orderBy: { sttNguon: "asc" },
  });
  return ds.map((g) => ({
    id: g.id,
    sttNguon: g.sttNguon ?? 0,
    maCongTrinh: idSangMa.get(g.projectId) ?? "",
    tenCongTrinhNguon: g.tenCongTrinhNguon ?? "",
    maBase: g.maBase,
    soHoaDon: g.soHoaDon,
    ngayChungTu: iso(g.ngayChungTu),
    thangThucHien: g.thangThucHien,
    tuanThucHien: g.tuanThucHien,
    noiDungThanhToan: g.noiDung,
    dvt: g.dvt,
    donGia: g.donGia,
    soLuong: g.soLuong,
    soTien: g.soTien,
    maDTCP: g.maDTCP,
    ghiChu: g.ghiChu,
    importBatchId: g.importBatchId,
    sourceFileName: g.sourceFileName ?? "",
    trangThai: g.trangThai as GiaoDich["trangThai"],
    rowHash: g.rowHash,
  }));
}

export async function demGiaoDichTheoMa(loc: BoLocGiaoDich = {}): Promise<Map<string, number>> {
  const rows = await db.transaction.groupBy({
    by: ["maDTCP"],
    _count: { _all: true },
    where: await dieuKien(loc),
  });
  return new Map(rows.map((r) => [r.maDTCP, r._count._all]));
}

export async function layGiaoDichChoXuLy(): Promise<GiaoDich[]> {
  const pv = await phamViHienTai();
  const ds = await db.transactionStaging.findMany({
    where: pv === null ? {} : { maCongTrinh: { in: pv } },
    orderBy: { dongExcel: "asc" },
  });
  return ds.map((g) => ({
    id: g.id,
    sttNguon: g.dongExcel - 2,
    maCongTrinh: g.maCongTrinh ?? "",
    tenCongTrinhNguon: g.tenCongTrinh ?? "",
    maBase: null,
    soHoaDon: g.soHoaDon,
    ngayChungTu: iso(g.ngayChungTu),
    thangThucHien: g.thangThucHien,
    tuanThucHien: g.tuanThucHien,
    noiDungThanhToan: g.noiDung ?? "",
    dvt: g.dvt,
    donGia: g.donGia,
    soLuong: g.soLuong,
    soTien: g.soTien ?? 0,
    maDTCP: g.maDTCP,
    ghiChu: g.ghiChu,
    importBatchId: g.importBatchId,
    sourceFileName: "",
    trangThai: "LOI",
    rowHash: g.rowHash,
  }));
}

export async function layLoiDuLieu(): Promise<LoiDuLieu[]> {
  // Lỗi gắn với lô nhập, lô nhập gắn với công trình -> lọc bắc cầu.
  const pv = await phamViHienTai();
  const ds = await db.importError.findMany({
    where: pv === null ? {} : { batch: { project: { maCongTrinh: { in: pv } } } },
    orderBy: { dong: "asc" },
  });
  return ds.map((l) => ({
    id: l.id,
    importBatchId: l.importBatchId,
    dong: l.dong,
    cot: l.cot,
    maLoi: l.maLoi,
    mucDo: l.mucDo as LoiDuLieu["mucDo"],
    thongDiep: l.thongDiep,
    cachXuLy: l.cachXuLy ?? "",
  }));
}

export async function layLoNhap(): Promise<LoNhap[]> {
  const { idSangMa } = await banDoCongTrinh();
  const ds = await db.importBatch.findMany({
    where: await locTheoProjectId(),
    orderBy: { thoiDiemTai: "desc" },
  });
  return ds.map((l) => ({
    id: l.id,
    tenFile: l.tenFile,
    hashFile: l.hashFile,
    maCongTrinh: l.projectId ? (idSangMa.get(l.projectId) ?? null) : null,
    kyDuLieu: l.kyDuLieu,
    nguoiTai: l.nguoiTai,
    thoiDiemTai: l.thoiDiemTai.toISOString().slice(0, 19),
    soDong: l.soDong,
    soDongHopLe: l.soDongHopLe,
    soDongLoi: l.soDongLoi,
    trangThai: l.trangThai as LoNhap["trangThai"],
    nguoiDuyet: l.nguoiDuyet,
    thoiDiemDuyet: l.thoiDiemDuyet ? l.thoiDiemDuyet.toISOString().slice(0, 19) : null,
  }));
}

export const cacThang = cache(async (): Promise<string[]> => {
  const ds = await db.transaction.groupBy({
    by: ["thangThucHien"],
    where: await locTheoProjectId(),
  });
  return ds.map((r) => r.thangThucHien).sort();
});

export async function thangMoiNhat(): Promise<string> {
  const ds = await cacThang();
  return ds[ds.length - 1];
}

// ------------------------------------------------------------ Tổng hợp
export interface TongHop {
  doanhThu: number;
  chiPhi: number;
  loiNhuan: number;
  bienLN: number | null;
}

function ghepTongHop(doanhThu: number, chiPhi: number): TongHop {
  return {
    doanhThu,
    chiPhi,
    loiNhuan: loiNhuanGop(doanhThu, chiPhi),
    bienLN: bienLoiNhuan(doanhThu, chiPhi),
  };
}

/**
 * KPI toàn công ty. Không truyền tháng = lũy kế toàn kỳ.
 * §6.1: doanh thu CHỈ lấy mã điều hành, không cộng lẫn các trạng thái khác.
 */
export async function tongQuanCongTy(thang?: string): Promise<TongHop> {
  const loai = await banDoLoai();
  const maChiPhi = [...loai.entries()].filter(([, l]) => l === "Chi phí").map(([m]) => m);
  const where = { ...(await locTheoProjectId()), ...(thang ? { thangThucHien: thang } : {}) };

  // Công trình có BOQ: doanh thu lấy từ bill BOQ đã xác nhận, nên phải loại
  // chúng khỏi phép cộng trên sổ giao dịch để không tính hai lần.
  const { duAnCoBOQ } = await billTuBOQ();
  const [dt, cp] = await Promise.all([
    db.transaction.aggregate({
      _sum: { soTien: true },
      where: {
        AND: [
          where,
          { maDTCP: MA_DOANH_THU_DIEU_HANH },
          ...(duAnCoBOQ.size ? [{ projectId: { notIn: [...duAnCoBOQ] } }] : []),
        ],
      },
    }),
    db.transaction.aggregate({
      _sum: { soTien: true },
      where: { ...where, maDTCP: { in: maChiPhi } },
    }),
  ]);
  return ghepTongHop((dt._sum.soTien ?? 0) + (await billBOQTrongPhamVi(thang)), cp._sum.soTien ?? 0);
}

/** Chuỗi doanh thu – chi phí – lợi nhuận theo tháng, gom bằng MỘT truy vấn. */
export const chuoiTheoThang = cache(async (): Promise<(TongHop & { thang: string })[]> => {
  const loai = await banDoLoai();
  // Gom thêm projectId để loại được công trình có BOQ ra khỏi doanh thu sổ.
  const rows = await db.transaction.groupBy({
    by: ["thangThucHien", "maDTCP", "projectId"],
    _sum: { soTien: true },
    where: await locTheoProjectId(),
  });
  const { duAnCoBOQ, theoThang } = await billTuBOQ();

  const gom = new Map<string, { dt: number; cp: number }>();
  for (const r of rows) {
    const o = gom.get(r.thangThucHien) ?? { dt: 0, cp: 0 };
    const v = r._sum.soTien ?? 0;
    if (r.maDTCP === MA_DOANH_THU_DIEU_HANH) {
      if (!duAnCoBOQ.has(r.projectId)) o.dt += v; // có BOQ thì cộng ở vòng dưới
    } else if (loai.get(r.maDTCP) === "Chi phí") o.cp += v;
    gom.set(r.thangThucHien, o);
  }

  // Bù doanh thu của các công trình có BOQ, chỉ tháng đã xác nhận.
  const pv = await phamViHienTai();
  const { maSangId } = await banDoCongTrinh();
  const choPhep =
    pv === null ? null : new Set(pv.map((m) => maSangId.get(m)).filter(Boolean) as string[]);
  for (const [k, v] of theoThang) {
    const [pid, thang] = k.split("|");
    if (choPhep && !choPhep.has(pid)) continue;
    const o = gom.get(thang) ?? { dt: 0, cp: 0 };
    o.dt += v;
    gom.set(thang, o);
  }

  return [...gom.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([thang, v]) => ({ thang, ...ghepTongHop(v.dt, v.cp) }));
});

/** Gộp chuỗi tháng thành chuỗi quý (§ yêu cầu view tổng hợp theo quý). */
export const chuoiTheoQuy = cache(async (): Promise<(TongHop & { ky: string })[]> => {
  const thang = await chuoiTheoThang();
  const gom = new Map<string, { dt: number; cp: number }>();
  for (const t of thang) {
    const k = khoaQuy(t.thang);
    const o = gom.get(k) ?? { dt: 0, cp: 0 };
    o.dt += t.doanhThu;
    o.cp += t.chiPhi;
    gom.set(k, o);
  }
  return [...gom.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ky, v]) => ({ ky, ...ghepTongHop(v.dt, v.cp) }));
});

// ------------------------------------------------------------ Dòng tiền
/**
 * Dòng tiền theo tháng: tiền THU (mã Doanh thu: Tạm ứng/Thanh toán/Quyết toán) và
 * tiền CHI (mã Chi phí) trên SỔ GIAO DỊCH. Bill (Giá trị thực hiện) KHÔNG phải dòng
 * tiền nên bỏ qua. `luyKe` = dòng tiền ròng cộng dồn (số dư).
 *
 * Không truyền `maCongTrinh` = toàn công ty theo phạm vi người dùng.
 */
export async function dongTienTheoThang(
  maCongTrinh?: string
): Promise<{ thang: string; thu: number; chi: number; rong: number; luyKe: number }[]> {
  const loai = await banDoLoai();
  let where: Record<string, unknown>;
  if (maCongTrinh) {
    const ct = (await layCongTrinh()).find((c) => c.maCongTrinh === maCongTrinh);
    if (!ct) return [];
    where = { projectId: ct.id };
  } else {
    where = await locTheoProjectId();
  }

  const rows = await db.transaction.groupBy({
    by: ["thangThucHien", "maDTCP"],
    _sum: { soTien: true },
    where,
  });

  const gom = new Map<string, { thu: number; chi: number }>();
  for (const r of rows) {
    const l = loai.get(r.maDTCP);
    if (l !== "Doanh thu" && l !== "Chi phí") continue; // bỏ Bill (Giá trị thực hiện)
    const o = gom.get(r.thangThucHien) ?? { thu: 0, chi: 0 };
    if (l === "Doanh thu") o.thu += r._sum.soTien ?? 0;
    else o.chi += r._sum.soTien ?? 0;
    gom.set(r.thangThucHien, o);
  }

  let luyKe = 0;
  return [...gom.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([thang, v]) => {
      const rong = v.thu - v.chi;
      luyKe += rong;
      return { thang, thu: v.thu, chi: v.chi, rong, luyKe };
    });
}

// ------------------------------------------------------------ Kế hoạch
/** Kế hoạch lũy kế theo từng công trình. Một truy vấn cho tất cả. */
const keHoachTatCa = cache(async () => {
  const { idSangMa } = await banDoCongTrinh();
  const loai = await banDoLoai();
  const rows = await db.planLine.groupBy({
    by: ["projectId", "maDTCP"],
    _sum: { giaTri: true },
    where: await locTheoProjectId(),
  });

  const gom = new Map<string, { dtKeHoach: number; cpKeHoach: number }>();
  for (const r of rows) {
    // maDTCP null = mã chưa ánh xạ được -> LOẠI khỏi KPI, không gộp ngầm.
    if (!r.maDTCP) continue;
    const ma = idSangMa.get(r.projectId);
    if (!ma) continue;
    const o = gom.get(ma) ?? { dtKeHoach: 0, cpKeHoach: 0 };
    const v = r._sum.giaTri ?? 0;
    if (loai.get(r.maDTCP) === "Doanh thu") o.dtKeHoach += v;
    else o.cpKeHoach += v;
    gom.set(ma, o);
  }
  return gom;
});

export async function keHoachTheoCongTrinh(maCongTrinh: string, denThang?: string) {
  if (!denThang) {
    return (await keHoachTatCa()).get(maCongTrinh) ?? { dtKeHoach: 0, cpKeHoach: 0 };
  }
  const { maSangId } = await banDoCongTrinh();
  const loai = await banDoLoai();
  const rows = await db.planLine.groupBy({
    by: ["maDTCP"],
    _sum: { giaTri: true },
    where: { projectId: maSangId.get(maCongTrinh), thang: { lte: denThang } },
  });
  let dt = 0;
  let cp = 0;
  for (const r of rows) {
    if (!r.maDTCP) continue;
    const v = r._sum.giaTri ?? 0;
    if (loai.get(r.maDTCP) === "Doanh thu") dt += v;
    else cp += v;
  }
  return { dtKeHoach: dt, cpKeHoach: cp };
}

/**
 * Kế hoạch hiện có của MỘT công trình, theo từng mã — dùng để đổ vào lưới nhập.
 * Trả rỗng nếu công trình ngoài phạm vi người dùng.
 */
export async function keHoachTheoMa(maCongTrinh: string): Promise<Map<string, number>> {
  const ct = (await layCongTrinh()).find((c) => c.maCongTrinh === maCongTrinh);
  if (!ct) return new Map();
  const rows = await db.planLine.groupBy({
    by: ["maDTCP"],
    _sum: { giaTri: true },
    where: { projectId: ct.id },
  });
  return new Map(
    rows.filter((r) => r.maDTCP).map((r) => [r.maDTCP as string, r._sum.giaTri ?? 0])
  );
}

/** So sánh Kế hoạch vs Thực hiện theo mã. */
export async function keHoachVsThucHien(maCongTrinh?: string) {
  const { maSangId } = await banDoCongTrinh();
  const projectId = maCongTrinh ? maSangId.get(maCongTrinh) : undefined;
  const danhMuc = await layDanhMucMa();

  const [kh, th] = await Promise.all([
    db.planLine.groupBy({
      by: ["maDTCP"],
      _sum: { giaTri: true },
      where: projectId ? { projectId } : await locTheoProjectId(),
    }),
    db.transaction.groupBy({
      by: ["maDTCP"],
      _sum: { soTien: true },
      where: projectId ? { projectId } : await locTheoProjectId(),
    }),
  ]);

  const gom = new Map<string, { keHoach: number; thucHien: number }>();
  for (const r of kh) {
    if (!r.maDTCP) continue;
    gom.set(r.maDTCP, { keHoach: r._sum.giaTri ?? 0, thucHien: 0 });
  }
  for (const r of th) {
    const o = gom.get(r.maDTCP) ?? { keHoach: 0, thucHien: 0 };
    o.thucHien = r._sum.soTien ?? 0;
    gom.set(r.maDTCP, o);
  }

  return [...gom.entries()]
    .map(([ma, v]) => {
      const info = danhMuc.find((c) => c.ma === ma);
      return {
        ma,
        ten: info?.ten ?? ma,
        loai: info?.loai,
        keHoach: v.keHoach,
        thucHien: v.thucHien,
        chenhLech: v.keHoach - v.thucHien,
        tyLe: v.keHoach ? v.thucHien / v.keHoach : null,
      };
    })
    .sort((a, b) => b.thucHien - a.thucHien);
}

// ------------------------------------------------------------ Sức khỏe danh mục
export interface DongDanhMuc extends KetQuaSucKhoe {
  congTrinh: CongTrinh;
  doanhThu: number;
  chiPhi: number;
  loiNhuan: number;
  dtKeHoach: number;
  cpKeHoach: number;
  chenhLechCP: number;
  soLoiDuLieu: number;
  /** Tổng giá trị hợp đồng theo BOQ. null = công trình chưa nhập BOQ. */
  boqHopDong: number | null;
}

export const danhMucSucKhoe = cache(async (tatCa = false): Promise<DongDanhMuc[]> => {
  const [congTrinh, loai, keHoach, { idSangMa }] = await Promise.all([
    tatCa ? layCongTrinhTatCa() : layCongTrinh(),
    banDoLoai(),
    keHoachTatCa(),
    banDoCongTrinh(),
  ]);

  // Một truy vấn gom toàn bộ thực hiện, thay vì lặp 31 lần.
  const rows = await db.transaction.groupBy({
    by: ["projectId", "maDTCP"],
    _sum: { soTien: true },
    where: tatCa ? {} : await locTheoProjectId(),
  });
  const { duAnCoBOQ, theoThang: billBOQ } = await billTuBOQ();
  const thucHien = new Map<string, { dt: number; cp: number }>();
  for (const r of rows) {
    const ma = idSangMa.get(r.projectId);
    if (!ma) continue;
    const o = thucHien.get(ma) ?? { dt: 0, cp: 0 };
    const v = r._sum.soTien ?? 0;
    if (r.maDTCP === MA_DOANH_THU_DIEU_HANH) {
      if (!duAnCoBOQ.has(r.projectId)) o.dt += v; // có BOQ thì cộng ở vòng dưới
    } else if (loai.get(r.maDTCP) === "Chi phí") o.cp += v;
    thucHien.set(ma, o);
  }

  // Doanh thu của công trình có BOQ = tổng bill các tháng ĐÃ XÁC NHẬN.
  for (const [k, v] of billBOQ) {
    const ma = idSangMa.get(k.split("|")[0]);
    if (!ma) continue;
    const o = thucHien.get(ma) ?? { dt: 0, cp: 0 };
    o.dt += v;
    thucHien.set(ma, o);
  }

  const pvLoi = tatCa ? null : await phamViHienTai();
  const loiRows = await db.transactionStaging.groupBy({
    by: ["maCongTrinh"],
    _count: { _all: true },
    where: pvLoi === null ? {} : { maCongTrinh: { in: pvLoi } },
  });
  const soLoi = new Map(loiRows.map((r) => [r.maCongTrinh ?? "", r._count._all]));

  /*
   * Giá trị hợp đồng theo BOQ, gom trong JS chứ không groupBy: thành tiền là
   * ROUND(khối lượng × đơn giá) nên phải làm tròn TỪNG DÒNG rồi mới cộng, đúng
   * như mọi chỗ khác trong app. Bảng BOQ chỉ vài chục dòng nên đọc hết không tốn.
   */
  const boqHopDong = new Map<string, number>();
  for (const l of await db.bOQLine.findMany({
    select: { projectId: true, khoiLuong: true, donGia: true },
  })) {
    const ma = idSangMa.get(l.projectId);
    if (!ma) continue;
    boqHopDong.set(ma, (boqHopDong.get(ma) ?? 0) + Math.round(l.khoiLuong * l.donGia));
  }

  return congTrinh
    .map((ct) => {
      const th = thucHien.get(ct.maCongTrinh) ?? { dt: 0, cp: 0 };
      const kh = keHoach.get(ct.maCongTrinh) ?? { dtKeHoach: 0, cpKeHoach: 0 };
      const soLoiDuLieu = soLoi.get(ct.maCongTrinh) ?? 0;
      const sk = danhGiaSucKhoe({
        doanhThu: th.dt,
        chiPhi: th.cp,
        cpKeHoach: kh.cpKeHoach,
        dtKeHoach: kh.dtKeHoach,
        ngayCapNhatCuoi: ct.ngayCapNhatCuoi,
        bienLNMucTieu: ct.bienLNMucTieu,
        soLoiDuLieu,
      });
      return {
        congTrinh: ct,
        doanhThu: th.dt,
        chiPhi: th.cp,
        loiNhuan: th.dt - th.cp,
        dtKeHoach: kh.dtKeHoach,
        cpKeHoach: kh.cpKeHoach,
        chenhLechCP: kh.cpKeHoach - th.cp,
        soLoiDuLieu,
        boqHopDong: boqHopDong.get(ct.maCongTrinh) ?? null,
        ...sk,
      };
    })
    .sort((a, b) => b.chiPhi - a.chiPhi);
});

export async function demSucKhoe(): Promise<Record<SucKhoe, number>> {
  const d: Record<SucKhoe, number> = { Xanh: 0, "Vàng": 0, "Đỏ": 0 };
  for (const r of await danhMucSucKhoe()) d[r.sucKhoe]++;
  return d;
}

// ------------------------------------------------------------ Cơ cấu chi phí
export interface DongCoCau {
  ma: string;
  ten: string;
  maCha: string | null;
  soTien: number;
  tyTrongTrenCP: number;
  tyTrongTrenDT: number | null;
}

export async function coCauChiPhi(loc: BoLocGiaoDich = {}): Promise<DongCoCau[]> {
  const danhMuc = await layDanhMucMa();
  const rows = await db.transaction.groupBy({
    by: ["maDTCP"],
    _sum: { soTien: true },
    where: await dieuKien({ ...loc, loai: "Chi phí" }),
  });

  const tongCP = rows.reduce((a, r) => a + (r._sum.soTien ?? 0), 0);
  const { doanhThu } = await tongQuanCongTy(loc.thang);

  return rows
    .map((r) => {
      const info = danhMuc.find((c) => c.ma === r.maDTCP);
      const soTien = r._sum.soTien ?? 0;
      return {
        ma: r.maDTCP,
        ten: info?.ten ?? r.maDTCP,
        maCha: info?.maCha ?? null,
        soTien,
        tyTrongTrenCP: tongCP ? soTien / tongCP : 0,
        tyTrongTrenDT: doanhThu ? soTien / doanhThu : null,
      };
    })
    .sort((a, b) => b.soTien - a.soTien);
}

/** Gộp cơ cấu chi phí lên mã cha (nhóm). */
export async function coCauChiPhiTheoNhom(loc: BoLocGiaoDich = {}): Promise<DongCoCau[]> {
  const [chiTiet, danhMuc] = await Promise.all([coCauChiPhi(loc), layDanhMucMa()]);
  const gom = new Map<string, number>();
  for (const d of chiTiet) {
    const khoa = d.maCha ?? d.ma;
    gom.set(khoa, (gom.get(khoa) ?? 0) + d.soTien);
  }
  const tong = [...gom.values()].reduce((a, b) => a + b, 0);
  const { doanhThu } = await tongQuanCongTy(loc.thang);
  return [...gom.entries()]
    .map(([ma, soTien]) => ({
      ma,
      ten: danhMuc.find((c) => c.ma === ma)?.ten ?? ma,
      maCha: null,
      soTien,
      tyTrongTrenCP: tong ? soTien / tong : 0,
      tyTrongTrenDT: doanhThu ? soTien / doanhThu : null,
    }))
    .sort((a, b) => b.soTien - a.soTien);
}

// ------------------------------------------------------------ Ma trận báo cáo
export type KyBaoCao = "thang" | "quy" | "nam";

function thuocKy(thang: string, ky: KyBaoCao, kyChon?: string) {
  if (!kyChon) return true;
  if (ky === "thang") return thang === kyChon;
  if (ky === "quy") return khoaQuy(thang) === kyChon;
  return thang.slice(0, 4) === kyChon;
}

/** Ma trận TH_THANG / TH_QUY / TH_NAM: hàng = mã, cột = công trình. */
/**
 * Hàng của ma trận: TOÀN BỘ danh mục theo cây 2 cấp, không chỉ mã có phát sinh —
 * để nhìn ra ngay mã nào đang trống. Phần doanh thu chỉ giữ mã Bill; TƯ/TT/QT là
 * dòng tiền thu theo hợp đồng, đặt chung bảng với chi phí thực hiện sẽ đọc sai.
 */
async function hangDanhMucMaTran() {
  return (await layDanhMucTheoCay()).filter(
    (c) => c.loai !== "Doanh thu" || c.ma === MA_DOANH_THU_DIEU_HANH
  );
}

export async function maTranBaoCao(ky: KyBaoCao, kyChon?: string) {
  const [congTrinh, danhMuc, { idSangMa }] = await Promise.all([
    layCongTrinh(),
    hangDanhMucMaTran(),
    banDoCongTrinh(),
  ]);
  const cot = congTrinh.map((c) => c.maCongTrinh);

  const rows = await db.transaction.groupBy({
    by: ["maDTCP", "projectId", "thangThucHien"],
    _sum: { soTien: true },
    where: await locTheoProjectId(),
  });

  const o = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!thuocKy(r.thangThucHien, ky, kyChon)) continue;
    const maCT = idSangMa.get(r.projectId);
    if (!maCT) continue;
    let hang = o.get(r.maDTCP);
    if (!hang) {
      hang = new Map();
      o.set(r.maDTCP, hang);
    }
    hang.set(maCT, (hang.get(maCT) ?? 0) + (r._sum.soTien ?? 0));
  }

  // Giữ thứ tự danh mục để giống bố cục báo cáo Excel gốc.
  const hangs = danhMuc
    .map((c) => {
      const hang = o.get(c.ma) ?? new Map<string, number>();
      const giaTri = cot.map((ct) => hang.get(ct) ?? 0);
      return {
        ma: c.ma,
        ten: c.ten,
        loai: c.loai,
        maCha: c.maCha,
        giaTri,
        tong: giaTri.reduce((a, b) => a + b, 0),
      };
    });

  return { cot, hangs };
}

/**
 * Báo cáo của MỘT công trình: hàng = mã, cột = kỳ.
 * Đây là bản xoay của `maTranBaoCao` — cùng dữ liệu, đổi trục.
 */
export async function maTranTheoCongTrinh(maCongTrinh: string, ky: KyBaoCao) {
  const [danhMuc, { maSangId }] = await Promise.all([hangDanhMucMaTran(), banDoCongTrinh()]);
  // Không dùng maSangId trực tiếp: bảng đó chứa mọi công trình. Phải tra qua
  // layCongTrinh() vốn đã lọc phạm vi, nếu không sẽ lộ dữ liệu khi gõ thẳng URL.
  const trongPhamVi = (await layCongTrinh()).some((c) => c.maCongTrinh === maCongTrinh);
  const projectId = trongPhamVi ? maSangId.get(maCongTrinh) : undefined;
  if (!projectId) return { cot: [], hangs: [] };

  const rows = await db.transaction.groupBy({
    by: ["maDTCP", "thangThucHien"],
    _sum: { soTien: true },
    where: { projectId },
  });

  const khoaKy = (thang: string) =>
    ky === "thang" ? thang : ky === "quy" ? khoaQuy(thang) : thang.slice(0, 4);

  // Dòng "Bill nội bộ" lấy từ Giá trị thực hiện (BOQ) — CÙNG nguồn với tab Doanh
  // thu và KPI, không cộng mã "Bill" trên sổ giao dịch (công trình có BOQ không có
  // giao dịch Bill nên trước đây báo cáo hiện 0). Gom giá trị thực hiện theo kỳ.
  const billThang = await billDoanhThuTheoThang(maCongTrinh);
  const billKy = new Map<string, number>();
  for (const [thang, v] of billThang) {
    const k = khoaKy(thang);
    billKy.set(k, (billKy.get(k) ?? 0) + v);
  }

  const cot = [...new Set([...rows.map((r) => khoaKy(r.thangThucHien)), ...billKy.keys()])].sort();
  const o = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const k = khoaKy(r.thangThucHien);
    let hang = o.get(r.maDTCP);
    if (!hang) {
      hang = new Map();
      o.set(r.maDTCP, hang);
    }
    hang.set(k, (hang.get(k) ?? 0) + (r._sum.soTien ?? 0));
  }
  // Ghi đè dòng Bill bằng giá trị thực hiện (BOQ), thay cho tổng giao dịch mã Bill.
  o.set(MA_DOANH_THU_DIEU_HANH, billKy);

  const hangs = danhMuc
    .map((c) => {
      const hang = o.get(c.ma) ?? new Map<string, number>();
      const giaTri = cot.map((k) => hang.get(k) ?? 0);
      return {
        ma: c.ma,
        ten: c.ten,
        loai: c.loai,
        maCha: c.maCha,
        giaTri,
        tong: giaTri.reduce((a, b) => a + b, 0),
      };
    });

  return { cot, hangs };
}

export async function cacKy(ky: KyBaoCao): Promise<string[]> {
  const t = await cacThang();
  if (ky === "thang") return t;
  if (ky === "quy") return [...new Set(t.map(khoaQuy))];
  return [...new Set(t.map((x) => x.slice(0, 4)))];
}

// ------------------------------------------------------------ Chất lượng dữ liệu
export interface ChiTieuChatLuong {
  maChiTieu: string;
  ten: string;
  soLuong: number;
  mucDich: string;
  nghiemTrong: boolean;
}

/** 12 chỉ tiêu chất lượng dữ liệu theo §4.5. */
export const chatLuongDuLieu = cache(async (): Promise<ChiTieuChatLuong[]> => {
  const [cho, loi, danhMuc, congTrinh, loLoi] = await Promise.all([
    layGiaoDichChoXuLy(),
    layLoiDuLieu(),
    layDanhMucMa(),
    layCongTrinh(),
    db.importBatch.count({ where: { trangThai: "ERROR", ...(await locTheoProjectId()) } }),
  ]);
  const dem = (ma: string) => loi.filter((l) => l.maLoi === ma).length;
  const hopLeMa = new Set(danhMuc.map((c) => c.ma));

  const hashCho = cho.map((g) => g.rowHash);
  const trung = hashCho.length
    ? await db.transaction.count({
        where: { rowHash: { in: hashCho }, ...(await locTheoProjectId()) },
      })
    : 0;

  const treHan = congTrinh.filter(
    (c) => soNgayChuaCapNhat(c.ngayCapNhatCuoi) > NGUONG.soNgayTreVang
  ).length;

  return [
    { maChiTieu: "THIEU_CT", ten: "Dòng thiếu mã công trình", soLuong: cho.filter((g) => !g.maCongTrinh).length, mucDich: "Phát hiện giao dịch không phân bổ được", nghiemTrong: true },
    { maChiTieu: "THIEU_THANG", ten: "Dòng thiếu tháng thực hiện", soLuong: dem("THIEU_THANG"), mucDich: "Phát hiện giao dịch không lên đúng kỳ", nghiemTrong: true },
    { maChiTieu: "THIEU_MA", ten: "Dòng thiếu mã DT–CP", soLuong: dem("THIEU_MA"), mucDich: "Giao dịch không xếp được vào báo cáo", nghiemTrong: true },
    { maChiTieu: "THIEU_ND", ten: "Dòng thiếu nội dung thanh toán", soLuong: cho.filter((g) => !g.noiDungThanhToan?.trim()).length, mucDich: "Khó truy vết", nghiemTrong: false },
    { maChiTieu: "THIEU_CHUNG_TU", ten: "Dòng thiếu chứng từ", soLuong: dem("THIEU_CHUNG_TU"), mucDich: "Rủi ro kiểm soát", nghiemTrong: false },
    { maChiTieu: "MA_NGOAI_DM", ten: "Mã không có trong danh mục", soLuong: cho.filter((g) => g.maDTCP && !hopLeMa.has(g.maDTCP)).length, mucDich: "Sai chuẩn phân loại", nghiemTrong: true },
    { maChiTieu: "MA_NHOM", ten: "Ghi vào mã nhóm không cho nhập trực tiếp", soLuong: dem("MA_KHONG_NHAP_TRUC_TIEP"), mucDich: "Sai cấp hạch toán", nghiemTrong: true },
    { maChiTieu: "TRUNG", ten: "Dữ liệu trùng", soLuong: trung, mucDich: "Nguy cơ cộng trùng", nghiemTrong: true },
    { maChiTieu: "TIEN_KHONG_HOP_LE", ten: "Số tiền không hợp lệ", soLuong: cho.filter((g) => !Number.isFinite(g.soTien)).length, mucDich: "Không thể tổng hợp", nghiemTrong: true },
    { maChiTieu: "SAU_KHOA", ten: "Dữ liệu sau kỳ khóa", soLuong: 0, mucDich: "Rủi ro thay đổi báo cáo", nghiemTrong: true },
    { maChiTieu: "CHUA_CAP_NHAT", ten: "Công trình chưa cập nhật đúng hạn", soLuong: treHan, mucDich: "Dữ liệu không đầy đủ", nghiemTrong: false },
    { maChiTieu: "LO_LOI", ten: "Lô nhập đang có lỗi chưa xử lý", soLuong: loLoi, mucDich: "Đánh giá kỷ luật báo cáo", nghiemTrong: false },
  ];
});

/**
 * Điểm chất lượng dữ liệu = 100 − điểm phạt (§21).
 * Phạt tính TƯƠNG ĐỐI trên tổng số dòng: 30 dòng lỗi trên 300 dòng là tệ, trên
 * 300.000 dòng thì không. §21 ghi rõ cách chấm cần Data Owner thống nhất.
 */
export const TRONG_SO_PHAT = { nghiemTrong: 3, thuong: 1 } as const;

export async function diemChatLuong(): Promise<number> {
  const [ct, soChinhThuc, soCho] = await Promise.all([
    chatLuongDuLieu(),
    db.transaction.count({ where: await locTheoProjectId() }),
    db.transactionStaging.count(),
  ]);
  const tongDong = soChinhThuc + soCho;
  if (!tongDong) return 100;
  const phat = ct.reduce(
    (a, c) => a + c.soLuong * (c.nghiemTrong ? TRONG_SO_PHAT.nghiemTrong : TRONG_SO_PHAT.thuong),
    0
  );
  return Math.max(0, Math.round(100 - Math.min(100, (phat / tongDong) * 1000)));
}

// ------------------------------------------------------------ Cảnh báo
/** Sinh cảnh báo động từ KPI hiện tại (§4.6). */
export async function layCanhBao(): Promise<CanhBao[]> {
  const kq: CanhBao[] = [];
  let i = 0;
  const them = (
    loai: string,
    mucDo: CanhBao["mucDo"],
    maCongTrinh: string | null,
    tieuDe: string,
    moTa: string,
    nguoi: string
  ) => {
    kq.push({
      id: `cb-${++i}`,
      loai,
      mucDo,
      maCongTrinh,
      tieuDe,
      moTa,
      trangThai: i % 4 === 0 ? "Đang xử lý" : "Mới",
      nguoiChiuTrachNhiem: nguoi,
      ngayPhatSinh: "2026-07-18",
    });
  };

  for (const r of await danhMucSucKhoe()) {
    const ct = r.congTrinh;
    if (r.tyLeNganSach !== null && r.tyLeNganSach > NGUONG.tyLeNganSachDo) {
      them("VUOT_NGAN_SACH", "P0", ct.maCongTrinh, "Chi phí vượt ngân sách", `Đã dùng ${(r.tyLeNganSach * 100).toFixed(1)}% ngân sách được duyệt.`, ct.chiHuyTruong);
    }
    if (r.doanhThu > 0 && r.loiNhuan < 0) {
      them("LOI_NHUAN_AM", "P0", ct.maCongTrinh, "Lợi nhuận công trình âm", "Chi phí thực hiện đang cao hơn doanh thu ghi nhận.", ct.chiHuyTruong);
    }
    if (r.doanhThu === 0 && r.chiPhi > 0) {
      them("CHUA_CO_DOANH_THU", "P0", ct.maCongTrinh, "Chưa ghi nhận doanh thu", `Đã phát sinh ${Math.round(r.chiPhi).toLocaleString("vi-VN")} đ chi phí nhưng chưa có dòng doanh thu nào. Cần xác minh: chưa tới kỳ ra bill, hay bị thiếu dữ liệu?`, ct.chiHuyTruong);
    }
    if (r.bienLN !== null && r.bienLN >= 0 && r.bienLN < NGUONG.bienLNToiThieu) {
      them("BIEN_LN_THAP", "P1", ct.maCongTrinh, "Biên lợi nhuận dưới ngưỡng", `Biên hiện tại ${(r.bienLN * 100).toFixed(1)}%, dưới ngưỡng ${(NGUONG.bienLNToiThieu * 100).toFixed(0)}%.`, ct.chiHuyTruong);
    }
    if (r.ngayTre > NGUONG.soNgayTreDo) {
      them("CHAM_BAO_CAO", "P0", ct.maCongTrinh, "Chưa cập nhật dữ liệu đúng hạn", `Đã ${r.ngayTre} ngày chưa nộp dữ liệu.`, ct.phongPhuTrach ?? ct.chiHuyTruong);
    }
    if (r.soLoiDuLieu > 0) {
      them("LOI_DU_LIEU", "P1", ct.maCongTrinh, "Còn lỗi dữ liệu chưa xử lý", `${r.soLoiDuLieu} dòng đang nằm ở vùng chờ, chưa ghi sổ.`, ct.chiHuyTruong);
    }
  }

  for (const d of await coCauChiPhi()) {
    if (d.tyTrongTrenCP > NGUONG.tyTrongMaChiPhiToiDa) {
      them("TY_TRONG_MA", "P1", null, `Mã ${d.ma} chiếm tỷ trọng lớn`, `${d.ten} chiếm ${(d.tyTrongTrenCP * 100).toFixed(1)}% tổng chi phí.`, "Phòng Tài chính");
    }
  }

  const thuTu = { P0: 0, P1: 1, P2: 2 };
  return kq.sort((a, b) => thuTu[a.mucDo] - thuTu[b.mucDo]);
}

// ------------------------------------------------------------ Xếp hạng
export async function topLoiNhuan(n = 10) {
  return (await danhMucSucKhoe())
    .filter((r) => r.doanhThu > 0)
    .sort((a, b) => b.loiNhuan - a.loiNhuan)
    .slice(0, n);
}

export async function topRuiRo(n = 10) {
  return (await danhMucSucKhoe())
    .filter((r) => r.tyLeNganSach !== null)
    .sort((a, b) => (b.tyLeNganSach ?? 0) - (a.tyLeNganSach ?? 0))
    .slice(0, n);
}

/** Tình trạng nộp dữ liệu của các công trình. */
export async function tinhTrangNopDuLieu() {
  return (await layCongTrinh())
    .map((ct) => {
      const ngayTre = soNgayChuaCapNhat(ct.ngayCapNhatCuoi);
      return {
        congTrinh: ct,
        ngayTre,
        trangThai:
          ngayTre > NGUONG.soNgayTreDo
            ? ("Quá hạn" as const)
            : ngayTre > NGUONG.soNgayTreVang
              ? ("Chậm" as const)
              : ("Đúng hạn" as const),
      };
    })
    .sort((a, b) => b.ngayTre - a.ngayTre);
}

export { tyLeHoanThanhDoanhThu, tyLeSuDungNganSach };

// ------------------------------------------------------------ Báo cáo EVM
/**
 * EVM PHẦN CHI PHÍ.
 *
 * CỐ Ý KHÔNG có SPI và SV. Baseline kế hoạch hiện chỉ trải T1–T7/2026 trong khi
 * công trình chạy sang 2027, nên tại thời điểm đánh giá PV đã bằng trọn BAC và
 * SPI suy biến thành đúng % hoàn thành — một con số vô nghĩa, thà không hiện.
 *
 * EV = % hoàn thành VẬT LÝ × BAC. Phần trăm lấy từ BOQ (khối lượng thực hiện đã
 * xác nhận / khối lượng hợp đồng) chứ không suy từ tiền đã tiêu — suy từ tiền thì
 * CPI luôn bằng 1 và cả phép đo mất ý nghĩa.
 *
 * Quy đổi về CÙNG ĐƠN VỊ CHI PHÍ: EV và AC đều tính theo ngân sách chi phí. Không
 * lấy giá trị BOQ (đơn giá bán) làm EV — so giá bán với giá vốn ra biên lợi nhuận,
 * không phải CPI.
 */
export interface DongEVM {
  maCongTrinh: string;
  tenCongTrinh: string;
  /** 0–1, theo khối lượng BOQ đã xác nhận. */
  phanTramHT: number;
  bac: number;
  ev: number;
  ac: number;
  cv: number;
  cpi: number | null;
  eac: number | null;
  etc: number | null;
  vac: number | null;
  tcpi: number | null;
}

/** Giá trị hợp đồng BOQ và lũy kế đã xác nhận, theo từng công trình có BOQ. */
const goiBOQ = cache(async () => {
  const { idSangMa } = await banDoCongTrinh();
  const hopDong = new Map<string, number>();
  for (const l of await db.bOQLine.findMany({
    select: { projectId: true, khoiLuong: true, donGia: true },
  })) {
    const ma = idSangMa.get(l.projectId);
    if (!ma) continue;
    hopDong.set(ma, (hopDong.get(ma) ?? 0) + Math.round(l.khoiLuong * l.donGia));
  }

  // Lũy kế theo tháng, chỉ tháng đã xác nhận — dùng lại đúng nguồn của KPI.
  const { theoThang } = await billTuBOQ();
  const luyKeThang = new Map<string, number>(); // `maCongTrinh|thang`
  for (const [k, v] of theoThang) {
    const [pid, thang] = k.split("|");
    const ma = idSangMa.get(pid);
    if (ma) luyKeThang.set(`${ma}|${thang}`, v);
  }
  return { hopDong, luyKeThang };
});

/** Ngân sách chi phí (BAC) và chi phí thực tế (AC) theo công trình. */
const bacVaAc = cache(async () => {
  const [{ idSangMa }, loai] = await Promise.all([banDoCongTrinh(), banDoLoai()]);
  const maChiPhi = [...loai.entries()].filter(([, l]) => l === "Chi phí").map(([m]) => m);

  const bac = new Map<string, number>();
  for (const r of await db.planLine.groupBy({
    by: ["projectId"],
    _sum: { giaTri: true },
    where: { maDTCP: { in: maChiPhi } },
  })) {
    const ma = idSangMa.get(r.projectId);
    if (ma) bac.set(ma, r._sum.giaTri ?? 0);
  }

  const ac = new Map<string, number>();
  for (const r of await db.transaction.groupBy({
    by: ["projectId"],
    _sum: { soTien: true },
    where: { maDTCP: { in: maChiPhi } },
  })) {
    const ma = idSangMa.get(r.projectId);
    if (ma) ac.set(ma, r._sum.soTien ?? 0);
  }
  return { bac, ac };
});

export async function chiSoEVM(): Promise<DongEVM[]> {
  const [congTrinh, { hopDong, luyKeThang }, { bac, ac }] = await Promise.all([
    layCongTrinh(),
    goiBOQ(),
    bacVaAc(),
  ]);

  return congTrinh
    .filter((ct) => (hopDong.get(ct.maCongTrinh) ?? 0) > 0)
    .map((ct) => {
      const hd = hopDong.get(ct.maCongTrinh)!;
      let luyKe = 0;
      for (const [k, v] of luyKeThang) {
        if (k.startsWith(`${ct.maCongTrinh}|`)) luyKe += v;
      }
      const phanTramHT = Math.min(1, luyKe / hd);
      const BAC = bac.get(ct.maCongTrinh) ?? 0;
      const AC = ac.get(ct.maCongTrinh) ?? 0;
      const EV = phanTramHT * BAC;
      const cpi = AC > 0 ? EV / AC : null;
      const eac = cpi && cpi > 0 ? BAC / cpi : null;
      // TCPI: hiệu suất chi phí phải đạt cho phần việc còn lại nếu muốn về đúng BAC.
      const conLai = BAC - AC;
      const tcpi = conLai > 0 ? (BAC - EV) / conLai : null;
      return {
        maCongTrinh: ct.maCongTrinh,
        tenCongTrinh: ct.tenCongTrinh,
        phanTramHT,
        bac: BAC,
        ev: EV,
        ac: AC,
        cv: EV - AC,
        cpi,
        eac,
        etc: eac === null ? null : eac - AC,
        vac: eac === null ? null : BAC - eac,
        tcpi,
      };
    })
    .sort((a, b) => (a.cpi ?? 9) - (b.cpi ?? 9));
}

/**
 * Chuỗi EV và AC LŨY TIẾN theo tháng, gộp các công trình có BOQ (hoặc một công
 * trình nếu truyền mã). Không kèm PV — xem lý do ở `chiSoEVM`.
 */
export async function chuoiEVM(
  maCongTrinh?: string
): Promise<{ thang: string; ev: number; ac: number }[]> {
  const [thangGiaoDich, { hopDong, luyKeThang }, { bac }, loai, { maSangId }] = await Promise.all([
    cacThang(),
    goiBOQ(),
    bacVaAc(),
    banDoLoai(),
    banDoCongTrinh(),
  ]);

  /*
   * Trục tháng là HỢP của tháng có giao dịch và tháng có khối lượng BOQ đã xác nhận.
   * Lấy mỗi tháng giao dịch thì chuỗi bị cắt ở T7 trong khi BOQ đã xác nhận đến T9,
   * làm điểm cuối của biểu đồ thấp hơn tổng EV ở bảng — cùng một chỉ số ra hai số.
   */
  const thangs = [
    ...new Set([...thangGiaoDich, ...[...luyKeThang.keys()].map((k) => k.split("|")[1])]),
  ].sort();
  const maChiPhi = [...loai.entries()].filter(([, l]) => l === "Chi phí").map(([m]) => m);

  const dsMa = (await layCongTrinh())
    .map((c) => c.maCongTrinh)
    .filter((m) => (hopDong.get(m) ?? 0) > 0 && (!maCongTrinh || m === maCongTrinh));
  const ids = dsMa.map((m) => maSangId.get(m)).filter(Boolean) as string[];

  const acRows = await db.transaction.groupBy({
    by: ["thangThucHien"],
    _sum: { soTien: true },
    where: { projectId: { in: ids }, maDTCP: { in: maChiPhi } },
  });
  const acThang = new Map(acRows.map((r) => [r.thangThucHien, r._sum.soTien ?? 0]));

  let acLuy = 0;
  return thangs.map((t) => {
    acLuy += acThang.get(t) ?? 0;
    // EV lũy tiến = tổng theo từng công trình của (%HT đến hết tháng t × BAC).
    let ev = 0;
    for (const m of dsMa) {
      const hd = hopDong.get(m)!;
      let luyKe = 0;
      for (const [k, v] of luyKeThang) {
        const [maCT, thang] = k.split("|");
        if (maCT === m && thang <= t) luyKe += v;
      }
      ev += Math.min(1, luyKe / hd) * (bac.get(m) ?? 0);
    }
    return { thang: t, ev, ac: acLuy };
  });
}
