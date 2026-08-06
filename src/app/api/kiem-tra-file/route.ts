/**
 * Nhận file .xlsx người dùng tải lên, đọc Table `tbl_ChiTietTH` và chạy bộ quy
 * tắc kiểm tra. Chạy phía máy chủ để exceljs không lọt vào bundle trình duyệt.
 *
 * Đây là bước "Kiểm tra" của luồng §11.2 — CHƯA ghi sổ. Bước ghi sổ nằm ở
 * Phase 2 khi đã có cơ sở dữ liệu và workflow phê duyệt.
 */
import { NextResponse } from "next/server";
import { docFileCongTrinh } from "@/lib/excel/parse-chitiet-th";
import { kiemTra, type NguCanh } from "@/lib/validation";
import { layCongTrinh, layDanhMucMa, layGiaoDich } from "@/lib/data/repository";
import { serverLogger, withApiLogging } from "@/lib/logger";

export const runtime = "nodejs";
/** File tải lên là dữ liệu người dùng, không được cache. */
export const dynamic = "force-dynamic";

const TOI_DA_BYTE = 25 * 1024 * 1024;

async function postKiemTraFile(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    serverLogger.warn("excel_file_rejected", {
      module: "excel_import",
      status: "invalid_form",
    });
    return NextResponse.json({ loiXuLy:"Không đọc được dữ liệu tải lên." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    serverLogger.warn("excel_file_rejected", {
      module: "excel_import",
      status: "missing_file",
    });
    return NextResponse.json({ loiXuLy:"Thiếu file." }, { status: 400 });
  }
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    serverLogger.warn("excel_file_rejected", {
      module: "excel_import",
      fileSizeBytes: file.size,
      fileExtension: duoiFile(file.name),
      status: "invalid_extension",
    });
    return NextResponse.json(
      { loiXuLy: "Chỉ nhận file .xlsx hoặc .xlsm. File .xls đời cũ cần lưu lại dưới định dạng mới." },
      { status: 400 }
    );
  }
  if (file.size > TOI_DA_BYTE) {
    serverLogger.warn("excel_file_rejected", {
      module: "excel_import",
      fileSizeBytes: file.size,
      fileExtension: duoiFile(file.name),
      status: "file_too_large",
    });
    return NextResponse.json(
      { loiXuLy: `File ${(file.size / 1024 / 1024).toFixed(1)} MB vượt giới hạn 25 MB.` },
      { status: 400 }
    );
  }
  if (file.name.startsWith("~$")) {
    serverLogger.warn("excel_file_rejected", {
      module: "excel_import",
      fileSizeBytes: file.size,
      fileExtension: duoiFile(file.name),
      status: "excel_temp_file",
    });
    return NextResponse.json(
      { loiXuLy: "Đây là file tạm của Excel (~$). Đóng Excel rồi tải lại file thật." },
      { status: 400 }
    );
  }

  try {
    const doc = await docFileCongTrinh(await file.arrayBuffer());

    const danhMuc = await layDanhMucMa();
    const nc: NguCanh = {
      maHopLe: new Set(danhMuc.map((c) => c.ma)),
      maNhapTrucTiep: new Set(danhMuc.filter((c) => c.choPhepNhapTrucTiep).map((c) => c.ma)),
      congTrinhHopLe: new Set((await layCongTrinh()).map((c) => c.maCongTrinh)),
      hashDaCo: new Set((await layGiaoDich()).map((g) => g.rowHash)),
      kyDaKhoa: new Set<string>(), // khóa kỳ thuộc Phase 2
    };

    const kq = kiemTra(doc, nc);

    serverLogger.info("excel_file_check_completed", {
      module: "excel_import",
      fileSizeBytes: file.size,
      fileExtension: duoiFile(file.name),
      rowCount: kq.dong.length,
      errorCount: kq.loi.length,
      status: "completed",
    });

    // Trả gọn: 200 dòng đầu là đủ để xem trước.
    return NextResponse.json({
      tenFile: file.name,
      kichThuoc: file.size,
      nguon: doc.nguon,
      tenSheet: doc.tenSheet,
      cotTimThay: doc.cotTimThay,
      cotThieu: doc.cotThieu,
      cotBoQua: doc.cotBoQua,
      tomTat: kq.tomTat,
      loiCauTruc: kq.loiCauTruc,
      loi: kq.loi.slice(0, 500),
      tongSoLoi: kq.loi.length,
      dong: kq.dong.slice(0, 200),
    });
  } catch (e) {
    serverLogger.error(
      "excel_file_check_failed",
      {
        module: "excel_import",
        fileSizeBytes: file.size,
        fileExtension: duoiFile(file.name),
        status: "failed",
      },
      e
    );
    return NextResponse.json(
      {
        loiXuLy: `Không đọc được file: ${e instanceof Error ? e.message : "lỗi không xác định"}. File có thể bị hỏng hoặc được bảo vệ bằng mật khẩu.`,
      },
      { status: 422 }
    );
  }
}

export const POST = withApiLogging("/api/kiem-tra-file", postKiemTraFile);

function duoiFile(tenFile: string): string {
  const phan = tenFile.split(".");
  return phan.length > 1 ? `.${phan.at(-1)?.toLowerCase()}` : "";
}
