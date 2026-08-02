"use server";

/**
 * Server Action của module Quản lý công nhân.
 *
 * CHỐT CHẶN ĐẶT Ở ĐÂY, không chỉ ẩn nút trên giao diện — người dùng có thể gọi
 * thẳng Server Action. Hai lớp kiểm mỗi lần ghi:
 *   1. Vai trò được THAO TÁC đúng tab (Hồ sơ / Phân công / Chấm công).
 *   2. Công trình nằm trong phạm vi được giao (`congTrinhTrongPhamVi`).
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { thaoTacTabCongNhan, type MucCongNhan } from "@/lib/auth/quyen";
import {
  choPhepSuaLich,
  congTrinhTrongPhamVi,
  laCanBoQuanLyCN,
  layCongTrinhChamCong,
} from "@/lib/data/cong-nhan";

export interface KetQuaCN {
  ok: boolean;
  thongDiep: string;
}

const DOI = ["NOI_THANH", "NGOAI_THANH"];

async function kiemThaoTac(tab: MucCongNhan): Promise<{ ten: string } | { loi: string }> {
  const u = await nguoiDungHienTai();
  const laCanBoQL = await laCanBoQuanLyCN();
  if (!thaoTacTabCongNhan(u, tab, laCanBoQL)) {
    return { loi: "Vai trò của bạn không được phép thao tác ở mục này." };
  }
  return { ten: u!.hoTen || u!.email };
}

/** yyyy-MM-dd, không nhận chuỗi rác vì ngày là khóa gom nhóm của cả module. */
function ngayHopLe(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

// ------------------------------------------------------------ Hồ sơ công nhân
export async function luuCongNhan(formData: FormData): Promise<KetQuaCN> {
  const q = await kiemThaoTac("ho-so");
  if ("loi" in q) return { ok: false, thongDiep: q.loi };

  const id = String(formData.get("id") ?? "").trim();
  const maCN = String(formData.get("maCN") ?? "").trim();
  const hoTen = String(formData.get("hoTen") ?? "").trim();
  const doi = String(formData.get("doi") ?? "NOI_THANH");
  const ngheNghiep = String(formData.get("ngheNghiep") ?? "").trim();
  const nguoiQuanLy = String(formData.get("nguoiQuanLy") ?? "").trim();
  const ghiChu = String(formData.get("ghiChu") ?? "").trim();
  // Đội DA chỉ áp dụng cho NGOAI_THANH; Đội thi công để trống.
  const doiDAId = doi === "NGOAI_THANH" ? String(formData.get("doiDAId") ?? "").trim() || null : null;

  if (!maCN) return { ok: false, thongDiep: "Mã công nhân không được để trống." };
  if (!hoTen) return { ok: false, thongDiep: "Họ tên không được để trống." };
  if (!DOI.includes(doi)) return { ok: false, thongDiep: "Đội không hợp lệ." };

  const trung = await db.congNhan.findUnique({ where: { maCN } });
  if (trung && trung.id !== id) {
    return { ok: false, thongDiep: `Mã công nhân ${maCN} đã tồn tại.` };
  }

  const duLieu = { maCN, hoTen, doi, doiDAId, ngheNghiep, nguoiQuanLy, ghiChu };
  // Tích "Áp dụng cho tất cả trong đội": gán cùng người quản lý cho mọi công nhân
  // cùng đội — Đội thi công (NOI_THANH) hoặc đúng một Đội DA (theo doiDAId).
  const apDungTatCaDoi = formData.get("apDungTatCaDoi") === "on";

  if (id) {
    await db.congNhan.update({ where: { id }, data: duLieu });
    // Chỉ lan khi có tên quản lý, tránh vô tình xoá trắng người quản lý cả đội.
    if (apDungTatCaDoi && nguoiQuanLy) {
      await db.congNhan.updateMany({
        where: doi === "NGOAI_THANH" ? { doi: "NGOAI_THANH", doiDAId } : { doi: "NOI_THANH" },
        data: { nguoiQuanLy },
      });
    }
  } else {
    await db.congNhan.create({ data: duLieu });
  }

  revalidatePath("/cong-nhan");
  return { ok: true, thongDiep: `Đã lưu công nhân ${maCN} — ${hoTen}.` };
}

/**
 * Thêm nhiều công nhân một lượt. Mỗi trường gửi dạng mảng cùng tên (`maCN`,
 * `hoTen`, `doi`, `ngheNghiep`, `nguoiQuanLy`) căn theo chỉ số dòng. Dòng trống
 * mã bỏ qua; dòng lỗi (thiếu tên, trùng mã, trùng trong chính lô) không chặn cả
 * lô mà chỉ báo lại — thêm được bao nhiêu hay bấy nhiêu, đỡ mất công gõ lại.
 */
export async function themNhieuCongNhan(formData: FormData): Promise<KetQuaCN> {
  const q = await kiemThaoTac("ho-so");
  if ("loi" in q) return { ok: false, thongDiep: q.loi };

  const maCNs = formData.getAll("maCN").map((v) => String(v).trim());
  const hoTens = formData.getAll("hoTen").map((v) => String(v).trim());
  const dois = formData.getAll("doi").map((v) => String(v));
  const doiDAIds = formData.getAll("doiDAId").map((v) => String(v).trim());
  const nghes = formData.getAll("ngheNghiep").map((v) => String(v).trim());
  const quanLys = formData.getAll("nguoiQuanLy").map((v) => String(v).trim());

  const daCo = new Set((await db.congNhan.findMany({ select: { maCN: true } })).map((c) => c.maCN));
  const trongLo = new Set<string>();
  const loi: string[] = [];
  let them = 0;

  for (let i = 0; i < maCNs.length; i++) {
    const maCN = maCNs[i];
    if (!maCN) continue; // dòng trống
    const hoTen = hoTens[i] ?? "";
    const doi = dois[i] ?? "NOI_THANH";
    if (!hoTen) {
      loi.push(`${maCN}: thiếu họ tên`);
      continue;
    }
    if (!DOI.includes(doi)) {
      loi.push(`${maCN}: đội không hợp lệ`);
      continue;
    }
    if (daCo.has(maCN) || trongLo.has(maCN)) {
      loi.push(`${maCN}: trùng mã`);
      continue;
    }
    await db.congNhan.create({
      data: {
        maCN,
        hoTen,
        doi,
        doiDAId: doi === "NGOAI_THANH" ? (doiDAIds[i] ?? "") || null : null,
        ngheNghiep: nghes[i] ?? "",
        nguoiQuanLy: quanLys[i] ?? "",
      },
    });
    trongLo.add(maCN);
    them++;
  }

  if (!them && !loi.length) return { ok: false, thongDiep: "Chưa nhập công nhân nào." };
  revalidatePath("/cong-nhan");
  return {
    ok: them > 0,
    thongDiep: loi.length
      ? `Đã thêm ${them} công nhân. Bỏ qua: ${loi.join("; ")}.`
      : `Đã thêm ${them} công nhân.`,
  };
}

export async function xoaCongNhan(formData: FormData): Promise<KetQuaCN> {
  const q = await kiemThaoTac("ho-so");
  if ("loi" in q) return { ok: false, thongDiep: q.loi };

  const id = String(formData.get("id") ?? "").trim();
  const cn = await db.congNhan.findUnique({ where: { id } });
  if (!cn) return { ok: false, thongDiep: "Không tìm thấy công nhân." };

  // Xoá công nhân kéo theo mọi phân công và chấm công của người đó (cascade ở
  // schema). Đây là xoá cứng theo yêu cầu — không còn cơ chế đánh dấu nghỉ việc.
  await db.congNhan.delete({ where: { id } });
  revalidatePath("/cong-nhan");
  return { ok: true, thongDiep: `Đã xoá công nhân ${cn.maCN}.` };
}

// ------------------------------------------------------------ Khu vực công trình
export async function luuKhuVuc(formData: FormData): Promise<KetQuaCN> {
  const q = await kiemThaoTac("ho-so");
  if ("loi" in q) return { ok: false, thongDiep: q.loi };

  const projectId = String(formData.get("projectId") ?? "").trim();
  const khuVuc = String(formData.get("khuVuc") ?? "NOI_THANH");
  // Đội DA sở hữu công trình — chỉ khi ngoại thành; nội thành để trống.
  const doiDAId = khuVuc === "NGOAI_THANH" ? String(formData.get("doiDAId") ?? "").trim() || null : null;

  if (!DOI.includes(khuVuc)) return { ok: false, thongDiep: "Khu vực không hợp lệ." };
  const ct = await congTrinhTrongPhamVi(projectId);
  if (!ct) return { ok: false, thongDiep: "Công trình không tồn tại hoặc ngoài phạm vi của bạn." };

  // Người phụ trách tự động theo phạm vi giao (UserProject), không lưu tay ở đây.
  await db.congTrinhChamCong.upsert({
    where: { projectId },
    create: { projectId, khuVuc, doiDAId },
    update: { khuVuc, doiDAId },
  });

  revalidatePath("/cong-nhan");
  return { ok: true, thongDiep: `Đã lưu khu vực cho ${ct.maCongTrinh}.` };
}

// ------------------------------------------------------------ Danh mục Đội DA
export async function luuDoiDA(formData: FormData): Promise<KetQuaCN> {
  const q = await kiemThaoTac("ho-so");
  if ("loi" in q) return { ok: false, thongDiep: q.loi };

  const ten = String(formData.get("ten") ?? "").trim();
  if (!ten) return { ok: false, thongDiep: "Tên đội DA không được để trống." };
  const trung = await db.doiDA.findUnique({ where: { ten } });
  if (trung) return { ok: false, thongDiep: `Đội DA "${ten}" đã có.` };

  await db.doiDA.create({ data: { ten } });
  revalidatePath("/cong-nhan");
  return { ok: true, thongDiep: `Đã thêm đội DA "${ten}".` };
}

export async function xoaDoiDA(formData: FormData): Promise<KetQuaCN> {
  const q = await kiemThaoTac("ho-so");
  if ("loi" in q) return { ok: false, thongDiep: q.loi };

  const id = String(formData.get("id") ?? "").trim();
  const doi = await db.doiDA.findUnique({
    where: { id },
    include: { _count: { select: { congNhans: true, congTrinhs: true } } },
  });
  if (!doi) return { ok: false, thongDiep: "Không tìm thấy đội DA." };
  if (doi._count.congNhans || doi._count.congTrinhs) {
    return {
      ok: false,
      thongDiep: `Đội "${doi.ten}" còn ${doi._count.congNhans} công nhân, ${doi._count.congTrinhs} công trình — gỡ hết trước khi xoá.`,
    };
  }
  await db.doiDA.delete({ where: { id } });
  revalidatePath("/cong-nhan");
  return { ok: true, thongDiep: `Đã xoá đội DA "${doi.ten}".` };
}

/**
 * Sửa một đội DA (dự án): đổi tên, gán người quản lý (tài khoản cán bộ hiện
 * trường), và NHÓM công trình vào dự án. Nhóm công trình = đặt công trình sang
 * ngoại thành + trỏ về đội này; bỏ tích thì gỡ khỏi đội (giữ khu vực). Chỉ đụng
 * công trình trong phạm vi người dùng thấy — không xoá gán của công trình ngoài tầm.
 */
export async function suaDoiDA(formData: FormData): Promise<KetQuaCN> {
  const q = await kiemThaoTac("ho-so");
  if ("loi" in q) return { ok: false, thongDiep: q.loi };

  const id = String(formData.get("id") ?? "").trim();
  const ten = String(formData.get("ten") ?? "").trim();
  const nguoiQuanLyId = String(formData.get("nguoiQuanLyId") ?? "").trim() || null;
  if (!id) return { ok: false, thongDiep: "Thiếu đội DA." };
  if (!ten) return { ok: false, thongDiep: "Tên đội DA không được để trống." };

  const doi = await db.doiDA.findUnique({ where: { id } });
  if (!doi) return { ok: false, thongDiep: "Không tìm thấy đội DA." };
  const trung = await db.doiDA.findUnique({ where: { ten } });
  if (trung && trung.id !== id) return { ok: false, thongDiep: `Đội DA "${ten}" đã có.` };

  if (nguoiQuanLyId) {
    const cb = await db.user.findFirst({
      where: {
        id: nguoiQuanLyId,
        isActive: true,
        vaiTro: { in: ["CHI_HUY_TRUONG", "CAN_BO_KY_THUAT", "CHUYEN_VIEN_CAO"] },
      },
      select: { id: true },
    });
    if (!cb) return { ok: false, thongDiep: "Người quản lý không hợp lệ (phải là cán bộ hiện trường)." };
  }

  await db.doiDA.update({ where: { id }, data: { ten, nguoiQuanLyId } });

  const dsCT = await layCongTrinhChamCong();
  const trongTam = new Set(dsCT.map((c) => c.id));
  const chon = new Set(
    formData.getAll("ctId").map((v) => String(v)).filter((p) => trongTam.has(p))
  );
  for (const c of dsCT) {
    const dangThuoc = c.doiDAId === id;
    if (chon.has(c.id) && !dangThuoc) {
      await db.congTrinhChamCong.upsert({
        where: { projectId: c.id },
        create: { projectId: c.id, khuVuc: "NGOAI_THANH", doiDAId: id },
        update: { khuVuc: "NGOAI_THANH", doiDAId: id },
      });
    } else if (!chon.has(c.id) && dangThuoc) {
      await db.congTrinhChamCong.update({ where: { projectId: c.id }, data: { doiDAId: null } });
    }
  }

  revalidatePath("/cong-nhan");
  return { ok: true, thongDiep: `Đã lưu đội DA "${ten}".` };
}

// ------------------------------------------------------------ Phân công ngày
/**
 * Lưu cả ma trận phân công của một ngày trong một lượt.
 *
 * Ô tích gửi lên dạng `cell:<congNhanId>:<projectId>`. Đối chiếu với các dòng
 * hiện có của ngày, CHỈ trong phạm vi công trình người dùng thấy: ô tích mà chưa
 * có thì tạo, ô đang có mà bỏ tích thì xoá. Không đụng phân công ở công trình
 * ngoài tầm để tránh xoá nhầm dữ liệu của người khác.
 *
 * Chỉ nhận công nhân NỘI THÀNH — đội ngoại thành chấm trực tiếp, không phân công.
 */
export async function luuPhanCongMaTran(formData: FormData): Promise<KetQuaCN> {
  const q = await kiemThaoTac("phan-cong");
  if ("loi" in q) return { ok: false, thongDiep: q.loi };

  const ngay = String(formData.get("ngay") ?? "").trim();
  if (!ngayHopLe(ngay)) return { ok: false, thongDiep: "Ngày không hợp lệ (cần dạng yyyy-MM-dd)." };

  // Chốt chặn thật ở máy chủ, không chỉ khoá ô trên giao diện.
  if (!choPhepSuaLich(ngay)) {
    return {
      ok: false,
      thongDiep: `Lịch ngày ${ngay} đã quá một ngày nên khoá sửa. Chỉ sửa được lịch từ hôm qua trở đi.`,
    };
  }

  // Tập ô được tích, sau khi lọc quyền + đội.
  const [dsCT, dsCN] = await Promise.all([
    layCongTrinhChamCong(),
    db.congNhan.findMany({ where: { doi: "NOI_THANH" }, select: { id: true } }),
  ]);
  const ctTrongTam = new Set(dsCT.map((c) => c.id));
  const cnNoiThanh = new Set(dsCN.map((c) => c.id));

  // Ô tích gửi lên dạng cell:<cnId>:<pId> = CA_NGAY | SANG | CHIEU (rỗng = bỏ).
  const BUOI = ["CA_NGAY", "SANG", "CHIEU"];
  const oTich = new Map<string, string>(); // `congNhanId|projectId` -> buoi
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("cell:")) continue;
    const buoi = String(v);
    if (!BUOI.includes(buoi)) continue;
    const [, cnId, pId] = k.split(":");
    if (ctTrongTam.has(pId) && cnNoiThanh.has(cnId)) oTich.set(`${cnId}|${pId}`, buoi);
  }

  // Hiện trạng trong phạm vi.
  const hienCo = await db.phanCongNgay.findMany({
    where: { ngay, projectId: { in: [...ctTrongTam] } },
  });
  const daCo = new Map(hienCo.map((r) => [`${r.congNhanId}|${r.projectId}`, r]));

  let them = 0;
  let bo = 0;
  let doi = 0;
  for (const [cell, buoi] of oTich) {
    const cu = daCo.get(cell);
    const [cnId, pId] = cell.split("|");
    if (!cu) {
      await db.phanCongNgay.create({
        data: { ngay, congNhanId: cnId, projectId: pId, buoi, nguoiPhanCong: q.ten },
      });
      them++;
    } else if (cu.buoi !== buoi) {
      await db.phanCongNgay.update({ where: { id: cu.id }, data: { buoi, nguoiPhanCong: q.ten } });
      doi++;
    }
  }
  for (const [cell, r] of daCo) {
    if (!oTich.has(cell)) {
      await db.phanCongNgay.delete({ where: { id: r.id } });
      bo++;
    }
  }

  revalidatePath("/cong-nhan");
  return {
    ok: true,
    thongDiep: `Đã lưu phân công ngày ${ngay}: thêm ${them}, đổi buổi ${doi}, bỏ ${bo}.`,
  };
}

