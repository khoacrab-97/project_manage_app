import { Bang, DauTrang, GhiChuNguon, Nhan, Td, The, TheDau, Th } from "@/components/ui";
import { layDanhMucMa, layGiaoDich } from "@/lib/data/repository";
import { FormThemMa, NutSuaMa, NutXoaMa } from "@/components/sua-ma";

export const metadata = { title: "Danh mục mã DT–CP" };

export default async function TrangDanhMuc() {
  const danhMuc = await layDanhMucMa();

  const phatSinh = new Map<string, { soDong: number }>();
  for (const g of await layGiaoDich()) {
    if (!g.maDTCP) continue;
    const o = phatSinh.get(g.maDTCP) ?? { soDong: 0 };
    o.soDong++;
    phatSinh.set(g.maDTCP, o);
  }

  // Số mã con của từng mã nhóm — nút xoá phải biết để chặn xoá nhóm còn con.
  const soCon = new Map<string, number>();
  for (const c of danhMuc) {
    if (c.maCha) soCon.set(c.maCha, (soCon.get(c.maCha) ?? 0) + 1);
  }

  // Xếp theo cây: mã gốc rồi tới mã con của nó.
  const goc = danhMuc.filter((c) => !c.maCha);
  const hang: { ma: (typeof danhMuc)[number]; con: boolean }[] = [];
  for (const g of goc) {
    hang.push({ ma: g, con: false });
    for (const c of danhMuc.filter((x) => x.maCha === g.ma)) hang.push({ ma: c, con: true });
  }

  const soDT = danhMuc.filter((c) => c.loai === "Doanh thu").length;
  const soCP = danhMuc.filter((c) => c.loai === "Chi phí").length;
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

      <div className="mb-4">
        <FormThemMa danhMuc={danhMuc} />
      </div>

      <The>
        <TheDau
          tieuDe="Cây mã 2 cấp"
          moTa="Mã nhóm in đậm và không được ghi giao dịch trực tiếp; mã chi tiết thụt vào"
        />
        <Bang>
          <thead>
            <tr>
              <Th className="w-10" />
              <Th>Mã</Th>
              <Th>Tên mã</Th>
              <Th>Loại</Th>
              <Th>Mã cha</Th>
              <Th>Nhập trực tiếp</Th>
              <Th phai>Số giao dịch</Th>
            </tr>
          </thead>
          <tbody>
            {hang.map(({ ma, con }) => {
              const ps = phatSinh.get(ma.ma);
              return (
                <tr key={ma.ma} className={con ? "hover:bg-nen" : "bg-nen/60 hover:bg-nen"}>
                  {/* Cây bút trên, thùng rác dưới — xếp dọc để cột thao tác chỉ rộng một biểu tượng. */}
                  <Td className="px-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <NutSuaMa ma={ma} soGiaoDich={ps?.soDong ?? 0} />
                      <NutXoaMa ma={ma} soGiaoDich={ps?.soDong ?? 0} soCon={soCon.get(ma.ma) ?? 0} />
                    </div>
                  </Td>
                  <Td className={`font-mono text-xs ${con ? "pl-8" : "font-semibold"}`}>{ma.ma}</Td>
                  <Td className={`text-xs ${con ? "" : "font-semibold"}`}>{ma.ten}</Td>
                  <Td>
                    <Nhan bienThe={ma.loai === "Doanh thu" ? "nhan" : "trung_tinh"}>{ma.loai}</Nhan>
                  </Td>
                  <Td className="font-mono text-xs text-chunhat">{ma.maCha ?? "—"}</Td>
                  <Td>
                    {ma.choPhepNhapTrucTiep ? (
                      <Nhan bienThe="xanh">Có</Nhan>
                    ) : (
                      <Nhan>Không — mã nhóm</Nhan>
                    )}
                  </Td>
                  <Td phai className="text-xs">
                    {ps ? ps.soDong.toLocaleString("vi-VN") : <span className="text-chunhat">0</span>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
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
