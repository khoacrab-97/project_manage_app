/**
 * Đọc file công trình và lấy ra 15 cột chuẩn.
 *
 * Thay thế đoạn Power Query trong sheet "MÃ POWER QUERY" của bộ chuẩn hóa.
 * Những điểm bắt buộc phải khớp với hành vi của Power Query gốc:
 *   - Nhận đúng Table `tbl_ChiTietTH`; nếu không có Table thì lùi về sheet
 *     "2.1 CHI TIẾT TH" (file mẫu hiện tại CHƯA được chuyển thành Table).
 *   - Chuẩn hóa tên cột: Text.Clean + Text.Trim + gộp nhiều dấu cách thành một.
 *     File công trình ghi "Mã Doanh thu  - Chi Phí" (HAI dấu cách), file tổng
 *     hợp ghi "Hạng mục" — cùng trỏ về một cột.
 *   - Chỉ lấy 15 cột; cột thứ 16 trở đi (S→AB: DA6K, DA7TN, HC27, VP72…) bỏ qua.
 */
import ExcelJS from "exceljs";

export const TEN_TABLE = "tbl_ChiTietTH";
export const TEN_SHEET = "2.1 CHI TIẾT TH";

/** 15 cột chuẩn, theo đúng thứ tự của Power Query. */
export const COT_CHUAN = [
  "STT",
  "Tên công trình",
  "Mã công trình",
  "Mã Base",
  "Số hóa đơn",
  "Ngày chứng từ",
  "Tháng thực hiện",
  "Tuần thực hiện",
  "Nội dung thanh toán",
  "ĐVT",
  "Đơn giá",
  "Số lượng",
  "Số tiền",
  "Mã DT–CP",
  "Ghi chú",
] as const;

export type TenCot = (typeof COT_CHUAN)[number];

/**
 * Bí danh cho cột thứ 14 — hai file gốc đặt tên khác nhau.
 * So khớp sau khi đã chuẩn hóa (bỏ dấu cách thừa, thường hóa).
 */
const BI_DANH: Record<string, TenCot> = {
  "ma doanh thu - chi phi": "Mã DT–CP",
  "ma doanh thu-chi phi": "Mã DT–CP",
  "ma dt-cp": "Mã DT–CP",
  "ma dt–cp": "Mã DT–CP",
  "hang muc": "Mã DT–CP",
  "ma/hang muc": "Mã DT–CP",
};

/** Bỏ dấu tiếng Việt + gộp khoảng trắng, để so tên cột bền với sai lệch gõ tay. */
export function chuanHoaTen(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[–—]/g, "-") // en/em dash -> hyphen
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const TRA_COT = new Map<string, TenCot>();
for (const c of COT_CHUAN) TRA_COT.set(chuanHoaTen(c), c);
for (const [k, v] of Object.entries(BI_DANH)) TRA_COT.set(chuanHoaTen(k), v);

export interface DongThô {
  /** Số dòng thật trong sheet, để báo lỗi chỉ đúng chỗ. */
  dongExcel: number;
  giaTri: Partial<Record<TenCot, unknown>>;
}

export interface KetQuaDoc {
  nguon: "table" | "sheet";
  tenSheet: string;
  /** Tên cột đọc được, sau chuẩn hóa. */
  cotTimThay: TenCot[];
  cotThieu: TenCot[];
  /** Cột có trong file nhưng ngoài 15 cột chuẩn — bị bỏ qua. */
  cotBoQua: string[];
  dong: DongThô[];
  loiCauTruc: string[];
}

function oGiaTri(o: ExcelJS.Cell | undefined): unknown {
  if (!o) return null;
  const v = o.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if (v instanceof Date) return v;
    if ("result" in v) return (v as { result: unknown }).result ?? null; // ô công thức
    if ("richText" in v)
      return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
    if ("text" in v) return (v as { text: string }).text;
    if ("error" in v) return null; // #REF!, #DIV/0! -> coi như trống
  }
  return v;
}

