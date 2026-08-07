import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { BieuDoCoCau, BieuDoEVM, BieuDoXuHuong } from "@/components/charts";
import { TheKPI } from "@/components/kpi-card";
import { ChonNavi } from "@/components/chon-navi";
import {
  Bang,
  CanhBaoBox,
  DauTrang,
  LocLink,
  Nhan,
  NhanCongTrinh,
  NhanSucKhoe,
  O_So,
  Td,
  The,
  TheDau,
  Th,
  ThanhTyLe,
} from "@/components/ui";
import { khoaQuy, nhanNam, nhanQuy, nhanThang, phanTram, tien, tienGon } from "@/lib/format";
import {
  chiSoEVM,
  chuoiEVM,
  chuoiTheoQuy,
  chuoiTheoThang,
  coCauChiPhiTheoNhom,
  danhMucSucKhoe,
  demSucKhoe,
  diemChatLuong,
  layCanhBao,
  maTranTheoCongTrinh,
  maTranTongHop,
  thangMoiNhat,
  tinhTrangNopDuLieu,
  tongQuanCongTy,
  topLoiNhuan,
  topRuiRo,
} from "@/lib/data/repository";
import { motGiaTri } from "@/lib/search-params";
import { MA_DOANH_THU_DIEU_HANH } from "@/lib/thresholds";

/** Nhãn kỳ dùng chung cho tab Tổng kết phân tích chi phí. */
const nhanKyBC = (ky: "thang" | "quy" | "nam", c: string) =>
  ky === "quy" ? nhanQuy(c) : ky === "nam" ? nhanNam(c) : nhanThang(c);

const KY_BC = [
  { id: "thang", nhan: "Tháng" },
  { id: "quy", nhan: "Quý" },
  { id: "nam", nhan: "Năm" },
] as const;

