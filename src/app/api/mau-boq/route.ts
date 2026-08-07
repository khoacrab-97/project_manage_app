/**
 * Sinh file Excel MẪU để nhập BOQ (bảng khối lượng hợp đồng).
 *
 * Người dùng tải file này, điền dữ liệu theo đúng 5 cột rồi import lại — có file
 * mẫu thì không phải đoán tên cột, và bộ đọc `parse-boq.ts` dò cột theo tên nên
 * khớp chắc chắn. Hai dòng ví dụ (in nghiêng) để hướng dẫn, người dùng xoá đi khi nhập.
 */
import ExcelJS from "exceljs";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { coQuyen } from "@/lib/auth/quyen";
import { TEN_THANH_PHAN, THANH_PHAN_THEO_KIEU, kieuHopLe, truongDonGia } from "@/lib/boq-thanh-phan";
import { withApiLogging } from "@/lib/logger";

async function getMauBoq(request: Request) {
  const u = await nguoiDungHienTai();
  if (!u) return new Response("Chưa đăng nhập", { status: 401 });
  if (!coQuyen(u, "nhap_boq")) return new Response("Không có quyền", { status: 403 });

  const kieu = kieuHopLe(new URL(request.url).searchParams.get("kieu"));
  const tps = THANH_PHAN_THEO_KIEU[kieu];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("BOQ");
  const cot: Partial<ExcelJS.Column>[] = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Nội dung hạng mục", key: "noiDung", width: 48 },
    { header: "Đơn vị tính", key: "dvt", width: 12 },
    { header: "Khối lượng", key: "khoiLuong", width: 14 },
  ];
  if (tps.length) {
    // Kiểu tách: mỗi thành phần một cột đơn giá (key = dgVT…). Đơn giá tổng tính khi lưu.
    for (const tp of tps) cot.push({ header: `Đơn giá ${TEN_THANH_PHAN[tp]}`, key: truongDonGia(tp), width: 18 });
  } else {
    cot.push({ header: "Đơn giá", key: "donGia", width: 16 });
  }
  ws.columns = cot;
  ws.getRow(1).font = { bold: true };

  // Hai dòng ví dụ (in nghiêng) — người dùng xoá rồi điền dữ liệu thật.
  const vd = (stt: number, noiDung: string, khoiLuong: number, dg: number) => {
    const row: Record<string, unknown> = { stt, noiDung, dvt: "m3", khoiLuong };
    if (tps.length) {
      // Chia đều ví dụ ra các thành phần cho dễ hình dung.
      const moi = Math.round(dg / tps.length);
      for (const tp of tps) row[truongDonGia(tp)] = moi;
    } else row.donGia = dg;
    return ws.addRow(row);
  };
  const vd1 = vd(1, "Đào móng", 100, 50000);
  const vd2 = vd(2, "Bê tông lót", 50, 1200000);
  for (const r of [vd1, vd2]) r.font = { italic: true, color: { argb: "FF999999" } };

  // Số hiển thị kiểu Việt Nam khi mở bằng Excel.
  ws.getColumn("khoiLuong").numFmt = "#,##0.##";
  for (const c of tps.length ? tps.map(truongDonGia) : ["donGia"]) ws.getColumn(c).numFmt = "#,##0";

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Mau_BOQ.xlsx"',
    },
  });
}

export const GET = withApiLogging("/api/mau-boq", getMauBoq);
