"use server";

/**
 * Nhập khối lượng BOQ theo tháng và duyệt bill.
 *
 * LUỒNG XÁC NHẬN (theo yêu cầu nghiệp vụ):
 *   - Chỉ huy trưởng (hoặc Admin) nhập  -> lưu và XÁC NHẬN luôn.
 *   - Cán bộ kỹ thuật / Chuyên viên bậc cao nhập -> để CHỜ XÁC NHẬN, chỉ huy
 *     trưởng duyệt sau.
 *   - Sửa lại một tháng đã xác nhận thì trạng thái quay về theo người sửa: cán
 *     bộ kỹ thuật sửa là phải duyệt lại, không giữ dấu xác nhận cũ.
 *
 * CHỈ tháng đã xác nhận mới được tính vào KPI (xử lý ở repository).
 *
 * Mọi hàm tự kiểm quyền VÀ kiểm phạm vi công trình — không dựa vào việc giao
 * diện đã ẩn nút.
 */
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { batBuocQuyen } from "@/lib/auth/quyen";
import { layCongTrinh } from "@/lib/data/repository";
import { docBOQTuExcel, type DongBOQDoc } from "@/lib/excel/parse-boq";

export interface KetQuaBOQ {
  ok: boolean;
  thongDiep: string;
}

export interface KetQuaDocFileBOQ {
  ok: boolean;
  thongDiep: string;
  dongs: DongBOQDoc[];
}

/** Tháng hợp lệ dạng yyyy-MM. */
const LA_THANG = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Tìm công trình TRONG PHẠM VI người dùng. Trả null nếu ngoài phạm vi — không
 * phân biệt với "không tồn tại", để không lộ sự tồn tại của công trình khác.
 */
async function congTrinhTrongPhamVi(maCongTrinh: string) {
  return (await layCongTrinh()).find((c) => c.maCongTrinh === maCongTrinh) ?? null;
}

/**
 * Công trình dùng để GHI dữ liệu.
 *
 * Công trình đã nghiệm thu thì ĐÓNG BĂNG: không thêm, không chèn, không sửa gì
 * nữa, chỉ được xem. Chặn ở đây chứ không chỉ ẩn nút trên giao diện.
 *
 * Muốn mở lại thì sửa công trình và bỏ tích "Đã hoàn thành" — cố ý để đường lùi
 * đó mở, vì tích nhầm mà khoá vĩnh viễn thì không cứu được.
 */
async function congTrinhChoGhi(
  maCongTrinh: string
): Promise<{ ct: NonNullable<Awaited<ReturnType<typeof congTrinhTrongPhamVi>>> } | { loi: string }> {
  const ct = await congTrinhTrongPhamVi(maCongTrinh);
  if (!ct) return { loi: `Không tìm thấy công trình ${maCongTrinh}.` };
  if (ct.trangThai === "Đã nghiệm thu") {
    return {
      loi: `Công trình ${maCongTrinh} đã hoàn thành (nghiệm thu) — chỉ được xem, không thêm hay sửa dữ liệu.`,
    };
  }
  return { ct };
}

export async function themBillThang(formData: FormData): Promise<KetQuaBOQ> {
  const u = await nguoiDungHienTai();
  batBuocQuyen(u, "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const thang = String(formData.get("thang") ?? "").trim();
  if (!LA_THANG.test(thang)) return { ok: false, thongDiep: "Tháng không hợp lệ (dạng yyyy-MM)." };

  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };
  const ct = kq.ct;

  const soDong = await db.bOQLine.count({ where: { projectId: ct.id } });
  if (!soDong) {
    return { ok: false, thongDiep: "Công trình chưa có BOQ — cần nhập bảng khối lượng trước." };
  }

  if (await db.billThang.findUnique({ where: { projectId_thang: { projectId: ct.id, thang } } })) {
    return { ok: false, thongDiep: `Bill tháng ${thang} đã tồn tại.` };
  }

  await db.billThang.create({
    data: {
      projectId: ct.id,
      thang,
      // Không còn bước xác nhận: Bill tính vào KPI ngay khi người phụ trách nhập.
      trangThai: "DA_XAC_NHAN",
      nguoiNhap: u!.email,
      ngayNhap: new Date(),
    },
  });

  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  return { ok: true, thongDiep: `Đã thêm Bill tháng ${thang}. Nhập khối lượng rồi lưu.` };
}