/** Đọc buffer .xlsx và trả về các dòng đã ánh xạ về 15 cột chuẩn. */
export async function docFileCongTrinh(buffer: ArrayBuffer): Promise<KetQuaDoc> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const loiCauTruc: string[] = [];

  // 1. Ưu tiên tìm Table tbl_ChiTietTH.
  let ws: ExcelJS.Worksheet | undefined;
  let hangHeader = 0;
  let nguon: "table" | "sheet" = "table";

  for (const sheet of wb.worksheets) {
    const tables = (sheet as unknown as { tables?: Record<string, { table?: { name?: string; tableRef?: string } }> })
      .tables;
    if (!tables) continue;
    for (const key of Object.keys(tables)) {
      const t = tables[key]?.table;
      const ten = t?.name ?? key;
      if (chuanHoaTen(ten) === chuanHoaTen(TEN_TABLE)) {
        ws = sheet;
        const ref = t?.tableRef ?? "A1";
        hangHeader = Number(ref.split(":")[0].replace(/[A-Z]/g, "")) || 1;
      }
    }
  }

  // 2. Không có Table -> lùi về sheet theo tên (file mẫu hiện tại rơi vào nhánh này).
  if (!ws) {
    nguon = "sheet";
    ws = wb.worksheets.find((s) => chuanHoaTen(s.name) === chuanHoaTen(TEN_SHEET));
    if (!ws) {
      // 3. Cuối cùng: dò sheet nào có hàng chứa đủ các tiêu đề đặc trưng.
      for (const s of wb.worksheets) {
        for (let r = 1; r <= Math.min(10, s.rowCount); r++) {
          const ten = (s.getRow(r).values as unknown[])
            .map((v) => (typeof v === "string" ? chuanHoaTen(v) : ""))
            .filter(Boolean);
          if (ten.includes("so tien") && ten.includes("ma cong trinh")) {
            ws = s;
            hangHeader = r;
            break;
          }
        }
        if (ws) break;
      }
    }
    if (ws) {
      loiCauTruc.push(
        `Không tìm thấy Table "${TEN_TABLE}". Đang đọc theo sheet "${ws.name}". ` +
          `Cần chuyển vùng dữ liệu thành Table để nhập ổn định về lâu dài.`
      );
    }
  }

  if (!ws) {
    return {
      nguon,
      tenSheet: "",
      cotTimThay: [],
      cotThieu: [...COT_CHUAN],
      cotBoQua: [],
      dong: [],
      loiCauTruc: [
        `Không tìm thấy Table "${TEN_TABLE}" lẫn sheet "${TEN_SHEET}" trong file. ` +
          `Nhiều khả năng đây không phải file công trình (có thể là file tổng hợp).`,
      ],
    };
  }

  // Tìm hàng tiêu đề nếu chưa biết.
  if (!hangHeader) {
    for (let r = 1; r <= Math.min(12, ws.rowCount); r++) {
      const ten = (ws.getRow(r).values as unknown[])
        .map((v) => (typeof v === "string" ? chuanHoaTen(v) : ""))
        .filter(Boolean);
      if (ten.includes("so tien")) {
        hangHeader = r;
        break;
      }
    }
  }
  if (!hangHeader) hangHeader = 1;

  // Ánh xạ chỉ số cột -> tên cột chuẩn.
  const header = ws.getRow(hangHeader);
  const anhXaCot = new Map<number, TenCot>();
  const cotBoQua: string[] = [];
  const daDung = new Set<TenCot>();

  header.eachCell({ includeEmpty: false }, (cell, colIdx) => {
    const raw = oGiaTri(cell);
    if (typeof raw !== "string" || !raw.trim()) return;
    const chuan = TRA_COT.get(chuanHoaTen(raw));
    if (chuan && !daDung.has(chuan)) {
      anhXaCot.set(colIdx, chuan);
      daDung.add(chuan);
    } else if (chuan && daDung.has(chuan)) {
      loiCauTruc.push(`Cột "${raw}" bị trùng tên với một cột đã đọc — chỉ lấy cột đầu tiên.`);
    } else {
      cotBoQua.push(raw.trim());
    }
  });

  const cotTimThay = [...daDung];
  const cotThieu = COT_CHUAN.filter((c) => !daDung.has(c));

  // Đọc dữ liệu.
  const dong: DongThô[] = [];
  for (let r = hangHeader + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const giaTri: Partial<Record<TenCot, unknown>> = {};
    let coGiaTri = false;
    for (const [colIdx, ten] of anhXaCot) {
      const v = oGiaTri(row.getCell(colIdx));
      if (v !== null && v !== "") coGiaTri = true;
      giaTri[ten] = v;
    }
    if (coGiaTri) dong.push({ dongExcel: r, giaTri });
  }

  return { nguon, tenSheet: ws.name, cotTimThay, cotThieu, cotBoQua, dong, loiCauTruc };
}
