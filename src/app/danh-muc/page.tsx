import { Bang, DauTrang, GhiChuNguon, Nhan, The, TheDau, Th } from "@/components/ui";
import { demGiaoDichTheoMa, layDanhMucMa } from "@/lib/data/repository";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { coQuyen } from "@/lib/auth/quyen";
import { FormThemMa } from "@/components/sua-ma";
import { CayMaKeo } from "@/components/cay-ma-keo";

export const metadata = { title: "Danh mục mã DT–CP" };

export default async function TrangDanhMuc() {
  const [danhMuc, phatSinh, nguoiDung] = await Promise.all([
    layDanhMucMa(),
    demGiaoDichTheoMa(),
    nguoiDungHienTai(),
  ]);
  // Chỉ Quản trị hệ thống được thêm/sửa/xoá/sắp xếp danh mục — còn lại chỉ xem.
  // Chốt chặn thật nằm trong các Server Action; đây chỉ để ẩn nút.
  const duocSua = coQuyen(nguoiDung, "sua_danh_muc");

  // Số mã con của từng mã nhóm — nút xoá phải biết để chặn xoá nhóm còn con.
  const soCon = new Map<string, number>();
  for (const c of danhMuc) {
    if (c.maCha) soCon.set(c.maCha, (soCon.get(c.maCha) ?? 0) + 1);
  }

  // Xếp theo cây: mã gốc rồi tới mã con. Thứ tự nhóm: Doanh thu → Giá trị thực hiện → Chi phí.
  const XEP_LOAI: Record<string, number> = { "Doanh thu": 0, "Giá trị thực hiện": 1, "Chi phí": 2 };
  const goc = danhMuc
    .filter((c) => !c.maCha)
    .sort((a, b) => (XEP_LOAI[a.loai] ?? 9) - (XEP_LOAI[b.loai] ?? 9));
  const hang: { ma: (typeof danhMuc)[number]; con: boolean }[] = [];
  for (const g of goc) {
    hang.push({ ma: g, con: false });
    for (const c of danhMuc.filter((x) => x.maCha === g.ma)) hang.push({ ma: c, con: true });
  }

  const soDT = danhMuc.filter((c) => c.loai === "Doanh thu").length;
  const soCP = danhMuc.filter((c) => c.loai === "Chi phí").length;
  const soGTTH = danhMuc.filter((c) => c.loai === "Giá trị thực hiện").length;
  const soNhap = danhMuc.filter((c) => c.choPhepNhapTrucTiep).length;
  const soChuaDung = danhMuc.filter((c) => c.choPhepNhapTrucTiep && !phatSinh.has(c.ma)).length;

  return (
    <>
      <DauTrang
        tieuDe="Danh mục mã doanh thu – chi phí"
        moTa="Trích nguyên từ sheet DM_MA_DT_CP của bộ chuẩn hóa. Ứng dụng không tự sinh mã — việc thêm, sửa, khóa mã do người quản trị danh mục thực hiện (§3.4)."
        phai={
          <>
            <Nhan bienThe="nhan">{soDT} mã doanh thu</Nhan>
            {soGTTH ? <Nhan bienThe="xanh">{soGTTH} giá trị thực hiện</Nhan> : null}
            <Nhan>{soCP} mã chi phí</Nhan>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-vien bg-the p-3">
          <p className="text-xs text-chunhat">Tổng số mã</p>
          <p className="so mt-1 text-lg font-semibold">{danhMuc.length}</p>
        </div>
        <div className="rounded-xl border border-vien bg-the p-3">
          <p className="text-xs text-chunhat">Cho nhập trực tiếp</p>
          <p className="so mt-1 text-lg font-semibold">{soNhap}</p>
        </div>
        <div className="rounded-xl border border-vien bg-the p-3">
          <p className="text-xs text-chunhat">Mã nhóm (không nhập)</p>
          <p className="so mt-1 text-lg font-semibold">{danhMuc.length - soNhap}</p>
        </div>
        <div className="rounded-xl border border-vien bg-the p-3">
          <p className="text-xs text-chunhat">Chưa có phát sinh</p>
          <p className="so mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400">
            {soChuaDung}
          </p>
        </div>
      </div>

      {duocSua ? (
        <div className="mb-4">
          <FormThemMa danhMuc={danhMuc} />
        </div>
      ) : null}

      <The>
        <TheDau
          tieuDe="Cây mã 2 cấp"
          moTa={
            duocSua
              ? "Kéo biểu tượng ⋮⋮ để sắp xếp: mã nhóm kéo kèm mã con; mã con chỉ đổi thứ tự trong nhóm cha."
              : "Chỉ Quản trị hệ thống được thêm, sửa, xoá hoặc sắp xếp danh mục — bạn đang ở chế độ chỉ xem."
          }
        />
        <Bang>
          <thead>
            <tr>
              {duocSua ? <Th className="w-10" /> : null}
              <Th>Mã</Th>
              <Th>Tên mã</Th>
              <Th>Loại</Th>
              <Th>Mã cha</Th>
              <Th>Nhập trực tiếp</Th>
              <Th phai>Số giao dịch</Th>
            </tr>
          </thead>
          <CayMaKeo
            duocSua={duocSua}
            hang={hang.map(({ ma, con }) => ({
              ma,
              con,
              soGiaoDich: phatSinh.get(ma.ma) ?? 0,
              soCon: soCon.get(ma.ma) ?? 0,
            }))}
          />
        </Bang>
      </The>

      <GhiChuNguon>
        {soChuaDung} mã được phép nhập nhưng chưa có phát sinh nào trong kỳ. Cần rà xem đây là mã đã
        ngừng dùng (nên khóa) hay là dữ liệu còn thiếu — §8.1 yêu cầu quản lý ngày hiệu lực và trạng
        thái hoạt động của từng mã.
      </GhiChuNguon>
    </>
  );
}