export async function luuKhoiLuong(formData: FormData): Promise<KetQuaBOQ> {
  const u = await nguoiDungHienTai();
  batBuocQuyen(u, "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const thang = String(formData.get("thang") ?? "").trim();
  if (!LA_THANG.test(thang)) return { ok: false, thongDiep: "Tháng không hợp lệ." };

  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };
  const ct = kq.ct;

  const bill = await db.billThang.findUnique({
    where: { projectId_thang: { projectId: ct.id, thang } },
  });
  if (!bill) return { ok: false, thongDiep: `Chưa có Bill tháng ${thang}.` };

  const dong = await db.bOQLine.findMany({ where: { projectId: ct.id }, select: { id: true } });

  const thucHienMoi: { boqLineId: string; thang: string; khoiLuong: number }[] = [];
  const idsXong: string[] = [];
  const idsChuaXong: string[] = [];
  for (const l of dong) {
    const raw = String(formData.get(`kl_${l.id}`) ?? "").trim().replace(/\s/g, "").replace(",", ".");
    const kl = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(kl) || kl < 0) {
      return { ok: false, thongDiep: "Khối lượng phải là số không âm." };
    }
    if (kl > 0) thucHienMoi.push({ boqLineId: l.id, thang, khoiLuong: kl });
    // Ô tích "đã thi công xong" — thuộc về công tác, không theo tháng.
    (formData.get(`xong_${l.id}`) === "on" ? idsXong : idsChuaXong).push(l.id);
  }

  // GỘP thành vài truy vấn trong MỘT giao dịch thay vì 2 lệnh mỗi dòng chạy tuần
  // tự — BOQ vài trăm dòng mà round-trip từng dòng lên Railway thì rất lâu.
  // Xoá sạch khối lượng tháng này của các dòng rồi ghi lại dòng có số (>0).
  const ids = dong.map((l) => l.id);
  await db.$transaction([
    db.bOQThucHien.deleteMany({ where: { boqLineId: { in: ids }, thang } }),
    ...(thucHienMoi.length ? [db.bOQThucHien.createMany({ data: thucHienMoi })] : []),
    ...(idsXong.length
      ? [db.bOQLine.updateMany({ where: { id: { in: idsXong } }, data: { hoanThanh: true } })]
      : []),
    ...(idsChuaXong.length
      ? [db.bOQLine.updateMany({ where: { id: { in: idsChuaXong } }, data: { hoanThanh: false } })]
      : []),
    // Không còn bước xác nhận: lưu là số liệu vào KPI ngay.
    db.billThang.update({
      where: { id: bill.id },
      data: { nguoiNhap: u!.email, ngayNhap: new Date(), trangThai: "DA_XAC_NHAN" },
    }),
  ]);

  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  revalidatePath("/");
  return { ok: true, thongDiep: `Đã lưu Bill tháng ${thang}.` };
}

/**
 * Đổi THÁNG của một Bill: dời cả bản ghi BillThang lẫn toàn bộ khối lượng thực
 * hiện (BOQThucHien) của tháng đó sang tháng mới. Chặn nếu tháng mới đã có Bill.
 */
export async function doiThangBill(formData: FormData): Promise<KetQuaBOQ> {
  const u = await nguoiDungHienTai();
  batBuocQuyen(u, "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const thangCu = String(formData.get("thangCu") ?? "").trim();
  const thangMoi = String(formData.get("thangMoi") ?? "").trim();
  if (!LA_THANG.test(thangMoi)) return { ok: false, thongDiep: "Tháng mới không hợp lệ (dạng yyyy-MM)." };
  if (thangMoi === thangCu) return { ok: false, thongDiep: "Tháng mới trùng tháng hiện tại." };

  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };
  const ct = kq.ct;

  const bill = await db.billThang.findUnique({
    where: { projectId_thang: { projectId: ct.id, thang: thangCu } },
  });
  if (!bill) return { ok: false, thongDiep: `Chưa có Bill tháng ${thangCu}.` };
  if (await db.billThang.findUnique({ where: { projectId_thang: { projectId: ct.id, thang: thangMoi } } })) {
    return { ok: false, thongDiep: `Bill tháng ${thangMoi} đã tồn tại — không thể đổi trùng.` };
  }

  const ids = (
    await db.bOQLine.findMany({ where: { projectId: ct.id }, select: { id: true } })
  ).map((l) => l.id);
  await db.$transaction([
    db.bOQThucHien.updateMany({ where: { boqLineId: { in: ids }, thang: thangCu }, data: { thang: thangMoi } }),
    db.billThang.update({ where: { id: bill.id }, data: { thang: thangMoi } }),
  ]);

  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  revalidatePath("/");
  return { ok: true, thongDiep: `Đã đổi Bill tháng ${thangCu} → ${thangMoi}.` };
}

