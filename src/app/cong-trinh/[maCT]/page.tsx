import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TheKPI } from "@/components/kpi-card";
import { CanhBaoNut } from "@/components/canh-bao-nut";
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
  dongTienTheoThang,
  giaTriBillThang,
  giaTriMotGiamGia,
  maTranTheoCongTrinh,
  timCongTrinh,
  type KyBaoCao,
  type ThongTinVATBOQ,
} from "@/lib/data/repository";
import { type MaThanhPhan, TEN_THANH_PHAN, THANH_PHAN_THEO_KIEU } from "@/lib/boq-thanh-phan";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { coQuyen } from "@/lib/auth/quyen";
import { motGiaTri } from "@/lib/search-params";
import { NGAY_HIEN_TAI } from "@/lib/thresholds";
import { GiamGiaBOQ, HopThoaiBill, ImportBOQ, LuoiNhapBOQ, NutThemBill, SuaBOQ, ThietLapVAT } from "@/components/nhap-boq";
import { BangGiaoDich } from "@/components/nhap-giao-dich";
import { KhoiDongTien } from "@/components/khoi-dong-tien";
import { NutThemCot, NutThemDong } from "@/components/cot-boq";
import { QuanLyBOQ } from "@/components/quan-ly-boq";
import { ThongTinCongTrinh } from "@/components/thong-tin-cong-trinh";

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
  { id: "dong-tien", nhan: "Dòng tiền" },
  { id: "bao-cao", nhan: "Báo cáo" },
  { id: "evm", nhan: "EVM" },
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
        moTaRong
        tieuDe={ct.tenRutGon || maCongTrinh}
        moTa={
          // Nén thông tin công trình vào nút "Thông tin" bật/tắt (hộp nổi, không đẩy
          // trang) để vùng xem BOQ rộng hơn. Mã đặt trước, rồi tới nút.
          <ThongTinCongTrinh
            ma={maCongTrinh}
            hienMa={!!ct.tenRutGon}
            tenCongTrinh={ct.tenCongTrinh}
            diaDiem={ct.diaDiem ?? undefined}
            chuDauTu={ct.chuDauTu ?? undefined}
            chiHuyTruong={ct.chiHuyTruong ?? undefined}
            ngayKhoiCong={ngay(ct.ngayBatDau)}
          />
        }
        phai={
          <>
            <Nhan>{ct.trangThai}</Nhan>
            {dong.lyDo.length ? (
              <CanhBaoNut mucDo={dong.sucKhoe} lyDo={dong.lyDo} />
            ) : (
              <NhanSucKhoe sucKhoe={dong.sucKhoe} lyDo={dong.lyDo} />
            )}
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

      {/* Các tab (trừ Báo cáo — tab đó tự khóa tới dòng "Mã") đưa nội dung vào
          hộp cuộn vừa khung nhìn: trang không cuộn nên back-link + tiêu đề + tab
          đứng yên, chỉ nội dung tab cuộn. */}
      <div
        className={
          tab === "bao-cao"
            ? undefined
            : "-mx-4 max-h-[calc(100vh-21rem)] overflow-y-auto px-4 pt-1"
        }
      >
        {tab === "tong-quan" ? (
          <TongQuan dong={dong} chuoi={chuoiVongDoi} base={base} />
        ) : tab === "boq" ? (
          <BOQTab
            maCongTrinh={maCongTrinh}
            thangChon={bqParam}
            daHoanThanh={ct.trangThai === "Đã nghiệm thu"}
          />
        ) : tab === "doanh-thu" ? (
          // Bill theo tháng liệt kê từ THÁNG KHỞI CÔNG của công trình (vòng đời),
          // không dùng dải tháng chung toàn app.
          <DoanhThu maCongTrinh={maCongTrinh} chuoi={chuoiVongDoi} />
        ) : tab === "chi-phi" ? (
          <ChiPhi maCongTrinh={maCongTrinh} danhMuc={danhMuc} base={base} an0={an0Param === "1"} />
        ) : tab === "giao-dich" ? (
          <GiaoDichTab maCongTrinh={maCongTrinh} daHoanThanh={ct.trangThai === "Đã nghiệm thu"} />
        ) : tab === "dong-tien" ? (
          <DongTienTab maCongTrinh={maCongTrinh} />
        ) : tab === "bao-cao" ? (
          <BaoCaoTab maCongTrinh={maCongTrinh} loai={loaiParam} ky={kyParam} q={q} />
        ) : (
          <EVMTab maCongTrinh={maCongTrinh} />
        )}
      </div>
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
        <TheKPI
          nhan="Giá trị thực hiện lũy kế"
          giaTri={dong.doanhThu}
          phuChu="Bill nội bộ (BOQ)"
          chiDan="Lũy kế giá trị thực hiện (Bill nội bộ tính từ khối lượng BOQ đã xác nhận). Đây là giá trị thực hiện, chưa phải doanh thu nghiệm thu thanh toán."
        />
        <TheKPI
          nhan="Chi phí lũy kế"
          giaTri={dong.chiPhi}
          phuChu="Tổng các mã chi phí"
          chiDan="Tổng các giao dịch thuộc mã Chi phí đã ghi sổ cho công trình này (lũy kế toàn kỳ)."
        />
        <TheKPI
          nhan="Lợi nhuận gộp"
          giaTri={dong.loiNhuan}
          phuChu="Doanh thu − Chi phí"
          chiDan="Lợi nhuận gộp = Giá trị thực hiện lũy kế − Chi phí lũy kế. Số âm (đỏ) nghĩa là chi phí đang vượt giá trị thực hiện."
        />
        <TheKPI
          nhan="Biên lợi nhuận"
          giaTri={dong.bienLN}
          dinhDang="phanTram"
          phuChu={`Mục tiêu ${phanTram(dong.congTrinh.bienLNMucTieu, 0)}`}
          chiDan={`Biên lợi nhuận = Lợi nhuận gộp / Giá trị thực hiện. Mục tiêu của công trình: ${phanTram(dong.congTrinh.bienLNMucTieu, 0)}.`}
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
  const {
    thangs,
    dongs,
    cots,
    donGiaGomVAT,
    vatPhanTram,
    lamTronThanhTien,
    giamGia,
    vatInfo,
    vatTPRaw,
    hienTongCong,
  } = await layBOQ(maCongTrinh);
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
            <>
              <p className="mb-2 text-xs text-chunhat">
                Nếu đơn giá tách thành phần (Vật tư / Nhân công / Máy…), hãy chọn kiểu ở{" "}
                <strong>Thiết lập BOQ</strong> TRƯỚC khi nhập.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ThietLapVAT
                  maCongTrinh={maCongTrinh}
                  donGiaGomVAT={donGiaGomVAT}
                  vatPhanTram={vatPhanTram}
                  lamTronThanhTien={lamTronThanhTien}
                  kieu={vatInfo.kieu}
                  vatTPRaw={vatTPRaw}
                  hienTongCong={hienTongCong}
                />
                <LuoiNhapBOQ maCongTrinh={maCongTrinh} nhan="Tạo BOQ — nhập bảng khối lượng" noiBat kieu={vatInfo.kieu} />
                <ImportBOQ maCongTrinh={maCongTrinh} kieu={vatInfo.kieu} />
              </div>
            </>
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
    (a, t) => a + giaTriBillThang(dongs, t.thang, vatInfo, giamGia, lamTronThanhTien),
    0
  );
  const billKy = ky ? giaTriBillThang(dongs, ky.thang, vatInfo, giamGia, lamTronThanhTien) : 0;
  const soXong = dongs.filter((d) => d.hoanThanh).length;
  // Tất cả công tác tích "Xong" = tiến độ thực hiện 100% (theo yêu cầu nghiệp vụ),
  // bất kể lũy kế giá trị. Ngược lại tính theo lũy kế / hợp đồng như cũ.
  const tatCaXong = dongs.length > 0 && soXong === dongs.length;

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
          chiDan={
            <>
              Tổng thành tiền theo bảng khối lượng (BOQ) của hợp đồng.{" "}
              {donGiaGomVAT
                ? `Đơn giá ĐÃ bao gồm VAT ${vatPhanTram}%.`
                : "Đơn giá CHƯA bao gồm VAT."}{" "}
              {giamGia.length
                ? `Đã trừ ${giamGia.length} khoản giảm giá.`
                : "Không có khoản giảm giá."}
            </>
          }
        />
        <TheKPI
          nhan="Lũy kế Bill"
          giaTri={ttXacNhan}
          phuChu="Giá trị Bill mọi kỳ"
          chiDan={`Tổng giá trị thực hiện (Bill) đã xác nhận qua tất cả các kỳ. ${donGiaGomVAT ? `Đã quy về CHƯA VAT (chia 1+${vatPhanTram}%).` : "Theo đơn giá chưa VAT."}`}
        />
        <TheKPI
          nhan={ky ? `Bill ${nhanThang(ky.thang)}` : "Bill tháng"}
          giaTri={billKy}
          phuChu="Giá trị Bill kỳ này"
          chiDan="Giá trị thực hiện (Bill) của riêng kỳ đang chọn — tổng khối lượng thực hiện trong tháng nhân đơn giá, trừ giảm giá của kỳ."
        />
        <TheKPI
          nhan="Tiến độ thực hiện"
          giaTri={tatCaXong ? 1 : ttHopDong ? ttLuyKe / ttHopDong : null}
          dinhDang="phanTram"
          phuChu={tatCaXong ? "Tất cả công tác đã xong" : "Lũy kế / Hợp đồng"}
          chiDan="Tỷ lệ hoàn thành = Lũy kế giá trị thực hiện / Giá trị hợp đồng (BOQ). Nếu mọi công tác đã tích Xong thì tính tròn 100%."
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
          <QuanLyBOQ>
            <NutThemDong
              maCongTrinh={maCongTrinh}
              kieu={vatInfo.kieu}
              dongs={dongs.map((d) => ({ id: d.id, stt: d.stt, noiDung: d.noiDung }))}
            />
            <SuaBOQ
              maCongTrinh={maCongTrinh}
              kieu={vatInfo.kieu}
              dongs={dongs.map((d) => ({
                id: d.id,
                stt: d.stt,
                noiDung: d.noiDung,
                dvt: d.dvt,
                khoiLuong: d.klHopDong,
                donGia: d.donGia,
                donGiaTP: d.donGiaTP,
              }))}
            />
            <LuoiNhapBOQ maCongTrinh={maCongTrinh} kieu={vatInfo.kieu} />
            <ImportBOQ maCongTrinh={maCongTrinh} daCoBOQ kieu={vatInfo.kieu} />
            <NutThemCot maCongTrinh={maCongTrinh} />
            <ThietLapVAT
              maCongTrinh={maCongTrinh}
              donGiaGomVAT={donGiaGomVAT}
              vatPhanTram={vatPhanTram}
              lamTronThanhTien={lamTronThanhTien}
              kieu={vatInfo.kieu}
              vatTPRaw={vatTPRaw}
              hienTongCong={hienTongCong}
            />
            <GiamGiaBOQ maCongTrinh={maCongTrinh} danhSach={giamGiaTinh} soDong={dongs.length} />
          </QuanLyBOQ>
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
            vatInfo={vatInfo}
            lamTron={lamTronThanhTien}
            hienTong={hienTongCong}
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
          donGiaGomVAT={donGiaGomVAT}
          vatPhanTram={vatPhanTram}
          kieu={vatInfo.kieu}
          vatTP={vatInfo.vatTP}
          cots={cots.map((c) => ({ id: c.id, ten: c.ten }))}
          dongs={dongs.map((d) => ({
            id: d.id,
            stt: d.stt,
            noiDung: d.noiDung,
            dvt: d.dvt,
            donGia: d.donGia,
            donGiaTP: d.donGiaTP,
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
  vatInfo,
  lamTron,
  hienTong,
  giamGia,
}: {
  dongs: {
    id: string;
    stt: string;
    noiDung: string;
    dvt: string;
    klHopDong: number;
    donGia: number;
    donGiaTP: Partial<Record<MaThanhPhan, number>>;
    ttHopDong: number;
    hoanThanh: boolean;
  }[];
  tong: number;
  vatInfo: ThongTinVATBOQ;
  lamTron: boolean;
  /** Kiểu tách: có hiện cột đơn giá/thành tiền tổng cộng không. */
  hienTong: boolean;
  giamGia: { id: string; moTa: string; tuStt: number; denStt: number; phanTram: number; giaTri: number }[];
}) {
  const oS = "border border-vien px-2 py-1 text-xs whitespace-nowrap";
  const oT = "border border-vien bg-nen px-2 py-1.5 text-xs font-semibold whitespace-nowrap";

  const { donGiaGomVAT, vatPhanTram, kieu, vatTP } = vatInfo;
  const tps = THANH_PHAN_THEO_KIEU[kieu];
  const tach = tps.length > 0;
  // Cột "tổng cộng" chỉ có khi tách VÀ người dùng chọn hiện.
  const coCotTong = tach && hienTong;
  const tt = (kl: number, dg: number) => (lamTron ? Math.round(kl * dg) : kl * dg);

  // Số cột đơn giá + thành tiền: kiểu tách = số thành phần (+1 nếu hiện cột tổng cộng).
  const soCotDG = tach ? tps.length + (coCotTong ? 1 : 0) : 1;
  const soCotTT = tach ? tps.length + (coCotTong ? 1 : 0) : 1;
  // Cột trước khối thành tiền (để colSpan cho dòng TỔNG): ID+STT+Nội dung+ĐVT+KL + các cột đơn giá.
  const truocTT = 5 + soCotDG;
  const tongCot = 5 + soCotDG + soCotTT; // toàn bộ cột, cho dòng gộp một ô.

  // Tổng thành tiền từng thành phần (cho dòng TỔNG CỘNG) + gồm/chưa VAT của cả bảng.
  const tongTPtt: Record<string, number> = {};
  let gomVAT = 0; // giá trị "đã gồm VAT" của toàn bảng
  let chuaVAT = 0; // giá trị "chưa VAT" của toàn bảng
  for (const d of dongs) {
    if (tach) {
      for (const tp of tps) {
        const g = tt(d.klHopDong, d.donGiaTP[tp] ?? 0);
        tongTPtt[tp] = (tongTPtt[tp] ?? 0) + g;
        const vtp = (vatTP[tp] || 0) / 100;
        gomVAT += donGiaGomVAT ? g : g * (1 + vtp);
        chuaVAT += donGiaGomVAT ? g / (1 + vtp) : g;
      }
    } else {
      const g = d.ttHopDong;
      const vv = (vatPhanTram || 0) / 100;
      gomVAT += donGiaGomVAT ? g : g * (1 + vv);
      chuaVAT += donGiaGomVAT ? g / (1 + vv) : g;
    }
  }

  // Chiết khấu trừ trên TỔNG CỘNG (gộp) → TỔNG SAU GIẢM; quy gồm/chưa VAT theo tỷ lệ.
  const coGiam = giamGia.length > 0;
  const giam = giamGia.reduce((a, g) => a + g.giaTri, 0);
  const tongSauGiam = tong - giam;
  const tyLe = tong ? tongSauGiam / tong : 1;
  const coVAT = donGiaGomVAT ? chuaVAT < gomVAT : gomVAT > chuaVAT;
  // Dòng chính hiển thị theo đúng cách đơn giá đang lưu; dòng phụ là cách còn lại.
  const chinhSauGiam = tongSauGiam;
  const phuSauGiam = Math.round((donGiaGomVAT ? chuaVAT : gomVAT) * tyLe);
  const tenGoc = coGiam ? "TỔNG SAU GIẢM" : "TỔNG";
  const nhanChinh = donGiaGomVAT ? `${tenGoc} (bao gồm VAT)` : `${tenGoc} (chưa VAT)`;
  const nhanPhu = donGiaGomVAT ? `${tenGoc} (chưa VAT)` : `${tenGoc} (bao gồm VAT)`;

  // Kiểu tách + đơn giá CHƯA VAT: cụm tổng cộng tách theo từng thành phần
  // (trước VAT → thuế → sau thuế) rồi một ô gộp "TỔNG THÀNH TIỀN TRƯỚC VAT".
  // Số liệu từng thành phần lấy sau giảm giá (nhân tỷ lệ) để cộng khớp tổng.
  const preTP: Record<string, number> = {};
  const thueTP: Record<string, number> = {};
  const sauThueTP: Record<string, number> = {};
  let grandPre = 0;
  let grandThue = 0;
  for (const tp of tps) {
    const pre = Math.round((tongTPtt[tp] ?? 0) * tyLe);
    const thue = Math.round((pre * (vatTP[tp] || 0)) / 100);
    preTP[tp] = pre;
    thueTP[tp] = thue;
    sauThueTP[tp] = pre + thue;
    grandPre += pre;
    grandThue += thue;
  }
  const grandSauThue = grandPre + grandThue;
  const cacMucVAT = new Set(tps.map((tp) => vatTP[tp] || 0));
  const nhanThue =
    cacMucVAT.size === 1 ? `THUẾ VAT ${[...cacMucVAT][0]}%` : "THUẾ VAT (theo thành phần)";
  // Cụm tách theo thành phần chỉ dùng khi tách + chưa VAT + thực sự có thuế.
  const cumTachTP = tach && !donGiaGomVAT && grandThue > 0;

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
            {tach ? (
              <>
                {tps.map((tp) => (
                  <th key={`dg-${tp}`} className={`${oT} text-right`}>
                    Đơn giá {TEN_THANH_PHAN[tp]}
                  </th>
                ))}
                {coCotTong ? <th className={`${oT} text-right`}>Đơn giá tổng cộng</th> : null}
                {tps.map((tp) => (
                  <th key={`tt-${tp}`} className={`${oT} text-right`}>
                    Thành tiền {TEN_THANH_PHAN[tp]}
                  </th>
                ))}
                {coCotTong ? <th className={`${oT} text-right`}>Thành tiền tổng cộng</th> : null}
              </>
            ) : (
              <>
                <th className={`${oT} text-right`}>Đơn giá</th>
                <th className={`${oT} text-right`}>Thành tiền</th>
              </>
            )}
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
              <td
                className="border border-vien px-2 py-1 text-xs"
                style={{ minWidth: 280 }}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: nội dung BOQ đã lọc còn b/i/u ở server (locDinhDang)
                dangerouslySetInnerHTML={{ __html: d.noiDung }}
              />
              <td className={oS}>{d.dvt}</td>
              <td className={`${oS} so text-right`}>{khoiLuong(d.klHopDong)}</td>
              {tach ? (
                <>
                  {tps.map((tp) => (
                    <td key={`dg-${tp}`} className={`${oS} so text-right`}>
                      {tienLe(d.donGiaTP[tp] ?? 0)}
                    </td>
                  ))}
                  {coCotTong ? (
                    <td className={`${oS} so text-right font-medium`}>{tienLe(d.donGia)}</td>
                  ) : null}
                  {tps.map((tp) => (
                    <td key={`tt-${tp}`} className={`${oS} so text-right`}>
                      {tienLe(tt(d.klHopDong, d.donGiaTP[tp] ?? 0))}
                    </td>
                  ))}
                  {coCotTong ? (
                    <td className={`${oS} so text-right font-medium`}>{tienLe(d.ttHopDong)}</td>
                  ) : null}
                </>
              ) : (
                <>
                  <td className={`${oS} so text-right`}>{tienLe(d.donGia)}</td>
                  <td className={`${oS} so text-right`}>{tienLe(d.ttHopDong)}</td>
                </>
              )}
            </tr>
          ))}
          {/* Dòng TỔNG CỘNG: kiểu tách hiện tổng thành tiền từng thành phần + tổng chung. */}
          <tr>
            <td className={`${oT} sticky left-0 z-10 text-right`} colSpan={truocTT}>
              TỔNG CỘNG
            </td>
            {tach ? (
              <>
                {tps.map((tp) => (
                  <td key={`sum-${tp}`} className={`${oT} so text-right`}>
                    {tienLe(tongTPtt[tp] ?? 0)}
                  </td>
                ))}
                {coCotTong ? <td className={`${oT} so text-right`}>{tienLe(tong)}</td> : null}
              </>
            ) : (
              <td className={`${oT} so text-right`}>{tienLe(tong)}</td>
            )}
          </tr>
          {giamGia.map((g) => (
            <tr key={g.id}>
              <td className={`${oT} sticky left-0 z-10 text-right font-normal text-chunhat`} colSpan={tongCot - 1}>
                {g.moTa ? `${g.moTa} · ` : ""}Giảm giá {g.phanTram}% (dòng {g.tuStt}–{g.denStt})
              </td>
              <td className={`${oT} so text-right text-rose-600 dark:text-rose-400`}>−{tienLe(g.giaTri)}</td>
            </tr>
          ))}
          {cumTachTP ? (
            <>
              {/* Kiểu tách + đơn giá chưa VAT: thuế + sau thuế theo TỪNG thành phần. */}
              <tr>
                <td className={`${oT} sticky left-0 z-10 text-right`} colSpan={truocTT}>
                  {nhanThue}
                </td>
                {tps.map((tp) => (
                  <td key={`thue-${tp}`} className={`${oT} so text-right`}>
                    {tienLe(thueTP[tp] ?? 0)}
                  </td>
                ))}
                {coCotTong ? <td className={`${oT} so text-right`}>{tienLe(grandThue)}</td> : null}
              </tr>
              <tr>
                <td className={`${oT} sticky left-0 z-10 text-right`} colSpan={truocTT}>
                  TỔNG CỘNG SAU THUẾ
                </td>
                {tps.map((tp) => (
                  <td key={`sauthue-${tp}`} className={`${oT} so text-right`}>
                    {tienLe(sauThueTP[tp] ?? 0)}
                  </td>
                ))}
                {coCotTong ? <td className={`${oT} so text-right`}>{tienLe(grandSauThue)}</td> : null}
              </tr>
              {/* Nhãn gộp một ô rộng, GIÁ TRỊ căn phải thẳng cột với 3 dòng trên. */}
              <tr>
                <td className={`${oT} sticky left-0 z-10 text-right`} colSpan={tongCot - 1}>
                  TỔNG THÀNH TIỀN TRƯỚC VAT
                </td>
                <td className={`${oT} so text-right`}>{tienLe(grandPre)}</td>
              </tr>
            </>
          ) : (
            <>
              {coGiam ? (
                <tr>
                  <td className={`${oT} sticky left-0 z-10 text-right`} colSpan={tongCot - 1}>
                    {nhanChinh}
                  </td>
                  <td className={`${oT} so text-right`}>{tienLe(chinhSauGiam)}</td>
                </tr>
              ) : null}
              {coVAT ? (
                <tr>
                  <td className={`${oT} sticky left-0 z-10 text-right`} colSpan={tongCot - 1}>
                    {nhanPhu}
                    <span className="ml-1 font-normal text-chunhat">
                      · VAT {tach ? "theo từng thành phần" : `${vatPhanTram}%`}
                    </span>
                  </td>
                  <td className={`${oT} so text-right`}>{tienLe(phuSauGiam)}</td>
                </tr>
              ) : null}
            </>
          )}
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
          chiDan="Bill là giá trị khối lượng thực hiện trong tháng (chỉ huy trưởng xác nhận) — xem như doanh thu dự kiến, CHƯA phải dòng tiền. Tạm ứng, Thanh toán đợt và Quyết toán mới là tiền thực thu; hiện chưa ghi nhận trong dữ liệu nguồn."
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
        chiDan="Kế hoạch lấy từ sheet KẾ HOẠCH TH (hệ mã cũ DA*) sau khi qua bảng ánh xạ. Mã kế hoạch chưa ánh xạ được sẽ hiển thị “—” chứ không bị gộp ngầm vào mã khác."
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
  // Mã cho nhập trực tiếp (bỏ mã nhóm): dùng cho ô chọn Mã DT–CP và cột "Nội dung
  // chi phí" (tra tên theo mã) — cần cả ở chế độ xem nên luôn nạp, không chỉ khi sửa.
  const dsMaNhap = (await layDanhMucMa())
    .filter((c) => c.choPhepNhapTrucTiep)
    .map((c) => ({ ma: c.ma, ten: c.ten, loai: c.loai }));

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
        tieuDe="Giao dịch (sổ dòng tiền)"
        moTa="Sổ dòng tiền thu – chi (mã Doanh thu / Chi phí) nhập như Excel — nguồn cho tab Chi phí và Dòng tiền."
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

