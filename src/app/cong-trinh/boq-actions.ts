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
import { batBuocQuyen, coQuyen } from "@/lib/auth/quyen";
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
      trangThai: "CHO_XAC_NHAN",
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

  for (const l of dong) {
    const raw = String(formData.get(`kl_${l.id}`) ?? "").trim().replace(/\s/g, "").replace(",", ".");
    const kl = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(kl) || kl < 0) {
      return { ok: false, thongDiep: "Khối lượng phải là số không âm." };
    }
    if (kl === 0) {
      await db.bOQThucHien.deleteMany({ where: { boqLineId: l.id, thang } });
    } else {
      await db.bOQThucHien.upsert({
        where: { boqLineId_thang: { boqLineId: l.id, thang } },
        create: { boqLineId: l.id, thang, khoiLuong: kl },
        update: { khoiLuong: kl },
      });
    }

    // Ô tích "đã thi công xong" — thuộc về công tác, không theo tháng.
    const xong = formData.get(`xong_${l.id}`) === "on";
    await db.bOQLine.update({ where: { id: l.id }, data: { hoanThanh: xong } });
  }

  // Người có quyền xác nhận thì lưu là xác nhận luôn; còn lại phải chờ duyệt.
  const tuXacNhan = coQuyen(u, "xac_nhan_bill");
  await db.billThang.update({
    where: { id: bill.id },
    data: {
      nguoiNhap: u!.email,
      ngayNhap: new Date(),
      trangThai: tuXacNhan ? "DA_XAC_NHAN" : "CHO_XAC_NHAN",
      nguoiXacNhan: tuXacNhan ? u!.email : null,
      ngayXacNhan: tuXacNhan ? new Date() : null,
    },
  });

  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  revalidatePath("/");
  return {
    ok: true,
    thongDiep: tuXacNhan
      ? `Đã lưu và xác nhận Bill tháng ${thang}.`
      : `Đã lưu Bill tháng ${thang}. Chờ chỉ huy trưởng xác nhận mới tính vào KPI.`,
  };
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
  let them = 0;
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
    await db.bOQLine.create({
      data: { projectId: ct.id, stt, noiDung, dvt: dvts[i] || null, khoiLuong, donGia, thuTu: thuTu++ },
    });
    them++;
  }

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
  const vat = Number(String(formData.get("vatPhanTram") ?? "").replace(",", "."));
  if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
    return { ok: false, thongDiep: "VAT (%) phải là số từ 0 đến 100." };
  }

  await db.project.update({
    where: { id: kq.ct.id },
    data: { donGiaGomVAT, vatPhanTram: vat },
  });

  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  revalidatePath("/");
  return { ok: true, thongDiep: "Đã lưu thiết lập VAT." };
}

export async function xacNhanBill(formData: FormData): Promise<KetQuaBOQ> {
  const u = await nguoiDungHienTai();
  batBuocQuyen(u, "xac_nhan_bill");

  const maCongTrinh = String(formData.get("maCongTrinh") ?? "").trim();
  const thang = String(formData.get("thang") ?? "").trim();

  const kq = await congTrinhChoGhi(maCongTrinh);
  if ("loi" in kq) return { ok: false, thongDiep: kq.loi };
  const ct = kq.ct;

  const bill = await db.billThang.findUnique({
    where: { projectId_thang: { projectId: ct.id, thang } },
  });
  if (!bill) return { ok: false, thongDiep: `Chưa có Bill tháng ${thang}.` };

  await db.billThang.update({
    where: { id: bill.id },
    data: { trangThai: "DA_XAC_NHAN", nguoiXacNhan: u!.email, ngayXacNhan: new Date() },
  });

  revalidatePath(`/cong-trinh/${maCongTrinh}`);
  revalidatePath("/");
  return { ok: true, thongDiep: `Đã xác nhận Bill tháng ${thang}. Số liệu được tính vào KPI.` };
}
