/**
 * ★ RANH GIỚI DỮ LIỆU — MODULE QUẢN LÝ CÔNG NHÂN ★
 *
 * Đặt riêng khỏi `repository.ts` vì module này độc lập với phần doanh thu – chi
 * phí: nó không đọc và cũng không ghi vào `Transaction`, nên không làm xê dịch
 * bất kỳ con số nào của các tab khác.
 *
 * LỌC PHẠM VI NẰM Ở ĐÂY, KHÔNG Ở COMPONENT — cùng quy tắc với `repository.ts`.
 * Người chỉ được giao vài công trình thì mọi truy vấn chấm công đều bị kẹp lại,
 * kể cả khi gõ thẳng URL.
 */
import { cache } from "react";
import { db } from "../db";
import { nguoiDungHienTai } from "../auth/phien";
import { phamViCongTrinh } from "../auth/quyen";

export type Doi = "NOI_THANH" | "NGOAI_THANH";

export const NHAN_DOI: Record<Doi, string> = {
  NOI_THANH: "Đội thi công",
  NGOAI_THANH: "Đội DA",
};

export type Buoi = "CA_NGAY" | "SANG" | "CHIEU";

export const NHAN_BUOI: Record<Buoi, string> = {
  CA_NGAY: "Cả ngày",
  SANG: "Sáng",
  CHIEU: "Chiều",
};

export type LoaiVang = "CO_PHEP" | "KHONG_PHEP";

/** Chủ nhật theo lịch (getDay() === 0). Ngày dạng yyyy-MM-dd. */
export function laChuNhat(ngay: string): boolean {
  return new Date(`${ngay}T00:00:00`).getDay() === 0;
}

/**
 * Công thường của một dòng chấm công (KHÔNG tính Chủ nhật hay ngày lễ — hai loại
 * đó chỉ tính tăng ca). Mỗi ca làm hoặc nghỉ CÓ PHÉP tính 0,5; nghỉ không phép 0.
 */
export function congCuaCham(
  c: {
    ngay: string;
    caSang: boolean;
    caChieu: boolean;
    loaiVang: string | null;
  },
  laLe = false
): number {
  if (laChuNhat(c.ngay) || laLe) return 0;
  const coPhep = c.loaiVang === "CO_PHEP";
  const caCong = (lam: boolean) => (lam ? 0.5 : coPhep ? 0.5 : 0);
  return caCong(c.caSang) + caCong(c.caChieu);
}

/**
 * Phần công đến từ NGHỈ CÓ PHÉP của một dòng: mỗi ca không làm nhưng nghỉ có
 * phép tính 0,5. Là một phần nằm trong `congCuaCham` — tách ra để hiện riêng.
 */
export function congNghiPhep(
  c: {
    ngay: string;
    caSang: boolean;
    caChieu: boolean;
    loaiVang: string | null;
  },
  laLe = false
): number {
  if (laChuNhat(c.ngay) || laLe || c.loaiVang !== "CO_PHEP") return 0;
  return (c.caSang ? 0 : 0.5) + (c.caChieu ? 0 : 0.5);
}

// ------------------------------------------------------------ Phạm vi
/**
 * Phạm vi công trình của người dùng TRONG module chấm công.
 *
 * Ngoài phạm vi giao qua Quản trị (UserProject), người QUẢN LÝ một Đội DA còn
 * được thấy các công trình của dự án mình quản lý — để chấm công cho cả đội. Nhờ
 * vậy ở tab Chấm công họ "chỉ thấy dự án của mình" mà không cần gán tay từng công
 * trình. Người toàn công ty (null) thì thấy hết, không cần bù thêm.
 */
const phamViHienTai = cache(async (): Promise<string[] | null> => {
  const u = await nguoiDungHienTai();
  const base = phamViCongTrinh(u);
  if (base === null || !u) return base;
  const doi = await db.doiDA.findMany({
    where: { nguoiQuanLyId: u.id },
    include: { congTrinhs: { include: { congTrinh: true } } },
  });
  const them = doi.flatMap((d) => d.congTrinhs.map((c) => c.congTrinh.maCongTrinh));
  return them.length ? [...new Set([...base, ...them])] : base;
});

/** Công trình người dùng được phép thấy, kèm khu vực chấm công. */
export const layCongTrinhChamCong = cache(async () => {
  const pv = await phamViHienTai();
  const ds = await db.project.findMany({
    where: { isActive: true, ...(pv === null ? {} : { maCongTrinh: { in: pv } }) },
    orderBy: { maCongTrinh: "asc" },
    // Người phụ trách KHÔNG nhập tay nữa: tự động là người được giao công trình
    // này trong Quản trị (bảng UserProject). Kéo kèm để dựng tên tại chỗ.
    include: {
      chamCongCT: { include: { doiDA: true } },
      nguoiDuocGan: { include: { user: true } },
    },
  });
  return ds.map((p) => ({
    id: p.id,
    maCongTrinh: p.maCongTrinh,
    tenCongTrinh: p.tenCongTrinh,
    tenRutGon: p.tenRutGon ?? "",
    khuVuc: (p.chamCongCT?.khuVuc ?? "NOI_THANH") as Doi,
    /** Đội DA sở hữu công trình (khi ngoại thành). */
    doiDAId: p.chamCongCT?.doiDAId ?? "",
    tenDoiDA: p.chamCongCT?.doiDA?.ten ?? "",
    nguoiPhuTrach: p.nguoiDuocGan
      .filter((g) => g.user.isActive)
      .map((g) => g.user.hoTen)
      .join(", "),
  }));
});

