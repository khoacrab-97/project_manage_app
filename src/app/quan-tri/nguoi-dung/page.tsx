import { notFound } from "next/navigation";
import { Bang, CanhBaoBox, DauTrang, GhiChuNguon, Nhan, Td, The, TheDau, Th } from "@/components/ui";
import { QuanTriNguoiDung } from "@/components/quan-tri-nguoi-dung";
import { QuyenMenu } from "@/components/quyen-menu";
import { layCauHinhMenu } from "./menu-actions";
import { db } from "@/lib/db";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { coQuyen, moTaPhamVi, VAI_TRO, type VaiTro } from "@/lib/auth/quyen";
import { layCongTrinh } from "@/lib/data/repository";
import { ngay } from "@/lib/format";

export const metadata = { title: "Quản trị người dùng" };

/** Mô tả quyền của từng vai trò, khớp với bảng QUYEN trong src/lib/auth/quyen.ts. */
const MO_TA_VAI_TRO: [VaiTro, string][] = [
  ["ADMIN", "Toàn quyền: quản lý người dùng, danh mục mã, công trình, kế hoạch"],
  ["BAN_GIAM_DOC", "Xem toàn bộ số liệu; không sửa danh mục, không nhập liệu"],
  ["CHI_HUY_TRUONG", "Nhập dữ liệu cho công trình được giao"],
  ["CHUYEN_VIEN_CAO", "Nhập dữ liệu cho công trình được giao"],
  ["CAN_BO_KY_THUAT", "Nhập dữ liệu cho công trình được giao"],
  ["THU_KY", "Xem toàn bộ số liệu và nhập dữ liệu"],
];

export default async function TrangQuanTriNguoiDung() {
  const toi = await nguoiDungHienTai();
  // Không đủ quyền thì coi như trang không tồn tại — không tiết lộ là có trang này.
  if (!coQuyen(toi, "quan_tri_nguoi_dung")) notFound();

  const nguoiDung = await db.user.findMany({
    include: { phamViGiao: { include: { project: true } } },
    orderBy: [{ vaiTro: "asc" }, { hoTen: "asc" }],
  });
  const congTrinh = await layCongTrinh();
  const cauHinhMenu = await layCauHinhMenu();

  return (
    <>
      <DauTrang
        tieuDe="Quản trị người dùng"
        moTa="Cấp tài khoản, gán vai trò và phạm vi công trình. Hệ thống không cho tự đăng ký — mọi tài khoản do quản trị tạo."
      />

      <div className="mb-4">
        <CanhBaoBox bienThe="nhan" tieuDe="Cách mật khẩu hoạt động">
          Quản trị <strong>tự đặt mật khẩu</strong> khi cấp tài khoản và khi đặt lại. Ô mật khẩu để
          dạng chữ thường để bạn đọc lại cho người dùng. Sau khi lưu, hệ thống chỉ giữ bản băm
          scrypt — <strong>không ai đọc lại được, kể cả quản trị</strong>. Quên mật khẩu thì đặt
          mật khẩu mới, không có cách khôi phục cái cũ.
        </CanhBaoBox>
      </div>

      <QuanTriNguoiDung
        nguoiDung={nguoiDung.map((u) => ({
          id: u.id,
          email: u.email,
          hoTen: u.hoTen,
          vaiTro: u.vaiTro,
          isActive: u.isActive,
          phamVi: u.phamViGiao.map((p) => p.project.maCongTrinh),
        }))}
        congTrinh={congTrinh.map((c) => ({
          ma: c.maCongTrinh,
          ten: c.tenCongTrinh,
          rutGon: c.tenRutGon,
        }))}
        toiLaAi={toi!.id}
      />

      <div className="mt-4">
        <QuyenMenu cauHinh={cauHinhMenu} />
      </div>

      <The className="mt-4">
        <TheDau tieuDe="Ý nghĩa từng vai trò" />
        <Bang>
          <thead>
            <tr>
              <Th>Vai trò</Th>
              <Th>Phạm vi dữ liệu</Th>
              <Th>Được làm gì</Th>
            </tr>
          </thead>
          <tbody>
            {MO_TA_VAI_TRO.map(([vt, lam]) => (
              <tr key={vt} className="hover:bg-nen">
                <Td>
                  <Nhan bienThe={vt === "ADMIN" ? "nhan" : "trung_tinh"}>{VAI_TRO[vt]}</Nhan>
                </Td>
                <Td className="text-xs">{moTaPhamVi(vt)}</Td>
                <Td className="text-xs text-chunhat">{lam}</Td>
              </tr>
            ))}
          </tbody>
        </Bang>
        <GhiChuNguon>
          Sửa danh mục mã, tạo công trình và sửa kế hoạch – ngân sách hiện <strong>chỉ Admin</strong>{" "}
          được làm. Muốn mở cho vai trò khác thì sửa bảng <code>QUYEN</code> trong{" "}
          <code>src/lib/auth/quyen.ts</code>.
        </GhiChuNguon>
      </The>

      <The className="mt-4">
        <TheDau tieuDe="Phiên đăng nhập đang mở" />
        <Bang>
          <thead>
            <tr>
              <Th>Người dùng</Th>
              <Th>Hết hạn</Th>
            </tr>
          </thead>
          <tbody>
            {(
              await db.session.findMany({
                include: { user: true },
                orderBy: { expires: "desc" },
              })
            ).map((s) => (
              <tr key={s.sessionToken} className="hover:bg-nen">
                <Td className="text-xs">{s.user.email}</Td>
                <Td className="text-xs">{ngay(s.expires.toISOString())}</Td>
              </tr>
            ))}
          </tbody>
        </Bang>
      </The>

      <GhiChuNguon>
        Đổi vai trò, đổi phạm vi hoặc đặt mật khẩu mới đều huỷ mọi phiên đang mở của người đó — nếu
        không họ vẫn giữ quyền cũ cho tới khi cookie hết hạn.
      </GhiChuNguon>
    </>
  );
}