// ------------------------------------------------------------ Cột tùy chỉnh
export async function themCot(formData: FormData): Promise<KetQuaBOQ> {
  batBuocQuyen(await nguoiDungHienTai(), "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const ten = String(formData.get("ten") ?? "").trim();
  if (!ten) return { ok: false, thongDiep: "Tên cột không được để trống." };

  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };
  const ct = kq.ct;

  if (await db.bOQCot.findFirst({ where: { projectId: ct.id, ten } })) {
    return { ok: false, thongDiep: `Cột "${ten}" đã có rồi.` };
  }

  // Lấy thuTu lớn nhất + 1, KHÔNG dùng count(): xoá một cột giữa chừng rồi thêm
  // cột mới thì count() cho ra số đã có, hai cột trùng thứ tự và không sắp xếp được.
  const max = await db.bOQCot.aggregate({ where: { projectId: ct.id }, _max: { thuTu: true } });
  await db.bOQCot.create({
    data: { projectId: ct.id, ten, thuTu: (max._max.thuTu ?? -1) + 1 },
  });

  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  return { ok: true, thongDiep: `Đã thêm cột "${ten}".` };
}

/**
 * Xoá một cột tùy chỉnh và toàn bộ giá trị của nó (cascade).
 * Có hàm này vì thêm cột mà không xoá được thì gõ nhầm tên là kẹt vĩnh viễn.
 */
export async function xoaCot(formData: FormData): Promise<KetQuaBOQ> {
  batBuocQuyen(await nguoiDungHienTai(), "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const cotId = String(formData.get("cotId") ?? "").trim();

  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };
  const ct = kq.ct;

  // Ràng projectId để không xoá được cột của công trình khác qua id đoán mò.
  const cot = await db.bOQCot.findFirst({ where: { id: cotId, projectId: ct.id } });
  if (!cot) return { ok: false, thongDiep: "Không tìm thấy cột." };

  await db.bOQCot.delete({ where: { id: cot.id } });
  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  return { ok: true, thongDiep: `Đã xoá cột "${cot.ten}".` };
}

/**
 * Đổi chỗ một cột tùy chỉnh sang trái/phải. Dùng nút mũi tên thay vì kéo thả —
 * ít mã hơn nhiều mà vẫn đủ việc.
 *
 * ĐÁNH SỐ LẠI cả danh sách chứ không hoán vị hai giá trị `thuTu`: nếu dữ liệu
 * cũ lỡ có hai cột trùng thứ tự thì hoán vị sẽ không đổi được gì, còn đánh số
 * lại vừa chuyển đúng vừa tự chữa luôn chỗ trùng.
 */
export async function chuyenCot(formData: FormData): Promise<KetQuaBOQ> {
  batBuocQuyen(await nguoiDungHienTai(), "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const cotId = String(formData.get("cotId") ?? "").trim();
  const sang = String(formData.get("huong") ?? "");

  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };
  const ct = kq.ct;

  const ds = await db.bOQCot.findMany({
    where: { projectId: ct.id },
    orderBy: [{ thuTu: "asc" }, { id: "asc" }],
  });
  const i = ds.findIndex((c) => c.id === cotId);
  if (i < 0) return { ok: false, thongDiep: "Không tìm thấy cột." };

  const j = sang === "trai" ? i - 1 : i + 1;
  if (j < 0 || j >= ds.length) return { ok: false, thongDiep: "Cột đã ở đầu/cuối rồi." };

  const moi = [...ds];
  [moi[i], moi[j]] = [moi[j], moi[i]];
  for (let k = 0; k < moi.length; k++) {
    await db.bOQCot.update({ where: { id: moi[k].id }, data: { thuTu: k } });
  }

  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  return { ok: true, thongDiep: `Đã chuyển cột "${ds[i].ten}".` };
}

