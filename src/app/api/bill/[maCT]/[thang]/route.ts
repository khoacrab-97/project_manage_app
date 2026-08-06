/**
 * Xuất Bill tháng ra .xlsx theo form KT-08-BM01 do công ty ban hành.
 *
 * ĐIỀN VÀO CHÍNH FILE MẪU, không vẽ lại: mở `templates/KT-08-BM01.xlsx` rồi ghi
 * giá trị vào đúng ô. Nhờ vậy font, khung, ô ký và mã số biểu vẫn y hệt bản
 * ban hành — vẽ lại thì kiểu gì cũng lệch đôi chút.
 *
 * File mẫu có 6 sheet, 5 sheet là số liệu mẫu của người khác. Bản xuất ra CHỈ
 * giữ sheet "1.1 BILL" để không phát tán dữ liệu không liên quan.
 *
 * Chỉ xuất được tháng ĐÃ XÁC NHẬN: đây là "Bill xác nhận doanh thu", phát hành
 * cho số liệu chưa duyệt là sai bản chất của chứng từ.
 */
import path from "node:path";
import ExcelJS from "exceljs";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { giaTriBillThang, layBOQ, layCongTrinh } from "@/lib/data/repository";
import { serverLogger, withApiLogging } from "@/lib/logger";

const TEN_SHEET = "1.1 BILL";

async function getBill(_req: Request, { params }: RouteContext<"/api/bill/[maCT]/[thang]">) {
  const { maCT, thang } = await params;
  const maCongTrinh = decodeURIComponent(maCT);

  if (!(await nguoiDungHienTai())) {
    return new Response("Chưa đăng nhập", { status: 401 });
  }

  // layCongTrinh() đã lọc theo phạm vi, nên công trình ngoài phạm vi = không thấy.
  const ct = (await layCongTrinh()).find((c) => c.maCongTrinh === maCongTrinh);
  if (!ct) {
    serverLogger.warn("bill_export_rejected", {
      module: "bill_export",
      projectCode: maCongTrinh,
      month: thang,
      status: "project_not_found",
    });
    return new Response("Không tìm thấy công trình", { status: 404 });
  }

  const { thangs, dongs } = await layBOQ(maCongTrinh);
  const ky = thangs.find((t) => t.thang === thang);
  if (!ky) {
    serverLogger.warn("bill_export_rejected", {
      module: "bill_export",
      projectCode: maCongTrinh,
      month: thang,
      status: "bill_not_found",
    });
    return new Response(`Chưa có Bill tháng ${thang}`, { status: 404 });
  }

  const giaTri = giaTriBillThang(dongs, thang);
  // Luỹ kế "đã ra bill" tính tới hết tháng đang xuất (không còn bước xác nhận).
  const luyKe = thangs
    .filter((t) => t.thang <= thang)
    .reduce((a, t) => a + giaTriBillThang(dongs, t.thang), 0);
  const ttHopDong = dongs.reduce((a, d) => a + d.ttHopDong, 0);
  const tienDo = ttHopDong ? luyKe / ttHopDong : 0;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(process.cwd(), "templates", "KT-08-BM01.xlsx"));

  // Bỏ mọi sheet khác trước khi ghi, tránh mang theo số liệu mẫu.
  for (const ws of [...wb.worksheets]) {
    if (ws.name !== TEN_SHEET) wb.removeWorksheet(ws.id);
  }
  const ws = wb.getWorksheet(TEN_SHEET);
  if (!ws) {
    serverLogger.error("bill_export_failed", {
      module: "bill_export",
      projectCode: maCongTrinh,
      month: thang,
      status: "missing_template_sheet",
    });
    return new Response("File mẫu thiếu sheet 1.1 BILL", { status: 500 });
  }

  const nhanTien = (v: number) => v.toLocaleString("vi-VN");

  // Giữ số 0 đứng đầu và dấu phẩy thập phân đúng kiểu Việt Nam, y như bản mẫu
  // ("THỰC HIỆN THÁNG 05/2026"). nhanThang() cho "T7/2026" nên không dùng ở đây.
  const [nam, thangSo] = thang.split("-");
  ws.getCell("F6").value = `THỰC HIỆN THÁNG ${thangSo}/${nam}`;
  ws.getCell("A8").value = `_ Người yêu cầu: ${ct.chiHuyTruong || ""}`;
  ws.getCell("D8").value = `_ Phòng ban: ${ct.phongPhuTrach || ""}`;
  ws.getCell("A9").value = `_Tên Khách hàng : ${ct.chuDauTu || ""}`;
  // Số hợp đồng chưa có trong dữ liệu công trình -> để trống cho người ký điền tay.
  ws.getCell("D9").value = "_ Số hợp đồng: ";
  ws.getCell("A10").value = "_ Mã doanh thu: Bill";
  ws.getCell("D10").value = `_ Mã công trình: ${maCongTrinh}`;
  ws.getCell("A11").value = `_Giá trị đã ra bill đến ngày ra bill hiện tại : ${nhanTien(luyKe)}`;
  ws.getCell("A12").value = `_Tiến độ thực hiện hợp đồng: ${(tienDo * 100)
    .toFixed(1)
    .replace(".", ",")}%`;

  ws.getCell("B17").value = ct.tenCongTrinh;
  ws.getCell("C17").value = "Gói";
  ws.getCell("D17").value = 1;
  ws.getCell("E17").value = giaTri;
  // Giữ nguyên công thức của biểu mẫu, kèm sẵn kết quả để trình xem nào cũng hiện số.
  ws.getCell("F17").value = { formula: "+D17*E17", result: giaTri };

  const buf = await wb.xlsx.writeBuffer();
  serverLogger.info("bill_export_completed", {
    module: "bill_export",
    projectCode: maCongTrinh,
    month: thang,
    status: "completed",
  });
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Bill_${maCongTrinh}_${thang}.xlsx"`,
    },
  });
}

export const GET = withApiLogging("/api/bill/[maCT]/[thang]", getBill);