// ------------------------------------------------------------ Chấm công
const LOAI_VANG = ["CO_PHEP", "KHONG_PHEP"];

/**
 * Chấm công cả danh sách điều động của một ngày trong một lượt. Mỗi lượt điều
 * động (công nhân × công trình) có các trường gửi theo khoá `<congNhanId>:<projectId>`:
 *   cs / cc  = tick ca sáng / ca chiều (0,5 công mỗi ca)
 *   vang     = "" | CO_PHEP | KHONG_PHEP
 *   lydo     = lý do vắng
 *   gtcNgay / gtcDem = giờ tăng ca trong ngày / qua đêm (có thể có cả hai)
 *
 * Chỉ ghi cho đúng các lượt điều động THẬT trong phạm vi — không tin danh sách
 * khoá gửi lên, tránh chèn chấm công cho lượt không được điều.
 */
export async function luuChamCongNgay(formData: FormData): Promise<KetQuaCN> {
  const q = await kiemThaoTac("cham-cong");
  if ("loi" in q) return { ok: false, thongDiep: q.loi };

  const ngay = String(formData.get("ngay") ?? "").trim();
  if (!ngayHopLe(ngay)) return { ok: false, thongDiep: "Ngày không hợp lệ (cần dạng yyyy-MM-dd)." };

  // Form chấm công là của MỘT công trình (một tab). CHỈ lưu công trình này — nếu
  // duyệt cả ngày thì các công trình khác (không có ô trong form) bị ghi rỗng =
  // XOÁ SẠCH chấm công đã lưu của chúng.
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) return { ok: false, thongDiep: "Thiếu công trình cần chấm." };
  const trongTam = new Set((await layCongTrinhChamCong()).map((c) => c.id));
  if (!trongTam.has(projectId)) {
    return { ok: false, thongDiep: "Công trình ngoài phạm vi của bạn." };
  }

  // Danh sách người cần chấm ở công trình này = HỢP điều động ∪ chấm công đã lưu
  // (để sửa được cả khi điều động gốc đã bị xoá sau khi chấm).
  const [phan, chamCu] = await Promise.all([
    db.phanCongNgay.findMany({ where: { ngay, projectId } }),
    db.chamCong.findMany({ where: { ngay, projectId } }),
  ]);
  const cap = new Map<string, string>(); // congNhanId
  for (const p of phan) cap.set(p.congNhanId, p.congNhanId);
  for (const c of chamCu) cap.set(c.congNhanId, c.congNhanId);
  if (!cap.size) return { ok: false, thongDiep: "Công trình này chưa có ai để chấm trong ngày." };

  let luu = 0;
  for (const congNhanId of cap.values()) {
    const k = `${congNhanId}:${projectId}`;
    const caSang = formData.get(`cs:${k}`) === "1";
    const caChieu = formData.get(`cc:${k}`) === "1";
    const vangRaw = String(formData.get(`vang:${k}`) ?? "");
    const loaiVang = LOAI_VANG.includes(vangRaw) ? vangRaw : null;
    const lyDoVang = String(formData.get(`lydo:${k}`) ?? "").trim() || null;
    const gio = (ten: string) => {
      const n = Number(formData.get(ten) ?? 0);
      return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 0;
    };

    const duLieu = {
      caSang,
      caChieu,
      loaiVang: caSang && caChieu ? null : loaiVang,
      lyDoVang: caSang && caChieu ? null : lyDoVang,
      gioTangCaNgay: gio(`gtcNgay:${k}`),
      gioTangCaDem: gio(`gtcDem:${k}`),
      nguoiChamCong: q.ten,
    };
    await db.chamCong.upsert({
      where: {
        ngay_congNhanId_projectId: { ngay, congNhanId, projectId },
      },
      create: { ngay, congNhanId, projectId, ...duLieu },
      update: duLieu,
    });
    luu++;
  }

  revalidatePath("/cong-nhan");
  return { ok: true, thongDiep: `Đã chấm công ${luu} người ngày ${ngay}.` };
}

