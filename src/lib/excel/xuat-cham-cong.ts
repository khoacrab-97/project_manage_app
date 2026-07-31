/**
 * Dựng workbook Excel "Bảng chấm công" đội NỘI THÀNH cho một tháng.
 *
 * Vì SỐ CỘT NGÀY co giãn theo số ngày trong tháng (28–31), không thể đổ vào ô cố
 * định của file mẫu — nên sinh bảng bằng code theo đúng layout mẫu, cột ngày sinh
 * động. Hai sheet NỐI NHAU BẰNG CÔNG THỨC SỐNG:
 *
 *   "Theo dõi công DA"  — lưới chi tiết: mỗi công nhân nhiều dòng (1 dòng/dự án)
 *                         + 1 dòng "Tổng Cộng". Ô ngày = [Ngày công | Tăng ca].
 *   "Bảng chấm công"    — bản nộp, mỗi công nhân 1 dòng, các cột KÉO từ dòng
 *                         Tổng Cộng của sheet trên bằng công thức.
 *
 * Sửa một ô ngày công trong Excel → tổng của dòng, dòng Tổng Cộng và Bảng chấm
 * công tự đổi theo. Đó là yêu cầu "các sheet link với nhau".
 */
import path from "node:path";
import ExcelJS from "exceljs";
import type { DuAnCham, DuLieuXuatChamCong } from "@/lib/data/cong-nhan";

/** Font của form mẫu công ty. */
const TIMES = "Times New Roman";

const CO_CHU = 12; // cỡ chữ nội dung đồng bộ
const CO_TIEU_DE = 18; // cỡ chữ tên bảng

/**
 * Đồng bộ toàn sheet: Times New Roman, mọi nội dung cỡ 12 (giữ đậm/nghiêng/màu
 * đã có); ô chưa canh thì canh giữa. Tên bảng đặt cỡ 18 riêng SAU khi gọi hàm này.
 */
function dungFontMau(ws: ExcelJS.Worksheet) {
  ws.eachRow((row) => {
    // includeEmpty: phủ cả ô trống trong phạm vi hàng (ô ngày không có công) để
    // font đồng bộ, không sót ô Calibri mặc định.
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { ...(cell.font ?? {}), name: TIMES, size: CO_CHU };
      if (!cell.alignment) cell.alignment = { horizontal: "center", vertical: "middle" };
    });
  });
}

/** Đặt cỡ tên bảng (gọi SAU dungFontMau để không bị ép về 12). */
function tenBangCo(ws: ExcelJS.Worksheet, row: number) {
  const c = ws.getCell(row, 1);
  c.font = { ...(c.font ?? {}), name: TIMES, size: CO_TIEU_DE, bold: true };
}

/**
 * Nhúng logo letterhead công ty (trích từ form mẫu) vào góc trên trái sheet.
 * Kích thước cố định 10 × 2,66 cm (≈ 378 × 101 px) và neo TUYỆT ĐỐI — không di
 * chuyển/co giãn theo ô ("Don't move or size with cells"). File ở templates/,
 * được đóng gói sang dist/templates/ khi build.
 */
function themLogo(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, ten: string) {
  const duoi = ten.split(".").pop() as "jpeg" | "png";
  const id = wb.addImage({ filename: path.join(process.cwd(), "templates", ten), extension: duoi });
  // exceljs nhận {tl, ext, editAs} lúc chạy (neo tuyệt đối), nhưng kiểu ImageRange
  // lại bắt buộc `br` — ép qua unknown cho đúng kiểu.
  ws.addImage(id, {
    tl: { col: 0, row: 0 },
    ext: { width: 378, height: 101 },
    editAs: "absolute",
  } as unknown as ExcelJS.ImageRange);
}

/** Số cột (1-based) → chữ cái cột Excel (1→A, 27→AA). */
function colL(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = (n - m - 1) / 26;
  }
  return s;
}

const THU = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

const VIEN_MONG: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