export default async function TrangTongQuan({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const muc = motGiaTri(sp.muc) ?? "dashboard"; // dashboard | chung | tong-ket

  /** Dashboard: xem theo Năm / Quý / Tháng. Mặc định tháng. */
  const kyParam = motGiaTri(sp.ky);
  const kyXem: "thang" | "quy" | "nam" =
    kyParam === "quy" ? "quy" : kyParam === "nam" ? "nam" : "thang";

  const [
    luyKe,
    thang,
    chuoi,
    chuoiQuy,
    suckhoe,
    canhBao,
    danhMuc,
    nop,
    diem,
    evm,
    chuoiEV,
    topLoiNhuanDs,
    topRuiRoDs,
  ] = await Promise.all([
    tongQuanCongTy(),
    thangMoiNhat(),
    chuoiTheoThang(),
    chuoiTheoQuy(),
    demSucKhoe(),
    layCanhBao(),
    danhMucSucKhoe(),
    tinhTrangNopDuLieu(),
    diemChatLuong(),
    chiSoEVM(),
    chuoiEVM(),
    topLoiNhuan(),
    topRuiRo(),
  ]);

  // Gộp theo NĂM từ chuỗi tháng — mỗi năm một điểm, biên LN tính lại từ tổng.
  const chuoiNam = Object.values(
    chuoi.reduce<Record<string, { thang: string; doanhThu: number; chiPhi: number; loiNhuan: number; bienLN: number }>>(
      (acc, r) => {
        const y = r.thang.slice(0, 4);
        const a = acc[y] ?? { thang: y, doanhThu: 0, chiPhi: 0, loiNhuan: 0, bienLN: 0 };
        a.doanhThu += r.doanhThu;
        a.chiPhi += r.chiPhi;
        a.loiNhuan += r.loiNhuan;
        acc[y] = a;
        return acc;
      },
      {}
    )
  ).map((a) => ({ ...a, bienLN: a.doanhThu ? a.loiNhuan / a.doanhThu : 0 }));

  // Chuỗi + nhãn theo granularity đang chọn (chung cho biểu đồ xu hướng).
  const chuoiXem =
    kyXem === "quy" ? chuoiQuy.map((r) => ({ ...r, thang: r.ky })) : kyXem === "nam" ? chuoiNam : chuoi;
  const nhanKy = kyXem === "quy" ? nhanQuy : kyXem === "nam" ? nhanNam : nhanThang;
  const tenKy = kyXem === "quy" ? "quý" : kyXem === "nam" ? "năm" : "tháng";

  const canhBaoP0 = canhBao.filter((c) => c.mucDo === "P0");
  const khongDoanhThu = danhMuc.filter((d) => d.doanhThu === 0 && d.chiPhi > 0);

  // ---- EVM: chỉ gồm công trình đã nhập BOQ, vì EV cần % hoàn thành vật lý ----
  const evmBAC = evm.reduce((a, d) => a + d.bac, 0);
  const evmEV = evm.reduce((a, d) => a + d.ev, 0);
  const evmAC = evm.reduce((a, d) => a + d.ac, 0);
  const evmCPI = evmAC > 0 ? evmEV / evmAC : null;
  const evmVAC = evm.reduce((a, d) => a + (d.vac ?? 0), 0);
  const evmBaoDong = evm.filter((d) => (d.cpi ?? 1) < 0.9).length;

  // EV/AC gộp theo granularity: chuỗi LŨY TIẾN nên lấy điểm CUỐI mỗi kỳ.
  const goiKy = (t: string) => (kyXem === "quy" ? khoaQuy(t) : kyXem === "nam" ? t.slice(0, 4) : t);
  const chuoiEVxem =
    kyXem === "thang"
      ? chuoiEV
      : [
          ...new Map(
            [...chuoiEV]
              .sort((a, b) => a.thang.localeCompare(b.thang))
              .map((r) => [goiKy(r.thang), { thang: goiKy(r.thang), ev: r.ev, ac: r.ac }])
          ).values(),
        ];

  // Xếp theo số tiền lệch, không theo phần trăm.
  const lechNganSach = danhMuc
    .filter((d) => d.cpKeHoach > 0)
    .sort((a, b) => a.chenhLechCP - b.chenhLechCP)
    .slice(0, 10);

  // ---- Dashboard: Cơ cấu chi phí theo KỲ (Năm = cả năm hiện tại; Quý/Tháng = kỳ chọn) ----
  const allThang = chuoi.map((r) => r.thang);
  const namHienTai = allThang.at(-1)?.slice(0, 4) ?? "";
  const kyCoCauCo = kyXem === "nam" ? [] : [...new Set(allThang.map(goiKy))];
  const kyChonTho = motGiaTri(sp.kyChon);
  const kyChonCoCau =
    kyXem === "nam"
      ? namHienTai
      : kyChonTho && kyCoCauCo.includes(kyChonTho)
        ? kyChonTho
        : (kyCoCauCo.at(-1) ?? "");
  const thangCoCau =
    kyXem === "nam"
      ? allThang.filter((t) => t.slice(0, 4) === namHienTai)
      : allThang.filter((t) => goiKy(t) === kyChonCoCau);
  const coCau = muc === "dashboard" ? await coCauChiPhiTheoNhom({ thangs: thangCoCau }) : [];
  const top8 = coCau.slice(0, 8);
  const conLai = coCau.slice(8);
  const duLieuCoCau = [
    ...top8.map((c) => ({ ma: c.ma, ten: c.ten, soTien: c.soTien, tyTrong: c.tyTrongTrenCP })),
    ...(conLai.length
      ? [
          {
            ma: "KHAC",
            ten: `Khác (${conLai.length} nhóm)`,
            soTien: conLai.reduce((a, c) => a + c.soTien, 0),
            tyTrong: conLai.reduce((a, c) => a + c.tyTrongTrenCP, 0),
          },
        ]
      : []),
  ];

  // ---- Tổng kết phân tích chi phí (chỉ nạp khi ở tab đó) ----
  const tkKyParam = motGiaTri(sp.tkKy);
  const tkKy: "thang" | "quy" | "nam" =
    tkKyParam === "quy" ? "quy" : tkKyParam === "nam" ? "nam" : "thang";
  const tkCt = motGiaTri(sp.tkCt) ?? "all";
  const tkData =
    muc === "tong-ket"
      ? tkCt === "all"
        ? await maTranTongHop(tkKy)
        : await maTranTheoCongTrinh(tkCt, tkKy)
      : { cot: [] as string[], hangs: [] as Awaited<ReturnType<typeof maTranTongHop>>["hangs"] };
  const tkKyChonTho = motGiaTri(sp.tkKyChon);
  const tkKyChon =
    tkKyChonTho && tkData.cot.includes(tkKyChonTho) ? tkKyChonTho : tkData.cot.at(-1);
  const tkIdx = tkKyChon ? tkData.cot.indexOf(tkKyChon) : -1;
  const tkTongChung = tkData.hangs.reduce((a, h) => a + h.tong, 0);
  const tkKyVal = tkIdx >= 0 ? tkData.hangs.reduce((a, h) => a + h.giaTri[tkIdx], 0) : 0;
  const tkTuyChon = [
    { value: "all", nhan: "Tổng hợp tất cả công trình", href: `/?muc=tong-ket&tkKy=${tkKy}&tkCt=all` },
    ...danhMuc.map((r) => ({
      value: r.congTrinh.maCongTrinh,
      nhan: r.congTrinh.tenRutGon || r.congTrinh.maCongTrinh,
      href: `/?muc=tong-ket&tkKy=${tkKy}&tkCt=${encodeURIComponent(r.congTrinh.maCongTrinh)}`,
    })),
  ];
  // Dòng tiêu đề bảng Tổng kết khóa (sticky) ngay dưới thanh trên khi CUỘN TRANG —
  // nhờ vậy "Tổng quan điều hành" + bộ lọc cuộn đi, chỉ dòng "Mã" ở lại.
  const thTK =
    "sticky top-[52px] z-20 border-b border-vien bg-nen px-3 py-2 text-xs font-semibold whitespace-nowrap text-chunhat";

  return (
    <>
      {/* Khối tiêu đề + tab — khóa cố định khi cuộn (Dashboard: từ "Xem theo" trở
          lên; Chung: từ Tab trở lên). Tab Tổng kết cuộn bình thường vì bảng của nó
          tự khóa dòng tiêu đề "Mã". */}
      <div
        className={
          muc === "tong-ket"
            ? "mb-4"
            : "sticky top-[52px] z-20 -mx-4 mb-4 border-b border-vien bg-nen px-4 pb-2"
        }
      >
        <DauTrang
          tieuDe="Tổng quan điều hành"
          chiDan={
            <>
              Lũy kế tất cả công trình đến hết {nhanThang(thang)}. Giá trị thực hiện lấy theo mã{" "}
              <strong>{MA_DOANH_THU_DIEU_HANH} — bill nội bộ</strong>; theo §6.1 các trạng thái Tạm
              ứng / Thanh toán đợt / Quyết toán (dòng tiền) không được cộng lẫn vào đây.
            </>
          }
          phai={
            <Nhan bienThe={diem >= 85 ? "xanh" : diem >= 60 ? "vang" : "do"}>
              Chất lượng dữ liệu {diem}/100
            </Nhan>
          }
        />
        <div className="flex flex-wrap gap-1.5">
          <LocLink href="/" dangChon={muc === "dashboard"}>
            Dashboard
          </LocLink>
          <LocLink href="/?muc=chung" dangChon={muc === "chung"}>
            Chung
          </LocLink>
          <LocLink href="/?muc=tong-ket" dangChon={muc === "tong-ket"}>
            Tổng kết phân tích chi phí
          </LocLink>
        </div>
        {muc === "dashboard" ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-vien pt-2">
            <span className="mr-1 text-xs font-medium text-chunhat">Xem theo:</span>
            <LocLink href="/?ky=nam" dangChon={kyXem === "nam"}>
              Năm
            </LocLink>
            <LocLink href="/?ky=quy" dangChon={kyXem === "quy"}>
              Quý
            </LocLink>
            <LocLink href="/" dangChon={kyXem === "thang"}>
              Tháng
            </LocLink>
          </div>
        ) : null}
      </div>

      {muc === "dashboard" ? (
        <>
          {/* EV/AC */}
          {evm.length ? (
            <The className="mb-4">
              <TheDau
                tieuDe="Giá trị thu được (EV) so với Chi phí thực tế (AC)"
                moTa={`Theo ${tenKy}`}
                chiDan="Lũy tiến, gộp các công trình có BOQ. Khoảng cách giữa hai đường chính là CV (chênh lệch chi phí). EV = % hoàn thành vật lý × ngân sách chi phí. Quý/Năm lấy giá trị lũy tiến cuối kỳ."
              />
              <div className="p-3">
                <BieuDoEVM data={chuoiEVxem} loaiKy={kyXem} />
                <div className="mt-2 border-t border-vien pt-1">
                  <Bang>
                    <thead>
                      <tr>
                        <Th>{kyXem === "quy" ? "Quý" : kyXem === "nam" ? "Năm" : "Tháng"}</Th>
                        <Th phai>EV lũy tiến</Th>
                        <Th phai>AC lũy tiến</Th>
                        <Th phai>CV = EV − AC</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {chuoiEVxem.map((r) => (
                        <tr key={r.thang} className="hover:bg-nen">
                          <Td className="whitespace-nowrap">{nhanKy(r.thang)}</Td>
                          <Td phai>{tien(r.ev)}</Td>
                          <Td phai>{tien(r.ac)}</Td>
                          <Td phai>
                            <O_So am={r.ev - r.ac < 0}>{tien(r.ev - r.ac)}</O_So>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Bang>
                </div>
              </div>
            </The>
          ) : null}

          {/* Xu hướng theo kỳ */}
          <The className="mb-4">
            <TheDau
              tieuDe={`Giá trị thực hiện – Chi phí – Lợi nhuận theo ${tenKy}`}
              moTa="Cùng một trục giá trị (VNĐ) để so sánh trực tiếp"
            />
            <div className="p-3">
              <BieuDoXuHuong data={chuoiXem} loaiKy={kyXem} />
              <div className="mt-2 border-t border-vien pt-1">
                <Bang>
                  <thead>
                    <tr>
                      <Th>{kyXem === "quy" ? "Quý" : kyXem === "nam" ? "Năm" : "Tháng"}</Th>
                      <Th phai>Giá trị thực hiện</Th>
                      <Th phai>Chi phí</Th>
                      <Th phai>Lợi nhuận gộp</Th>
                      <Th phai>Biên LN</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {chuoiXem.map((r) => (
                      <tr key={r.thang} className="hover:bg-nen">
                        <Td className="font-medium whitespace-nowrap">{nhanKy(r.thang)}</Td>
                        <Td phai>{tien(r.doanhThu)}</Td>
                        <Td phai>{tien(r.chiPhi)}</Td>
                        <Td phai>
                          <O_So am={r.loiNhuan < 0}>{tien(r.loiNhuan)}</O_So>
                        </Td>
                        <Td phai>{phanTram(r.bienLN)}</Td>
                      </tr>
                    ))}
                    <tr className="bg-nen font-semibold">
                      <Td>Lũy kế</Td>
                      <Td phai>{tien(luyKe.doanhThu)}</Td>
                      <Td phai>{tien(luyKe.chiPhi)}</Td>
                      <Td phai>
                        <O_So am={luyKe.loiNhuan < 0}>{tien(luyKe.loiNhuan)}</O_So>
                      </Td>
                      <Td phai>{phanTram(luyKe.bienLN)}</Td>
                    </tr>
                  </tbody>
                </Bang>
              </div>
            </div>
          </The>

          {/* Cơ cấu chi phí theo kỳ + Tỷ trọng */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <The className="xl:col-span-2">
              <TheDau
                tieuDe="Cơ cấu chi phí theo nhóm"
                moTa={kyXem === "nam" ? `Năm ${namHienTai}` : nhanKy(kyChonCoCau)}
                phai={
                  <Link
                    href="/chi-phi"
                    className="inline-flex items-center gap-1 text-xs font-medium text-nhan hover:underline"
                  >
                    Phân tích chi tiết <ArrowRight className="size-3" />
                  </Link>
                }
              />
              {kyXem !== "nam" ? (
                <div className="flex flex-wrap items-center gap-1 border-b border-vien px-4 py-2">
                  <span className="mr-1 text-xs font-medium text-chunhat">
                    {kyXem === "quy" ? "Quý:" : "Tháng:"}
                  </span>
                  {kyCoCauCo.map((k) => (
                    <LocLink
                      key={k}
                      href={`/?ky=${kyXem}&kyChon=${encodeURIComponent(k)}`}
                      dangChon={k === kyChonCoCau}
                    >
                      {nhanKy(k)}
                    </LocLink>
                  ))}
                </div>
              ) : null}
              <div className="p-3">
                <BieuDoCoCau data={duLieuCoCau} />
              </div>
            </The>

            <The>
              <TheDau
                tieuDe="Tỷ trọng trên tổng chi phí"
                moTa={kyXem === "nam" ? `Năm ${namHienTai}` : nhanKy(kyChonCoCau)}
              />
              <Bang>
                <thead>
                  <tr>
                    <Th>Nhóm</Th>
                    <Th phai>Số tiền</Th>
                    <Th phai>%</Th>
                  </tr>
                </thead>
                <tbody>
                  {duLieuCoCau.map((c) => (
                    <tr key={c.ma} className="hover:bg-nen">
                      <Td className="max-w-40 truncate text-xs" title={c.ten}>
                        {c.ten}
                      </Td>
                      <Td phai className="text-xs">
                        {tienGon(c.soTien)}
                      </Td>
                      <Td phai className="text-xs">
                        {phanTram(c.tyTrong)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Bang>
            </The>
          </div>
        </>
      ) : muc === "chung" ? (
        <>
          {/* Cảnh báo nổi bật nhất */}
          {khongDoanhThu.length > 0 ? (
            <div className="mb-5">
              <CanhBaoBox
                bienThe="do"
                tieuDe={`${khongDoanhThu.length} công trình đã phát sinh chi phí nhưng chưa ghi nhận giá trị thực hiện nào`}
              >
                <p>
                  Tổng chi phí đang treo:{" "}
                  <strong className="so">
                    {tien(khongDoanhThu.reduce((a, d) => a + d.chiPhi, 0))} đ
                  </strong>
                  . Cần xác minh đây là chưa tới kỳ ra bill hay là thiếu dữ liệu giá trị thực hiện.
                </p>
              </CanhBaoBox>
            </div>
          ) : null}

          <p className="mb-2 text-xs font-semibold tracking-wide text-chunhat uppercase">
            Lũy kế từ đầu năm
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TheKPI
              nhan="Giá trị thực hiện lũy kế"
              giaTri={luyKe.doanhThu}
              phuChu="Bill nội bộ"
              chiDan="Lũy kế giá trị thực hiện (Bill nội bộ theo mã điều hành) của tất cả công trình từ đầu năm. Đây là giá trị thực hiện, không phải tiền thu (dòng tiền)."
            />
            <TheKPI
              nhan="Chi phí lũy kế"
              giaTri={luyKe.chiPhi}
              phuChu="Tổng các mã chi phí"
              chiDan="Tổng mọi giao dịch thuộc mã Chi phí của tất cả công trình, lũy kế từ đầu năm."
            />
            <TheKPI
              nhan="Lợi nhuận gộp"
              giaTri={luyKe.loiNhuan}
              phuChu="Giá trị thực hiện − Chi phí"
              chiDan="Lợi nhuận gộp = Giá trị thực hiện lũy kế − Chi phí lũy kế, cộng gộp toàn công ty."
            />
            <TheKPI
              nhan="Biên lợi nhuận gộp"
              giaTri={luyKe.bienLN}
              dinhDang="phanTram"
              phuChu="Lợi nhuận / Giá trị thực hiện"
              chiDan="Biên lợi nhuận gộp = Lợi nhuận gộp / Giá trị thực hiện lũy kế của toàn công ty."
            />
          </div>

          {evm.length ? (
            <>
              <p className="mt-5 mb-2 text-xs font-semibold tracking-wide text-chunhat uppercase">
                EVM — giá trị thu được
                <span className="ml-2 font-normal normal-case">
                  (chỉ {evm.length}/{danhMuc.length} công trình đã nhập BOQ · không có SPI/SV vì kế
                  hoạch chưa rải theo thời gian)
                </span>
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <TheKPI
                  nhan="CPI cả nhóm"
                  giaTri={evmCPI}
                  dinhDang="so"
                  phuChu={
                    evmCPI && evmCPI < 1 ? "Dưới 1 — đang vượt chi" : "Từ 1 trở lên — trong ngân sách"
                  }
                  chiDan="CPI (Chỉ số hiệu quả chi phí) = Giá trị thu được (EV) / Chi phí thực tế (AC). Dưới 1 = đang vượt chi; từ 1 trở lên = trong ngân sách."
                />
                <TheKPI
                  nhan="Ngân sách (BAC)"
                  giaTri={evmBAC}
                  phuChu={`${evm.length} công trình`}
                  chiDan="BAC (Budget At Completion) = tổng ngân sách khi hoàn thành — ở đây lấy tổng giá trị hợp đồng BOQ của các công trình đã nhập BOQ."
                />
                <TheKPI
                  nhan="Dự báo lệch (VAC)"
                  giaTri={evmVAC}
                  phuChu={evmVAC < 0 ? "Âm — dự báo vượt ngân sách" : "Dương — dự báo còn dư"}
                  chiDan="VAC (Variance At Completion) = BAC − Dự báo chi phí khi hoàn thành (EAC). Âm = dự báo vượt ngân sách; dương = dự báo còn dư."
                />
                <TheKPI
                  nhan="Công trình báo động"
                  giaTri={evmBaoDong}
                  dinhDang="so"
                  phuChu="CPI dưới 0,9"
                />
              </div>
            </>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <The>
              <TheDau
                tieuDe="Sức khỏe danh mục"
                moTa={`${danhMuc.length} công trình`}
                chiDan="Đỏ khi vượt ngân sách, lợi nhuận âm, quá hạn cập nhật hoặc chưa có doanh thu. Ngưỡng đặt tập trung tại src/lib/thresholds.ts."
              />
              <div className="space-y-2 p-4">
                {(["Xanh", "Vàng", "Đỏ"] as const).map((s) => {
                  const n = suckhoe[s];
                  const pct = danhMuc.length ? (n / danhMuc.length) * 100 : 0;
                  const mau =
                    s === "Xanh" ? "bg-emerald-500" : s === "Vàng" ? "bg-amber-500" : "bg-rose-500";
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-xs font-medium">{s}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-nen">
                        <div className={`h-full rounded-full ${mau}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="so w-8 shrink-0 text-right text-xs font-semibold">{n}</span>
                    </div>
                  );
                })}
              </div>
            </The>

            <The>
              <TheDau
                tieuDe="Cảnh báo cần xử lý"
                moTa={
                  canhBao.length > 5
                    ? `${canhBaoP0.length} cảnh báo P0 · hiện 5 trong ${canhBao.length}`
                    : `${canhBaoP0.length} cảnh báo P0 · ${canhBao.length} cảnh báo`
                }
              />
              <ul className="divide-y divide-vien">
                {canhBao.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-start gap-2 px-4 py-2.5">
                    <AlertTriangle
                      className={`mt-0.5 size-3.5 shrink-0 ${c.mucDo === "P0" ? "text-rose-500" : "text-amber-500"}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{c.tieuDe}</p>
                      <p className="truncate text-[11px] text-chunhat">
                        {c.maCongTrinh ?? "Tất cả công trình"} · {c.nguoiChiuTrachNhiem}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </The>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <The>
              <TheDau tieuDe="Top 10 công trình lợi nhuận cao nhất" />
              <Bang>
                <thead>
                  <tr>
                    <Th>Công trình</Th>
                    <Th phai>Lợi nhuận</Th>
                    <Th phai>Biên LN</Th>
                  </tr>
                </thead>
                <tbody>
                  {topLoiNhuanDs.map((r) => (
                    <tr key={r.congTrinh.id} className="hover:bg-nen">
                      <Td>
                        <Link
                          href={`/cong-trinh/${encodeURIComponent(r.congTrinh.maCongTrinh)}`}
                          className="font-medium text-nhan hover:underline"
                        >
                          {r.congTrinh.maCongTrinh}
                        </Link>
                      </Td>
                      <Td phai>
                        <O_So am={r.loiNhuan < 0}>{tienGon(r.loiNhuan)}</O_So>
                      </Td>
                      <Td phai>{phanTram(r.bienLN)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Bang>
            </The>

            <The>
              <TheDau tieuDe="Top 10 công trình rủi ro vượt chi phí" />
              <Bang>
                <thead>
                  <tr>
                    <Th>Công trình</Th>
                    <Th phai>Chi phí</Th>
                    <Th>Dùng ngân sách</Th>
                    <Th>Sức khỏe</Th>
                  </tr>
                </thead>
                <tbody>
                  {topRuiRoDs.map((r) => (
                    <tr key={r.congTrinh.id} className="hover:bg-nen">
                      <Td>
                        <Link
                          href={`/cong-trinh/${encodeURIComponent(r.congTrinh.maCongTrinh)}`}
                          className="font-medium text-nhan hover:underline"
                        >
                          {r.congTrinh.maCongTrinh}
                        </Link>
                      </Td>
                      <Td phai>{tienGon(r.chiPhi)}</Td>
                      <Td>
                        <ThanhTyLe tyLe={r.tyLeNganSach} />
                      </Td>
                      <Td>
                        <NhanSucKhoe sucKhoe={r.sucKhoe} lyDo={r.lyDo} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Bang>
            </The>
          </div>

          <The className="mt-4">
            <TheDau
              tieuDe="Top công trình lệch ngân sách (TOP 10)"
              moTa="Chênh lệch = Kế hoạch − Thực hiện · âm là đã vượt · xếp theo số tiền lệch"
              chiDan="% lệch = Chênh lệch / Kế hoạch. Chỉ gồm công trình đã được cấp ngân sách; công trình chưa lập kế hoạch không có mẫu số để so."
            />
            <Bang>
              <thead>
                <tr>
                  <Th>Mã</Th>
                  <Th>Tên công trình</Th>
                  <Th phai>Kế hoạch</Th>
                  <Th phai>Thực hiện</Th>
                  <Th phai>Chênh lệch</Th>
                  <Th phai>% lệch</Th>
                </tr>
              </thead>
              <tbody>
                {lechNganSach.map((d) => (
                  <tr key={d.congTrinh.maCongTrinh} className="hover:bg-nen">
                    <Td className="whitespace-nowrap">
                      <Link
                        href={`/cong-trinh/${encodeURIComponent(d.congTrinh.maCongTrinh)}`}
                        className="font-medium text-nhan hover:underline"
                      >
                        {d.congTrinh.maCongTrinh}
                      </Link>
                    </Td>
                    <Td className="max-w-70 truncate text-xs" title={d.congTrinh.tenCongTrinh}>
                      {d.congTrinh.tenCongTrinh}
                    </Td>
                    <Td phai>{tien(d.cpKeHoach)}</Td>
                    <Td phai>{tien(d.chiPhi)}</Td>
                    <Td phai>
                      <O_So am={d.chenhLechCP < 0}>{tien(d.chenhLechCP)}</O_So>
                    </Td>
                    <Td phai>
                      <O_So am={d.chenhLechCP < 0}>{phanTram(d.chenhLechCP / d.cpKeHoach, 1)}</O_So>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Bang>
          </The>

          <The className="mt-4">
            <TheDau
              tieuDe="Tình trạng cập nhật dữ liệu của công trình"
              moTa="Đo bằng số ngày kể từ lần nộp gần nhất (Data Freshness §21)"
            />
            <Bang>
              <thead>
                <tr>
                  <Th>Mã công trình</Th>
                  <Th>Tên công trình</Th>
                  <Th>Chỉ huy trưởng</Th>
                  <Th phai>Số ngày chưa cập nhật</Th>
                </tr>
              </thead>
              <tbody>
                {nop.slice(0, 10).map((r) => (
                  <tr key={r.congTrinh.id} className="hover:bg-nen">
                    <Td className="whitespace-nowrap">
                      <NhanCongTrinh
                        tenRutGon={r.congTrinh.tenRutGon}
                        ma={r.congTrinh.maCongTrinh}
                        href={`/cong-trinh/${encodeURIComponent(r.congTrinh.maCongTrinh)}`}
                      />
                    </Td>
                    <Td className="max-w-80 truncate text-xs" title={r.congTrinh.tenCongTrinh}>
                      {r.congTrinh.tenCongTrinh}
                    </Td>
                    <Td className="text-xs whitespace-nowrap">{r.congTrinh.chiHuyTruong}</Td>
                    <Td phai>{r.ngayTre}</Td>
                  </tr>
                ))}
              </tbody>
            </Bang>
          </The>
        </>
      ) : (
        <>
          {/* ---- Tổng kết phân tích chi phí ---- */}
          <div className="mb-4 divide-y divide-vien rounded-xl border border-vien bg-the px-3 py-0.5">
            <div className="flex items-start gap-2 py-1.5">
              <span className="w-20 shrink-0 pt-1 text-xs font-medium text-chunhat">Kỳ</span>
              <div className="flex flex-wrap gap-1">
                {KY_BC.map((l) => (
                  <LocLink
                    key={l.id}
                    href={`/?muc=tong-ket&tkCt=${encodeURIComponent(tkCt)}&tkKy=${l.id}`}
                    dangChon={tkKy === l.id}
                  >
                    {l.nhan}
                  </LocLink>
                ))}
              </div>
            </div>
            <div className="flex items-start gap-2 py-1.5">
              <span className="w-20 shrink-0 pt-1 text-xs font-medium text-chunhat">Thời điểm</span>
              <div className="flex max-h-19 flex-wrap gap-1 overflow-y-auto">
                {tkData.cot.length ? (
                  tkData.cot.map((c) => (
                    <LocLink
                      key={c}
                      href={`/?muc=tong-ket&tkCt=${encodeURIComponent(tkCt)}&tkKy=${tkKy}&tkKyChon=${encodeURIComponent(c)}`}
                      dangChon={tkKyChon === c}
                    >
                      {nhanKyBC(tkKy, c)}
                    </LocLink>
                  ))
                ) : (
                  <span className="pt-1 text-xs text-chunhat">Chưa có dữ liệu</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 py-1.5">
              <span className="w-20 shrink-0 text-xs font-medium text-chunhat">Công trình</span>
              <ChonNavi giaTri={tkCt} tuyChon={tkTuyChon} />
            </div>
          </div>

          <The>
            <TheDau
              tieuDe={tkCt === "all" ? "Tổng hợp tất cả công trình" : tkTuyChon.find((o) => o.value === tkCt)?.nhan ?? tkCt}
              moTa={`${tkKyChon ? nhanKyBC(tkKy, tkKyChon) : "—"} · ${tkData.hangs.length} mã · tổng lũy kế ${tien(tkTongChung)} đ`}
              chiDan="Cột Tổng là lũy kế mọi kỳ (không đổi theo Thời điểm). Cột giá trị kỳ là số của đúng Thời điểm đang chọn. Tỷ trọng = Giá trị kỳ / Tổng của dòng (kỳ này chiếm bao nhiêu phần trăm tổng lũy kế). Dòng Bill là giá trị thực hiện (BOQ)."
            />
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={`${thTK} text-left`}>Mã</th>
                  <th className={`${thTK} text-left`}>Nội dung</th>
                  <th className={`${thTK} text-right`}>Tổng</th>
                  {tkKyChon ? (
                    <th className={`${thTK} text-right`}>{nhanKyBC(tkKy, tkKyChon)}</th>
                  ) : null}
                  <th className={`${thTK} text-right`}>Tỷ trọng</th>
                </tr>
              </thead>
              <tbody>
                {tkData.hangs.map((h) => {
                  const nhomCha = !h.maCha;
                  const kyVal = tkIdx >= 0 ? h.giaTri[tkIdx] : 0;
                  // Tỷ trọng = giá trị của kỳ đang chọn / Tổng lũy kế của chính dòng đó.
                  const tyTrong = h.tong ? kyVal / h.tong : 0;
                  return (
                    <tr key={h.ma} className={nhomCha ? "bg-nen/60 hover:bg-nen" : "hover:bg-nen"}>
                      <Td className={`text-xs whitespace-nowrap ${nhomCha ? "font-semibold" : "pl-7"}`}>
                        {h.ma}
                      </Td>
                      <Td
                        className={`max-w-70 truncate text-xs ${nhomCha ? "font-semibold" : ""}`}
                        title={h.ten}
                      >
                        {h.loai === "Chi phí" ? h.ten : <span className="text-nhan">{h.ten}</span>}
                      </Td>
                      <Td phai className="bg-nen font-semibold">
                        {tien(h.tong)}
                      </Td>
                      {tkKyChon ? (
                        <Td phai className={kyVal ? "" : "text-chunhat"}>
                          {kyVal ? tien(kyVal) : "—"}
                        </Td>
                      ) : null}
                      <Td phai className="text-xs">
                        {h.tong ? phanTram(tyTrong) : "—"}
                      </Td>
                    </tr>
                  );
                })}
                <tr className="bg-nen font-semibold">
                  <Td>TỔNG</Td>
                  <Td />
                  <Td phai>{tien(tkTongChung)}</Td>
                  {tkKyChon ? <Td phai>{tien(tkKyVal)}</Td> : null}
                  <Td phai>{tkTongChung ? phanTram(tkKyVal / tkTongChung) : "—"}</Td>
                </tr>
              </tbody>
            </table>
          </The>
        </>
      )}
    </>
  );
}