/**
 * Chấm công cả một dự án (Đội DA) trong một lượt. Khác luồng nội thành: KHÔNG qua
 * điều động — liệt kê sẵn cả đội, mỗi công nhân một dòng kèm ô CHỌN CÔNG TRÌNH của
 * dự án. Ô chọn quyết định công trình thực tế; bỏ chọn thì gỡ chấm của người đó.
 *
 * Mỗi người một ngày chỉ ở một công trình của dự án: trước khi ghi, dọn mọi chấm
 * cũ của người đó trong các công trình của dự án ở ngày đó (trừ công trình đang
 * chọn) để không đếm đôi. Chỉ đụng công trình của dự án trong phạm vi người dùng.
 */
export async function luuChamCongDoiDA(formData: FormData): Promise<KetQuaCN> {
  const q = await kiemThaoTac("cham-cong");
  if ("loi" in q) return { ok: false, thongDiep: q.loi };

  const ngay = String(formData.get("ngay") ?? "").trim();
  if (!ngayHopLe(ngay)) return { ok: false, thongDiep: "Ngày không hợp lệ (cần dạng yyyy-MM-dd)." };
  const doiDAId = String(formData.get("doiDAId") ?? "").trim();
  if (!doiDAId) return { ok: false, thongDiep: "Thiếu dự án cần chấm." };

  const dsCT = (await layCongTrinhChamCong()).filter((c) => c.doiDAId === doiDAId);
  const ctIds = new Set(dsCT.map((c) => c.id));
  if (!ctIds.size) return { ok: false, thongDiep: "Dự án chưa có công trình trong phạm vi của bạn." };

  const cn = await db.congNhan.findMany({
    where: { doiDAId, doi: "NGOAI_THANH" },
    select: { id: true },
  });
  if (!cn.length) return { ok: false, thongDiep: "Đội này chưa có công nhân nào." };

  let luu = 0;
  let bo = 0;
  for (const { id: congNhanId } of cn) {
    const pidRaw = String(formData.get(`ct:${congNhanId}`) ?? "").trim();
    const chon = ctIds.has(pidRaw) ? pidRaw : "";

    // Dọn chấm cũ của người này trong dự án ở ngày đó, TRỪ công trình đang chọn.
    await db.chamCong.deleteMany({
      where: {
        ngay,
        congNhanId,
        projectId: { in: [...ctIds] },
        ...(chon ? { NOT: { projectId: chon } } : {}),
      },
    });
    if (!chon) {
      bo++;
      continue;
    }

    const caSang = formData.get(`cs:${congNhanId}`) === "1";
    const caChieu = formData.get(`cc:${congNhanId}`) === "1";
    const vangRaw = String(formData.get(`vang:${congNhanId}`) ?? "");
    const loaiVang = LOAI_VANG.includes(vangRaw) ? vangRaw : null;
    const lyDoVang = String(formData.get(`lydo:${congNhanId}`) ?? "").trim() || null;
    const gio = (ten: string) => {
      const n = Number(formData.get(ten) ?? 0);
      return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 0;
    };

    const duLieu = {
      caSang,
      caChieu,
      loaiVang: caSang && caChieu ? null : loaiVang,
      lyDoVang: caSang && caChieu ? null : lyDoVang,
      gioTangCaNgay: gio(`gtcNgay:${congNhanId}`),
      gioTangCaDem: gio(`gtcDem:${congNhanId}`),
      nguoiChamCong: q.ten,
    };
    await db.chamCong.upsert({
      where: { ngay_congNhanId_projectId: { ngay, congNhanId, projectId: chon } },
      create: { ngay, congNhanId, projectId: chon, ...duLieu },
      update: duLieu,
    });
    luu++;
  }

  revalidatePath("/cong-nhan");
  return { ok: true, thongDiep: `Đã chấm công dự án: ${luu} người, bỏ ${bo}, ngày ${ngay}.` };
}

