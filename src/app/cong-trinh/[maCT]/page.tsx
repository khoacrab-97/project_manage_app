import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TheKPI } from "@/components/kpi-card";
import { BieuDoXuHuong } from "@/components/charts";
import {
  Bang,
  CanhBaoBox,
  DauTrang,
  GhiChuNguon,
  LocLink,
  Nhan,
  NhanSucKhoe,
  O_So,
  Rong,
  Td,
  The,
  TheDau,
  Th,
  ThanhTyLe,
} from "@/components/ui";
import { khoiLuong, ngay, nhanThang, phanTram, tien, tienLe } from "@/lib/format";
import {
  cacThang,
  chiSoEVM,
  danhMucSucKhoe,
  keHoachVsThucHien,
  layDanhMucMa,
  layGiaoDich,
  layBOQ,
  billDoanhThuTheoThang,
  giaTriBillThang,
  giaTriMotGiamGia,
  ttThanhTien,
  layGiaoDichChoXuLy,
  layLoNhap,
  maTranTheoCongTrinh,
  timCongTrinh,
  type KyBaoCao,
} from "@/lib/data/repository";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { coQuyen } from "@/lib/auth/quyen";
import { motGiaTri } from "@/lib/search-params";
import { NGAY_HIEN_TAI } from "@/lib/thresholds";
import { GiamGiaBOQ, HopThoaiBill, ImportBOQ, LuoiNhapBOQ, NutThemBill, ThietLapVAT } from "@/components/nhap-boq";
import { BangGiaoDich } from "@/components/nhap-giao-dich";
import { NutThemCot, NutThemDong } from "@/components/cot-boq";

/** Dãy tháng liên tục "yyyy-MM" từ `tu` đến `den`, bao gồm cả hai đầu. */
function dayThang(tu: string, den: string): string[] {
  const ds: string[] = [];
  let [n, t] = tu.split("-").map(Number);
  const [nCuoi, tCuoi] = den.split("-").map(Number);
  while (n < nCuoi || (n === nCuoi && t <= tCuoi)) {
    ds.push(`${n}-${String(t).padStart(2, "0")}`);
    if (t === 12) {
      n++;
      t = 1;
    } else t++;
  }
  return ds;
}

const TABS = [
  { id: "tong-quan", nhan: "Tổng quan" },
  { id: "boq", nhan: "BOQ" },
  { id: "doanh-thu", nhan: "Doanh thu" },
  { id: "chi-phi", nhan: "Chi phí" },
  { id: "giao-dich", nhan: "Giao dịch" },
  { id: "bao-cao", nhan: "Báo cáo" },
  { id: "evm", nhan: "EVM" },
  { id: "lich-su", nhan: "Lịch sử nhập" },
] as const;

const LOAI_KY: { id: KyBaoCao; nhan: string }[] = [
  { id: "thang", nhan: "Theo tháng" },
  { id: "quy", nhan: "Theo quý" },
  { id: "nam", nhan: "Theo năm" },
];

function nhanKyBaoCao(loai: KyBaoCao, ky: string) {
  if (loai === "thang") return nhanThang(ky);
  if (loai === "quy") {
    const [y, s] = ky.split("-Q");
    return `Quý ${["I", "II", "III", "IV"][Number(s) - 1]}/${y}`;
  }
  return `Năm ${ky}`;
}

