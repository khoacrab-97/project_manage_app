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

export const runtime = "nodejs";
/** File tải lên là dữ liệu người dùng, không được cache. */
export const dynamic = "force-dynamic";

const TOI_DA_BYTE = 25 * 1024 * 1024;

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ loiXuLy:"Không đọc được dữ liệu tải lên." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ loiXuLy:"Thiếu file." }, { status: 400 });
  }
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    return NextResponse.json(
      { loiXuLy: "Chỉ nhận file .xlsx hoặc .xlsm. File .xls đời cũ cần lưu lại dưới định dạng mới." },
      { status: 400 }
    );
  }
  if (file.size > TOI_DA_BYTE) {
    return NextResponse.json(
      { loiXuLy: `File ${(file.size / 1024 / 1024).toFixed(1)} MB vượt giới hạn 25 MB.` },
      { status: 400 }
    );
  }
  if (file.name.startsWith("~$")) {
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
    return NextResponse.json(
      {
        loiXuLy: `Không đọc được file: ${e instanceof Error ? e.message : "lỗi không xác định"}. File có thể bị hỏng hoặc được bảo vệ bằng mật khẩu.`,
      },
      { status: 422 }
    );
  }
}