// ------------------------------------------------------------ Ngày lễ
/**
 * Thêm/sửa ngày lễ theo KHOẢNG (từ → đến) — ngày lễ có thể kéo dài nhiều ngày
 * liên tục (Tết, 30/4–1/5). Mỗi ngày trong khoảng ghi một dòng cùng tên. Bỏ
 * trống "đến" thì chỉ một ngày. CHỈ ADMIN — dùng chung toàn công ty.
 */
export async function luuNgayLe(formData: FormData): Promise<KetQuaCN> {
  const u = await nguoiDungHienTai();
  if (u?.vaiTro !== "ADMIN") {
    return { ok: false, thongDiep: "Chỉ Quản trị hệ thống được cài đặt ngày lễ." };
  }
  const tu = String(formData.get("tu") ?? "").trim();
  const den = String(formData.get("den") ?? "").trim() || tu;
  const ten = String(formData.get("ten") ?? "").trim();
  if (!ngayHopLe(tu)) return { ok: false, thongDiep: "Ngày bắt đầu không hợp lệ." };
  if (!ngayHopLe(den)) return { ok: false, thongDiep: "Ngày kết thúc không hợp lệ." };
  if (den < tu) return { ok: false, thongDiep: "Ngày kết thúc phải từ ngày bắt đầu trở đi." };
  if (!ten) return { ok: false, thongDiep: "Tên ngày lễ không được để trống." };

  // Lặp hằng năm: bỏ qua năm của ngày đã chọn (nam = null), khớp mọi năm.
  const lapLai = formData.get("lapLai") === "1";

  const start = new Date(`${tu}T00:00:00`);
  const soNgay = Math.round((Date.parse(`${den}T00:00:00`) - start.getTime()) / 86_400_000) + 1;
  if (soNgay > 60) return { ok: false, thongDiep: "Khoảng ngày lễ quá dài (tối đa 60 ngày)." };

  for (let i = 0; i < soNgay; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const thang = d.getMonth() + 1;
    const ngayTrongThang = d.getDate();
    const nam = lapLai ? null : d.getFullYear();
    // Trùng (tháng, ngày, năm) thì cập nhật tên, không tạo dòng thứ hai.
    const daCo = await db.ngayLe.findFirst({ where: { thang, ngay: ngayTrongThang, nam } });
    if (daCo) await db.ngayLe.update({ where: { id: daCo.id }, data: { ten } });
    else await db.ngayLe.create({ data: { thang, ngay: ngayTrongThang, nam, ten } });
  }

  revalidatePath("/cong-nhan");
  const dai = lapLai ? " (lặp hằng năm)" : "";
  return {
    ok: true,
    thongDiep:
      soNgay > 1 ? `Đã lưu ${soNgay} ngày lễ${dai}.` : `Đã lưu ngày lễ ${tu}${dai}.`,
  };
}

