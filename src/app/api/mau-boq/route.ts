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

export async function GET() {
  const u = await nguoiDungHienTai();
  if (!u) return new Response("Chưa đăng nhập", { status: 401 });
  if (!coQuyen(u, "nhap_boq")) return new Response("Không có quyền", { status: 403 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("BOQ");
  ws.columns = [
    { header: "STT", key: "stt", width: 8 },
    { header: "Nội dung hạng mục", key: "noiDung", width: 48 },
    { header: "Đơn vị tính", key: "dvt", width: 12 },
    { header: "Khối lượng", key: "khoiLuong", width: 14 },
    { header: "Đơn giá", key: "donGia", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };

  // Hai dòng ví dụ (in nghiêng) — người dùng xoá rồi điền dữ liệu thật.
  const vd1 = ws.addRow({ stt: 1, noiDung: "Đào móng", dvt: "m3", khoiLuong: 100, donGia: 50000 });
  const vd2 = ws.addRow({ stt: 2, noiDung: "Bê tông lót", dvt: "m3", khoiLuong: 50, donGia: 1200000 });
  for (const r of [vd1, vd2]) r.font = { italic: true, color: { argb: "FF999999" } };

  // Số hiển thị kiểu Việt Nam khi mở bằng Excel.
  ws.getColumn("khoiLuong").numFmt = "#,##0.##";
  ws.getColumn("donGia").numFmt = "#,##0";

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Mau_BOQ.xlsx"',
    },
  });
}