/** Lưu giá trị MỘT ô cột tùy chỉnh — sửa trực tiếp ngay trên bảng BOQ. */
export async function luuOCot(formData: FormData): Promise<KetQuaBOQ> {
  batBuocQuyen(await nguoiDungHienTai(), "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const cotId = String(formData.get("cotId") ?? "").trim();
  const boqLineId = String(formData.get("boqLineId") ?? "").trim();
  const giaTri = String(formData.get("giaTri") ?? "").trim();

  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };
  const ct = kq.ct;

  // Ràng cả cột lẫn dòng về đúng công trình này, chặn sửa xuyên công trình bằng id đoán mò.
  const cot = await db.bOQCot.findFirst({ where: { id: cotId, projectId: ct.id } });
  const dong = await db.bOQLine.findFirst({ where: { id: boqLineId, projectId: ct.id } });
  if (!cot || !dong) return { ok: false, thongDiep: "Không tìm thấy ô cần sửa." };

  if (giaTri === "") {
    await db.bOQGiaTriCot.deleteMany({ where: { cotId, boqLineId } });
  } else {
    await db.bOQGiaTriCot.upsert({
      where: { cotId_boqLineId: { cotId, boqLineId } },
      create: { cotId, boqLineId, giaTri },
      update: { giaTri },
    });
  }

  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  return { ok: true, thongDiep: "Đã lưu." };
}

/**
 * Thêm một dòng BOQ phát sinh, chèn vào ĐÚNG vị trí người dùng chọn.
 * `sauDongId` rỗng = chèn lên đầu. Các dòng phía sau được đẩy `thuTu` xuống.
 */
