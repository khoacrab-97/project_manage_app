// Trích dữ liệu thật từ 3 file Excel nguồn -> JSON.
// Đọc trực tiếp OOXML qua unzip, không cần thư viện.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const SRC = "C:\\Users\\Khoa Crab\\Desktop\\Claude\\Project Management\\PrMana";
const OUT = process.argv[2];

const F_MAU = path.join(SRC, "MẪU DOANH THU - CHI PHÍ.xlsx");
const F_TH = path.join(SRC, "TỔNG HỢP DOANH THU - CHI PHÍ.xlsx");
const F_BO = path.join(SRC, "BỘ THỬ NGHIỆM CHUẨN HÓA & APPEND DOANH THU - CHI PHÍ.xlsx");

const unzip = (file, entry) =>
  execFileSync("unzip", ["-p", file, entry], { maxBuffer: 1 << 30 }).toString("utf8");

const decode = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, "&");

function sharedStrings(file) {
  let xml;
  try {
    xml = unzip(file, "xl/sharedStrings.xml");
  } catch {
    return [];
  }
  return [...xml.matchAll(/<(?:x:)?si>([\s\S]*?)<\/(?:x:)?si>/g)].map((m) =>
    decode([...m[1].matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map((t) => t[1]).join(""))
  );
}

/** Đọc 1 sheet -> Map<"A1", value>. Giữ nguyên number/string. */
function readSheet(file, entry, strs) {
  const xml = unzip(file, entry);
  const cells = new Map();
  const re = /<(?:x:)?c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g;
  for (const m of xml.matchAll(re)) {
    const ref = m[1];
    const attrs = m[2] || "";
    const body = m[3] || "";
    const t = (attrs.match(/t="([^"]+)"/) || [])[1];
    if (t === "inlineStr") {
      const its = [...body.matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map((x) => x[1]).join("");
      if (its) cells.set(ref, decode(its));
      continue;
    }
    const v = (body.match(/<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/) || [])[1];
    if (v === undefined) continue;
    let val;
    if (t === "s") val = strs[+v];
    else if (t === "str" || t === "e") val = decode(v);
    else {
      const n = Number(v);
      val = Number.isNaN(n) ? decode(v) : n;
    }
    if (val !== undefined && val !== "") cells.set(ref, val);
  }
  return cells;
}

const colToNum = (c) => [...c].reduce((a, ch) => a * 26 + (ch.charCodeAt(0) - 64), 0);
const numToCol = (n) => {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = ((n - r) / 26) | 0;
  }
  return s;
};
const get = (cells, col, row) => cells.get(`${col}${row}`);

// ---------- 1) Danh mục 55 mã DT–CP ----------
const boStrs = sharedStrings(F_BO);
const dm = readSheet(F_BO, "xl/worksheets/sheet6.xml", boStrs);
const codes = [];
for (let r = 2; r <= 60; r++) {
  const ma = get(dm, "A", r);
  if (ma === undefined) continue;
  codes.push({
    ma: String(ma).trim(),
    ten: String(get(dm, "B", r) ?? "").trim(),
    loai: String(get(dm, "C", r) ?? "").trim(), // "Doanh thu" | "Chi phí"
    maCha: get(dm, "D", r) ? String(get(dm, "D", r)).trim() : null,
    choPhepNhapTrucTiep: String(get(dm, "E", r) ?? "").trim() === "Có",
  });
}

// ---------- 2) Ma trận OUTPUT_NAM (mã × công trình) ----------
const thStrs = sharedStrings(F_TH);
const on = readSheet(F_TH, "xl/worksheets/sheet3.xml", thStrs); // OUTPUT_NAM

// header công trình ở hàng 2, từ cột D trở đi
const projectCols = [];
for (let n = colToNum("D"); n <= colToNum("BB"); n++) {
  const col = numToCol(n);
  const v = get(on, col, 2);
  if (v === undefined) continue;
  const code = String(v).trim();
  if (!code || code === "Tổng") continue;
  projectCols.push({ col, maCongTrinh: code });
}

// các hàng dữ liệu: C = mã chi phí
const matrix = []; // { maCode, tenCode, byProject: { maCongTrinh: number } }
for (let r = 3; r <= 200; r++) {
  const maCode = get(on, "C", r);
  if (maCode === undefined) continue;
  const ten = String(get(on, "B", r) ?? "").trim();
  const byProject = {};
  let any = false;
  for (const { col, maCongTrinh } of projectCols) {
    const v = get(on, col, r);
    if (typeof v === "number" && v !== 0) {
      byProject[maCongTrinh] = v;
      any = true;
    }
  }
  matrix.push({ maCode: String(maCode).trim(), tenCode: ten, byProject, coSoLieu: any });
}

// ---------- 3) Tổng kiểm chứng từ TH_THANG ----------
const tt = readSheet(F_TH, "xl/worksheets/sheet9.xml", thStrs); // TH_THANG
const checks = {};
for (let r = 9; r <= 90; r++) {
  const ma = get(tt, "C", r);
  const tong = get(tt, "D", r);
  if (ma !== undefined && typeof tong === "number") checks[String(ma).trim()] = tong;
}

// ---------- 4) KẾ HOẠCH TH (hệ mã cũ DA*) ----------
const mauStrs = sharedStrings(F_MAU);
const kh = readSheet(F_MAU, "xl/worksheets/sheet6.xml", mauStrs); // KẾ HOẠCH TH
const plan = [];
for (let r = 10; r <= 80; r++) {
  const maCu = get(kh, "C", r);
  if (maCu === undefined) continue;
  const tong = get(kh, "D", r);
  plan.push({
    maCu: String(maCu).trim(),
    ten: String(get(kh, "B", r) ?? "").trim(),
    keHoachTong: typeof tong === "number" ? tong : 0,
  });
}

const out = {
  ghiChu: "Trích tự động từ 3 file Excel nguồn. Không sửa tay.",
  danhMucMa: codes,
  congTrinh: projectCols.map((p) => p.maCongTrinh),
  maTranNam: matrix.filter((m) => m.coSoLieu).map(({ coSoLieu, ...m }) => m),
  tongKiemChung: checks,
  keHoachHeMaCu: plan,
};

writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");

console.log("Mã DT–CP:", codes.length, "| DT:", codes.filter((c) => c.loai === "Doanh thu").length, "| CP:", codes.filter((c) => c.loai === "Chi phí").length);
console.log("Công trình:", projectCols.length);
console.log("Hàng ma trận có số liệu:", out.maTranNam.length, "/", matrix.length);
console.log("Ô có số liệu:", out.maTranNam.reduce((a, m) => a + Object.keys(m.byProject).length, 0));
console.log("Tổng toàn bộ ma trận:", out.maTranNam.reduce((a, m) => a + Object.values(m.byProject).reduce((x, y) => x + y, 0), 0).toLocaleString("vi-VN"));
console.log("Kế hoạch (hệ DA*):", plan.length, "dòng");
console.log("Kiểm chứng TH_THANG Bill =", checks.Bill?.toLocaleString("vi-VN"), "| CP =", checks.CP?.toLocaleString("vi-VN"));
console.log("->", OUT);
