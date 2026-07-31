import { BieuDoCoCau } from "@/components/charts";
import { DauTrang, GhiChuNguon, LocLink, Nhan, The, TheDau } from "@/components/ui";
import { nhanThang, phanTram } from "@/lib/format";
import {
  cacThang,
  coCauChiPhi,
  coCauChiPhiTheoNhom,
  layDanhMucMa,
  tongQuanCongTy,
} from "@/lib/data/repository";
import { NGUONG } from "@/lib/thresholds";
import { CayChiPhi } from "@/components/cay-chi-phi";

export const metadata = { title: "Cơ cấu chi phí" };

export default async function TrangCoCauChiPhi({
  searchParams,
}: {
  searchParams: Promise<{ thang?: string }>;
}) {
  const sp = await searchParams;
  const thangs = await cacThang();
  const thang = thangs.includes(sp.thang ?? "") ? sp.thang : undefined;

  const loc = thang ? { thang } : {};
  const nhom = await coCauChiPhiTheoNhom(loc);
  const chiTiet = await coCauChiPhi(loc);
  const tong = await tongQuanCongTy(thang);
  const danhMuc = await layDanhMucMa();

  // So sánh với tháng liền trước để thấy mã nào tăng bất thường.
  const iThang = thang ? thangs.indexOf(thang) : -1;
  const thangTruoc = iThang > 0 ? thangs[iThang - 1] : undefined;
  const truoc = new Map(
    (thangTruoc ? await coCauChiPhi({ thang: thangTruoc }) : []).map((c) => [c.ma, c.soTien])
  );

  const top8 = nhom.slice(0, 8);
  const duoi = nhom.slice(8);
  const duLieuChart = [
    ...top8.map((c) => ({ ma: c.ma, ten: c.ten, soTien: c.soTien, tyTrong: c.tyTrongTrenCP })),
    ...(duoi.length
      ? [
          {
            ma: "KHAC",
            ten: `Khác (${duoi.length} nhóm)`,
            soTien: duoi.reduce((a, c) => a + c.soTien, 0),
            tyTrong: duoi.reduce((a, c) => a + c.tyTrongTrenCP, 0),
          },
        ]
      : []),
  ];

  const vuotTyTrong = chiTiet.filter((c) => c.tyTrongTrenCP > NGUONG.tyTrongMaChiPhiToiDa);

  /*
   * Dựng cây nhóm -> mã chi tiết cho bảng tỷ trọng.
   *
   * Tổng kỳ trước của một NHÓM phải gom lại từ chính dữ liệu kỳ trước (theo đúng
   * cách coCauChiPhiTheoNhom gom), chứ không cộng theo danh sách mã của kỳ này —
   * mã kỳ trước có mà kỳ này không phát sinh sẽ bị bỏ sót, làm biến động sai.
   */
  const truocTheoNhom = new Map<string, number>();
  for (const [ma, v] of truoc) {
    const khoa = danhMuc.find((d) => d.ma === ma)?.maCha ?? ma;
    truocTheoNhom.set(khoa, (truocTheoNhom.get(khoa) ?? 0) + v);
  }
  const bienDongCua = (nay: number, truocDo: number | undefined) =>
    truocDo ? (nay - truocDo) / truocDo : null;

  const cay = nhom.map((g) => ({
    ma: g.ma,
    ten: g.ten,
    soTien: g.soTien,
    tyTrongTrenCP: g.tyTrongTrenCP,
    tyTrongTrenDT: g.tyTrongTrenDT,
    bienDong: bienDongCua(g.soTien, truocTheoNhom.get(g.ma)),
    vuotNguong: false,
    con: chiTiet
      .filter((c) => c.maCha === g.ma)
      .map((c) => ({
        ma: c.ma,
        ten: c.ten,
        soTien: c.soTien,
        tyTrongTrenCP: c.tyTrongTrenCP,
        tyTrongTrenDT: c.tyTrongTrenDT,
        bienDong: bienDongCua(c.soTien, truoc.get(c.ma)),
        vuotNguong: c.tyTrongTrenCP > NGUONG.tyTrongMaChiPhiToiDa,
      })),
  }));

  return (
    <>
      <DauTrang
        tieuDe="Cơ cấu chi phí tất cả công trình"
        moTa="Tiền đang được sử dụng vào đâu (§4.4). Tỷ trọng tính trên tổng chi phí và trên doanh thu ghi nhận."
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <LocLink href="/chi-phi" dangChon={!thang}>
          Lũy kế
        </LocLink>
        {thangs.map((t) => (
          <LocLink key={t} href={`/chi-phi?thang=${t}`} dangChon={thang === t}>
            {nhanThang(t)}
          </LocLink>
        ))}
      </div>

      {vuotTyTrong.length ? (
        <div className="mb-4">
          <Nhan bienThe="vang">
            {vuotTyTrong.length} mã chi phí vượt ngưỡng tỷ trọng{" "}
            {phanTram(NGUONG.tyTrongMaChiPhiToiDa, 0)}
          </Nhan>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <The>
          <TheDau
            tieuDe="Cơ cấu theo nhóm chi phí"
            moTa={thang ? nhanThang(thang) : "Lũy kế toàn kỳ"}
          />
          <div className="p-3">
            <BieuDoCoCau data={duLieuChart} />
          </div>
        </The>

        <The className="xl:col-span-2">
          <TheDau
            tieuDe="Tỷ trọng theo nhóm"
            moTa={
              thangTruoc
                ? `Bấm vào nhóm để mở các mã chi tiết · biến động so với ${nhanThang(thangTruoc)}`
                : "Bấm vào nhóm để mở các mã chi tiết · chọn một tháng để thấy cột biến động"
            }
          />
          <CayChiPhi
            nhom={cay}
            coBienDong={!!thangTruoc}
            tongChiPhi={tong.chiPhi}
            tyTrongTrenDTTong={tong.doanhThu ? tong.chiPhi / tong.doanhThu : null}
          />
          <GhiChuNguon>
            Biến động in đỏ khi tăng trên 30% so với tháng trước — ngưỡng đặt tại{" "}
            <code className="text-[11px]">src/lib/thresholds.ts</code>. Mã mới phát sinh trong kỳ
            hiển thị “mới” thay vì một tỷ lệ tăng vô cực.
          </GhiChuNguon>
        </The>
      </div>
    </>
  );
}
