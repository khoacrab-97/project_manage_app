/**
 * Đọc file Excel BOQ do người dùng nhập theo file mẫu (/api/mau-boq).
 *
 * Dò cột theo TÊN (không chốt cứng vị trí) để người dùng chèn thêm cột mô tả vẫn
 * đọc được: tìm trong 15 dòng đầu một dòng có đủ "khối lượng" + "đơn giá" làm dòng
 * tiêu đề, rồi ánh xạ 5 cột STT / Nội dung / ĐVT / Khối lượng / Đơn giá.
 *
 * Trả về MỌI dòng có dữ liệu (kể cả dòng thiếu STT/nội dung) — bước review trên app
 * cho người dùng sửa trực tiếp trước khi lưu, nên không loại ngầm ở đây.
 */
import ExcelJS from "exceljs";

export interface DongBOQDoc {
  stt: string;
  noiDung: string;
  dvt: string;
  /** Giữ dạng chuỗi để đổ vào ô nhập ở màn review; app parse lại khi lưu. */
  khoiLuong: string;
  donGia: string;
}

export interface KetQuaDocBOQ {
  dongs: DongBOQDoc[];
  loi: string | null;
}

const chuanHoa = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // "đ/Đ" không phải tổ hợp dấu nên NFD không tách — map tay để "đơn giá"→"don gia".
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();

/** Ô công thức thì lấy result đã tính; còn lại lấy value thô. */
function oGiaTri(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  return v !== null && typeof v === "object" && "result" in v ? (v as { result: unknown }).result : v;
}

/**
 * "1.234.567" hoặc "1234567,5" -> chuỗi số theo QUY ƯỚC VIỆT của app (phần thập
 * phân dùng DẤU PHẨY, không có dấu phân nhóm). Phải khớp cách `so()` ở boq-actions
 * đọc lại khi lưu — nó bỏ mọi dấu chấm và đổi phẩy thành chấm; nếu trả "35.5"
 * (chấm thập phân) thì bị hiểu nhầm thành 355. Ô rỗng/không phải số trả nguyên văn.
 */
function soChuoi(v: unknown): string {
  const raw = v === null || v === undefined ? "" : typeof v === "number" ? String(v) : String(v).trim();
  if (raw === "") return "";
  const s = raw.replace(/[\s.]/g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return typeof v === "string" ? v.trim() : "";
  // Số nguyên giữ nguyên; số lẻ đổi dấu chấm thập phân của JS sang dấu phẩy.
  return String(n).replace(".", ",");
}

export async function docBOQTuExcel(buffer: ArrayBuffer): Promise<KetQuaDocBOQ> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { dongs: [], loi: "File không có sheet nào." };

  // --- Dò dòng tiêu đề + ánh xạ cột theo tên ---
  let dongTieuDe = 0;
  let cStt = 0;
  let cNoiDung = 0;
  let cDvt = 0;
  let cKL = 0;
  let cDG = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 15); r++) {
    let kl = 0;
    let dg = 0;
    let stt = 0;
    let nd = 0;
    let dvt = 0;
    for (let c = 1; c <= ws.columnCount; c++) {
      const t = chuanHoa(String(ws.getRow(r).getCell(c).value ?? ""));
      if (!t) continue;
      if (!stt && t === "stt") stt = c;
      else if (!nd && (t.includes("noi dung") || t.includes("mo ta") || t.includes("hang muc"))) nd = c;
      else if (!dvt && (t.includes("don vi") || t === "dvt")) dvt = c;
      else if (!kl && t.includes("khoi luong")) kl = c;
      else if (!dg && t.includes("don gia")) dg = c;
    }
    if (kl && dg) {
      dongTieuDe = r;
      cStt = stt;
      cNoiDung = nd;
      cDvt = dvt;
      cKL = kl;
      cDG = dg;
      break;
    }
  }
  if (!cKL || !cDG) {
    return {
      dongs: [],
      loi: 'Không tìm thấy cột "Khối lượng" và "Đơn giá". Hãy tải file mẫu và điền theo đúng cột.',
    };
  }

  // --- Đọc dữ liệu ---
  const dongs: DongBOQDoc[] = [];
  for (let r = dongTieuDe + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const stt = cStt ? String(oGiaTri(row.getCell(cStt)) ?? "").trim() : "";
    const noiDung = cNoiDung ? String(oGiaTri(row.getCell(cNoiDung)) ?? "").trim() : "";
    const dvt = cDvt ? String(oGiaTri(row.getCell(cDvt)) ?? "").trim() : "";
    const khoiLuong = soChuoi(oGiaTri(row.getCell(cKL)));
    const donGia = soChuoi(oGiaTri(row.getCell(cDG)));
    // Dòng trống hoàn toàn thì bỏ.
    if (!stt && !noiDung && !dvt && !khoiLuong && !donGia) continue;
    dongs.push({ stt, noiDung, dvt, khoiLuong, donGia });
  }

  if (!dongs.length) {
    return { dongs: [], loi: "File không có dòng dữ liệu nào dưới dòng tiêu đề." };
  }
  return { dongs, loi: null };
}
