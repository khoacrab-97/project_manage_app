/**
 * Đọc file Excel kế hoạch – ngân sách.
 *
 * KHÔNG dùng chung bộ đọc `parse-chitiet-th.ts`: file đó đọc sổ giao dịch 15 cột,
 * còn kế hoạch chỉ có "mã" và "giá trị cho cả dự án".
 *
 * File nhận vào dùng MÃ THEO DANH MỤC HIỆN HÀNH (CP-*, 041-*…), không phải hệ mã
 * cũ DA* — app đã bỏ bảng ánh xạ. Nút "Tải file mẫu" sinh sẵn đúng định dạng này.
 *
 * Cách dò cột: tìm trong 10 dòng đầu một dòng có ô chứa "mã", rồi lấy cột đó làm
 * cột mã và cột đầu tiên chứa "kế hoạch"/"giá trị" làm cột số tiền. Dò theo tên
 * thay vì chốt cứng vị trí để người dùng chèn thêm cột mô tả vẫn đọc được.
 */
import ExcelJS from "exceljs";

export interface DongKeHoachDoc {
  ma: string;
  giaTri: number;
}

export interface KetQuaDocKeHoach {
  dongs: DongKeHoachDoc[];
  /** Mã trong file nhưng không có trong danh mục — bị loại, không gộp ngầm. */
  maLa: string[];
  loi: string | null;
}

const chuanHoa = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** "1.234.567" hoặc "1234567,5" -> số. Trả null nếu không phải số. */
function docSo(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[\s.]/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function docKeHoachTuExcel(
  buffer: ArrayBuffer,
  maHopLe: Set<string>
): Promise<KetQuaDocKeHoach> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return { dongs: [], maLa: [], loi: "File không có sheet nào." };

  // --- Dò dòng tiêu đề và hai cột cần dùng ---
  let dongTieuDe = 0;
  let cotMa = 0;
  let cotGiaTri = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    for (let c = 1; c <= ws.columnCount; c++) {
      const t = chuanHoa(String(ws.getRow(r).getCell(c).value ?? ""));
      if (!t) continue;
      if (!cotMa && t === "ma") {
        dongTieuDe = r;
        cotMa = c;
      } else if (dongTieuDe === r && !cotGiaTri && (t.includes("ke hoach") || t.includes("gia tri"))) {
        cotGiaTri = c;
      }
    }
    if (cotMa && cotGiaTri) break;
  }
  if (!cotMa || !cotGiaTri) {
    return {
      dongs: [],
      maLa: [],
      loi: 'Không tìm thấy cột "Mã" và cột "Kế hoạch" trong 10 dòng đầu. Hãy tải file mẫu và điền theo đúng cột.',
    };
  }

  // --- Đọc dữ liệu ---
  const gom = new Map<string, number>();
  const maLa = new Set<string>();
  for (let r = dongTieuDe + 1; r <= ws.rowCount; r++) {
    const ma = String(ws.getRow(r).getCell(cotMa).value ?? "").trim();
    if (!ma) continue;
    const o = ws.getRow(r).getCell(cotGiaTri).value;
    // Ô công thức: lấy kết quả đã tính sẵn trong file.
    const tho = o !== null && typeof o === "object" && "result" in o ? o.result : o;
    const v = docSo(tho);
    if (v === null || v === 0) continue;

    if (!maHopLe.has(ma)) {
      maLa.add(ma);
      continue;
    }
    // Cùng một mã xuất hiện nhiều dòng thì cộng dồn, không ghi đè.
    gom.set(ma, (gom.get(ma) ?? 0) + v);
  }

  return {
    dongs: [...gom.entries()].map(([ma, giaTri]) => ({ ma, giaTri })),
    maLa: [...maLa],
    loi: null,
  };
}