export default async function TrangChiTietCongTrinh({
  params,
  searchParams,
}: PageProps<"/cong-trinh/[maCT]">) {
  const { maCT } = await params;
  const sp = await searchParams;
  const tabParam = motGiaTri(sp.tab);
  const an0Param = motGiaTri(sp.an0);
  const bqParam = motGiaTri(sp.bq);
  const loaiParam = motGiaTri(sp.loai);
  const kyParam = motGiaTri(sp.ky);
  const maCongTrinh = decodeURIComponent(maCT);
  const ct = await timCongTrinh(maCongTrinh);
  if (!ct) notFound();

  const tab = tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "tong-quan";
  const base = `/cong-trinh/${encodeURIComponent(maCongTrinh)}`;
  const q = (o: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `${base}?${s}` : base;
  };

  const dong = (await danhMucSucKhoe()).find((d) => d.congTrinh.maCongTrinh === maCongTrinh)!;
  const tatCa = await layGiaoDich({ maCongTrinh });
  const danhMuc = await layDanhMucMa();
  // Doanh thu Bill lấy CÙNG nguồn với KPI: BOQ nếu có BOQ, ngược lại mã Bill trên sổ.
  const billThang = await billDoanhThuTheoThang(maCongTrinh);
  // Dải tháng = tháng có giao dịch (toàn app) ∪ tháng đã ra Bill của công trình.
  const thangs = [...new Set([...(await cacThang()), ...billThang.keys()])].sort();

  // Tra loại một lần rồi mới gộp — tránh gọi bất đồng bộ trong vòng lặp.
  const loaiTheoMa = new Map(danhMuc.map((c) => [c.ma, c.loai]));

  // Chuỗi theo tháng của riêng công trình này. Doanh thu = Bill (BOQ/sổ), chi phí
  // = tổng mã chi phí trên sổ giao dịch của tháng.
  const chuoi = thangs.map((t) => {
    const ds = tatCa.filter((g) => g.thangThucHien === t);
    let cp = 0;
    for (const g of ds) {
      if (loaiTheoMa.get(g.maDTCP ?? "") === "Chi phí") cp += g.soTien;
    }
    const dt = billThang.get(t) ?? 0;
    return { thang: t, doanhThu: dt, chiPhi: cp, loiNhuan: dt - cp };
  });

  /*
   * Biểu đồ ở tab Tổng quan chạy theo VÒNG ĐỜI CÔNG TRÌNH, không theo dải tháng
   * chung của cả app: từ tháng khởi công tới tháng nghiệm thu (công trình đã
   * hoàn thành) hoặc tháng hiện tại (còn đang thi công).
   *
   * Mốc "hiện tại" lấy NGAY_HIEN_TAI của bộ dữ liệu chứ không phải đồng hồ máy,
   * để biểu đồ và các KPI khác nói cùng một mốc thời gian.
   */
  const thangCua = (d: string) => d.slice(0, 7);
  const thangDau = ct.ngayBatDau ? thangCua(ct.ngayBatDau) : (thangs[0] ?? thangCua(NGAY_HIEN_TAI));
  const thangCuoiTho =
    ct.trangThai === "Đã nghiệm thu" && ct.ngayHoanThanh
      ? thangCua(ct.ngayHoanThanh)
      : thangCua(NGAY_HIEN_TAI);
  // Có công trình khởi công ở tương lai; không kẹp lại thì khoảng bị đảo ngược
  // và biểu đồ trống trơn.
  const thangCuoi = thangCuoiTho < thangDau ? thangDau : thangCuoiTho;

  const chuoiVongDoi = dayThang(thangDau, thangCuoi).map(
    (t) => chuoi.find((c) => c.thang === t) ?? { thang: t, doanhThu: 0, chiPhi: 0, loiNhuan: 0 }
  );

  return (
    <>
      <Link
        href="/cong-trinh"
        className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-nhan hover:underline"
      >
        <ArrowLeft className="size-3" /> Danh mục công trình
      </Link>

      <DauTrang
        tieuDe={ct.tenRutGon || maCongTrinh}
        moTa={
          <>
            {ct.tenRutGon ? (
              <>
                <span className="">{maCongTrinh}</span> ·{" "}
              </>
            ) : null}
            {ct.tenCongTrinh} · {ct.chuDauTu}
            <br />
            Chỉ huy trưởng <strong>{ct.chiHuyTruong}</strong> · {ct.phongPhuTrach} · {ct.diaDiem} ·
            Khởi công {ngay(ct.ngayBatDau)} · Cập nhật gần nhất {ngay(ct.ngayCapNhatCuoi)} (
            {dong.ngayTre} ngày trước)
          </>
        }
        phai={
          <>
            <Nhan>{ct.trangThai}</Nhan>
            <NhanSucKhoe sucKhoe={dong.sucKhoe} lyDo={dong.lyDo} />
          </>
        }
      />

      {ct.trangThai === "Đã nghiệm thu" ? (
        <div className="mb-4">
          <CanhBaoBox bienThe="nhan" tieuDe="Công trình đã hoàn thành — dữ liệu chỉ đọc">
            <p>
              Công trình đã nghiệm thu nên toàn bộ dữ liệu bị đóng băng: không thêm Bill tháng,
              không thêm dòng hay cột BOQ, không sửa khối lượng. Muốn mở lại, vào{" "}
              <Link href="/cong-trinh" className="font-medium text-nhan underline">
                Danh mục công trình
              </Link>{" "}
              bấm Sửa và bỏ tích “Đã hoàn thành”.
            </p>
          </CanhBaoBox>
        </div>
      ) : null}

      {dong.lyDo.length ? (
        <div className="mb-4">
          <CanhBaoBox
            bienThe={dong.sucKhoe === "Đỏ" ? "do" : "vang"}
            tieuDe={`Lý do công trình đang ở mức ${dong.sucKhoe}`}
          >
            <ul className="list-disc space-y-0.5 pl-4">
              {dong.lyDo.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </CanhBaoBox>
        </div>
      ) : null}

      {/* ---- Tabs ---- */}
      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-vien pb-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={q({ tab: t.id })}
            scroll={false}
            className={
              tab === t.id
                ? "rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-md px-3 py-1.5 text-xs font-medium text-chunhat hover:bg-nen hover:text-chu"
            }
          >
            {t.nhan}
          </Link>
        ))}
      </div>

      {tab === "tong-quan" ? (
        <TongQuan dong={dong} chuoi={chuoiVongDoi} base={base} />
      ) : tab === "boq" ? (
        <BOQTab
          maCongTrinh={maCongTrinh}
          thangChon={bqParam}
          daHoanThanh={ct.trangThai === "Đã nghiệm thu"}
        />
      ) : tab === "doanh-thu" ? (
        <DoanhThu maCongTrinh={maCongTrinh} chuoi={chuoi} />
      ) : tab === "chi-phi" ? (
        <ChiPhi maCongTrinh={maCongTrinh} danhMuc={danhMuc} base={base} an0={an0Param === "1"} />
      ) : tab === "giao-dich" ? (
        <GiaoDichTab maCongTrinh={maCongTrinh} daHoanThanh={ct.trangThai === "Đã nghiệm thu"} />
      ) : tab === "bao-cao" ? (
        <BaoCaoTab maCongTrinh={maCongTrinh} loai={loaiParam} ky={kyParam} q={q} />
      ) : tab === "evm" ? (
        <EVMTab maCongTrinh={maCongTrinh} />
      ) : (
        <LichSu maCongTrinh={maCongTrinh} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- Tổng quan
async function TongQuan({
  dong,
  chuoi,
  base,
}: {
  dong: Awaited<ReturnType<typeof danhMucSucKhoe>>[number];
  chuoi: { thang: string; doanhThu: number; chiPhi: number; loiNhuan: number }[];
  base: string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TheKPI nhan="Doanh thu lũy kế" giaTri={dong.doanhThu} phuChu="Bill nội bộ" />
        <TheKPI nhan="Chi phí lũy kế" giaTri={dong.chiPhi} phuChu="Tổng các mã chi phí" />
        <TheKPI nhan="Lợi nhuận gộp" giaTri={dong.loiNhuan} phuChu="Doanh thu − Chi phí" />
        <TheKPI
          nhan="Biên lợi nhuận"
          giaTri={dong.bienLN}
          dinhDang="phanTram"
          phuChu={`Mục tiêu ${phanTram(dong.congTrinh.bienLNMucTieu, 0)}`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <The className="xl:col-span-2">
          <TheDau tieuDe="Doanh thu – Chi phí – Lợi nhuận theo tháng" />
          <div className="p-3">
            <BieuDoXuHuong data={chuoi} />
          </div>
        </The>

        <The>
          <TheDau tieuDe="Kế hoạch và thực hiện" />
          <Bang>
            <tbody>
              <tr>
                <Td className="text-xs text-chunhat">Doanh thu kế hoạch</Td>
                <Td phai>{tien(dong.dtKeHoach)}</Td>
              </tr>
              <tr>
                <Td className="text-xs text-chunhat">Doanh thu thực hiện</Td>
                <Td phai>{tien(dong.doanhThu)}</Td>
              </tr>
              <tr>
                <Td className="text-xs text-chunhat">Tỷ lệ hoàn thành DT</Td>
                <Td phai>
                  <ThanhTyLe tyLe={dong.tyLeDoanhThu} />
                </Td>
              </tr>
              <tr>
                <Td className="text-xs text-chunhat">Chi phí kế hoạch</Td>
                <Td phai>{tien(dong.cpKeHoach)}</Td>
              </tr>
              <tr>
                <Td className="text-xs text-chunhat">Chi phí thực hiện</Td>
                <Td phai>{tien(dong.chiPhi)}</Td>
              </tr>
              <tr>
                <Td className="text-xs text-chunhat">Tỷ lệ dùng ngân sách</Td>
                <Td phai>
                  <ThanhTyLe tyLe={dong.tyLeNganSach} />
                </Td>
              </tr>
              <tr>
                <Td className="text-xs text-chunhat">Chênh lệch chi phí</Td>
                <Td phai>
                  <O_So am={dong.chenhLechCP < 0}>{tien(dong.chenhLechCP)}</O_So>
                </Td>
              </tr>
              <tr>
                <Td className="text-xs text-chunhat">Cost Progress Gap</Td>
                <Td phai>{phanTram(dong.gap)}</Td>
              </tr>
            </tbody>
          </Bang>
          <div className="px-4 pb-3">
            <Link
              href={`${base}?tab=giao-dich`}
              className="text-xs font-medium text-nhan hover:underline"
            >
              Xem toàn bộ giao dịch →
            </Link>
          </div>
        </The>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- BOQ
/** Tháng liền sau tháng cuối cùng đã có Bill — gợi ý sẵn khi tạo Bill mới. */
function thangKe(thang: string | undefined): string {
  if (!thang) return "";
  const [n, t] = thang.split("-").map(Number);
  return t === 12 ? `${n + 1}-01` : `${n}-${String(t + 1).padStart(2, "0")}`;
}

/**
 * BOQ và tiến độ thực hiện, dựng theo sheet "1.2 GÍA TRỊ BILL".
 *
 * Khác file gốc ở một điểm cố ý: KHÔNG trải hết mọi tháng ra thành một bảng dài.
 * Mỗi tháng xem và cập nhật riêng, nên bảng chỉ có 2 cột của tháng đang chọn —
 * khối lượng và thành tiền TÁCH RỜI nhau.
 *
 * Cột tùy chỉnh sửa THẲNG trên bảng này (ô gõ tại chỗ), không tách ra bảng riêng.
 */
async function BOQTab({
  maCongTrinh,
  thangChon,
  daHoanThanh,
}: {
  maCongTrinh: string;
  thangChon?: string;
  /** Công trình đã nghiệm thu — đóng băng, chỉ được xem. */
  daHoanThanh: boolean;
}) {
  const { thangs, dongs, cots, donGiaGomVAT, vatPhanTram, lamTronThanhTien, giamGia } =
    await layBOQ(maCongTrinh);
  // Bill (doanh thu) lấy chưa VAT: nếu đơn giá đã gồm VAT thì chia (1+vat%).
  const heSoBill = donGiaGomVAT ? 1 / (1 + (vatPhanTram || 0) / 100) : 1;
  // Chiết khấu: tính số tiền giảm từng dòng theo thành tiền hợp đồng (theo thứ tự BOQ).
  const ttList = dongs.map((d) => d.ttHopDong);
  const giamGiaTinh = giamGia.map((g) => ({ ...g, giaTri: giaTriMotGiamGia(ttList, g) }));
  const u = await nguoiDungHienTai();
  // Công trình hoàn thành thì ẩn hết lối sửa. Chốt chặn thật nằm ở Server Action
  // (`congTrinhChoGhi`); ẩn ở đây chỉ để không mời người dùng bấm vào ngõ cụt.
  const duocNhap = coQuyen(u, "nhap_boq") && !daHoanThanh;

  if (!dongs.length) {
    return (
      <The>
        <TheDau tieuDe="Bảng khối lượng hợp đồng (BOQ)" />
        <div className="p-4">
          <p className="mb-3 text-sm text-chunhat">
            Công trình chưa có BOQ. Nhập bảng khối lượng hợp đồng thì mới tính được giá trị Bill theo
            tháng.
          </p>
          {duocNhap ? (
            <div className="flex flex-wrap items-center gap-2">
              <LuoiNhapBOQ maCongTrinh={maCongTrinh} nhan="Tạo BOQ — nhập bảng khối lượng" noiBat />
              <ImportBOQ maCongTrinh={maCongTrinh} />
            </div>
          ) : null}
        </div>
      </The>
    );
  }

  // Tháng đang MỞ hộp thoại Bill: chỉ khi người dùng bấm chọn (?bq=...). KPI vẫn
  // mặc định tháng cuối để luôn có số hiển thị.
  const kyChon = thangChon ? thangs.find((t) => t.thang === thangChon) ?? null : null;
  const ky = kyChon ?? thangs.at(-1);
  const base = `/cong-trinh/${encodeURIComponent(maCongTrinh)}`;

  const ttHopDong = dongs.reduce((a, d) => a + d.ttHopDong, 0);
  // Lũy kế vật lý tính mọi tháng; lũy kế vào KPI chỉ tính tháng đã xác nhận.
  const ttLuyKe = dongs.reduce((a, d) => a + d.ttLuyKe, 0);
  // Không còn xác nhận: mọi kỳ Bill đều tính vào lũy kế.
  const ttXacNhan = thangs.reduce(
    (a, t) => a + giaTriBillThang(dongs, t.thang, heSoBill, giamGia, lamTronThanhTien),
    0
  );
  const billKy = ky ? giaTriBillThang(dongs, ky.thang, heSoBill, giamGia, lamTronThanhTien) : 0;
  const soXong = dongs.filter((d) => d.hoanThanh).length;

  /** Luỹ kế khối lượng của các tháng TRƯỚC kỳ đang chọn. */
  const klKyTruoc = (d: (typeof dongs)[number]) =>
    !ky
      ? 0
      : Object.entries(d.klTheoThang)
          .filter(([t]) => t < ky.thang)
          .reduce((a, [, v]) => a + v, 0);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TheKPI
          nhan="Giá trị hợp đồng (BOQ)"
          giaTri={ttHopDong}
          phuChu={`${dongs.length} công tác · ${soXong} đã xong`}
        />
        <TheKPI nhan="Lũy kế Bill" giaTri={ttXacNhan} phuChu="Giá trị Bill mọi kỳ" />
        <TheKPI
          nhan={ky ? `Bill ${nhanThang(ky.thang)}` : "Bill tháng"}
          giaTri={billKy}
          phuChu="Giá trị Bill kỳ này"
        />
        <TheKPI
          nhan="Tiến độ thực hiện"
          giaTri={ttHopDong ? ttLuyKe / ttHopDong : null}
          dinhDang="phanTram"
          phuChu="Lũy kế / Hợp đồng"
        />
      </div>

      {/* ---- Chọn tháng: bấm để mở hộp thoại Bill. ---- */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-chunhat">Kỳ Bill:</span>
        {thangs.map((t) => (
          <LocLink
            key={t.thang}
            href={`${base}?tab=boq&bq=${t.thang}`}
            dangChon={kyChon?.thang === t.thang}
          >
            {nhanThang(t.thang)}
          </LocLink>
        ))}
        {thangs.length === 0 ? <span className="text-xs text-chunhat">Chưa có kỳ Bill nào.</span> : null}
      </div>

      {duocNhap ? (
        <div className="mt-2 flex flex-wrap items-start gap-1.5">
          <NutThemBill maCongTrinh={maCongTrinh} goiY={thangKe(thangs.at(-1)?.thang)} base={base} />
          <NutThemDong
            maCongTrinh={maCongTrinh}
            dongs={dongs.map((d) => ({ id: d.id, stt: d.stt, noiDung: d.noiDung }))}
          />
          <LuoiNhapBOQ maCongTrinh={maCongTrinh} />
          <ImportBOQ maCongTrinh={maCongTrinh} daCoBOQ />
          <NutThemCot maCongTrinh={maCongTrinh} />
          <ThietLapVAT
            maCongTrinh={maCongTrinh}
            donGiaGomVAT={donGiaGomVAT}
            vatPhanTram={vatPhanTram}
            lamTronThanhTien={lamTronThanhTien}
          />
          <GiamGiaBOQ maCongTrinh={maCongTrinh} danhSach={giamGiaTinh} soDong={dongs.length} />
        </div>
      ) : null}

      {/* BOQ dạng BẢNG TÍNH (chỉ xem) — luôn hiện khi có BOQ, kể cả chưa có kỳ Bill. */}
      <The className="mt-3">
        <TheDau
          tieuDe="Bảng khối lượng BOQ"
          moTa={`${dongs.length} công tác · dạng bảng tính, chỉ xem`}
        />
        <div className="p-3">
          <SpreadsheetBOQ
            dongs={dongs}
            tong={ttHopDong}
            donGiaGomVAT={donGiaGomVAT}
            vatPhanTram={vatPhanTram}
            giamGia={giamGiaTinh}
          />
        </div>
      </The>

      {kyChon ? (
        <HopThoaiBill
          maCongTrinh={maCongTrinh}
          thang={kyChon.thang}
          nhan={nhanThang(kyChon.thang)}
          base={base}
          nguoiNhap={kyChon.nguoiNhap || ""}
          duocNhap={duocNhap}
          lamTronThanhTien={lamTronThanhTien}
          cots={cots.map((c) => ({ id: c.id, ten: c.ten }))}
          dongs={dongs.map((d) => ({
            id: d.id,
            stt: d.stt,
            noiDung: d.noiDung,
            dvt: d.dvt,
            donGia: d.donGia,
            klKyTruoc: klKyTruoc(d),
            klHienTai: d.klTheoThang[kyChon.thang] ?? 0,
            hoanThanh: d.hoanThanh,
            giaTriCot: d.giaTriCot,
          }))}
        />
      ) : null}
    </>
  );
}


/**
 * BOQ dạng bảng tính CHỈ XEM: viền ô kiểu Excel, header dính khi cuộn dọc, cuộn
 * ngang nếu tràn, dòng TỔNG dính đáy. Cột hợp đồng: STT · Nội dung · ĐVT · Khối
 * lượng · Đơn giá · Thành tiền. Sửa BOQ vẫn qua các nút/ô ở phần dưới, không ở đây.
 */
function SpreadsheetBOQ({
  dongs,
  tong,
  donGiaGomVAT,
  vatPhanTram,
  giamGia,
}: {
  dongs: {
    id: string;
    stt: string;
    noiDung: string;
    dvt: string;
    klHopDong: number;
    donGia: number;
    ttHopDong: number;
    hoanThanh: boolean;
  }[];
  tong: number;
  donGiaGomVAT: boolean;
  vatPhanTram: number;
  giamGia: { id: string; moTa: string; tuStt: number; denStt: number; phanTram: number; giaTri: number }[];
}) {
  const oS = "border border-vien px-2 py-1 text-xs whitespace-nowrap";
  const oT = "border border-vien bg-nen px-2 py-1.5 text-xs font-semibold whitespace-nowrap";

  // Chiết khấu (nếu có) trừ trên TỔNG CỘNG → TỔNG SAU GIẢM; VAT tính trên tổng sau
  // giảm. `tong` theo đơn giá: gồm VAT nếu donGiaGomVAT, ngược lại là chưa VAT.
  const coGiam = giamGia.length > 0;
  const tongSauGiam = tong - giamGia.reduce((a, g) => a + g.giaTri, 0);
  const v = (vatPhanTram || 0) / 100;
  const tenGoc = coGiam ? "TỔNG SAU GIẢM" : "TỔNG";
  const nhanChinh = donGiaGomVAT ? `${tenGoc} (bao gồm VAT)` : `${tenGoc} (chưa VAT)`;
  const nhanPhu = donGiaGomVAT ? `${tenGoc} (chưa VAT)` : `${tenGoc} (bao gồm VAT)`;
  const giaPhu = donGiaGomVAT ? Math.round(tongSauGiam / (1 + v)) : Math.round(tongSauGiam * (1 + v));

  return (
    <div className="max-h-[65vh] overflow-auto rounded-lg border border-vien">
      <table className="min-w-full border-collapse">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className={`${oT} sticky left-0 z-30 text-right`}>ID</th>
            <th className={`${oT} text-left`}>STT</th>
            <th className={`${oT} text-left`}>Nội dung hạng mục</th>
            <th className={`${oT} text-left`}>ĐVT</th>
            <th className={`${oT} text-right`}>Khối lượng</th>
            <th className={`${oT} text-right`}>Đơn giá</th>
            <th className={`${oT} text-right`}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {dongs.map((d, i) => (
            <tr key={d.id} className="hover:bg-nen/50">
              <td className={`${oS} so sticky left-0 z-10 bg-the text-right text-chunhat`}>{i + 1}</td>
              <td className={oS}>
                {d.stt}
                {d.hoanThanh ? (
                  <span className="ml-1 text-emerald-600 dark:text-emerald-400" title="Đã thi công xong">
                    ✓
                  </span>
                ) : null}
              </td>
              <td className="border border-vien px-2 py-1 text-xs" style={{ minWidth: 280 }}>
                {d.noiDung}
              </td>
              <td className={oS}>{d.dvt}</td>
              <td className={`${oS} so text-right`}>{khoiLuong(d.klHopDong)}</td>
              <td className={`${oS} so text-right`}>{tienLe(d.donGia)}</td>
              <td className={`${oS} so text-right`}>{tienLe(d.ttHopDong)}</td>
            </tr>
          ))}
          {coGiam ? (
            <>
              <tr>
                <td className={`${oT} sticky left-0 z-10 text-right`} colSpan={6}>
                  TỔNG CỘNG
                </td>
                <td className={`${oT} so text-right`}>{tienLe(tong)}</td>
              </tr>
              {giamGia.map((g) => (
                <tr key={g.id}>
                  <td className={`${oT} sticky left-0 z-10 text-right font-normal text-chunhat`} colSpan={6}>
                    {g.moTa ? `${g.moTa} · ` : ""}Giảm giá {g.phanTram}% (dòng {g.tuStt}–{g.denStt})
                  </td>
                  <td className={`${oT} so text-right text-rose-600 dark:text-rose-400`}>−{tienLe(g.giaTri)}</td>
                </tr>
              ))}
            </>
          ) : null}
          <tr>
            <td className={`${oT} sticky left-0 z-10 text-right`} colSpan={6}>
              {nhanChinh}
            </td>
            <td className={`${oT} so text-right`}>{tienLe(tongSauGiam)}</td>
          </tr>
          {v > 0 ? (
            <tr>
              <td className={`${oT} sticky left-0 z-10 text-right`} colSpan={6}>
                {nhanPhu}
                <span className="ml-1 font-normal text-chunhat">· VAT {vatPhanTram}%</span>
              </td>
              <td className={`${oT} so text-right`}>{tienLe(giaPhu)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- Doanh thu
async function DoanhThu({
  maCongTrinh,
  chuoi,
}: {
  maCongTrinh: string;
  chuoi: { thang: string; doanhThu: number }[];
}) {
  const dsDT = await layGiaoDich({ maCongTrinh, loai: "Doanh thu" });
  const theoMa = new Map<string, number>();
  for (const g of dsDT) {
    if (!g.maDTCP) continue;
    theoMa.set(g.maDTCP, (theoMa.get(g.maDTCP) ?? 0) + g.soTien);
  }
  const danhMuc = await layDanhMucMa();
  const tenTheoMa = new Map(danhMuc.map((c) => [c.ma, c.ten]));

  // Tổng Bill lấy từ chuỗi doanh thu (BOQ nếu có BOQ) — CÙNG nguồn với KPI, không
  // cộng riêng mã "Bill" trên sổ giao dịch nữa.
  const billTong = chuoi.reduce((a, c) => a + c.doanhThu, 0);
  const thangTrong = chuoi.filter((c) => c.doanhThu === 0).map((c) => c.thang);

  // Dòng tiền thu = mọi mã Doanh thu nhập trực tiếp trong danh mục (trừ Bill —
  // Bill là giá trị khối lượng thực hiện, tách riêng ở dòng trên). Mã Doanh thu
  // mới thêm trong Danh mục tự động hiện ở đây, không cần sửa code.
  const DONG_TIEN = danhMuc
    .filter((c) => c.loai === "Doanh thu" && c.choPhepNhapTrucTiep && c.ma !== "Bill")
    .map((c) => c.ma);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <The>
        <TheDau
          tieuDe="Giá trị thực hiện và dòng tiền thu"
          moTa="Bill là giá trị khối lượng thực hiện trong tháng do chỉ huy trưởng xác nhận — không phải dòng tiền thu"
        />
        <Bang>
          <thead>
            <tr>
              <Th>Mã</Th>
              <Th>Khoản mục</Th>
              <Th phai>Giá trị</Th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-nen/60">
              <Td className="text-xs font-semibold">Bill</Td>
              <Td className="text-xs font-semibold">
                Giá trị thực hiện — doanh thu dự kiến, chưa nghiệm thu thanh toán
              </Td>
              <Td phai>
                {billTong ? (
                  tien(billTong)
                ) : (
                  <span className="text-chunhat">chưa phát sinh</span>
                )}
              </Td>
            </tr>
            <tr>
              <Td colSpan={3} className="pt-3 text-[11px] font-semibold tracking-wide text-chunhat uppercase">
                Dòng tiền thu (Tạm ứng / Thanh toán đợt / Quyết toán)
              </Td>
            </tr>
            {DONG_TIEN.map((ma) => (
              <tr key={ma} className="hover:bg-nen">
                <Td className="text-xs">{ma}</Td>
                <Td className="text-xs">{tenTheoMa.get(ma) ?? ma}</Td>
                <Td phai>
                  {theoMa.has(ma) ? (
                    tien(theoMa.get(ma))
                  ) : (
                    <span className="text-chunhat">chưa phát sinh</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Bang>
        <GhiChuNguon>
          <strong>Bill</strong> là giá trị khối lượng thực hiện trong tháng, chỉ huy trưởng phụ trách
          xác nhận — xem như doanh thu dự kiến, <strong>chưa phải dòng tiền</strong>. Tạm ứng, Thanh
          toán đợt và Quyết toán mới là tiền thực thu; hiện chưa ghi nhận trong dữ liệu nguồn.
        </GhiChuNguon>
      </The>

      <The>
        <TheDau tieuDe="Giá trị thực hiện (Bill) theo tháng" />
        <Bang>
          <thead>
            <tr>
              <Th>Tháng</Th>
              <Th phai>Giá trị thực hiện</Th>
            </tr>
          </thead>
          <tbody>
            {chuoi.map((c) => (
              <tr key={c.thang} className="hover:bg-nen">
                <Td className="whitespace-nowrap">{nhanThang(c.thang)}</Td>
                <Td phai>
                  {c.doanhThu ? (
                    tien(c.doanhThu)
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">chưa ghi nhận</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Bang>
        {thangTrong.length ? (
          <GhiChuNguon>
            {thangTrong.length} tháng chưa ghi nhận giá trị thực hiện:{" "}
            {thangTrong.map(nhanThang).join(", ")}.
          </GhiChuNguon>
        ) : null}
      </The>
    </div>
  );
}

// ---------------------------------------------------------------- Chi phí (cây mã 2 cấp)
async function ChiPhi({
  maCongTrinh,
  danhMuc,
  base,
  an0,
}: {
  maCongTrinh: string;
  danhMuc: Awaited<ReturnType<typeof layDanhMucMa>>;
  base: string;
  /** Ẩn mã có thực hiện = 0. Mặc định hiện đủ mọi mã chi phí. */
  an0: boolean;
}) {
  const ds = await layGiaoDich({ maCongTrinh, loai: "Chi phí" });
  const theoMa = new Map<string, number>();
  for (const g of ds) {
    if (!g.maDTCP) continue;
    theoMa.set(g.maDTCP, (theoMa.get(g.maDTCP) ?? 0) + g.soTien);
  }

  const khth = new Map((await keHoachVsThucHien(maCongTrinh)).map((r) => [r.ma, r]));
  const tongCP = [...theoMa.values()].reduce((a, b) => a + b, 0);

  // Dựng cây 2 cấp. Mặc định hiện MỌI mã chi phí; khi an0 thì chỉ giữ mã có phát sinh.
  const cha = danhMuc.filter((c) => c.loai === "Chi phí" && !c.maCha);
  const hangs: { ma: MaHang; capCon: boolean }[] = [];
  type MaHang = (typeof danhMuc)[number];

  for (const p of cha) {
    const conTatCa = danhMuc.filter((c) => c.maCha === p.ma);
    const con = an0 ? conTatCa.filter((c) => theoMa.has(c.ma)) : conTatCa;
    const tuThan = theoMa.has(p.ma);
    // Khi lọc = 0: bỏ nhóm không còn mã con phát sinh và bản thân cũng bằng 0.
    if (an0 && !con.length && !tuThan) continue;
    hangs.push({ ma: p, capCon: false });
    for (const c of con) hangs.push({ ma: c, capCon: true });
  }

  const soAn = danhMuc.filter((c) => c.loai === "Chi phí" && !theoMa.has(c.ma)).length;

  const tongCua = (m: MaHang): number => {
    const con = danhMuc.filter((c) => c.maCha === m.ma);
    if (con.length) return con.reduce((a, c) => a + (theoMa.get(c.ma) ?? 0), 0);
    return theoMa.get(m.ma) ?? 0;
  };

  return (
    <The>
      <TheDau
        tieuDe="Chi phí theo cây mã"
        moTa="Mã nhóm in đậm, mã chi tiết thụt vào. Bấm số tiền để xem các giao dịch cấu thành."
        phai={
          <div className="flex gap-1.5">
            <LocLink href={`${base}?tab=chi-phi`} dangChon={!an0}>
              Hiện đủ
            </LocLink>
            <LocLink href={`${base}?tab=chi-phi&an0=1`} dangChon={an0}>
              Ẩn mã = 0{soAn ? ` (${soAn})` : ""}
            </LocLink>
          </div>
        }
      />
      <Bang>
        <thead>
          <tr>
            <Th>Mã</Th>
            <Th>Hạng mục</Th>
            <Th phai>Kế hoạch</Th>
            <Th phai>Thực hiện</Th>
            <Th phai>Chênh lệch</Th>
            <Th>% ngân sách</Th>
            <Th phai>% trên tổng CP</Th>
          </tr>
        </thead>
        <tbody>
          {hangs.map(({ ma, capCon }) => {
            const th = tongCua(ma);
            const kh = khth.get(ma.ma)?.keHoach ?? 0;
            const cl = kh - th;
            return (
              <tr key={ma.ma} className={capCon ? "hover:bg-nen" : "bg-nen/60 hover:bg-nen"}>
                <Td className={`text-xs ${capCon ? "pl-8" : "font-semibold"}`}>{ma.ma}</Td>
                <Td className={`text-xs ${capCon ? "" : "font-semibold"}`}>{ma.ten}</Td>
                <Td phai>{kh ? tien(kh) : <span className="text-chunhat">—</span>}</Td>
                <Td phai>
                  {capCon && th ? (
                    <Link
                      href={`${base}?tab=giao-dich&ma=${encodeURIComponent(ma.ma)}`}
                      className="text-nhan hover:underline"
                    >
                      {tien(th)}
                    </Link>
                  ) : (
                    tien(th)
                  )}
                </Td>
                <Td phai>
                  <O_So am={cl < 0}>{kh ? tien(cl) : "—"}</O_So>
                </Td>
                <Td>{kh ? <ThanhTyLe tyLe={th / kh} /> : <span className="text-chunhat">—</span>}</Td>
                <Td phai className="text-xs">
                  {tongCP ? phanTram(th / tongCP) : "—"}
                </Td>
              </tr>
            );
          })}
          <tr className="bg-nen font-semibold">
            <Td colSpan={3}>TỔNG CHI PHÍ</Td>
            <Td phai>{tien(tongCP)}</Td>
            <Td colSpan={3} />
          </tr>
        </tbody>
      </Bang>
      <GhiChuNguon>
        Kế hoạch lấy từ sheet KẾ HOẠCH TH (hệ mã cũ DA*) sau khi qua bảng ánh xạ. Mã kế hoạch chưa
        ánh xạ được sẽ hiển thị “—” chứ không bị gộp ngầm vào mã khác.
      </GhiChuNguon>
    </The>
  );
}

// ---------------------------------------------------------------- Giao dịch
async function GiaoDichTab({
  maCongTrinh,
  daHoanThanh,
}: {
  maCongTrinh: string;
  daHoanThanh: boolean;
}) {
  const u = await nguoiDungHienTai();
  const duocNhap = coQuyen(u, "nhap_du_lieu") && !daHoanThanh;
  // Mã được ghi trực tiếp cho ô chọn Mã DT–CP của bảng nhập (bỏ mã nhóm).
  const dsMaNhap = duocNhap
    ? (await layDanhMucMa())
        .filter((c) => c.choPhepNhapTrucTiep)
        .map((c) => ({ ma: c.ma, ten: c.ten, loai: c.loai }))
    : [];

  const ds = await layGiaoDich({ maCongTrinh });
  const giaoDich = [...ds]
    .sort((a, b) => (a.ngayChungTu ?? "").localeCompare(b.ngayChungTu ?? ""))
    .map((g) => ({
      id: g.id,
      maBase: g.maBase,
      soHoaDon: g.soHoaDon,
      ngayChungTu: g.ngayChungTu,
      noiDung: g.noiDungThanhToan,
      dvt: g.dvt,
      donGia: g.donGia,
      soLuong: g.soLuong,
      soTien: g.soTien,
      maDTCP: g.maDTCP ?? "",
      ghiChu: g.ghiChu,
    }));

  return (
    <The>
      <TheDau
        tieuDe="Giao dịch"
        moTa="Bảng nhập giao dịch (doanh thu – chi phí) như Excel — nguồn số liệu cho tab Doanh thu và Chi phí."
      />
      <BangGiaoDich
        maCongTrinh={maCongTrinh}
        dsMa={dsMaNhap}
        giaoDich={giaoDich}
        duocNhap={duocNhap}
      />
    </The>
  );
}

// ---------------------------------------------------------------- Báo cáo
/**
 * Ma trận mã × kỳ của riêng công trình này — chính là "Ma trận tổng hợp" cũ ở
 * trang Báo cáo, bỏ bộ lọc công trình vì trang này đã cố định một công trình.
 */
async function BaoCaoTab({
  maCongTrinh,
  loai: loaiTho,
  ky: kyTho,
  q,
}: {
  maCongTrinh: string;
  loai?: string;
  ky?: string;
  q: (o: Record<string, string | undefined>) => string;
}) {
  const loai = (LOAI_KY.find((l) => l.id === loaiTho)?.id ?? "thang") as KyBaoCao;
  const { cot, hangs } = await maTranTheoCongTrinh(maCongTrinh, loai);
  const ky = cot.includes(kyTho ?? "") ? kyTho! : undefined;

  // Ẩn kỳ không có phát sinh; chọn một thời điểm cụ thể thì chỉ giữ cột đó.
  const chiSo = cot
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => hangs.some((h) => h.giaTri[i] !== 0) && (!ky || c === ky));

  const tongCot = chiSo.map(({ i }) => hangs.reduce((a, h) => a + h.giaTri[i], 0));
  const tongChung = hangs.reduce((a, h) => a + h.tong, 0);

  return (
    <>
      <div className="mb-4 divide-y divide-vien rounded-xl border border-vien bg-the px-3 py-0.5">
        <div className="flex items-start gap-2 py-1.5">
          <span className="w-[76px] shrink-0 pt-1 text-xs font-medium text-chunhat">Kỳ</span>
          <div className="flex flex-wrap gap-1">
            {LOAI_KY.map((l) => (
              <LocLink key={l.id} href={q({ tab: "bao-cao", loai: l.id })} dangChon={loai === l.id}>
                {l.nhan}
              </LocLink>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2 py-1.5">
          <span className="w-[76px] shrink-0 pt-1 text-xs font-medium text-chunhat">Thời điểm</span>
          <div className="flex max-h-[4.75rem] flex-wrap gap-1 overflow-y-auto">
            <LocLink href={q({ tab: "bao-cao", loai })} dangChon={!ky}>
              Tất cả
            </LocLink>
            {cot.map((c) => (
              <LocLink key={c} href={q({ tab: "bao-cao", loai, ky: c })} dangChon={ky === c}>
                {nhanKyBaoCao(loai, c)}
              </LocLink>
            ))}
          </div>
        </div>
      </div>

      <The>
        <TheDau
          tieuDe={ky ? nhanKyBaoCao(loai, ky) : `Toàn bộ kỳ theo ${LOAI_KY.find((l) => l.id === loai)!.nhan.toLowerCase().replace("theo ", "")}`}
          moTa={`${hangs.length} mã · tổng lũy kế ${tien(tongChung)} đ`}
        />
        <Bang>
          <thead>
            <tr>
              <Th className="sticky left-0 z-20 min-w-[90px]">Mã</Th>
              <Th className="sticky left-[90px] z-20 min-w-[220px]">Nội dung</Th>
              <Th phai className="min-w-[130px] bg-nen">
                Tổng
              </Th>
              {chiSo.map(({ c }) => (
                <Th key={c} phai className="min-w-[120px]">
                  {nhanKyBaoCao(loai, c)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hangs.map((h) => {
              const nhomCha = !h.maCha;
              return (
                <tr key={h.ma} className={nhomCha ? "bg-nen/60 hover:bg-nen" : "hover:bg-nen"}>
                  <Td
                    className={`sticky left-0 z-10 text-xs whitespace-nowrap ${nhomCha ? "bg-nen/60 font-semibold" : "bg-the pl-7"}`}
                  >
                    {h.ma}
                  </Td>
                  <Td
                    className={`sticky left-[90px] z-10 max-w-[220px] truncate text-xs ${nhomCha ? "bg-nen/60 font-semibold" : "bg-the"}`}
                    title={h.ten}
                  >
                    {h.loai === "Doanh thu" ? <span className="text-nhan">{h.ten}</span> : h.ten}
                  </Td>
                  <Td phai className="bg-nen font-semibold">
                    {tien(h.tong)}
                  </Td>
                  {chiSo.map(({ c, i }) => (
                    <Td key={c} phai className={h.giaTri[i] ? "" : "text-chunhat"}>
                      {h.giaTri[i] ? tien(h.giaTri[i]) : "—"}
                    </Td>
                  ))}
                </tr>
              );
            })}
            <tr className="bg-nen font-semibold">
              <Td className="sticky left-0 z-10 bg-nen">TỔNG</Td>
              <Td className="sticky left-[90px] z-10 bg-nen" />
              <Td phai>{tien(tongChung)}</Td>
              {tongCot.map((t, i) => (
                <Td key={i} phai>
                  {tien(t)}
                </Td>
              ))}
            </tr>
          </tbody>
        </Bang>
      </The>

      <GhiChuNguon>
        Liệt kê đầy đủ danh mục mã theo cây 2 cấp (mã nhóm in đậm, mã chi tiết thụt vào); dòng toàn
        dấu “—” là mã chưa phát sinh. Phần doanh thu chỉ hiện mã <strong>Bill</strong> — TƯ, TT, QT
        là dòng tiền thu theo hợp đồng nên không đặt chung bảng với chi phí thực hiện. Cột{" "}
        <strong>Tổng</strong> luôn là lũy kế mọi kỳ, không đổi theo bộ lọc Thời điểm.
      </GhiChuNguon>
    </>
  );
}

// ---------------------------------------------------------------- EVM
/** Thanh ngang thuần CSS — không cần thư viện biểu đồ cho một dãy giá trị. */
function ThanhNgang({ tyLe, mau }: { tyLe: number; mau: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-nen">
      <div
        className={`h-full rounded-full ${mau}`}
        style={{ width: `${Math.min(100, tyLe * 100)}%` }}
      />
    </div>
  );
}

async function EVMTab({ maCongTrinh }: { maCongTrinh: string }) {
  const d = (await chiSoEVM()).find((r) => r.maCongTrinh === maCongTrinh);

  if (!d) {
    return (
      <The>
        <TheDau tieuDe="EVM chi phí" />
        <Rong>
          Công trình chưa nhập BOQ. EVM cần % hoàn thành vật lý, mà số đó chỉ đến từ bảng khối lượng
          — nhập BOQ ở mục <strong>BOQ</strong> rồi quay lại.
        </Rong>
      </The>
    );
  }

  /*
   * Bảng dựng theo CHIỀU DỌC (chỉ tiêu × giá trị), khác bản ở trang Báo cáo cũ
   * vốn xếp ngang cho nhiều công trình. Một công trình mà 11 cột một dòng thì
   * phải cuộn ngang mới đọc hết, trong khi dọc là vừa màn hình.
   */
  const dong: { nhan: string; giaTri: string; am?: boolean; ghiChu: string }[] = [
    { nhan: "% hoàn thành vật lý", giaTri: phanTram(d.phanTramHT), ghiChu: "Khối lượng BOQ đã xác nhận / giá trị hợp đồng BOQ" },
    { nhan: "BAC — ngân sách khi hoàn thành", giaTri: tien(d.bac), ghiChu: "Tổng kế hoạch các mã chi phí" },
    { nhan: "EV — giá trị thu được", giaTri: tien(d.ev), ghiChu: "% hoàn thành × BAC" },
    { nhan: "AC — chi phí thực tế", giaTri: tien(d.ac), ghiChu: "Tổng giao dịch các mã chi phí" },
    { nhan: "CV — lệch chi phí", giaTri: tien(d.cv), am: d.cv < 0, ghiChu: "EV − AC, âm là vượt chi" },
    {
      nhan: "CPI — hiệu suất chi phí",
      giaTri: d.cpi === null ? "—" : d.cpi.toFixed(2),
      am: (d.cpi ?? 1) < 1,
      ghiChu: "EV / AC, dưới 1 là mỗi đồng bỏ ra thu về ít hơn một đồng giá trị",
    },
    { nhan: "EAC — dự báo tổng chi", giaTri: tien(d.eac), ghiChu: "BAC / CPI, theo đà hiện tại" },
    { nhan: "ETC — còn phải chi", giaTri: tien(d.etc), ghiChu: "EAC − AC" },
    { nhan: "VAC — dự báo lệch ngân sách", giaTri: tien(d.vac), am: (d.vac ?? 0) < 0, ghiChu: "BAC − EAC, âm là dự báo vượt" },
    {
      nhan: "TCPI — hiệu suất phải đạt",
      giaTri: d.tcpi === null ? "—" : d.tcpi.toFixed(2),
      ghiChu:
        d.tcpi === null
          ? "Không tính được: chi phí thực tế đã vượt ngân sách, không còn mức hiệu suất nào cứu được"
          : "(BAC − EV) / (BAC − AC) cho phần việc còn lại; trên 1 là phải làm tốt hơn từ giờ",
    },
  ];

  const tyEAC = d.eac && d.bac ? d.eac / d.bac : 0;

  return (
    <>
      <The>
        <TheDau
          tieuDe="Chỉ số EVM"
          moTa="EV tính theo % hoàn thành vật lý từ BOQ, không suy từ tiền đã tiêu — suy từ tiền thì CPI luôn bằng 1"
        />
        <Bang>
          <thead>
            <tr>
              <Th className="min-w-[220px]">Chỉ tiêu</Th>
              <Th phai className="min-w-[150px]">
                Giá trị
              </Th>
              <Th>Cách tính</Th>
            </tr>
          </thead>
          <tbody>
            {dong.map((r) => (
              <tr key={r.nhan} className="hover:bg-nen">
                <Td className="text-xs font-medium">{r.nhan}</Td>
                <Td phai className="font-semibold">
                  <O_So am={r.am}>{r.giaTri}</O_So>
                </Td>
                <Td className="text-xs text-chunhat">{r.ghiChu}</Td>
              </tr>
            ))}
          </tbody>
        </Bang>
      </The>

      <The className="mt-4">
        <TheDau
          tieuDe="Dự báo khi hoàn thành (EAC) so với ngân sách (BAC)"
          moTa="Thanh vượt quá vạch ngân sách là phần dự báo chi vượt"
        />
        <Bang>
          <thead>
            <tr>
              <Th phai>BAC</Th>
              <Th phai>EAC</Th>
              <Th className="min-w-[200px]">EAC / BAC</Th>
              <Th phai>Vượt</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td phai>{tien(d.bac)}</Td>
              <Td phai>{tien(d.eac)}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <ThanhNgang
                    tyLe={tyEAC / 1.5}
                    mau={tyEAC > 1 ? "bg-rose-500" : "bg-emerald-600"}
                  />
                  <span className="w-12 shrink-0 text-right text-xs">{phanTram(tyEAC, 0)}</span>
                </div>
              </Td>
              <Td phai>
                <O_So am={(d.vac ?? 0) < 0}>{tien(-(d.vac ?? 0))}</O_So>
              </Td>
            </tr>
          </tbody>
        </Bang>
        <GhiChuNguon>
          Vạch ngân sách nằm ở mốc 100%; thanh vẽ theo thang 150% nên thanh đầy nghĩa là dự báo chi
          gấp rưỡi ngân sách trở lên.
        </GhiChuNguon>
      </The>
    </>
  );
}

// ---------------------------------------------------------------- Lịch sử nhập
async function LichSu({ maCongTrinh }: { maCongTrinh: string }) {
  const los = (await layLoNhap())
    .filter((l) => l.maCongTrinh === maCongTrinh)
    .sort((a, b) => b.thoiDiemTai.localeCompare(a.thoiDiemTai));
  const cho = (await layGiaoDichChoXuLy()).filter((g) => g.maCongTrinh === maCongTrinh);

  return (
    <>
      {cho.length ? (
        <div className="mb-4">
          <CanhBaoBox bienThe="vang" tieuDe={`${cho.length} dòng đang chờ xử lý, chưa được ghi sổ`}>
            Các dòng này có lỗi dữ liệu nên không được cộng vào báo cáo. Xem chi tiết ở trang{" "}
            <Link href="/kiem-tra-du-lieu" className="font-medium text-nhan underline">
              Kiểm tra dữ liệu
            </Link>
            .
          </CanhBaoBox>
        </div>
      ) : null}

      <The>
        <TheDau tieuDe="Lịch sử nhập và phê duyệt" moTa="Mỗi lô nhập tương ứng một lần nộp file" />
        <Bang>
          <thead>
            <tr>
              <Th>Kỳ</Th>
              <Th>Tên file</Th>
              <Th>Người tải</Th>
              <Th>Thời điểm tải</Th>
              <Th phai>Số dòng</Th>
              <Th phai>Hợp lệ</Th>
              <Th phai>Lỗi</Th>
              <Th>Trạng thái</Th>
              <Th>Người duyệt</Th>
            </tr>
          </thead>
          <tbody>
            {los.map((l) => (
              <tr key={l.id} className="hover:bg-nen">
                <Td className="whitespace-nowrap">{nhanThang(l.kyDuLieu)}</Td>
                <Td className="max-w-[320px] truncate text-xs" title={l.tenFile}>
                  {l.tenFile}
                </Td>
                <Td className="text-xs whitespace-nowrap">{l.nguoiTai}</Td>
                <Td className="text-xs whitespace-nowrap">{l.thoiDiemTai.replace("T", " ")}</Td>
                <Td phai>{l.soDong}</Td>
                <Td phai>{l.soDongHopLe}</Td>
                <Td phai>
                  {l.soDongLoi ? <Nhan bienThe="do">{l.soDongLoi}</Nhan> : "0"}
                </Td>
                <Td>
                  <Nhan bienThe={l.trangThai === "POSTED" ? "xanh" : "do"}>{l.trangThai}</Nhan>
                </Td>
                <Td className="text-xs">{l.nguoiDuyet ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Bang>
      </The>
    </>
  );
}