export async function themDongBOQ(formData: FormData): Promise<KetQuaBOQ> {
  batBuocQuyen(await nguoiDungHienTai(), "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const stt = String(formData.get("stt") ?? "").trim();
  const noiDung = String(formData.get("noiDung") ?? "").trim();
  const dvt = String(formData.get("dvt") ?? "").trim();
  const sauDongId = String(formData.get("sauDongId") ?? "").trim();

  const so = (t: string) => Number(String(t).replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  const khoiLuong = so(String(formData.get("khoiLuong") ?? "0"));
  const donGia = so(String(formData.get("donGia") ?? "0"));

  if (!stt) return { ok: false, thongDiep: "STT không được để trống." };
  if (!noiDung) return { ok: false, thongDiep: "Nội dung công việc không được để trống." };
  if (!Number.isFinite(khoiLuong) || khoiLuong < 0) {
    return { ok: false, thongDiep: "Khối lượng phải là số không âm." };
  }
  if (!Number.isFinite(donGia) || donGia < 0) {
    return { ok: false, thongDiep: "Đơn giá phải là số không âm." };
  }

  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };
  const ct = kq.ct;

  const ds = await db.bOQLine.findMany({ where: { projectId: ct.id }, orderBy: { thuTu: "asc" } });
  const viTri = sauDongId ? ds.findIndex((d) => d.id === sauDongId) + 1 : 0;

  // Đẩy các dòng từ vị trí chèn trở đi xuống một bậc để chừa chỗ.
  for (let k = ds.length - 1; k >= viTri; k--) {
    await db.bOQLine.update({ where: { id: ds[k].id }, data: { thuTu: k + 1 } });
  }
  await db.bOQLine.create({
    data: { projectId: ct.id, stt, noiDung, dvt: dvt || null, khoiLuong, donGia, thuTu: viTri },
  });

  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  return { ok: true, thongDiep: `Đã thêm công tác "${stt} — ${noiDung}".` };
}

/**
 * Thêm NHIỀU dòng BOQ một lượt (tạo BOQ ban đầu / bổ sung hàng loạt). Mỗi trường
 * gửi dạng mảng cùng tên căn theo chỉ số dòng. Dòng trống cả STT lẫn nội dung thì
 * bỏ qua; dòng lỗi chỉ báo lại chứ không chặn cả lô. Thêm nối vào CUỐI danh sách.
 */
export async function themNhieuDongBOQ(formData: FormData): Promise<KetQuaBOQ> {
  batBuocQuyen(await nguoiDungHienTai(), "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };
  const ct = kq.ct;

  const stts = formData.getAll("stt").map((v) => String(v).trim());
  const noiDungs = formData.getAll("noiDung").map((v) => String(v).trim());
  const dvts = formData.getAll("dvt").map((v) => String(v).trim());
  const kls = formData.getAll("khoiLuong").map((v) => String(v));
  const dgs = formData.getAll("donGia").map((v) => String(v));

  const so = (t: string) => Number(String(t).replace(/\s/g, "").replace(/\./g, "").replace(",", "."));

  // Ghi đè: xoá sạch BOQ cũ (cascade luôn khối lượng thực hiện + giá trị cột) rồi
  // nhập lại từ đầu. Nối tiếp (mặc định): thêm vào sau dòng cuối.
  const ghiDe = formData.get("ghiDe") === "1";
  if (ghiDe) {
    await db.bOQLine.deleteMany({ where: { projectId: ct.id } });
  }

  const max = ghiDe
    ? { _max: { thuTu: null as number | null } }
    : await db.bOQLine.aggregate({ where: { projectId: ct.id }, _max: { thuTu: true } });
  let thuTu = (max._max.thuTu ?? -1) + 1;

  const loi: string[] = [];
  const dsMoi: {
    projectId: string;
    stt: string;
    noiDung: string;
    dvt: string | null;
    khoiLuong: number;
    donGia: number;
    thuTu: number;
  }[] = [];
  for (let i = 0; i < stts.length; i++) {
    const stt = stts[i];
    const noiDung = noiDungs[i] ?? "";
    if (!stt && !noiDung) continue; // dòng trống hoàn toàn
    if (!stt) {
      loi.push(`Dòng ${i + 1}: thiếu STT`);
      continue;
    }
    if (!noiDung) {
      loi.push(`${stt}: thiếu nội dung`);
      continue;
    }
    const khoiLuong = kls[i] ? so(kls[i]) : 0;
    const donGia = dgs[i] ? so(dgs[i]) : 0;
    if (!Number.isFinite(khoiLuong) || khoiLuong < 0) {
      loi.push(`${stt}: khối lượng phải là số không âm`);
      continue;
    }
    if (!Number.isFinite(donGia) || donGia < 0) {
      loi.push(`${stt}: đơn giá phải là số không âm`);
      continue;
    }
    dsMoi.push({ projectId: ct.id, stt, noiDung, dvt: dvts[i] || null, khoiLuong, donGia, thuTu: thuTu++ });
  }

  // Ghi MỘT lệnh thay vì create từng dòng tuần tự — import file vài trăm dòng lên
  // Railway mà chạy tuần tự thì rất lâu.
  if (dsMoi.length) await db.bOQLine.createMany({ data: dsMoi });
  const them = dsMoi.length;

  if (!them && !loi.length) return { ok: false, thongDiep: "Chưa nhập dòng BOQ nào." };
  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  return {
    ok: them > 0,
    thongDiep: loi.length
      ? `Đã thêm ${them} dòng BOQ. Bỏ qua: ${loi.join("; ")}.`
      : `Đã thêm ${them} dòng BOQ.`,
  };
}

/**
 * Chỉ giữ định dạng in đậm / nghiêng / gạch chân trong nội dung BOQ; bỏ mọi thẻ
 * và thuộc tính khác (chống XSS). Chuẩn hoá strong→b, em→i cho gọn.
 */
function locDinhDang(raw: string): string {
  return raw
    .replace(/<\s*strong(\s[^>]*)?>/gi, "<b>")
    .replace(/<\s*\/\s*strong\s*>/gi, "</b>")
    .replace(/<\s*em(\s[^>]*)?>/gi, "<i>")
    .replace(/<\s*\/\s*em\s*>/gi, "</i>")
    // Bỏ thuộc tính của chính b/i/u.
    .replace(/<\s*(b|i|u)(\s[^>]*)?>/gi, "<$1>")
    // Xuống dòng -> khoảng trắng (nội dung BOQ là một dòng).
    .replace(/<br\s*\/?>/gi, " ")
    // Bỏ MỌI thẻ khác (giữ phần chữ bên trong).
    .replace(/<\/?(?!(?:b|i|u)\b)[a-z][^>]*>/gi, "")
    .trim();
}

/**
 * Sửa nội dung nhiều dòng BOQ đang có (chỉnh lỗi nhỏ), KHÔNG import lại — vì import
 * ghi đè sẽ xoá mất khối lượng Bill các tháng đã nhập. Nội dung giữ định dạng cơ
 * bản (in đậm/nghiêng/gạch chân) sau khi lọc. Mỗi trường gửi dạng mảng theo dòng.
 */
export async function suaNhieuDongBOQ(formData: FormData): Promise<KetQuaBOQ> {
  batBuocQuyen(await nguoiDungHienTai(), "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };
  const ct = kq.ct;

  const ids = formData.getAll("id").map(String);
  const stts = formData.getAll("stt").map((v) => String(v).trim());
  const noiDungs = formData.getAll("noiDung").map(String);
  const dvts = formData.getAll("dvt").map((v) => String(v).trim());
  const kls = formData.getAll("khoiLuong").map(String);
  const dgs = formData.getAll("donGia").map(String);
  const so = (t: string) => Number(String(t).replace(/\s/g, "").replace(/\./g, "").replace(",", "."));

  // Chỉ cho sửa dòng THUỘC công trình này (chống sửa xuyên công trình qua id đoán mò).
  const cua = new Set(
    (await db.bOQLine.findMany({ where: { projectId: ct.id }, select: { id: true } })).map((l) => l.id)
  );

  const dsSua: {
    id: string;
    stt: string;
    noiDung: string;
    dvt: string | null;
    khoiLuong: number;
    donGia: number;
  }[] = [];
  for (let i = 0; i < ids.length; i++) {
    if (!cua.has(ids[i])) continue;
    const stt = stts[i];
    if (!stt) return { ok: false, thongDiep: `Dòng ${i + 1}: STT không được để trống.` };
    const noiDung = locDinhDang(noiDungs[i] ?? "");
    if (noiDung.replace(/<[^>]*>/g, "").trim() === "") {
      return { ok: false, thongDiep: `${stt}: nội dung không được để trống.` };
    }
    const khoiLuong = kls[i] ? so(kls[i]) : 0;
    const donGia = dgs[i] ? so(dgs[i]) : 0;
    if (!Number.isFinite(khoiLuong) || khoiLuong < 0) {
      return { ok: false, thongDiep: `${stt}: khối lượng phải là số không âm.` };
    }
    if (!Number.isFinite(donGia) || donGia < 0) {
      return { ok: false, thongDiep: `${stt}: đơn giá phải là số không âm.` };
    }
    dsSua.push({ id: ids[i], stt, noiDung, dvt: dvts[i] || null, khoiLuong, donGia });
  }

  if (!dsSua.length) return { ok: false, thongDiep: "Không có dòng nào để sửa." };
  await db.$transaction(
    dsSua.map((u) =>
      db.bOQLine.update({
        where: { id: u.id },
        data: { stt: u.stt, noiDung: u.noiDung, dvt: u.dvt, khoiLuong: u.khoiLuong, donGia: u.donGia },
      })
    )
  );
  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  revalidatePath("/");
  return { ok: true, thongDiep: `Đã cập nhật ${dsSua.length} dòng BOQ.` };
}

/**
 * Đọc file BOQ Excel người dùng tải lên và trả về các dòng ĐÃ NHẬN DIỆN để đưa
 * vào bước review — CHƯA lưu gì. Người dùng sửa trên màn review rồi mới bấm lưu
 * (dùng `themNhieuDongBOQ`). Kiểm quyền + công trình trước khi cho đọc.
 */
export async function docFileBOQ(formData: FormData): Promise<KetQuaDocFileBOQ> {
  batBuocQuyen(await nguoiDungHienTai(), "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi, dongs: [] };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, thongDiep: "Chưa chọn file Excel.", dongs: [] };
  }

  const buf = await file.arrayBuffer();
  const doc = await docBOQTuExcel(buf);
  if (doc.loi) return { ok: false, thongDiep: doc.loi, dongs: [] };
  return { ok: true, thongDiep: `Đã đọc ${doc.dongs.length} dòng từ file.`, dongs: doc.dongs };
}

/**
 * Lưu thiết lập VAT của BOQ: đơn giá đã gồm VAT chưa + thuế suất VAT (%).
 * Ảnh hưởng cách hiển thị dòng TỔNG và giá trị Bill (lấy chưa VAT).
 */
export async function luuThietLapVAT(formData: FormData): Promise<KetQuaBOQ> {
  batBuocQuyen(await nguoiDungHienTai(), "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };

  const donGiaGomVAT = formData.get("donGiaGomVAT") === "on";
  const lamTronThanhTien = formData.get("lamTronThanhTien") === "on";
  const vat = Number(String(formData.get("vatPhanTram") ?? "").replace(",", "."));
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
    return { ok: false, thongDiep: "VAT (%) phải là số từ 0 đến 100." };
  }

  await db.project.update({
    where: { id: kq.ct.id },
    data: { donGiaGomVAT, vatPhanTram: vat, lamTronThanhTien },
  });

  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  revalidatePath("/");
  return { ok: true, thongDiep: "Đã lưu thiết lập." };
}

/**
 * Thêm một dòng chiết khấu (giảm giá) BOQ: giảm `phanTram`% trên tổng thành tiền
 * các dòng từ `tuStt` đến `denStt` (1-based). Tích "Toàn bộ" = cả BOQ.
 */
export async function themGiamGiaBOQ(formData: FormData): Promise<KetQuaBOQ> {
  batBuocQuyen(await nguoiDungHienTai(), "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };
  const ct = kq.ct;

  const soDong = await db.bOQLine.count({ where: { projectId: ct.id } });
  if (!soDong) return { ok: false, thongDiep: "Công trình chưa có BOQ." };

  const moTa = String(formData.get("moTa") ?? "").trim() || null;
  const phanTram = Number(String(formData.get("phanTram") ?? "").replace(",", "."));
  if (!Number.isFinite(phanTram) || phanTram <= 0 || phanTram > 100) {
    return { ok: false, thongDiep: "% giảm giá phải trong khoảng 0–100." };
  }

  let tuStt: number;
  let denStt: number;
  if (formData.get("toanBo") === "1") {
    tuStt = 1;
    denStt = soDong;
  } else {
    tuStt = parseInt(String(formData.get("tuStt") ?? ""), 10);
    denStt = parseInt(String(formData.get("denStt") ?? ""), 10);
    if (!Number.isFinite(tuStt) || !Number.isFinite(denStt) || tuStt < 1 || denStt < tuStt || denStt > soDong) {
      return { ok: false, thongDiep: `Phạm vi dòng phải nằm trong 1–${soDong} và từ ≤ đến.` };
    }
  }

  const max = await db.bOQGiamGia.aggregate({ where: { projectId: ct.id }, _max: { thuTu: true } });
  await db.bOQGiamGia.create({
    data: { projectId: ct.id, moTa, tuStt, denStt, phanTram, thuTu: (max._max.thuTu ?? -1) + 1 },
  });

  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  revalidatePath("/");
  return { ok: true, thongDiep: `Đã thêm giảm giá ${phanTram}% (dòng ${tuStt}–${denStt}).` };
}

export async function xoaGiamGiaBOQ(formData: FormData): Promise<KetQuaBOQ> {
  batBuocQuyen(await nguoiDungHienTai(), "nhap_boq");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };

  const g = await db.bOQGiamGia.findFirst({ where: { id, projectId: kq.ct.id } });
  if (!g) return { ok: false, thongDiep: "Không tìm thấy dòng giảm giá." };

  await db.bOQGiamGia.delete({ where: { id: g.id } });
  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  revalidatePath("/");
  return { ok: true, thongDiep: "Đã xoá dòng giảm giá." };
}