export async function taoWorkbookChamCong(
  d: DuLieuXuatChamCong,
  logo: { theoDoi: string; bang: string }
): Promise<ArrayBuffer> {
  const N = d.soNgay;

  // Tên tab kèm tháng như form mẫu ("… tháng 06-2026" / "… T06-2026").
  const MM = String(d.thangSo).padStart(2, "0");
  const tenTheoDoi = `Theo dõi công DA T${MM}-${d.nam}`;
  const tenBang = `Bảng chấm công tháng ${MM}-${d.nam}`;
  const tenPhanBo = `Phân bổ công T${MM}-${d.nam}`;

  // --- Bản đồ cột của "Theo dõi công DA" ---
  const FIRST = 5; // E = "Ngày công" của ngày 1
  const cCong = (k: number) => FIRST + 2 * (k - 1);
  const cOt = (k: number) => cCong(k) + 1;
  const last = cOt(N); // cột "Tăng ca" của ngày cuối
  const cTCprevT = last + 1;
  const cTCprevCN = last + 2;
  const cNP = last + 3; // Nghỉ phép
  const cTong = last + 4; // Tổng ngày công
  const cTC = last + 5; // Tổng tăng ca (ngày thường)
  const cTCcn = last + 6; // Tăng ca Chủ nhật/Lễ
  const cGhiChu = last + 7;

  const congCols = Array.from({ length: N }, (_, i) => colL(cCong(i + 1)));
  const otThuongCols: string[] = [];
  const otCnCols: string[] = [];
  for (let k = 1; k <= N; k++) {
    (d.chuNhat.has(k) || d.ngayLe.has(k) ? otCnCols : otThuongCols).push(colL(cOt(k)));
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(tenTheoDoi, { views: [{ state: "frozen", xSplit: 4, ySplit: 6 }] });

  // Hàng đầu đề dời xuống chừa chỗ logo (hàng 1..3): tiêu đề 3, ngày 4, thứ 5, sub 6, dữ liệu 7.
  const HR_TT = 3;
  const HR_NGAY = 4;
  const HR_THU = 5;
  const HR_SUB = 6;
  const DATA0 = 7;
  themLogo(wb, ws, logo.theoDoi);

  // ---------- Tiêu đề + hàng đầu đề ----------
  ws.mergeCells(HR_TT, 1, HR_TT, cGhiChu);
  const tt = ws.getCell(HR_TT, 1);
  tt.value = `BẢNG CHẤM CÔNG CÔNG NHÂN ĐỘI THI CÔNG - THÁNG ${d.thangSo} NĂM ${d.nam}`;
  tt.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(HR_TT).height = 43.5;

  const dat = (r: number, c: number, v: ExcelJS.CellValue) => {
    const cell = ws.getCell(r, c);
    cell.value = v;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.font = { bold: true, size: 14 }; // cỡ đầu đề như mẫu
    cell.border = VIEN_MONG;
    return cell;
  };

  // Cột trái cố định (gộp dọc hàng đầu đề)
  const traiNhan = ["STT", "Mã\ncông nhân", "Họ và Tên", "Mã Dự Án"];
  traiNhan.forEach((nhan, i) => {
    ws.mergeCells(HR_NGAY, i + 1, HR_SUB, i + 1);
    dat(HR_NGAY, i + 1, nhan);
  });

  // Mỗi ngày: ngày dd/mm (gộp 2 ô) · thứ (gộp 2 ô) · Ngày công / Tăng ca
  for (let k = 1; k <= N; k++) {
    const dt = new Date(d.nam, d.thangSo - 1, k);
    const nhanNgay = `${String(k).padStart(2, "0")}/${String(d.thangSo).padStart(2, "0")}`;
    ws.mergeCells(HR_NGAY, cCong(k), HR_NGAY, cOt(k));
    const oNgay = dat(HR_NGAY, cCong(k), nhanNgay);
    ws.mergeCells(HR_THU, cCong(k), HR_THU, cOt(k));
    const oThu = dat(HR_THU, cCong(k), THU[dt.getDay()]);
    dat(HR_SUB, cCong(k), "Ngày\ncông");
    dat(HR_SUB, cOt(k), "Tăng\nca");
    if (d.chuNhat.has(k) || d.ngayLe.has(k)) {
      for (const o of [oNgay, oThu]) o.font = { bold: true, size: 9, color: { argb: "FFC00000" } };
    }
  }

  // Cột tổng hợp bên phải
  ws.mergeCells(HR_NGAY, cTCprevT, HR_THU, cTCprevCN);
  dat(HR_NGAY, cTCprevT, "Tăng ca\ntháng trước");
  dat(HR_SUB, cTCprevT, "Tc thường");
  dat(HR_SUB, cTCprevCN, "Tc chủ nhật");
  const cotDon: [number, string][] = [
    [cNP, "Nghỉ\nPhép"],
    [cTong, "Tổng\nngày công"],
    [cTC, "Tổng\ntăng ca"],
    [cTCcn, "Tăng ca\nChủ Nhật"],
    [cGhiChu, "GHI\nCHÚ"],
  ];
  for (const [c, nhan] of cotDon) {
    ws.mergeCells(HR_NGAY, c, HR_SUB, c);
    dat(HR_NGAY, c, nhan);
  }

  // ---------- Dữ liệu ----------
  let r = DATA0;
  const tongRowCuaCN: number[] = []; // dòng "Tổng Cộng" của từng công nhân (cho sheet Bảng)
  d.congNhan.forEach((cn, idx) => {
    const dauCN = r;
    // Một dòng mỗi dự án
    for (const pj of cn.duAn) {
      ws.getCell(r, 1).value = idx + 1;
      ws.getCell(r, 2).value = cn.maCN;
      ws.getCell(r, 3).value = cn.hoTen;
      ws.getCell(r, 4).value = pj.maCongTrinh;
      let sCong = 0;
      let sTC = 0;
      let sTCcn = 0;
      for (const [k, o] of pj.ngay) {
        if (o.cong) {
          ws.getCell(r, cCong(k)).value = o.cong;
          sCong += o.cong;
        }
        if (o.ot) {
          ws.getCell(r, cOt(k)).value = o.ot;
          if (d.chuNhat.has(k) || d.ngayLe.has(k)) sTCcn += o.ot;
          else sTC += o.ot;
        }
      }
      // Tổng của dòng dự án = công thức cộng các ô ngày (SỐNG: sửa ô ngày → tổng đổi)
      ws.getCell(r, cTong).value = { formula: congCols.map((c) => `${c}${r}`).join("+"), result: sCong };
      if (otThuongCols.length)
        ws.getCell(r, cTC).value = { formula: otThuongCols.map((c) => `${c}${r}`).join("+"), result: sTC };
      if (otCnCols.length)
        ws.getCell(r, cTCcn).value = { formula: otCnCols.map((c) => `${c}${r}`).join("+"), result: sTCcn };
      vienDong(ws, r, cGhiChu);
      r++;
    }
    // Dòng Tổng Cộng của công nhân
    ws.mergeCells(r, 1, r, 4);
    const oTong = ws.getCell(r, 1);
    oTong.value = "Tổng Cộng";
    oTong.font = { bold: true };
    oTong.alignment = { horizontal: "center" };
    const rows = [];
    for (let rr = dauCN; rr < r; rr++) rows.push(rr);
    ws.getCell(r, cNP).value = cn.nghiPhep || null;
    ws.getCell(r, cTong).value = {
      formula: rows.map((rr) => `${colL(cTong)}${rr}`).join("+"),
      result: cn.duAn.reduce((a, p) => a + [...p.ngay.values()].reduce((s, o) => s + o.cong, 0), 0),
    };
    ws.getCell(r, cTC).value = {
      formula: rows.map((rr) => `${colL(cTC)}${rr}`).join("+"),
      result: cn.duAn.reduce(
        (a, p) => a + [...p.ngay].reduce((s, [k, o]) => s + (d.chuNhat.has(k) || d.ngayLe.has(k) ? 0 : o.ot), 0),
        0
      ),
    };
    ws.getCell(r, cTCcn).value = {
      formula: rows.map((rr) => `${colL(cTCcn)}${rr}`).join("+"),
      result: cn.duAn.reduce(
        (a, p) => a + [...p.ngay].reduce((s, [k, o]) => s + (d.chuNhat.has(k) || d.ngayLe.has(k) ? o.ot : 0), 0),
        0
      ),
    };
    for (let c = 1; c <= cGhiChu; c++) {
      const cell = ws.getCell(r, c);
      cell.border = VIEN_MONG;
      if (!cell.font?.bold) cell.font = { bold: true };
    }
    tongRowCuaCN.push(r);
    r++;
  });

  // Bề rộng cột (bám mẫu: 1=9.14, 2=14, 3=33, 4=24; cột ngày gọn đều 5.5)
  ws.getColumn(1).width = 9.14;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 33;
  ws.getColumn(4).width = 24;
  // Cột ngày phải đủ rộng cho "Ngày"/"Tăng"/"công" size 12 — hẹp quá sẽ ngắt giữa từ.
  for (let k = 1; k <= N; k++) {
    ws.getColumn(cCong(k)).width = 8;
    ws.getColumn(cOt(k)).width = 8;
  }
  for (const c of [cTCprevT, cTCprevCN, cNP, cTong, cTC, cTCcn]) ws.getColumn(c).width = 10;
  ws.getColumn(cGhiChu).width = 12;
  // Chiều cao dòng đầu đề như mẫu (đủ chỗ cho nhãn nhiều dòng, wrap sẵn).
  ws.getRow(HR_NGAY).height = 34.5;
  ws.getRow(HR_THU).height = 34.5;
  ws.getRow(HR_SUB).height = 56.25;
  dungFontMau(ws);
  tenBangCo(ws, HR_TT);

  // ---------- Sheet "Bảng chấm công" ----------
  bangChamCong(wb, d, { cTong, cNP, cTC, cTCcn }, tongRowCuaCN, tenBang, tenTheoDoi, logo.bang);

  // ---------- Sheet "Phân bổ công" (bản nộp HR tính lương) ----------
  const wsPB = phanBoCong(wb, d, tenPhanBo);
  // Mở file là thấy sheet chính (Phân bổ công) trước.
  wb.views = [{ activeTab: wsPB.id - 1 } as ExcelJS.WorkbookView];

  return wb.xlsx.writeBuffer();
}

/** Tổng công/tăng ca của một công nhân tại MỘT dự án, tách 4 loại theo ngày. */
function tongDuAn(pj: DuAnCham, chuNhat: Set<number>, ngayLe: Set<number>) {
  let cong = 0;
  let tcT = 0;
  let tcCN = 0;
  let tcLe = 0;
  for (const [k, o] of pj.ngay) {
    cong += o.cong;
    if (o.ot) {
      if (ngayLe.has(k)) tcLe += o.ot; // lễ ưu tiên hơn Chủ nhật
      else if (chuNhat.has(k)) tcCN += o.ot;
      else tcT += o.ot;
    }
  }
  return { cong, tcT, tcCN, tcLe };
}

/**
 * Sheet "Phân bổ công" — bản chính nộp HR tính lương. Mỗi công nhân 1 dòng; mỗi
 * công trình 4 cột [Công thường · TC thường · TC CN · TC lễ]; các cột tổng bên
 * phải = CÔNG THỨC cộng ngang (sửa ô công của dự án → tổng công nhân tự đổi).
 */
function phanBoCong(wb: ExcelJS.Workbook, d: DuLieuXuatChamCong, tenSheet: string): ExcelJS.Worksheet {
  // Tập công trình xuất hiện trong tháng (union), làm nhóm cột.
  const ten = new Map<string, string>();
  for (const cn of d.congNhan) for (const pj of cn.duAn) ten.set(pj.maCongTrinh, pj.tenCongTrinh);
  const duAn = [...ten.keys()].sort();

  const ws = wb.addWorksheet(tenSheet, { views: [{ state: "frozen", xSplit: 2, ySplit: 5 }] });

  const base = (j: number) => 3 + 4 * j; // cột đầu của nhóm dự án j
  const S = 3 + 4 * duAn.length; // cột đầu khối tổng hợp
  const cNP = S;
  const cCong = S + 1; // Tổng công thường
  const cTcT = S + 2;
  const cTcCN = S + 3;
  const cTcLe = S + 4;
  const cTong = S + 5; // Tổng công = công thường + nghỉ phép
  const coCuoi = cTong;

  // Bề rộng cột: cột số (dự án + tổng hợp) = 10 (đủ cho "thường" size 12, không
  // ngắt giữa từ). Dùng 10 chứ không 9 vì 9 trùng mặc định nên exceljs bỏ qua.
  for (let c = 1; c <= coCuoi; c++) {
    ws.getColumn(c).width = c === 1 ? 6.28 : c === 2 ? 23.7 : 10;
  }

  ws.mergeCells(2, 1, 2, coCuoi);
  const tt = ws.getCell(2, 1);
  tt.value = "BẢNG PHÂN BỔ CÔNG DỰ ÁN"; // tiêu đề đúng như mẫu (không có tháng)
  tt.alignment = { horizontal: "center" };

  const dat = (r: number, c: number, v: ExcelJS.CellValue, mau?: string) => {
    const cell = ws.getCell(r, c);
    cell.value = v;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.font = { bold: true, size: 10 };
    cell.border = VIEN_MONG;
    if (mau) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: mau } };
    return cell;
  };

  // Hàng 4 (nhóm) + hàng 5 (cột con)
  ws.mergeCells(4, 1, 5, 1);
  dat(4, 1, "STT");
  ws.mergeCells(4, 2, 5, 2);
  dat(4, 2, "Họ và Tên");
  const conNhan = ["Công\nthường", "TC\nthường", "TC\nCN", "TC\nlễ"];
  duAn.forEach((ma, j) => {
    ws.mergeCells(4, base(j), 4, base(j) + 3);
    dat(4, base(j), ma);
    conNhan.forEach((nhan, i) => dat(5, base(j) + i, nhan));
  });
  const tongHopNhan: [number, string][] = [
    [cNP, "Nghỉ\nphép"],
    [cCong, "Tổng\ncông thường"],
    [cTcT, "Tổng\nTC thường"],
    [cTcCN, "Tổng\nTC CN"],
    [cTcLe, "Tổng\nTC lễ"],
    [cTong, "TỔNG\nCÔNG"],
  ];
  for (const [c, nhan] of tongHopNhan) {
    ws.mergeCells(4, c, 5, c);
    dat(4, c, nhan, "FFFFF2CC");
  }

  // Dữ liệu
  let r = 6;
  const congCols = duAn.map((_, j) => colL(base(j)));
  const tcTCols = duAn.map((_, j) => colL(base(j) + 1));
  const tcCNCols = duAn.map((_, j) => colL(base(j) + 2));
  const tcLeCols = duAn.map((_, j) => colL(base(j) + 3));
  const sumNgang = (cols: string[], row: number, kq: number) => ({
    formula: cols.map((c) => `${c}${row}`).join("+"),
    result: kq,
  });

  d.congNhan.forEach((cn, idx) => {
    ws.getCell(r, 1).value = idx + 1;
    ws.getCell(r, 2).value = cn.hoTen;
    let sCong = 0;
    let sTcT = 0;
    let sTcCN = 0;
    let sTcLe = 0;
    const theoMa = new Map(cn.duAn.map((pj) => [pj.maCongTrinh, tongDuAn(pj, d.chuNhat, d.ngayLe)]));
    duAn.forEach((ma, j) => {
      const t = theoMa.get(ma);
      if (!t) return;
      if (t.cong) ws.getCell(r, base(j)).value = t.cong;
      if (t.tcT) ws.getCell(r, base(j) + 1).value = t.tcT;
      if (t.tcCN) ws.getCell(r, base(j) + 2).value = t.tcCN;
      if (t.tcLe) ws.getCell(r, base(j) + 3).value = t.tcLe;
      sCong += t.cong;
      sTcT += t.tcT;
      sTcCN += t.tcCN;
      sTcLe += t.tcLe;
    });
    ws.getCell(r, cNP).value = cn.nghiPhep || null;
    ws.getCell(r, cCong).value = sumNgang(congCols, r, sCong);
    ws.getCell(r, cTcT).value = sumNgang(tcTCols, r, sTcT);
    ws.getCell(r, cTcCN).value = sumNgang(tcCNCols, r, sTcCN);
    ws.getCell(r, cTcLe).value = sumNgang(tcLeCols, r, sTcLe);
    ws.getCell(r, cTong).value = {
      formula: `${colL(cCong)}${r}+${colL(cNP)}${r}`,
      result: sCong + cn.nghiPhep,
    };
    vienDong(ws, r, coCuoi);
    r++;
  });

  // Dòng tổng cột
  ws.getCell(r, 2).value = "Tổng cộng";
  ws.getCell(r, 2).font = { bold: true };
  for (let c = 3; c <= coCuoi; c++) {
    const L = colL(c);
    ws.getCell(r, c).value = { formula: `SUM(${L}6:${L}${r - 1})` };
    ws.getCell(r, c).font = { bold: true };
  }
  vienDong(ws, r, coCuoi);

  ws.getRow(2).height = 45.75; // tiêu đề
  ws.getRow(4).height = 36.75; // nhóm dự án
  ws.getRow(5).height = 48; // nhãn con
  dungFontMau(ws);
  tenBangCo(ws, 2);
  return ws;
}

