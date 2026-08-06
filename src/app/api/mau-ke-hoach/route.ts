/**
 * Sinh file Excel mẫu để nhập kế hoạch – ngân sách.
 *
 * Liệt kê sẵn mọi mã CHO PHÉP NHẬP TRỰC TIẾP theo danh mục hiện hành, người dùng
 * chỉ việc điền cột "Kế hoạch". Có file mẫu thì không phải đoán tên cột, và
 * tránh việc dùng lại file kế hoạch cũ (hệ mã DA*) mà app không còn hiểu.
 */
import ExcelJS from "exceljs";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { layDanhMucTheoCay } from "@/lib/data/repository";
import { withApiLogging } from "@/lib/logger";

async function getMauKeHoach(_request: Request) {
  if (!(await nguoiDungHienTai())) return new Response("Chưa đăng nhập", { status: 401 });

  // Cùng trật tự cây với lưới nhập trên app — người dùng đối chiếu hai bên không lạc.
  const danhMuc = await layDanhMucTheoCay();

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("KE HOACH");
  ws.columns = [
    { header: "Mã", key: "ma", width: 14 },
    { header: "Nội dung", key: "ten", width: 46 },
    { header: "Loại", key: "loai", width: 12 },
    { header: "Kế hoạch", key: "giaTri", width: 18 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const c of danhMuc) {
    // Mã con thụt vào bằng khoảng trắng để nhìn ra cấp bậc ngay trong Excel.
    const dong = ws.addRow({
      ma: c.ma,
      ten: (c.capCon ? "    " : "") + c.ten,
      loai: c.loai,
      giaTri: null,
    });
    if (!c.capCon) dong.font = { bold: true };
  }
  // Cột tiền hiển thị kiểu Việt Nam cho dễ đọc khi mở bằng Excel.
  ws.getColumn("giaTri").numFmt = "#,##0";

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="Mau_ke_hoach_ngan_sach.xlsx"',
    },
  });
}

export const GET = withApiLogging("/api/mau-ke-hoach", getMauKeHoach);
