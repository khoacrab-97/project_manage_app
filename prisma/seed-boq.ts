/**
 * Sinh BOQ DEMO cho 4 công trình, dựng theo bố cục sheet "1.2 GÍA TRỊ BILL".
 *
 * NGUYÊN TẮC BẤT BIẾN: tổng giá trị thực hiện của BOQ trong một tháng phải khớp
 * TUYỆT ĐỐI (sai lệch 0 đồng) với tổng giao dịch mã `Bill` của chính công trình
 * đó trong tháng ấy. BOQ ở đây là lời GIẢI THÍCH con số Bill đang có bằng từng
 * công tác, không phải một con số thứ hai chạy song song rồi mâu thuẫn.
 *
 * Vì vậy script KHÔNG đụng vào bảng Transaction. Chạy lại nhiều lần cho ra đúng
 * một kết quả (PRNG có hạt giống cố định) và tự xoá BOQ cũ của 4 công trình.
 */
import "dotenv/config";
import { taoPrismaClient } from "../src/lib/prisma-client";

const db = taoPrismaClient();

const CONG_TRINH_DEMO = ["HL-00182", "HL-00240", "BGT-CXHTTQL50", "TSLA-SUKIEN"];

/** PRNG có hạt giống — chạy lại phải ra đúng bộ số cũ. */
function prng(hat: number) {
  let a = hat;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kho công tác mẫu; mỗi công trình lấy một lát khác nhau cho đỡ giống hệt. */
const CONG_TAC = [
  { noiDung: "Dọn dẹp, san phẳng mặt bằng", dvt: "100m2", donGia: 1_000_000 },
  { noiDung: "Đào đất móng bằng máy", dvt: "100m3", donGia: 8_500_000 },
  { noiDung: "Đắp cát nền công trình, tưới nước đầm chặt", dvt: "m3", donGia: 320_000 },
  { noiDung: "Bê tông lót móng đá 4x6 mác 100", dvt: "m3", donGia: 1_250_000 },
  { noiDung: "Bê tông móng đá 1x2 mác 250", dvt: "m3", donGia: 1_680_000 },
  { noiDung: "Gia công, lắp dựng cốt thép móng", dvt: "tấn", donGia: 18_500_000 },
  { noiDung: "Xây tường gạch ống vữa xi măng mác 75", dvt: "m3", donGia: 1_450_000 },
  { noiDung: "Lát gạch terrazzo vỉa hè, đường dạo", dvt: "m2", donGia: 285_000 },
  { noiDung: "Lắp đặt hệ thống tưới tự động", dvt: "hệ", donGia: 95_000_000 },
  { noiDung: "Trồng cây xanh, thảm cỏ và chăm sóc", dvt: "m2", donGia: 165_000 },
  { noiDung: "Lắp đặt hệ thống chiếu sáng cảnh quan", dvt: "bộ", donGia: 4_200_000 },
  { noiDung: "Thi công lắp đặt đường ống cấp nước D110", dvt: "md", donGia: 520_000 },
];

/**
 * Chia số tiền `tong` cho các công tác đang hoạt động sao cho TỔNG KHỚP CHÍNH XÁC.
 * Các dòng đầu lấy khối lượng làm tròn 2 chữ số cho đẹp; dòng cuối gánh phần dư
 * bằng khối lượng lẻ — đúng cách một bảng khối lượng thật vẫn hay lẻ (7,35 / 10,5).
 */
function chiaTien(tong: number, donGias: number[], rnd: () => number): number[] {
  const n = donGias.length;
  const trongSo = donGias.map(() => 0.5 + rnd());
  const tongTS = trongSo.reduce((a, b) => a + b, 0);

  const soTien: number[] = [];
  let conLai = tong;
  for (let i = 0; i < n - 1; i++) {
    // Làm tròn khối lượng về 2 chữ số rồi mới suy ngược ra tiền, nên số tiền
    // của dòng này là bội của đơn giá ở mức 0,01 đơn vị.
    const phan = (tong * trongSo[i]) / tongTS;
    const kl = Math.max(0.01, Math.round((phan / donGias[i]) * 100) / 100);
    const tien = Math.round(kl * donGias[i]);
    // Chừa đủ tiền cho các dòng còn lại, tránh dòng cuối bị âm.
    const tran = conLai - (n - 1 - i);
    const thuc = Math.min(tien, Math.max(0, tran));
    soTien.push(thuc);
    conLai -= thuc;
  }
  soTien.push(conLai); // dòng cuối gánh phần dư -> tổng khớp tuyệt đối
  return soTien;
}

async function main() {
  let tongDongBOQ = 0;

  for (const maCT of CONG_TRINH_DEMO) {
    const ct = await db.project.findUnique({ where: { maCongTrinh: maCT } });
    if (!ct) throw new Error(`Khong tim thay cong trinh ${maCT}`);

    // Bill thực tế theo tháng — đây là mục tiêu BOQ phải khớp.
    const billTheoThang = await db.transaction.groupBy({
      by: ["thangThucHien"],
      where: { projectId: ct.id, maDTCP: "Bill" },
      _sum: { soTien: true },
    });
    const thangs = billTheoThang
      .map((r) => ({ thang: r.thangThucHien, tong: Math.round(r._sum.soTien ?? 0) }))
      .filter((r) => r.thang && r.tong > 0)
      .sort((a, b) => a.thang!.localeCompare(b.thang!)) as { thang: string; tong: number }[];

    if (!thangs.length) throw new Error(`Cong trinh ${maCT} khong co giao dich Bill`);

    // Xoá BOQ cũ để chạy lại được nhiều lần (thực hiện tự xoá theo cascade).
    await db.bOQLine.deleteMany({ where: { projectId: ct.id } });
    await db.billThang.deleteMany({ where: { projectId: ct.id } });

    // Các tháng này là bill LỊCH SỬ, đã ra bill thật (khớp sổ giao dịch) nên
    // đánh dấu đã xác nhận — nếu để chờ duyệt thì KPI sẽ tụt về 0 một cách sai.
    for (const { thang } of thangs) {
      await db.billThang.create({
        data: {
          projectId: ct.id,
          thang,
          trangThai: "DA_XAC_NHAN",
          nguoiNhap: "dữ liệu demo",
          ngayNhap: new Date(),
          nguoiXacNhan: "dữ liệu demo",
          ngayXacNhan: new Date(),
        },
      });
    }

    const rnd = prng(
      [...maCT].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)
    );
    // Mỗi công trình 7 công tác, lấy lát khác nhau từ kho mẫu.
    const batDau = Math.floor(rnd() * 5);
    const congTac = CONG_TAC.slice(batDau, batDau + 7);

    // Khối lượng thực hiện từng tháng cho từng công tác.
    const klThang: Record<string, number[]> = {};
    for (const { thang, tong } of thangs) {
      // Mỗi tháng chỉ một số công tác chạy — giống thực tế thi công cuốn chiếu.
      const soHoatDong = 3 + Math.floor(rnd() * (congTac.length - 3));
      const chiSo = congTac
        .map((_, i) => i)
        .sort(() => rnd() - 0.5)
        .slice(0, soHoatDong)
        .sort((a, b) => a - b);

      const tien = chiaTien(tong, chiSo.map((i) => congTac[i].donGia), rnd);
      const hang = new Array(congTac.length).fill(0);
      chiSo.forEach((idx, k) => {
        hang[idx] = tien[k] / congTac[idx].donGia; // KL suy từ tiền -> khớp tuyệt đối
      });
      klThang[thang] = hang;
    }

    // Khối lượng hợp đồng > luỹ kế đã thực hiện (công trình còn đang chạy).
    for (let i = 0; i < congTac.length; i++) {
      const luyKe = thangs.reduce((a, { thang }) => a + klThang[thang][i], 0);
      const heSo = 1.15 + rnd() * 0.35;
      const klHopDong = Math.max(luyKe, Math.round(luyKe * heSo * 100) / 100);

      const line = await db.bOQLine.create({
        data: {
          projectId: ct.id,
          stt: `1.${i + 1}`,
          noiDung: congTac[i].noiDung,
          dvt: congTac[i].dvt,
          khoiLuong: klHopDong,
          donGia: congTac[i].donGia,
          thuTu: i,
        },
      });
      tongDongBOQ++;

      for (const { thang } of thangs) {
        const kl = klThang[thang][i];
        if (kl <= 0) continue;
        await db.bOQThucHien.create({ data: { boqLineId: line.id, thang, khoiLuong: kl } });
      }
    }

    console.log(`  ${maCT}: ${congTac.length} cong tac x ${thangs.length} thang`);
  }

  console.log(`\nDa tao ${tongDongBOQ} dong BOQ cho ${CONG_TRINH_DEMO.length} cong trinh.`);
  await db.$disconnect();
}

main();
