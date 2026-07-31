/**
 * Kiểm chứng đăng nhập và phân quyền.
 * Chạy: npx tsx prisma/kiemtra-quyen.ts   (cần dev server đang chạy ở cổng 3000)
 *
 * Tạo phiên thật trong cơ sở dữ liệu rồi gọi HTTP kèm cookie phiên đó — tức là đi
 * đúng đường mà trình duyệt đi: cookie -> nguoiDungHienTai() -> lọc phạm vi trong
 * repository -> trang render.
 */
import { randomBytes } from "node:crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { bamMatKhau, kiemTraMatKhau } from "../src/lib/auth/mat-khau";
import { coQuyen, DS_VAI_TRO } from "../src/lib/auth/quyen";

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }),
});
const GOC = "http://127.0.0.1:3000";
/** Mã các mục menu, giữ khớp với src/lib/menu.ts. */
const MENU_IDS = ["tong-quan","cong-trinh","chi-phi","ke-hoach","cong-nhan","nhap-du-lieu","kiem-tra-du-lieu","danh-muc"];

let loi = 0;
const ok = (dieuKien: boolean, nhan: string) => {
  console.log(`  ${dieuKien ? "DAT " : "HONG"} ${nhan}`);
  if (!dieuKien) loi++;
};

async function taoCookie(email: string): Promise<string> {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: { sessionToken: token, userId: u.id, expires: new Date(Date.now() + 3600_000) },
  });
  return `prmana_phien=${token}`;
}

async function tai(duongDan: string, cookie: string) {
  const res = await fetch(GOC + duongDan, { headers: { cookie }, redirect: "manual" });
  return {
    status: res.status,
    viTri: (res.headers.get("location") ?? "").replace(GOC, ""),
    html: res.status === 200 ? await res.text() : "",
  };
}

/**
 * Đăng nhập THẬT qua HTTP, đúng đường mà trình duyệt đi.
 * Trả cookie phiên nếu thành công, null nếu bị từ chối.
 */
async function dangNhapThat(email: string, matKhau: string): Promise<string | null> {
  const trang = await (await fetch(`${GOC}/dang-nhap`)).text();
  const actionId = trang.match(/\$ACTION_ID_([a-f0-9]+)/)?.[1];
  if (!actionId) throw new Error("Khong tim thay Server Action id trong trang dang nhap");

  const fd = new FormData();
  fd.set(`$ACTION_ID_${actionId}`, "");
  fd.set("email", email);
  fd.set("matKhau", matKhau);
  fd.set("tiep", "/");

  const res = await fetch(`${GOC}/dang-nhap`, { method: "POST", body: fd, redirect: "manual" });
  const setCookie = res.headers.get("set-cookie") ?? "";
  const m = setCookie.match(/prmana_phien=([a-f0-9]+)/);
  return m ? `prmana_phien=${m[1]}` : null;
}