/** Điều kiện `where` theo `projectId` cho các bảng chấm công. */
async function locProjectId() {
  const pv = await phamViHienTai();
  if (pv === null) return {};
  const ds = await db.project.findMany({
    where: { maCongTrinh: { in: pv } },
    select: { id: true },
  });
  return { projectId: { in: ds.map((p) => p.id) } };
}

/** Công trình có nằm trong phạm vi không — dùng ở server action trước khi ghi. */
export async function congTrinhTrongPhamVi(projectId: string) {
  const pv = await phamViHienTai();
  const p = await db.project.findUnique({ where: { id: projectId } });
  if (!p?.isActive) return null;
  if (pv !== null && !pv.includes(p.maCongTrinh)) return null;
  return p;
}

// ------------------------------------------------------------ Hồ sơ công nhân
export interface DongCongNhan {
  id: string;
  maCN: string;
  hoTen: string;
  doi: Doi;
  /** Khóa đội DA (chỉ NGOAI_THANH) — để lưu; rỗng nếu chưa gán. */
  doiDAId: string;
  /** Tên đội DA để hiển thị/nhóm tab (lấy từ danh mục DoiDA). */
  tenDoiDA: string;
  ngheNghiep: string;
  nguoiQuanLy: string;
  ghiChu: string;
}

export const layCongNhan = cache(async (): Promise<DongCongNhan[]> => {
  const ds = await db.congNhan.findMany({
    orderBy: [{ doi: "asc" }, { maCN: "asc" }],
    include: { doiDA: true },
  });
  return ds.map((c) => ({
    id: c.id,
    maCN: c.maCN,
    hoTen: c.hoTen,
    doi: c.doi as Doi,
    doiDAId: c.doiDAId ?? "",
    tenDoiDA: c.doiDA?.ten ?? "",
    ngheNghiep: c.ngheNghiep ?? "",
    nguoiQuanLy: c.nguoiQuanLy ?? "",
    ghiChu: c.ghiChu ?? "",
  }));
});

export interface ODoiDA {
  id: string;
  ten: string;
  /** Số công nhân / công trình đang thuộc đội — để chặn xoá khi còn dùng. */
  soCongNhan: number;
  soCongTrinh: number;
  /** Người quản lý đội (tài khoản User) — chấm công cho cả dự án. */
  nguoiQuanLyId: string;
  nguoiQuanLy: string;
  /** projectId các công trình đã nhóm vào dự án — để tick sẵn ở form sửa. */
  congTrinhIds: string[];
}

/** Danh mục Đội DA (đội dự án ngoại thành). */
export const layDoiDA = cache(async (): Promise<ODoiDA[]> => {
  const ds = await db.doiDA.findMany({
    orderBy: { ten: "asc" },
    include: {
      _count: { select: { congNhans: true, congTrinhs: true } },
      nguoiQuanLy: true,
      congTrinhs: { select: { projectId: true } },
    },
  });
  return ds.map((d) => ({
    id: d.id,
    ten: d.ten,
    soCongNhan: d._count.congNhans,
    soCongTrinh: d._count.congTrinhs,
    nguoiQuanLyId: d.nguoiQuanLyId ?? "",
    nguoiQuanLy: d.nguoiQuanLy?.hoTen ?? "",
    congTrinhIds: d.congTrinhs.map((c) => c.projectId),
  }));
});

export interface OCanBoUser {
  id: string;
  hoTen: string;
}

/**
 * Cán bộ (User) đủ điều kiện làm người quản lý Đội DA: đúng ba vai trò hiện
 * trường và đang hoạt động. Trả kèm id để lưu FK (khác `dsCanBo` chỉ trả tên).
 */
export const layCanBoUser = cache(async (): Promise<OCanBoUser[]> => {
  const us = await db.user.findMany({
    where: {
      isActive: true,
      vaiTro: { in: ["CHI_HUY_TRUONG", "CAN_BO_KY_THUAT", "CHUYEN_VIEN_CAO"] },
    },
    select: { id: true, hoTen: true },
    orderBy: { hoTen: "asc" },
  });
  return us.map((u) => ({ id: u.id, hoTen: u.hoTen }));
});

/**
 * Danh sách tên cán bộ để gợi ý khi nhập người quản lý / người phụ trách.
 *
 * CHỈ tài khoản có đúng ba vai trò được giao việc chấm công: Chỉ huy trưởng,
 * Cán bộ kỹ thuật, Chuyên viên bậc cao. Nguồn là bảng `User` — nơi duy nhất
 * gắn tên với vai trò; tên chỉ huy trưởng ghi tự do trong công trình không phải
 * tài khoản nên không đưa vào.
 */
export const dsCanBo = cache(async (): Promise<string[]> => {
  const us = await db.user.findMany({
    where: {
      isActive: true,
      vaiTro: { in: ["CHI_HUY_TRUONG", "CAN_BO_KY_THUAT", "CHUYEN_VIEN_CAO"] },
    },
    select: { hoTen: true },
  });
  const ten = new Set<string>();
  for (const u of us) {
    const t = u.hoTen.trim();
    if (t) ten.add(t);
  }
  return [...ten].sort((a, b) => a.localeCompare(b, "vi"));
});

/**
 * Người dùng hiện tại có được cử làm "Cán bộ quản lý công nhân" không.
 *
 * Không phải cả vai trò: chỉ người thuộc nhóm CHT/CBKT/CVBC mà TÊN được gán ở cột
 * Người quản lý của ít nhất một công nhân. Cán bộ quản lý mới được thao tác Hồ sơ
 * và Phân công (xem `thaoTacTabCongNhan`). ADMIN luôn đúng.
 */