function vienDong(ws: ExcelJS.Worksheet, r: number, coCuoi: number) {
  for (let c = 1; c <= coCuoi; c++) ws.getCell(r, c).border = VIEN_MONG;
}

/** Sheet bản nộp: mỗi công nhân 1 dòng, cột kéo từ dòng Tổng Cộng của sheet Theo dõi. */
function bangChamCong(
  wb: ExcelJS.Workbook,
  d: DuLieuXuatChamCong,
  cols: { cTong: number; cNP: number; cTC: number; cTCcn: number },
  tongRowCuaCN: number[],
  tenSheet: string,
  tenTheoDoi: string,
  logoBang: string
) {
  const ws = wb.addWorksheet(tenSheet, { views: [{ state: "frozen", ySplit: 10 }] });
  themLogo(wb, ws, logoBang);
  const ref = (col: number, row: number) => `'${tenTheoDoi}'!${colL(col)}${row}`;

  // Khối tiêu đề: 4=tên bảng, 5=đội, 6=thời gian, 7=mã chi phí — merge A:T như mẫu.
  const nganh = (row: number, v: ExcelJS.CellValue, canGiua = false) => {
    ws.mergeCells(row, 1, row, 20);
    const c = ws.getCell(row, 1);
    c.value = v;
    if (canGiua) {
      c.font = { bold: true };
      c.alignment = { horizontal: "center" };
    }
  };
  nganh(4, `BẢNG CHẤM CÔNG - THÁNG ${String(d.thangSo).padStart(2, "0")} NĂM ${d.nam}`, true);
  // Ngoại thành: gắn tên đội DA phía sau (VD "ĐỘI THI CÔNG TSLA"); nội thành để trơn.
  nganh(5, `ĐỘI THI CÔNG${d.tenDoi ? ` ${d.tenDoi}` : ""}`);
  ws.getCell(5, 1).font = { bold: true }; // dòng "ĐỘI THI CÔNG" đậm (cỡ 12 do dungFontMau)
  nganh(6, `Thời gian thực hiện: từ ngày 01/${String(d.thangSo).padStart(2, "0")}/${d.nam} đến ngày ${d.soNgay}/${String(d.thangSo).padStart(2, "0")}/${d.nam}`);
  nganh(7, "Mã chi phí: CP-003-2- Lương công nhân");

  // Hàng số thứ tự cột (hàng 8) + hai hàng đầu đề gộp nhóm (9,10) — bám đúng mẫu.
  const oĐĐ = (cell: ExcelJS.Cell, v?: ExcelJS.CellValue) => {
    if (v !== undefined) cell.value = v;
    cell.font = { bold: true, size: 12 }; // cỡ đầu đề như mẫu
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = VIEN_MONG;
  };
  // Hàng số thứ tự cột (8): in nghiêng, KHÔNG viền, không đậm — như mẫu.
  for (let c = 1; c <= 20; c++) {
    const cell = ws.getCell(8, c);
    cell.value = c;
    cell.font = { italic: true, size: 12 };
    cell.alignment = { horizontal: "center" };
  }

  // Nhóm đầu cột: cột đơn gộp dọc 9:10; nhóm nhiều cột gộp ngang ở hàng 9, con ở hàng 10.
  const nhom: { s: number; e: number; ten: string; con?: string[] }[] = [
    { s: 1, e: 1, ten: "STT" },
    { s: 2, e: 2, ten: "MÃ SỐ CN" },
    { s: 3, e: 3, ten: "HỌ VÀ TÊN" },
    { s: 4, e: 4, ten: "NGÀY CÔNG THỰC TẾ" },
    { s: 5, e: 6, ten: "NGHỈ CÓ PHÉP", con: ["Nghỉ phép năm", "Nghỉ chế độ"] },
    { s: 7, e: 7, ten: "NGHỈ KHÔNG PHÉP" },
    { s: 8, e: 8, ten: "TĂNG CƯỜNG" },
    {
      s: 9,
      e: 14,
      ten: "TĂNG CA",
      con: [
        "Tăng ca ngày thường (giờ)",
        "Tăng ca đêm sau 22h ngày thường (giờ)",
        "Tăng ca CN (giờ)",
        "Tăng ca Lễ Tết (giờ)",
        "Tăng ca đêm sau 22h CN, Lễ Tết (giờ)",
        "Số công ca chiều (ngày)",
      ],
    },
    { s: 15, e: 17, ten: "BỒI DƯỠNG", con: ["Xịt thuốc (giờ)", "Nặng nhọc (giờ)", "Bón phân (giờ)"] },
    { s: 18, e: 18, ten: "Điểm trách nhiệm" },
    { s: 19, e: 19, ten: "Trực sự cố cây xanh (ca trực)" },
    { s: 20, e: 20, ten: "GHI CHÚ" },
  ];
  for (const g of nhom) {
    if (g.con) {
      ws.mergeCells(9, g.s, 9, g.e); // tên nhóm ở hàng 9
      for (let c = g.s; c <= g.e; c++) oĐĐ(ws.getCell(9, c));
      ws.getCell(9, g.s).value = g.ten;
      g.con.forEach((t, i) => oĐĐ(ws.getCell(10, g.s + i), t));
    } else {
      ws.mergeCells(9, g.s, 10, g.s); // cột đơn gộp dọc 2 hàng
      oĐĐ(ws.getCell(9, g.s), g.ten);
      oĐĐ(ws.getCell(10, g.s));
    }
  }

  let r = 11;
  d.congNhan.forEach((cn, idx) => {
    const t = tongRowCuaCN[idx];
    const tongCong = cn.duAn.reduce((a, p) => a + [...p.ngay.values()].reduce((s, o) => s + o.cong, 0), 0);
    const tcThuong = cn.duAn.reduce(
      (a, p) => a + [...p.ngay].reduce((s, [k, o]) => s + (d.chuNhat.has(k) || d.ngayLe.has(k) ? 0 : o.ot), 0),
      0
    );
    const tcCn = cn.duAn.reduce(
      (a, p) => a + [...p.ngay].reduce((s, [k, o]) => s + (d.chuNhat.has(k) || d.ngayLe.has(k) ? o.ot : 0), 0),
      0
    );
    ws.getCell(r, 1).value = idx + 1;
    ws.getCell(r, 2).value = cn.maCN;
    ws.getCell(r, 3).value = cn.hoTen;
    ws.getCell(r, 4).value = { formula: ref(cols.cTong, t), result: tongCong };
    ws.getCell(r, 5).value = { formula: ref(cols.cNP, t), result: cn.nghiPhep };
    ws.getCell(r, 7).value = { formula: `26-D${r}-E${r}-H${r}`, result: 26 - tongCong - cn.nghiPhep };
    ws.getCell(r, 9).value = { formula: ref(cols.cTC, t), result: tcThuong };
    ws.getCell(r, 11).value = { formula: ref(cols.cTCcn, t), result: tcCn };
    vienDong(ws, r, 20);
    r++;
  });
  // Dòng cộng
  const dau = 11;
  const cuoi = r - 1;
  ws.getCell(r, 3).value = "Tổng cộng";
  ws.getCell(r, 3).font = { bold: true };
  for (const c of [4, 5, 7, 9, 11]) {
    const L = colL(c);
    ws.getCell(r, c).value = { formula: `SUBTOTAL(9,${L}${dau}:${L}${cuoi})` };
    ws.getCell(r, c).font = { bold: true };
  }
  vienDong(ws, r, 20);

  // Bề rộng cột bám mẫu.
  const rong = [9.14, 22.4, 27, 17, 17, 24.2, 19.4, 22, 11.7, 11.7, 11.7, 11.7, 11.7, 11.7, 10.7, 12, 12.7, 10.7, 12.4, 39.8];
  rong.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.getRow(10).height = 78.75; // dòng nhãn con nhiều dòng — cao như mẫu
  dungFontMau(ws);
  tenBangCo(ws, 4);
}