/** Xoá một ngày lễ theo id. CHỈ ADMIN. */
export async function xoaNgayLe(formData: FormData): Promise<KetQuaCN> {
  const u = await nguoiDungHienTai();
  if (u?.vaiTro !== "ADMIN") {
    return { ok: false, thongDiep: "Chỉ Quản trị hệ thống được xoá ngày lễ." };
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { ok: false, thongDiep: "Thiếu id ngày lễ." };

  await db.ngayLe.deleteMany({ where: { id } });
  revalidatePath("/cong-nhan");
  return { ok: true, thongDiep: "Đã xoá ngày lễ." };
}

/** Xoá toàn bộ điều động của một ngày. CHỈ ADMIN. */
export async function xoaLichDieuDong(formData: FormData): Promise<KetQuaCN> {
  const u = await nguoiDungHienTai();
  if (u?.vaiTro !== "ADMIN") {
    return { ok: false, thongDiep: "Chỉ Quản trị hệ thống được xoá lịch điều động." };
  }
  const ngay = String(formData.get("ngay") ?? "").trim();
  if (!ngayHopLe(ngay)) return { ok: false, thongDiep: "Ngày không hợp lệ." };

  const n = await db.phanCongNgay.deleteMany({ where: { ngay } });
  revalidatePath("/cong-nhan");
  return { ok: true, thongDiep: `Đã xoá lịch điều động ngày ${ngay} (${n.count} lượt).` };
}
