/*
 * Đồng bộ tháng thực hiện của giao dịch với tháng khởi công công trình.
 *
 * Quy tắc (chốt với người dùng): ngày khởi công là chuẩn; giao dịch phát sinh
 * trước tháng khởi công được dồn về CHÍNH tháng khởi công.
 *
 * Hai điều đã kiểm trước khi chạy:
 *   - `rowHash` không chứa thangThucHien nên cơ chế chống cộng trùng không vỡ.
 *   - Chỉ đụng cột `thangThucHien`. `ngayChungTu` giữ nguyên vì nó nằm trong
 *     rowHash — đổi là hỏng chống trùng. Chứng từ tháng 1 ghi nhận vào kỳ thực
 *     hiện tháng 5 là chuyện bình thường trong hạch toán theo kỳ.
 *
 * Chạy `node scripts/dong-bo-thang-thuc-hien.js` để xem trước, thêm `--ghi` để ghi.
 */
const Database = require("better-sqlite3");

const GHI = process.argv.includes("--ghi");
const THANG_HIEN_TAI = "2026-07"; // NGAY_HIEN_TAI của bộ dữ liệu
const D = new Database("data/prmana.db");

const thangCua = (d) => (d ? String(d).slice(0, 7) : null);
const ct = D.prepare(
  "select id, maCongTrinh, ngayBatDau from Project where isActive=1 and ngayBatDau is not null"
).all();

const tongTruoc = D.prepare("select coalesce(sum(soTien),0) s, count(*) n from `Transaction`").get();

let doiNgay = 0;
let doiGD = 0;
const keHoach = [];

for (const c of ct) {
  let dau = thangCua(c.ngayBatDau);
  if (!dau) continue;

  /*
   * Công trình không thể khởi công sau "hôm nay" mà đã có 7 tháng chi phí.
   * Kéo về tháng hiện tại, nếu không thì dồn giao dịch vào một tháng tương lai
   * và báo cáo chỉ còn đúng một cột nằm ngoài dải dữ liệu.
   */
  const batDauGoc = dau;
  if (dau > THANG_HIEN_TAI) dau = THANG_HIEN_TAI;

  const som = D.prepare(
    "select count(*) n, coalesce(sum(soTien),0) s from `Transaction` where projectId=? and thangThucHien < ?"
  ).get(c.id, dau);

  if (batDauGoc !== dau || som.n > 0) {
    keHoach.push({
      ma: c.maCongTrinh,
      batDauGoc,
      batDauMoi: dau,
      soGD: som.n,
      tien: som.s,
    });
  }
  if (batDauGoc !== dau) doiNgay++;
  doiGD += som.n;

  if (GHI) {
    if (batDauGoc !== dau) {
      D.prepare("update Project set ngayBatDau=? where id=?").run(`${dau}-01`, c.id);
    }
    if (som.n > 0) {
      D.prepare(
        "update `Transaction` set thangThucHien=? where projectId=? and thangThucHien < ?"
      ).run(dau, c.id, dau);
    }
  }
}

console.log(
  `${"Ma cong trinh".padEnd(16)} ${"KhoiCong".padEnd(9)} -> ${"Moi".padEnd(9)} ${"SoGD".padStart(5)} ${"Tien don ve".padStart(18)}`
);
for (const k of keHoach) {
  console.log(
    `${k.ma.padEnd(16)} ${k.batDauGoc.padEnd(9)} -> ${k.batDauMoi.padEnd(9)} ${String(k.soGD).padStart(5)} ${k.tien.toLocaleString("vi-VN").padStart(18)}`
  );
}

const tongSau = D.prepare("select coalesce(sum(soTien),0) s, count(*) n from `Transaction`").get();
const conSom = D.prepare(
  `select count(*) n from \`Transaction\` t join Project p on p.id=t.projectId
   where p.ngayBatDau is not null and t.thangThucHien < substr(p.ngayBatDau,1,7)`
).get();

console.log(`\n${GHI ? "DA GHI" : "CHAY THU (chua ghi)"}`);
console.log(`  Ngay khoi cong phai keo ve thang hien tai : ${doiNgay}`);
console.log(`  Giao dich phai doi thang                  : ${doiGD}`);
console.log(`  Tong tien truoc : ${tongTruoc.s.toLocaleString("vi-VN")} d / ${tongTruoc.n} dong`);
console.log(`  Tong tien sau   : ${tongSau.s.toLocaleString("vi-VN")} d / ${tongSau.n} dong`);
console.log(`  Bat bien tong tien: ${tongTruoc.s === tongSau.s ? "GIU NGUYEN" : "*** LECH ***"}`);
console.log(`  Con giao dich truoc khoi cong: ${conSom.n}`);