export const laCanBoQuanLyCN = cache(async (): Promise<boolean> => {
  const u = await nguoiDungHienTai();
  if (!u) return false;
  if (u.vaiTro === "ADMIN") return true;
  if (!["CHI_HUY_TRUONG", "CAN_BO_KY_THUAT", "CHUYEN_VIEN_CAO"].includes(u.vaiTro)) return false;
  const ten = u.hoTen.trim();
  if (!ten) return false;
  const co = await db.congNhan.findFirst({ where: { nguoiQuanLy: ten }, select: { id: true } });
  return !!co;
});

// ------------------------------------------------------------ Ngày lễ
export interface DongNgayLe {
  id: string;
  thang: number;
  ngay: number;
  /** null = lặp lại hằng năm; có năm = chỉ năm đó. */
  nam: number | null;
  ten: string;
}

/**
 * Danh sách ngày lễ ADMIN đã khai báo. Lặp hằng năm xếp trước (theo tháng/ngày),
 * rồi tới lễ theo năm cụ thể. Toàn công ty dùng chung.
 */
export const layNgayLe = cache(async (): Promise<DongNgayLe[]> => {
  const ds = await db.ngayLe.findMany();
  return ds
    .map((n) => ({ id: n.id, thang: n.thang, ngay: n.ngay, nam: n.nam, ten: n.ten }))
    .sort(
      (a, b) =>
        (a.nam === null ? 0 : 1) - (b.nam === null ? 0 : 1) ||
        (a.nam ?? 0) - (b.nam ?? 0) ||
        a.thang - b.thang ||
        a.ngay - b.ngay
    );
});

/** Kiểm tra một ngày (yyyy-MM-dd) có phải ngày lễ không — xét cả lặp hằng năm. */
export interface KiemNgayLe {
  co(ngay: string): boolean;
}

/** Nạp ngày lễ một lần rồi trả bộ kiểm tra (số lượng nhỏ). */
async function napNgayLe(): Promise<KiemNgayLe> {
  const ds = await db.ngayLe.findMany({ select: { thang: true, ngay: true, nam: true } });
  // Lặp hằng năm khớp theo "MM-DD"; lễ theo năm khớp đúng "yyyy-MM-dd".
  const hangNam = new Set<string>();
  const theoNam = new Set<string>();
  const md = (thang: number, ngay: number) =>
    `${String(thang).padStart(2, "0")}-${String(ngay).padStart(2, "0")}`;
  for (const n of ds) {
    if (n.nam === null) hangNam.add(md(n.thang, n.ngay));
    else theoNam.add(`${n.nam}-${md(n.thang, n.ngay)}`);
  }
  return {
    co: (ngay) => hangNam.has(ngay.slice(5)) || theoNam.has(ngay),
  };
}

// ------------------------------------------------------------ Chấm công
/**
 * Một dòng chấm công = một lượt điều động trong ngày (công nhân × công trình),
 * kèm trạng thái đã chấm nếu có. Cán bộ phụ trách chấm THEO danh sách điều động.
 */
export interface DongChamCong {
  congNhanId: string;
  projectId: string;
  maCN: string;
  hoTen: string;
  maCongTrinh: string;
  tenCongTrinh: string;
  buoiPhanCong: Buoi;
  caSang: boolean;
  caChieu: boolean;
  loaiVang: LoaiVang | null;
  lyDoVang: string;
  gioTangCaNgay: number;
  gioTangCaDem: number;
  /** Đã có bản ghi chấm công (để phân biệt "chưa chấm" với "chấm 0 công"). */
  daCham: boolean;
}

