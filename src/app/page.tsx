import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { BieuDoCoCau, BieuDoEVM, BieuDoXuHuong } from "@/components/charts";
import { TheKPI } from "@/components/kpi-card";
import {
  Bang,
  CanhBaoBox,
  DauTrang,
  GhiChuNguon,
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
import { nhanQuy, nhanThang, phanTram, tien, tienGon } from "@/lib/format";
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
  thangMoiNhat,
  tinhTrangNopDuLieu,
  tongQuanCongTy,
  topLoiNhuan,
  topRuiRo,
} from "@/lib/data/repository";
import { bienDong } from "@/lib/kpi";
import { MA_DOANH_THU_DIEU_HANH } from "@/lib/thresholds";

export default async function TrangTongQuan({
  searchParams,
}: {
  searchParams: Promise<{ ky?: string }>;
}) {
  const sp = await searchParams;
  /** Xu hướng xem theo tháng hay gộp theo quý. Mặc định tháng. */
  const kyXem: "thang" | "quy" = sp.ky === "quy" ? "quy" : "thang";

  const [
    luyKe,
    thang,
    chuoi,
    chuoiQuy,
    suckhoe,
    canhBao,
    coCau,
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
    coCauChiPhiTheoNhom(),
    danhMucSucKhoe(),
    tinhTrangNopDuLieu(),
    diemChatLuong(),
    chiSoEVM(),
    chuoiEVM(),
    topLoiNhuan(),
    topRuiRo(),
  ]);

  // Biểu đồ và bảng dùng chung một bộ dữ liệu; chỉ đổi khóa và cách gắn nhãn.
  const chuoiXem =
    kyXem === "quy"
      ? chuoiQuy.map((r) => ({ ...r, thang: r.ky }))
      : chuoi;
  const nhanKy = kyXem === "quy" ? nhanQuy : nhanThang;
  const tenKy = kyXem === "quy" ? "quý" : "tháng";

  /*
   * Kỳ gần nhất và kỳ liền trước, lấy từ CHÍNH chuỗi đang xem.
   * Nhờ vậy chọn Quý thì thẻ KPI so quý này với quý trước, chọn Tháng thì so
   * tháng này với tháng trước — một đường tính duy nhất cho cả hai chế độ.
   */
  const kyNay = chuoiXem.at(-1);
  const kyTruoc = chuoiXem.at(-2);
  const delta = (nay: number, truoc: number | undefined) =>
    truoc === undefined ? null : bienDong(nay, truoc);
  const canhBaoP0 = canhBao.filter((c) => c.mucDo === "P0");
  const khongDoanhThu = danhMuc.filter((d) => d.doanhThu === 0 && d.chiPhi > 0);

  // ---- EVM: chỉ gồm công trình đã nhập BOQ, vì EV cần % hoàn thành vật lý ----
  const evmBAC = evm.reduce((a, d) => a + d.bac, 0);
  const evmEV = evm.reduce((a, d) => a + d.ev, 0);
  const evmAC = evm.reduce((a, d) => a + d.ac, 0);
  const evmCPI = evmAC > 0 ? evmEV / evmAC : null;
  const evmVAC = evm.reduce((a, d) => a + (d.vac ?? 0), 0);
  const evmBaoDong = evm.filter((d) => (d.cpi ?? 1) < 0.9).length;

  // Xếp theo số tiền lệch, không theo phần trăm: công trình nhỏ lệch 24% vẫn ít
  // đáng lo hơn công trình lớn lệch 7,5% mà mất 305 triệu.
  const lechNganSach = danhMuc
    .filter((d) => d.cpKeHoach > 0)
    .sort((a, b) => a.chenhLechCP - b.chenhLechCP)
    .slice(0, 10);

  // Cơ cấu chi phí: giữ 8 nhóm lớn nhất, phần đuôi gộp "Khác" (không sinh thêm màu).
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

  return (
    <>
      <DauTrang
        tieuDe="Tổng quan điều hành"
        moTa={
          <>
            Lũy kế tất cả công trình đến hết {nhanThang(thang)}. Doanh thu lấy theo mã{" "}
            <strong>{MA_DOANH_THU_DIEU_HANH} — bill nội bộ</strong>; theo §6.1 các trạng thái Tạm
            ứng / Thanh toán đợt / Quyết toán không được cộng lẫn vào đây.
          </>
        }
        phai={
          <Nhan bienThe={diem >= 85 ? "xanh" : diem >= 60 ? "vang" : "do"}>
            Chất lượng dữ liệu {diem}/100
          </Nhan>
        }
      />

      {/* ---- Cảnh báo nổi bật nhất, đặt trên đầu vì CEO cần thấy trước ---- */}
      {khongDoanhThu.length > 0 ? (
        <div className="mb-5">
          <CanhBaoBox
            bienThe="do"
            tieuDe={`${khongDoanhThu.length} công trình đã phát sinh chi phí nhưng chưa ghi nhận đồng doanh thu nào`}
          >
            <p>
              Tổng chi phí đang treo:{" "}
              <strong className="so">
                {tien(khongDoanhThu.reduce((a, d) => a + d.chiPhi, 0))} đ
              </strong>
              . Cần xác minh đây là chưa tới kỳ ra bill hay là thiếu dữ liệu doanh thu.
            </p>
          </CanhBaoBox>
        </div>
      ) : null}

      {/*
        Hai hàng thẻ tách bạch LŨY KẾ và THÁNG.
        Không gắn delta tháng vào con số lũy kế — hai đại lượng khác nhau, ghép
        chung sẽ đọc thành "doanh thu lũy kế giảm 43,9%", điều đó vô nghĩa.
      */}
      <p className="mb-2 text-xs font-semibold tracking-wide text-chunhat uppercase">
        Lũy kế từ đầu năm
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TheKPI nhan="Doanh thu lũy kế" giaTri={luyKe.doanhThu} phuChu="Bill nội bộ" />
        <TheKPI nhan="Chi phí lũy kế" giaTri={luyKe.chiPhi} phuChu="Tổng các mã chi phí" />
        <TheKPI nhan="Lợi nhuận gộp" giaTri={luyKe.loiNhuan} phuChu="Doanh thu − Chi phí" />
        <TheKPI
          nhan="Biên lợi nhuận gộp"
          giaTri={luyKe.bienLN}
          dinhDang="phanTram"
          phuChu="Lợi nhuận / Doanh thu"
        />
      </div>

      <p className="mt-5 mb-2 text-xs font-semibold tracking-wide text-chunhat uppercase">
        Riêng {nhanKy(kyNay?.thang ?? "")}
        <span className="ml-2 font-normal normal-case">
          (kỳ chưa kết thúc — số liệu chốt đến ngày 20)
        </span>
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TheKPI
          nhan={`Doanh thu trong ${tenKy}`}
          giaTri={kyNay?.doanhThu ?? null}
          delta={delta(kyNay?.doanhThu ?? 0, kyTruoc?.doanhThu)}
          tangLaTot
          phuChu={kyTruoc ? `so với ${nhanKy(kyTruoc.thang)}` : "chưa có kỳ trước"}
        />
        <TheKPI
          nhan={`Chi phí trong ${tenKy}`}
          giaTri={kyNay?.chiPhi ?? null}
          delta={delta(kyNay?.chiPhi ?? 0, kyTruoc?.chiPhi)}
          tangLaTot={false}
          phuChu={kyTruoc ? `so với ${nhanKy(kyTruoc.thang)}` : "chưa có kỳ trước"}
        />
        <TheKPI
          nhan={`Lợi nhuận trong ${tenKy}`}
          giaTri={kyNay?.loiNhuan ?? null}
          delta={delta(kyNay?.loiNhuan ?? 0, kyTruoc?.loiNhuan)}
          tangLaTot
          phuChu={kyTruoc ? `so với ${nhanKy(kyTruoc.thang)}` : "chưa có kỳ trước"}
        />
        <TheKPI
          nhan={`Biên lợi nhuận ${tenKy}`}
          giaTri={kyNay?.bienLN ?? null}
          dinhDang="phanTram"
          phuChu="Lợi nhuận / Doanh thu"
        />
      </div>

      {/* ---- EVM ---- */}
      {evm.length ? (
        <>
          <p className="mt-5 mb-2 text-xs font-semibold tracking-wide text-chunhat uppercase">
            EVM — giá trị thu được
            <span className="ml-2 font-normal normal-case">
              (chỉ {evm.length}/{danhMuc.length} công trình đã nhập BOQ · không có SPI/SV vì kế hoạch
              chưa rải theo thời gian)
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
            />
            <TheKPI nhan="Ngân sách (BAC)" giaTri={evmBAC} phuChu={`${evm.length} công trình`} />
            <TheKPI
              nhan="Dự báo lệch (VAC)"
              giaTri={evmVAC}
              phuChu={evmVAC < 0 ? "Âm — dự báo vượt ngân sách" : "Dương — dự báo còn dư"}
            />
            <TheKPI
              nhan="Công trình báo động"
              giaTri={evmBaoDong}
              dinhDang="so"
              phuChu="CPI dưới 0,9"
            />
          </div>

          <The className="mt-4">
            <TheDau
              tieuDe="Giá trị thu được (EV) so với Chi phí thực tế (AC)"
              moTa="Lũy tiến theo tháng, gộp các công trình có BOQ. Khoảng cách giữa hai đường chính là CV."
            />
            <div className="p-3">
              <BieuDoEVM data={chuoiEV} />
            </div>
            {/* Bảng số liệu đi kèm biểu đồ là bắt buộc theo quy tắc bảng màu. */}
            <Bang>
              <thead>
                <tr>
                  <Th>Tháng</Th>
                  <Th phai>EV lũy tiến</Th>
                  <Th phai>AC lũy tiến</Th>
                  <Th phai>CV = EV − AC</Th>
                </tr>
              </thead>
              <tbody>
                {chuoiEV.map((r) => (
                  <tr key={r.thang} className="hover:bg-nen">
                    <Td className="whitespace-nowrap">{nhanThang(r.thang)}</Td>
                    <Td phai>{tien(r.ev)}</Td>
                    <Td phai>{tien(r.ac)}</Td>
                    <Td phai>
                      <O_So am={r.ev - r.ac < 0}>{tien(r.ev - r.ac)}</O_So>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Bang>
            <GhiChuNguon>
              EV = % hoàn thành vật lý × ngân sách chi phí, phần trăm lấy từ khối lượng BOQ đã xác
              nhận. Chỉ số của từng công trình nằm ở mục <strong>EVM</strong> trong chi tiết công
              trình.
            </GhiChuNguon>
          </The>
        </>
      ) : null}

      {/* ---- Xu hướng + sức khỏe ---- */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <The className="xl:col-span-2">
          <TheDau
            tieuDe={`Doanh thu – Chi phí – Lợi nhuận theo ${kyXem === "quy" ? "quý" : "tháng"}`}
            moTa="Cùng một trục giá trị (VNĐ) để so sánh trực tiếp"
            phai={
              <div className="flex gap-1.5">
                <LocLink href="/" dangChon={kyXem === "thang"}>
                  Tháng
                </LocLink>
                <LocLink href="/?ky=quy" dangChon={kyXem === "quy"}>
                  Quý
                </LocLink>
              </div>
            }
          />
          <div className="p-3">
            <BieuDoXuHuong data={chuoiXem} loaiKy={kyXem} />
            {/* Bảng số liệu đi kèm là bắt buộc: bảng màu light-mode có cảnh báo
                tương phản, nên biểu đồ phải có kênh đọc thứ hai. */}
            <div className="mt-2 border-t border-vien pt-1">
              <Bang>
                <thead>
                  <tr>
                    <Th>{kyXem === "quy" ? "Quý" : "Tháng"}</Th>
                    <Th phai>Doanh thu</Th>
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

        <div className="space-y-4">
          <The>
            <TheDau tieuDe="Sức khỏe danh mục" moTa={`${danhMuc.length} công trình`} />
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
              <GhiChuNguon>
                Đỏ khi vượt ngân sách, lợi nhuận âm, quá hạn cập nhật hoặc chưa có doanh thu. Ngưỡng
                đặt tập trung tại <code className="text-[11px]">src/lib/thresholds.ts</code>.
              </GhiChuNguon>
            </div>
          </The>

          <The>
            {/* Trang Cảnh báo riêng đã bỏ, nên phải ghi rõ số chưa hiện — không
                thì 5 dòng đầu trông như là toàn bộ. */}
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
      </div>

      {/* ---- Cơ cấu chi phí ---- */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <The className="xl:col-span-2">
          <TheDau
            tieuDe="Cơ cấu chi phí theo nhóm"
            moTa="Lũy kế tất cả công trình"
            phai={
              <Link
                href="/chi-phi"
                className="inline-flex items-center gap-1 text-xs font-medium text-nhan hover:underline"
              >
                Phân tích chi tiết <ArrowRight className="size-3" />
              </Link>
            }
          />
          <div className="p-3">
            <BieuDoCoCau data={duLieuCoCau} />
          </div>
        </The>

        <The>
          <TheDau tieuDe="Tỷ trọng trên tổng chi phí" moTa="Bảng đi kèm biểu đồ" />
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

      {/* ---- Xếp hạng ---- */}
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

      {/* ---- Lệch ngân sách ---- */}
      <The className="mt-4">
        <TheDau
          tieuDe="Top công trình lệch ngân sách (TOP 10)"
          moTa="Chênh lệch = Kế hoạch − Thực hiện · âm là đã vượt · xếp theo số tiền lệch"
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
        <GhiChuNguon>
          % lệch = Chênh lệch / Kế hoạch. Chỉ gồm công trình đã được cấp ngân sách; công trình chưa
          lập kế hoạch không có mẫu số để so.
        </GhiChuNguon>
      </The>

      {/* ---- Tình trạng nộp dữ liệu ---- */}
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
                <Td className="max-w-[320px] truncate text-xs" title={r.congTrinh.tenCongTrinh}>
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
  );
}