// ---------------------------------------------------------------- Dòng tiền
async function DongTienTab({ maCongTrinh }: { maCongTrinh: string }) {
  const chuoi = await dongTienTheoThang(maCongTrinh);
  return <KhoiDongTien chuoi={chuoi} />;
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

  // Tách riêng Bill (giá trị thực hiện) và Chi phí: Bill giữ nguyên từng dòng,
  // thêm dòng TỔNG CHI PHÍ gộp mọi mã chi phí (đặt dưới Bill, trên CP-001).
  const hangKhac = hangs.filter((h) => h.loai !== "Chi phí");
  const hangCP = hangs.filter((h) => h.loai === "Chi phí");
  const tongCPCot = chiSo.map(({ i }) => hangCP.reduce((a, h) => a + h.giaTri[i], 0));
  const tongCPChung = hangCP.reduce((a, h) => a + h.tong, 0);

  const veHang = (h: (typeof hangs)[number]) => {
    const nhomCha = !h.maCha;
    return (
      <tr key={h.ma} className={nhomCha ? "bg-nen/60 hover:bg-nen" : "hover:bg-nen"}>
        <Td
          className={`sticky left-0 z-10 text-xs whitespace-nowrap ${nhomCha ? "bg-nen/60 font-semibold" : "bg-the pl-7"}`}
        >
          {h.ma}
        </Td>
        <Td
          className={`sticky left-22.5 z-10 max-w-55 truncate text-xs ${nhomCha ? "bg-nen/60 font-semibold" : "bg-the"}`}
          title={h.ten}
        >
          {h.loai === "Chi phí" ? h.ten : <span className="text-nhan">{h.ten}</span>}
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
  };

  return (
    <>
      <div className="mb-4 divide-y divide-vien rounded-xl border border-vien bg-the px-3 py-0.5">
        <div className="flex items-start gap-2 py-1.5">
          <span className="w-19 shrink-0 pt-1 text-xs font-medium text-chunhat">Kỳ</span>
          <div className="flex flex-wrap gap-1">
            {LOAI_KY.map((l) => (
              <LocLink key={l.id} href={q({ tab: "bao-cao", loai: l.id })} dangChon={loai === l.id}>
                {l.nhan}
              </LocLink>
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2 py-1.5">
          <span className="w-19 shrink-0 pt-1 text-xs font-medium text-chunhat">Thời điểm</span>
          <div className="flex max-h-19 flex-wrap gap-1 overflow-y-auto">
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
          chiDan="Liệt kê đầy đủ danh mục mã theo cây 2 cấp; dòng toàn dấu “—” là mã chưa phát sinh. Dòng Bill là giá trị thực hiện lấy từ BOQ (cùng nguồn tab Doanh thu), không phải tổng giao dịch mã Bill; TƯ, TT, QT là dòng tiền thu theo hợp đồng nên không đặt chung bảng với chi phí thực hiện. Cột Tổng luôn là lũy kế mọi kỳ, không đổi theo bộ lọc Thời điểm."
        />
        <div className="cuon-ngang max-h-[calc(100vh-30rem)]">
          <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th className="sticky left-0 top-0 z-30 min-w-22.5">Mã</Th>
              <Th className="sticky left-22.5 top-0 z-30 min-w-55">Nội dung</Th>
              <Th phai className="min-w-32.5 bg-nen">
                Tổng
              </Th>
              {chiSo.map(({ c }) => (
                <Th key={c} phai className="min-w-30">
                  {nhanKyBaoCao(loai, c)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hangKhac.map(veHang)}
            <tr className="bg-nen font-semibold">
              <Td className="sticky left-0 z-10 bg-nen" />
              <Td className="sticky left-22.5 z-10 bg-nen text-xs whitespace-nowrap">
                TỔNG CHI PHÍ
              </Td>
              <Td phai>{tien(tongCPChung)}</Td>
              {tongCPCot.map((t, i) => (
                <Td key={i} phai>
                  {tien(t)}
                </Td>
              ))}
            </tr>
            {hangCP.map(veHang)}
          </tbody>
          </table>
        </div>
      </The>
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
              <Th className="min-w-55">Chỉ tiêu</Th>
              <Th phai className="min-w-37.5">
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
          chiDan="Vạch ngân sách nằm ở mốc 100%; thanh vẽ theo thang 150% nên thanh đầy nghĩa là dự báo chi gấp rưỡi ngân sách trở lên."
        />
        <Bang>
          <thead>
            <tr>
              <Th phai>BAC</Th>
              <Th phai>EAC</Th>
              <Th className="min-w-50">EAC / BAC</Th>
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
      </The>
    </>
  );
}