// ------------------------------------------------------------ Mốc ngày
/** Hôm nay theo ĐỒNG HỒ MÁY (không phải NGAY_HIEN_TAI của bộ dữ liệu), yyyy-MM-dd. */
export function homNay(): string {
  const d = new Date();
  const th = String(d.getMonth() + 1).padStart(2, "0");
  const ng = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${th}-${ng}`;
}

/**
 * Lịch của ngày này còn sửa được không?
 *
 * Cho sửa từ HÔM QUA trở đi: điều chuyển bất ngờ trong ngày là chuyện thường nên
 * phải vá được lịch hôm nay và hôm qua. Quá một ngày thì chốt, không sửa nữa —
 * nếu không thì số liệu các kỳ đã tổng hợp có thể bị đổi sau lưng.
 */
export function choPhepSuaLich(ngay: string): boolean {
  const d = new Date(`${homNay()}T00:00:00`);
  d.setDate(d.getDate() - 1);
  const th = String(d.getMonth() + 1).padStart(2, "0");
  const ng = String(d.getDate()).padStart(2, "0");
  return ngay >= `${d.getFullYear()}-${th}-${ng}`;
}

export interface NgayDieuDong {
  ngay: string;
  soLuot: number;
  soCongTrinh: number;
  soCongNhan: number;
  /** Bảng tổng hợp xem nhanh ngay trong lịch sử, khỏi phải mở bảng ma trận. */
  congTrinh: { maCongTrinh: string; tenCongTrinh: string; tenRutGon: string; congNhan: string[] }[];
}

/**
 * Lịch điều động xếp phân cấp THÁNG > NGÀY, mới nhất trước, kèm bảng tổng hợp
 * từng công trình để xem nhanh trong lịch sử.
 */
export async function lichDieuDong(): Promise<{ thang: string; ngays: NgayDieuDong[] }[]> {
  const ds = await db.phanCongNgay.findMany({
    where: await locProjectId(),
    include: { congNhan: true, congTrinh: true },
  });

  const theoNgay = new Map<
    string,
    { ct: Map<string, { ten: string; rutGon: string; cn: string[] }>; cnIds: Set<string>; soLuot: number }
  >();
  for (const p of ds) {
    const o = theoNgay.get(p.ngay) ?? { ct: new Map(), cnIds: new Set<string>(), soLuot: 0 };
    o.soLuot++;
    o.cnIds.add(p.congNhanId);
    const c =
      o.ct.get(p.congTrinh.maCongTrinh) ??
      { ten: p.congTrinh.tenCongTrinh, rutGon: p.congTrinh.tenRutGon ?? "", cn: [] };
    c.cn.push(`${p.congNhan.hoTen} (${NHAN_BUOI[p.buoi as Buoi]})`);
    o.ct.set(p.congTrinh.maCongTrinh, c);
    theoNgay.set(p.ngay, o);
  }

  const ngays: NgayDieuDong[] = [...theoNgay.entries()]
    .map(([ngay, o]) => ({
      ngay,
      soLuot: o.soLuot,
      soCongTrinh: o.ct.size,
      soCongNhan: o.cnIds.size,
      congTrinh: [...o.ct.entries()]
        .map(([maCongTrinh, c]) => ({
          maCongTrinh,
          tenCongTrinh: c.ten,
          tenRutGon: c.rutGon,
          congNhan: c.cn,
        }))
        .sort((a, b) => a.maCongTrinh.localeCompare(b.maCongTrinh)),
    }))
    .sort((a, b) => b.ngay.localeCompare(a.ngay));

  const theoThang = new Map<string, NgayDieuDong[]>();
  for (const n of ngays) {
    const t = n.ngay.slice(0, 7);
    theoThang.set(t, [...(theoThang.get(t) ?? []), n]);
  }
  return [...theoThang.entries()]
    .map(([thang, ds2]) => ({ thang, ngays: ds2 }))
    .sort((a, b) => b.thang.localeCompare(a.thang));
}

/**
 * Ba ngày điều động gần nhất (không tính `ngay` đang mở), kèm ma trận ô của mỗi
 * ngày — làm nguồn để chép sang ngày mới.
 */
export async function baNgayMauChep(
  ngay: string
): Promise<{ ngay: string; o: Record<string, Buoi> }[]> {
  const rows = await db.phanCongNgay.findMany({
    where: { ngay: { not: ngay }, ...(await locProjectId()) },
    select: { ngay: true },
    distinct: ["ngay"],
    orderBy: { ngay: "desc" },
    take: 3,
  });
  const out: { ngay: string; o: Record<string, Buoi> }[] = [];
  for (const r of rows) out.push({ ngay: r.ngay, o: await oDaPhan(r.ngay) });
  return out;
}

/** Ô đã phân của một ngày: `congNhanId|projectId` -> buổi. Cho ma trận đặt sẵn. */
export async function oDaPhan(ngay: string): Promise<Record<string, Buoi>> {
  const ds = await db.phanCongNgay.findMany({
    where: { ngay, ...(await locProjectId()) },
    select: { congNhanId: true, projectId: true, buoi: true },
  });
  return Object.fromEntries(ds.map((p) => [`${p.congNhanId}|${p.projectId}`, p.buoi as Buoi]));
}

/**
 * Danh sách chấm công của một ngày = HỢP của (điều động) và (chấm công đã lưu).
 *
 * Dựng chính từ điều động, ghép trạng thái đã chấm. NHƯNG chấm công đã lưu mà điều
 * động gốc bị xoá sau đó (mồ côi) VẪN phải hiện — nếu chỉ dựng từ điều động thì số
 * công đã chấm biến mất khỏi màn hình và không sửa được nữa (mất dữ liệu thật).
 */
export async function chamCongNgay(ngay: string): Promise<DongChamCong[]> {
  const loc = await locProjectId();
  const [phan, cham] = await Promise.all([
    db.phanCongNgay.findMany({
      where: { ngay, ...loc },
      include: { congNhan: true, congTrinh: true },
      orderBy: [{ congTrinh: { maCongTrinh: "asc" } }, { congNhan: { maCN: "asc" } }],
    }),
    db.chamCong.findMany({ where: { ngay, ...loc }, include: { congNhan: true, congTrinh: true } }),
  ]);
  const traCham = new Map(cham.map((c) => [`${c.congNhanId}|${c.projectId}`, c]));

  const tuPhan = new Set<string>();
  const ds: DongChamCong[] = phan.map((p) => {
    const key = `${p.congNhanId}|${p.projectId}`;
    tuPhan.add(key);
    const c = traCham.get(key);
    return {
      congNhanId: p.congNhanId,
      projectId: p.projectId,
      maCN: p.congNhan.maCN,
      hoTen: p.congNhan.hoTen,
      maCongTrinh: p.congTrinh.maCongTrinh,
      tenCongTrinh: p.congTrinh.tenCongTrinh,
      buoiPhanCong: p.buoi as Buoi,
      caSang: c?.caSang ?? false,
      caChieu: c?.caChieu ?? false,
      loaiVang: (c?.loaiVang ?? null) as LoaiVang | null,
      lyDoVang: c?.lyDoVang ?? "",
      gioTangCaNgay: c?.gioTangCaNgay ?? 0,
      gioTangCaDem: c?.gioTangCaDem ?? 0,
      daCham: !!c,
    };
  });

  // Chấm công mồ côi: đã lưu nhưng không còn dòng điều động tương ứng.
  for (const c of cham) {
    const key = `${c.congNhanId}|${c.projectId}`;
    if (tuPhan.has(key)) continue;
    ds.push({
      congNhanId: c.congNhanId,
      projectId: c.projectId,
      maCN: c.congNhan.maCN,
      hoTen: c.congNhan.hoTen,
      maCongTrinh: c.congTrinh.maCongTrinh,
      tenCongTrinh: c.congTrinh.tenCongTrinh,
      buoiPhanCong: "CA_NGAY",
      caSang: c.caSang,
      caChieu: c.caChieu,
      loaiVang: (c.loaiVang ?? null) as LoaiVang | null,
      lyDoVang: c.lyDoVang ?? "",
      gioTangCaNgay: c.gioTangCaNgay,
      gioTangCaDem: c.gioTangCaDem,
      daCham: true,
    });
  }

  return ds.sort(
    (a, b) => a.maCongTrinh.localeCompare(b.maCongTrinh) || a.maCN.localeCompare(b.maCN)
  );
}

/** Các ngày đã có chấm công, mới nhất trước — để chọn nhanh trên giao diện. */
export async function cacNgayChamCong(): Promise<string[]> {
  const ds = await db.chamCong.findMany({
    where: await locProjectId(),
    select: { ngay: true },
    distinct: ["ngay"],
    orderBy: { ngay: "desc" },
    take: 60,
  });
  return ds.map((d) => d.ngay);
}

// ------------------------------------------------------------ Chấm công Đội DA
export interface DongChamCongDA {
  congNhanId: string;
  maCN: string;
  hoTen: string;
  /** Công trình đã chấm (từ ChamCong đã lưu) — "" nếu chưa chấm ngày này. */
  projectId: string;
  caSang: boolean;
  caChieu: boolean;
  loaiVang: LoaiVang | null;
  lyDoVang: string;
  gioTangCaNgay: number;
  gioTangCaDem: number;
  daCham: boolean;
}

/**
 * Chấm công TRỰC TIẾP theo dự án (Đội DA): liệt kê SẴN toàn bộ công nhân của đội
 * (không qua điều động), kèm ô chọn công trình trong dự án. Một công nhân một
 * ngày chấm ở một công trình của dự án — nên mỗi người một dòng, ghép chấm đã lưu.
 *
 * Trả null nếu người dùng không được đụng đội này (không phải toàn công ty, không
 * phải người quản lý đội, và không thấy công trình nào của dự án).
 */
export async function chamCongDoiDA(
  doiDAId: string,
  ngay: string
): Promise<{
  ten: string;
  congTrinhs: { id: string; maCongTrinh: string; tenCongTrinh: string; tenRutGon: string }[];
  rows: DongChamCongDA[];
} | null> {
  const doi = await db.doiDA.findUnique({ where: { id: doiDAId } });
  if (!doi) return null;

  // Công trình của dự án MÀ NGƯỜI DÙNG ĐƯỢC THẤY (đã lọc phạm vi ở layCongTrinhChamCong).
  const ct = (await layCongTrinhChamCong()).filter((c) => c.doiDAId === doiDAId);
  const ctIds = ct.map((c) => c.id);

  const u = await nguoiDungHienTai();
  const laToanCongTy = phamViCongTrinh(u) === null;
  const laQuanLy = !!u && doi.nguoiQuanLyId === u.id;
  if (!laToanCongTy && !laQuanLy && ctIds.length === 0) return null;

  const [cn, cham] = await Promise.all([
    db.congNhan.findMany({ where: { doiDAId, doi: "NGOAI_THANH" }, orderBy: { maCN: "asc" } }),
    ctIds.length
      ? db.chamCong.findMany({ where: { ngay, projectId: { in: ctIds } } })
      : Promise.resolve([]),
  ]);
  const traCham = new Map(cham.map((c) => [c.congNhanId, c]));

  const rows: DongChamCongDA[] = cn.map((c) => {
    const d = traCham.get(c.id);
    return {
      congNhanId: c.id,
      maCN: c.maCN,
      hoTen: c.hoTen,
      projectId: d?.projectId ?? "",
      caSang: d?.caSang ?? false,
      caChieu: d?.caChieu ?? false,
      loaiVang: (d?.loaiVang ?? null) as LoaiVang | null,
      lyDoVang: d?.lyDoVang ?? "",
      gioTangCaNgay: d?.gioTangCaNgay ?? 0,
      gioTangCaDem: d?.gioTangCaDem ?? 0,
      daCham: !!d,
    };
  });

  return {
    ten: doi.ten,
    congTrinhs: ct.map((c) => ({
      id: c.id,
      maCongTrinh: c.maCongTrinh,
      tenCongTrinh: c.tenCongTrinh,
      tenRutGon: c.tenRutGon,
    })),
    rows,
  };
}

// ------------------------------------------------------------ Tổng hợp tháng
interface OT {
  /** Tăng ca ngày thường trong giờ hành chính đã qua. */
  tcTrongNgay: number;
  tcQuaDem: number;
  /** Toàn bộ giờ làm Chủ nhật (Chủ nhật không tính công thường). */
  tcChuNhat: number;
  /** Toàn bộ giờ làm ngày lễ (ngày lễ không tính công thường). */
  tcNgayLe: number;
}
export interface TongHopCongNhan extends OT {
  congNhanId: string;
  maCN: string;
  hoTen: string;
  doi: Doi;
  /** Công ĐI LÀM THẬT — chỉ ca có làm, KHÔNG gồm nghỉ phép. */
  soCong: number;
  /** Số công quy từ nghỉ CÓ PHÉP (tách riêng khỏi soCong). */
  nghiPhep: number;
  /** Tổng công = soCong + nghiPhep (nghỉ phép được tính như ngày công). */
  tongCong: number;
}
export interface TongHopCongTrinh extends OT {
  maCongTrinh: string;
  tenCongTrinh: string;
  tenRutGon: string;
  soCong: number;
  soNguoi: number;
}

/**
 * Cộng giờ tăng ca của một dòng vào đúng cột. Ngày lễ và Chủ nhật đều gộp cả
 * hai loại giờ vào cột riêng của mình; ngày lễ được ưu tiên (là mốc ADMIN đặt).
 */
function congOT(
  o: OT,
  c: { ngay: string; gioTangCaNgay: number; gioTangCaDem: number },
  laLe: boolean
) {
  if (laLe) {
    o.tcNgayLe += c.gioTangCaNgay + c.gioTangCaDem;
    return;
  }
  if (laChuNhat(c.ngay)) {
    o.tcChuNhat += c.gioTangCaNgay + c.gioTangCaDem;
    return;
  }
  o.tcTrongNgay += c.gioTangCaNgay;
  o.tcQuaDem += c.gioTangCaDem;
}

/**
 * Tổng hợp tháng — TÍNH LẠI mỗi lần đọc, không lưu bảng riêng.
 *
 * Công tháng = tổng công chấm xác nhận + nghỉ CÓ PHÉP (mỗi ca 0,5). KHÔNG chuẩn
 * hoá về 26: tháng đủ lịch ra đúng số ngày T2–T7 của tháng đó (25/26/27…). Chủ
 * nhật và ngày lễ không tính công thường, chỉ dồn giờ vào cột tăng ca riêng.
 */
export async function tongHopThang(thang: string): Promise<{
  theoCongNhan: TongHopCongNhan[];
  theoCongTrinh: TongHopCongTrinh[];
}> {
  const [ds, tapLe] = await Promise.all([
    db.chamCong.findMany({
      where: { ngay: { startsWith: thang }, ...(await locProjectId()) },
      include: { congNhan: true, congTrinh: true },
    }),
    napNgayLe(),
  ]);

  const cn = new Map<string, TongHopCongNhan>();
  const ct = new Map<string, TongHopCongTrinh & { nguoi: Set<string> }>();

  for (const d of ds) {
    const laLe = tapLe.co(d.ngay);
    const cong = congCuaCham(d, laLe); // đã gồm nghỉ có phép
    const np = congNghiPhep(d, laLe);
    const a =
      cn.get(d.congNhanId) ??
      ({
        congNhanId: d.congNhanId,
        maCN: d.congNhan.maCN,
        hoTen: d.congNhan.hoTen,
        doi: d.congNhan.doi as Doi,
        soCong: 0,
        nghiPhep: 0,
        tongCong: 0,
        tcTrongNgay: 0,
        tcQuaDem: 0,
        tcChuNhat: 0,
        tcNgayLe: 0,
      } satisfies TongHopCongNhan);
    a.soCong += cong - np; // công đi làm thật, bỏ phần nghỉ phép
    a.nghiPhep += np;
    a.tongCong += cong; // = soCong + nghiPhep
    congOT(a, d, laLe);
    cn.set(d.congNhanId, a);

    const b =
      ct.get(d.projectId) ??
      {
        maCongTrinh: d.congTrinh.maCongTrinh,
        tenCongTrinh: d.congTrinh.tenCongTrinh,
        tenRutGon: d.congTrinh.tenRutGon ?? "",
        soCong: 0,
        soNguoi: 0,
        tcTrongNgay: 0,
        tcQuaDem: 0,
        tcChuNhat: 0,
        tcNgayLe: 0,
        nguoi: new Set<string>(),
      };
    b.soCong += cong;
    congOT(b, d, laLe);
    b.nguoi.add(d.congNhanId);
    ct.set(d.projectId, b);
  }

  return {
    theoCongNhan: [...cn.values()].sort((a, b) => b.tongCong - a.tongCong),
    theoCongTrinh: [...ct.values()]
      .map(({ nguoi, ...r }) => ({ ...r, soNguoi: nguoi.size }))
      .sort((a, b) => b.soCong - a.soCong),
  };
}

export interface ONgayTimeSheet {
  ngay: string;
  thu: number; // 0=CN .. 6=T7
  laChuNhat: boolean;
  laNgayLe: boolean;
  /** Công đi làm thật (không gồm nghỉ phép). */
  cong: number;
  /** Công quy từ nghỉ có phép trong ngày. */
  nghiPhep: number;
  /** Giờ tăng ca trong ngày (ban ngày). */
  tcNgay: number;
  /** Giờ tăng ca qua đêm. */
  tcDem: number;
  coCham: boolean;
}

/**
 * Bảng chấm công theo ngày của MỘT công nhân trong tháng — cho time sheet: mỗi
 * ngày trong tháng một ô, kèm công và giờ tăng ca (gộp mọi công trình ngày đó).
 */
export async function timeSheetCongNhan(
  congNhanId: string,
  thang: string
): Promise<{ hoTen: string; maCN: string; ngays: ONgayTimeSheet[] } | null> {
  const cn = await db.congNhan.findUnique({ where: { id: congNhanId } });
  if (!cn) return null;

  const [cham, tapLe] = await Promise.all([
    db.chamCong.findMany({
      where: { congNhanId, ngay: { startsWith: thang }, ...(await locProjectId()) },
    }),
    napNgayLe(),
  ]);
  const theoNgay = new Map<
    string,
    { cong: number; nghiPhep: number; tcNgay: number; tcDem: number }
  >();
  for (const c of cham) {
    const laLe = tapLe.co(c.ngay);
    const o = theoNgay.get(c.ngay) ?? { cong: 0, nghiPhep: 0, tcNgay: 0, tcDem: 0 };
    const np = congNghiPhep(c, laLe);
    o.cong += congCuaCham(c, laLe) - np; // công đi làm thật
    o.nghiPhep += np;
    o.tcNgay += c.gioTangCaNgay;
    o.tcDem += c.gioTangCaDem;
    theoNgay.set(c.ngay, o);
  }

  const [nam, thg] = thang.split("-").map(Number);
  const soNgay = new Date(nam, thg, 0).getDate();
  const ngays: ONgayTimeSheet[] = [];
  for (let d = 1; d <= soNgay; d++) {
    const ngay = `${thang}-${String(d).padStart(2, "0")}`;
    const o = theoNgay.get(ngay);
    const dt = new Date(`${ngay}T00:00:00`);
    ngays.push({
      ngay,
      thu: dt.getDay(),
      laChuNhat: dt.getDay() === 0,
      laNgayLe: tapLe.co(ngay),
      cong: o?.cong ?? 0,
      nghiPhep: o?.nghiPhep ?? 0,
      tcNgay: o?.tcNgay ?? 0,
      tcDem: o?.tcDem ?? 0,
      coCham: !!o,
    });
  }
  return { hoTen: cn.hoTen, maCN: cn.maCN, ngays };
}

/** Các tháng đã có dữ liệu chấm công. */
export async function cacThangChamCong(): Promise<string[]> {
  const ds = await db.chamCong.findMany({
    where: await locProjectId(),
    select: { ngay: true },
  });
  return [...new Set(ds.map((d) => d.ngay.slice(0, 7)))].sort().reverse();
}

// ------------------------------------------------------------ Xuất Excel
export interface ONgayCham {
  /** Ngày công đi làm thật trong ngày (không gồm nghỉ phép). */
  cong: number;
  /** Giờ tăng ca trong ngày (ngày + đêm). */
  ot: number;
}
export interface DuAnCham {
  maCongTrinh: string;
  tenCongTrinh: string;
  /** Ngày (1..soNgay) → công/tăng ca tại dự án này. */
  ngay: Map<number, ONgayCham>;
}
export interface CongNhanCham {
  maCN: string;
  hoTen: string;
  duAn: DuAnCham[];
  /** Tổng công nghỉ có phép trong tháng (tách khỏi ngày công). */
  nghiPhep: number;
}
export interface DuLieuXuatChamCong {
  thang: string;
  nam: number;
  thangSo: number;
  soNgay: number;
  /** Các ngày (1..soNgay) là Chủ nhật. */
  chuNhat: Set<number>;
  /** Các ngày (1..soNgay) là ngày lễ. */
  ngayLe: Set<number>;
  /** Tên đội DA (chỉ khi xuất một đội dự án) — để ghi vào phụ đề bảng; rỗng nếu nội thành. */
  tenDoi: string;
  congNhan: CongNhanCham[];
}

/**
 * Dữ liệu để xuất bảng chấm công tháng của một đội: mỗi công nhân → các dự án →
 * công/tăng ca từng ngày. Dùng cho bộ xuất Excel (Theo dõi công DA + Bảng chấm
 * công). Lọc phạm vi như mọi truy vấn khác trong tầng này.
 */
export async function duLieuXuatChamCong(
  thang: string,
  doi: Doi,
  doiDAId?: string
): Promise<DuLieuXuatChamCong> {
  const [nam, thangSo] = thang.split("-").map(Number);
  const soNgay = new Date(nam, thangSo, 0).getDate();

  const [ds, tapLe, doiRec] = await Promise.all([
    db.chamCong.findMany({
      where: {
        ngay: { startsWith: thang },
        congNhan: { doi, ...(doiDAId ? { doiDAId } : {}) },
        ...(await locProjectId()),
      },
      include: { congNhan: true, congTrinh: true },
    }),
    napNgayLe(),
    doiDAId ? db.doiDA.findUnique({ where: { id: doiDAId }, select: { ten: true } }) : null,
  ]);

  const chuNhat = new Set<number>();
  const ngayLe = new Set<number>();
  for (let d = 1; d <= soNgay; d++) {
    const ngay = `${thang}-${String(d).padStart(2, "0")}`;
    if (laChuNhat(ngay)) chuNhat.add(d);
    if (tapLe.co(ngay)) ngayLe.add(d);
  }

  const map = new Map<string, CongNhanCham & { _pj: Map<string, DuAnCham> }>();
  for (const r of ds) {
    const laLe = tapLe.co(r.ngay);
    const np = congNghiPhep(r, laLe);
    const cong = congCuaCham(r, laLe) - np;
    const ot = r.gioTangCaNgay + r.gioTangCaDem;
    const day = Number(r.ngay.slice(8));

    let cn = map.get(r.congNhanId);
    if (!cn) {
      cn = { maCN: r.congNhan.maCN, hoTen: r.congNhan.hoTen, duAn: [], nghiPhep: 0, _pj: new Map() };
      map.set(r.congNhanId, cn);
    }
    cn.nghiPhep += np;

    let pj = cn._pj.get(r.projectId);
    if (!pj) {
      pj = { maCongTrinh: r.congTrinh.maCongTrinh, tenCongTrinh: r.congTrinh.tenCongTrinh, ngay: new Map() };
      cn._pj.set(r.projectId, pj);
      cn.duAn.push(pj);
    }
    const o = pj.ngay.get(day) ?? { cong: 0, ot: 0 };
    o.cong += cong;
    o.ot += ot;
    pj.ngay.set(day, o);
  }

  const congNhan = [...map.values()]
    .map(({ _pj, ...cn }) => ({
      ...cn,
      duAn: cn.duAn.sort((a, b) => a.maCongTrinh.localeCompare(b.maCongTrinh)),
    }))
    .sort((a, b) => a.maCN.localeCompare(b.maCN));

  return { thang, nam, thangSo, soNgay, chuNhat, ngayLe, tenDoi: doiRec?.ten ?? "", congNhan };
}

// ------------------------------------------------------------ Đối chiếu
export interface DongLech {
  ngay: string;
  maCN: string;
  hoTen: string;
  maCTPhanCong: string;
  maCTThucTe: string;
  /** DOI_CONG_TRINH | KHONG_CHAM | NGOAI_KE_HOACH | QUA_MOT_CONG */
  loai: string;
  ghiChu: string;
  soCong: number;
}

const NHAN_LECH: Record<string, string> = {
  DOI_CONG_TRINH: "Làm khác nơi được phân",
  KHONG_CHAM: "Được phân nhưng không có công",
  NGOAI_KE_HOACH: "Có công nhưng không được phân",
  QUA_MOT_CONG: "Tổng công trong ngày vượt 1",
};

export function nhanLech(loai: string) {
  return NHAN_LECH[loai] ?? loai;
}

/**
 * Đối chiếu phân công (kế hoạch) với chấm công (thực tế) trong một tháng (§6).
 *
 * CHỈ xét đội NỘI THÀNH: đội ngoại thành theo thiết kế không đi qua bước phân
 * công, đưa vào đây thì 100% số dòng đều báo "ngoài kế hoạch" và bảng thành vô
 * dụng.
 */
export async function doiChieuThang(thang: string): Promise<DongLech[]> {
  const loc = await locProjectId();
  const [phan, cham] = await Promise.all([
    db.phanCongNgay.findMany({
      where: { ngay: { startsWith: thang }, ...loc },
      include: { congNhan: true, congTrinh: true },
    }),
    db.chamCong.findMany({
      where: { ngay: { startsWith: thang }, ...loc },
      include: { congNhan: true, congTrinh: true },
    }),
  ]);

  const chamNoiThanh = cham.filter((c) => c.congNhan.doi === "NOI_THANH");

  /*
   * So theo TẬP HỢP site của mỗi (ngày, công nhân) — không so từng cặp dòng.
   * Một công nhân có thể được phân nhiều nơi trong ngày (sáng A, chiều B), nên
   * so cặp sẽ báo lệch sai (phân A × chấm B tưởng là "làm khác nơi").
   */
  const key = (ngay: string, cnId: string) => `${ngay}|${cnId}`;
  const info = new Map<string, { ngay: string; maCN: string; hoTen: string }>();
  const phanTheo = new Map<string, Map<string, string>>(); // key -> projectId -> maCT
  const chamTheo = new Map<string, Map<string, (typeof chamNoiThanh)[number]>>();

  for (const p of phan) {
    const k = key(p.ngay, p.congNhanId);
    info.set(k, { ngay: p.ngay, maCN: p.congNhan.maCN, hoTen: p.congNhan.hoTen });
    (phanTheo.get(k) ?? phanTheo.set(k, new Map()).get(k)!).set(
      p.projectId,
      p.congTrinh.maCongTrinh
    );
  }
  for (const c of chamNoiThanh) {
    const k = key(c.ngay, c.congNhanId);
    info.set(k, { ngay: c.ngay, maCN: c.congNhan.maCN, hoTen: c.congNhan.hoTen });
    (chamTheo.get(k) ?? chamTheo.set(k, new Map()).get(k)!).set(c.projectId, c);
  }

  const ds: DongLech[] = [];

  for (const [k, meta] of info) {
    const pm = phanTheo.get(k);
    const cm = chamTheo.get(k);

    if (pm) {
      // Site được phân mà không thấy chấm ở đó.
      for (const [pid, maCT] of pm) {
        if (!cm?.has(pid)) {
          ds.push({ ...meta, maCTPhanCong: maCT, maCTThucTe: "", loai: "KHONG_CHAM", ghiChu: "", soCong: 0 });
        }
      }
      // Chấm ở site không nằm trong tập được phân -> làm khác nơi được phân.
      const dsPhan = [...pm.values()].join(", ");
      if (cm) {
        for (const [pid, c] of cm) {
          if (!pm.has(pid)) {
            ds.push({
              ...meta,
              maCTPhanCong: dsPhan,
              maCTThucTe: c.congTrinh.maCongTrinh,
              loai: "DOI_CONG_TRINH",
              ghiChu: c.lyDoVang ?? "",
              soCong: congCuaCham(c),
            });
          }
        }
      }
    } else if (cm) {
      // Không được phân gì trong ngày nhưng vẫn có công.
      for (const c of cm.values()) {
        ds.push({
          ...meta,
          maCTPhanCong: "",
          maCTThucTe: c.congTrinh.maCongTrinh,
          loai: "NGOAI_KE_HOACH",
          ghiChu: c.lyDoVang ?? "",
          soCong: congCuaCham(c),
        });
      }
    }
  }

  // Tổng công trong một ngày vượt 1: hợp lệ về mặt dữ liệu (một người có thể
  // làm hai công trình trong ngày) nhưng phải nêu ra để người tổng hợp soi lại.
  const gomNgay = new Map<string, { soCong: number; maCN: string; hoTen: string; ngay: string }>();
  for (const c of cham) {
    const k = `${c.ngay}|${c.congNhanId}`;
    const o = gomNgay.get(k) ?? {
      soCong: 0,
      maCN: c.congNhan.maCN,
      hoTen: c.congNhan.hoTen,
      ngay: c.ngay,
    };
    o.soCong += congCuaCham(c);
    gomNgay.set(k, o);
  }
  for (const o of gomNgay.values()) {
    if (o.soCong > 1) {
      ds.push({
        ngay: o.ngay,
        maCN: o.maCN,
        hoTen: o.hoTen,
        maCTPhanCong: "",
        maCTThucTe: "",
        loai: "QUA_MOT_CONG",
        ghiChu: `Tổng ${o.soCong} công trong ngày`,
        soCong: o.soCong,
      });
    }
  }

  return ds.sort((a, b) => a.ngay.localeCompare(b.ngay) || a.maCN.localeCompare(b.maCN));
}