async function main() {
  /*
   * Script này chạy trên CƠ SỞ DỮ LIỆU THẬT nên tuyệt đối không được để lại dấu
   * vết. Phần kiểm thử phân quyền menu có ghi/xoá bảng MenuBiAn, nên phải chụp
   * lại cấu hình của Admin trước và trả về nguyên trạng ở cuối.
   * (Đã từng quên bước này và xoá mất cấu hình người dùng vừa thiết lập.)
   */
  const menuBanDau = await db.menuBiAn.findMany();

  // --- Mật khẩu ở tầng hàm băm ---
  const admin = await db.user.findUniqueOrThrow({
    where: { email: "nguyenchikhoa97@gmail.com" },
  });
  ok(!(await kiemTraMatKhau("sai-mat-khau", admin.matKhauHash)), "Mat khau SAI bi tu choi");
  ok(!(await kiemTraMatKhau("", admin.matKhauHash)), "Mat khau RONG bi tu choi");

  // --- Đăng nhập thật qua HTTP ---
  // BẮT BUỘC có phép thử CHIỀU ĐÚNG. Trước đây chỉ kiểm tra chiều từ chối nên
  // mật khẩu hỏng vẫn lọt qua toàn bộ bộ test.
  const MAT_KHAU_ADMIN = process.env.MAT_KHAU_KIEM_THU;
  if (!MAT_KHAU_ADMIN) {
    console.log("  BO QUA phep thu dang nhap that: chua dat MAT_KHAU_KIEM_THU");
  } else {
    ok((await dangNhapThat(admin.email, MAT_KHAU_ADMIN)) !== null, "Dang nhap DUNG mat khau -> CO cookie phien");
    ok((await dangNhapThat(admin.email, "sai-be-bet")) === null, "Dang nhap SAI mat khau -> KHONG co cookie");
  }

  const cookieAdmin = await taoCookie("nguyenchikhoa97@gmail.com");
  const cookieCht = await taoCookie("cht.test@noibo.local");

  // --- Cookie rác / phiên đã bị xoá phải bị đá về đăng nhập ---
  // Đây là lỗi đã gặp thật: middleware chỉ kiểm tra CÓ cookie, nên cookie cũ lọt
  // qua và app hiện toàn số 0 thay vì bắt đăng nhập lại.
  const cookieRac = "prmana_phien=" + "de".repeat(32);
  const racRes = await fetch(`${GOC}/`, { headers: { cookie: cookieRac }, redirect: "manual" });
  ok(
    racRes.status === 307 || racRes.status === 302,
    `Cookie rac bi da ve /dang-nhap (HTTP ${racRes.status})`
  );
  ok(
    (racRes.headers.get("location") ?? "").includes("/dang-nhap"),
    "Chuyen huong tro dung toi /dang-nhap"
  );

  // --- ADMIN thấy toàn công ty ---
  const dsCT = await db.project.findMany({ select: { maCongTrinh: true } });
  const aCongTrinh = await tai("/cong-trinh", cookieAdmin);
  const soAdmin = dsCT.filter((c) => aCongTrinh.html.includes(`>${c.maCongTrinh}<`)).length;
  ok(aCongTrinh.status === 200, "ADMIN vao duoc /cong-trinh");
  ok(soAdmin > 25, `ADMIN thay ${soAdmin}/${dsCT.length} cong trinh`);

  // --- CHI_HUY_TRUONG chỉ thấy công trình được gán ---
  const cCongTrinh = await tai("/cong-trinh", cookieCht);
  const thayDuoc = dsCT.filter((c) => cCongTrinh.html.includes(`>${c.maCongTrinh}<`));
  ok(cCongTrinh.status === 200, "CHI_HUY_TRUONG vao duoc /cong-trinh");
  ok(
    thayDuoc.length === 1 && thayDuoc[0].maCongTrinh === "HL-00240",
    `CHI_HUY_TRUONG chi thay HL-00240 (thuc te thay: ${thayDuoc.map((c) => c.maCongTrinh).join(", ") || "khong co"})`
  );

  // --- Đ1.4: chỉ ADMIN được tạo/sửa công trình ---
  ok(aCongTrinh.html.includes("Thêm công trình"), "ADMIN thay nut 'Them cong trinh'");
  ok(!cCongTrinh.html.includes("Thêm công trình"), "CHI_HUY_TRUONG KHONG thay nut 'Them cong trinh'");
  ok(
    DS_VAI_TRO.every(
      (v) => coQuyen({ id: "", email: "", hoTen: "", vaiTro: v, phamVi: [] }, "tao_cong_trinh") === (v === "ADMIN")
    ),
    "Ma tran quyen: CHI ADMIN co 'tao_cong_trinh'"
  );

  // --- Gõ thẳng URL công trình ngoài phạm vi ---
  const ngoai = dsCT.find((c) => c.maCongTrinh !== "HL-00240")!.maCongTrinh;
  const goTay = await tai(`/cong-trinh/${encodeURIComponent(ngoai)}`, cookieCht);
  ok(
    goTay.status === 404 || (goTay.status === 200 && !goTay.html.includes("Chi tiết giao dịch")),
    `Go thang URL /cong-trinh/${ngoai} bi chan (HTTP ${goTay.status})`
  );

  // --- KPI của CHI_HUY_TRUONG phải nhỏ hơn toàn công ty ---
  /*
   * Doanh thu toàn công ty KHÔNG còn là hằng số: từ khi có BOQ, mỗi lần xác nhận
   * thêm một Bill tháng là tổng tăng lên thật. Nên tính kỳ vọng từ dữ liệu hiện
   * có thay vì chốt cứng "27,23 tỷ" — chốt cứng thì test đỏ mỗi lần nhập liệu
   * bình thường, mà cái cần kiểm là "ADMIN thấy toàn công ty, CHT thì không".
   *
   * Hai nguồn: công trình chưa có BOQ lấy Bill từ sổ giao dịch, công trình có
   * BOQ lấy khối lượng đã xác nhận.
   */
  const duAnCoBOQ = (await db.bOQLine.findMany({ select: { projectId: true }, distinct: ["projectId"] })).map(
    (r) => r.projectId
  );
  const billSo = await db.transaction.aggregate({
    _sum: { soTien: true },
    where: { maDTCP: "Bill", projectId: { notIn: duAnCoBOQ } },
  });
  const daDuyet = new Set(
    (
      await db.billThang.findMany({
        where: { trangThai: "DA_XAC_NHAN" },
        select: { projectId: true, thang: true },
      })
    ).map((b) => `${b.projectId}|${b.thang}`)
  );
  const thucHien = await db.bOQThucHien.findMany({
    select: { thang: true, khoiLuong: true, line: { select: { projectId: true, donGia: true } } },
  });
  const billBOQ = thucHien.reduce(
    (a, t) =>
      daDuyet.has(`${t.line.projectId}|${t.thang}`) ? a + Math.round(t.khoiLuong * t.line.donGia) : a,
    0
  );
  const tongDT = (billSo._sum.soTien ?? 0) + billBOQ;
  // Trang chủ hiển thị dạng rút gọn "27,79 tỷ".
  const nhanTy = `${(tongDT / 1e9).toFixed(2).replace(".", ",")} tỷ`;

  const aTrang = await tai("/", cookieAdmin);
  const cTrang = await tai("/", cookieCht);
  ok(aTrang.html.includes(nhanTy), `ADMIN thay doanh thu toan cong ty ${nhanTy}`);
  ok(!cTrang.html.includes(nhanTy), "CHI_HUY_TRUONG KHONG thay so lieu toan cong ty");

  // --- Trang quản trị chỉ dành cho ADMIN ---
  const aQt = await tai("/quan-tri/nguoi-dung", cookieAdmin);
  const cQt = await tai("/quan-tri/nguoi-dung", cookieCht);
  ok(aQt.status === 200, "ADMIN vao duoc trang quan tri");
  ok(cQt.status === 404, `CHI_HUY_TRUONG bi chan khoi trang quan tri (HTTP ${cQt.status})`);

  // --- Vai trò mới + mật khẩu do quản trị tự đặt ---
  // Tạo tài khoản với mật khẩu đặt tay (đúng cách Server Action taoNguoiDung làm)
  // rồi đăng nhập bằng CHÍNH mật khẩu đó.
  const MK_TAY = "MatKhauDatTay2026";

  const thuKy = await db.user.upsert({
    where: { email: "thuky.test@noibo.local" },
    update: { vaiTro: "THU_KY", isActive: true, matKhauHash: await bamMatKhau(MK_TAY) },
    create: {
      email: "thuky.test@noibo.local",
      hoTen: "Thu ky kiem thu",
      vaiTro: "THU_KY",
      matKhauHash: await bamMatKhau(MK_TAY),
    },
  });
  const cvCao = await db.user.upsert({
    where: { email: "cvcao.test@noibo.local" },
    update: { vaiTro: "CHUYEN_VIEN_CAO", isActive: true, matKhauHash: await bamMatKhau(MK_TAY) },
    create: {
      email: "cvcao.test@noibo.local",
      hoTen: "Chuyen vien cao kiem thu",
      vaiTro: "CHUYEN_VIEN_CAO",
      matKhauHash: await bamMatKhau(MK_TAY),
    },
  });
  // Chuyên viên bậc cao chỉ thấy công trình được giao -> gán đúng 1 công trình.
  await db.userProject.deleteMany({ where: { userId: cvCao.id } });
  const ctGan = await db.project.findFirstOrThrow({ where: { maCongTrinh: "HL-00240" } });
  await db.userProject.create({ data: { userId: cvCao.id, projectId: ctGan.id } });

  const ckThuKy = await dangNhapThat(thuKy.email, MK_TAY);
  ok(ckThuKy !== null, "Mat khau QUAN TRI DAT TAY -> dang nhap duoc");

  const ckCvCao = await dangNhapThat(cvCao.email, MK_TAY);
  ok(ckCvCao !== null, "Tai khoan CHUYEN_VIEN_CAO dang nhap duoc");

  // Xoá cấu hình ẩn menu trước khi đo phạm vi dữ liệu, nếu không mục Công trình
  // có thể đang bị ẩn và phép đo sẽ sai.
  await db.menuBiAn.deleteMany({});

  if (ckThuKy && ckCvCao) {
    // THU_KY: toàn công ty
    const tThuKy = await tai("/cong-trinh", ckThuKy);
    const soThuKy = dsCT.filter((c) => tThuKy.html.includes(`>${c.maCongTrinh}<`)).length;
    ok(soThuKy > 25, `THU_KY thay toan cong ty (${soThuKy}/${dsCT.length} cong trinh)`);

    // CHUYEN_VIEN_CAO: chỉ công trình được giao
    const tCv = await tai("/cong-trinh", ckCvCao);
    const dsCv = dsCT.filter((c) => tCv.html.includes(`>${c.maCongTrinh}<`));
    ok(
      dsCv.length === 1 && dsCv[0].maCongTrinh === "HL-00240",
      `CHUYEN_VIEN_CAO chi thay cong trinh duoc giao (thay: ${dsCv.map((c) => c.maCongTrinh).join(", ") || "khong co"})`
    );

    // Cả hai đều KHÔNG được vào trang quản trị.
    ok((await tai("/quan-tri/nguoi-dung", ckThuKy)).status === 404, "THU_KY bi chan khoi quan tri");
    ok(
      (await tai("/quan-tri/nguoi-dung", ckCvCao)).status === 404,
      "CHUYEN_VIEN_CAO bi chan khoi quan tri"
    );
  }

  // --- Admin cấp phép vai trò nào thấy mục menu nào ---
  if (ckThuKy) {
    // Nền sạch để kiểm thử; cấu hình thật của Admin đã chụp ở đầu và trả lại ở cuối.
    await db.menuBiAn.deleteMany({});
    const truoc = await tai("/chi-phi", ckThuKy);
    ok(truoc.status === 200, "Chua an: THU_KY vao duoc /chi-phi");
    ok(
      (await tai("/", ckThuKy)).html.includes("/chi-phi"),
      "Chua an: link Co cau chi phi co tren thanh menu"
    );

    // Admin ẩn mục "Cơ cấu chi phí" với THU_KY.
    await db.menuBiAn.create({ data: { vaiTro: "THU_KY", maMenu: "chi-phi" } });

    // Bị ẩn thì CHUYỂN HƯỚNG về mục đầu tiên được phép, không trả 404.
    // Trả 404 từng đẩy người dùng vào trang trắng không lối thoát khi mục bị ẩn
    // đúng là trang đích sau đăng nhập.
    const sau = await tai("/chi-phi", ckThuKy);
    ok(sau.status === 307 || sau.status === 302, `Da an: /chi-phi bi chuyen huong (HTTP ${sau.status})`);
    ok(
      !(sau.viTri ?? "").includes("/chi-phi") && (sau.viTri ?? "") !== "",
      `Chuyen toi muc duoc phep (${sau.viTri})`
    );

    // Ẩn SẠCH mọi mục -> phải hiện thông báo có lối thoát, KHÔNG lặp chuyển hướng.
    await db.menuBiAn.createMany({
      data: MENU_IDS.filter((m) => m !== "chi-phi").map((m) => ({ vaiTro: "THU_KY", maMenu: m })),
    });
    const canKiet = await tai("/", ckThuKy);
    await db.menuBiAn.deleteMany({ where: { maMenu: { not: "chi-phi" } } });
    ok(
      canKiet.status === 200 && canKiet.html.includes("chưa được cấp quyền xem mục nào"),
      `An sach moi muc -> hien thong bao co loi thoat (HTTP ${canKiet.status})`
    );
    ok(
      !(await tai("/", ckThuKy)).html.includes(">Cơ cấu chi phí<"),
      "Da an: link Co cau chi phi bien mat khoi thanh menu"
    );
    // Mục khác không bị ảnh hưởng.
    ok((await tai("/danh-muc", ckThuKy)).status === 200, "Da an: cac muc khac van vao duoc");
    // ADMIN không bao giờ bị ẩn.
    ok(
      (await tai("/chi-phi", cookieAdmin)).status === 200,
      "ADMIN van vao duoc /chi-phi du da an voi vai tro khac"
    );

  }

  // --- Trả lại cấu hình menu như trước khi chạy ---
  await db.menuBiAn.deleteMany({});
  if (menuBanDau.length) {
    await db.menuBiAn.createMany({
      data: menuBanDau.map((r) => ({ vaiTro: r.vaiTro, maMenu: r.maMenu })),
    });
  }

  // --- Dọn phiên kiểm thử ---
  await db.session.deleteMany({
    where: { sessionToken: { in: [cookieAdmin.split("=")[1], cookieCht.split("=")[1]] } },
  });

  console.log(loi === 0 ? "\nTAT CA DAT" : `\n${loi} MUC HONG`);
  if (loi) process.exitCode = 1;
}

main().finally(() => db.$disconnect());
