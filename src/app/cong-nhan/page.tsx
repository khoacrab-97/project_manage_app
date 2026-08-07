import Link from "next/link";
import { FileDown } from "lucide-react";
import { Bang, CanhBaoBox, DauTrang, LocLink, Nhan, NhanCongTrinh, Rong, Td, The, TheDau, TheGap, Th } from "@/components/ui";
import {
  baNgayMauChep,
  cacThangChamCong,
  chamCongDoiDA,
  chamCongNgay,
  choPhepSuaLich,
  doiChieuThang,
  dsCanBo,
  homNay,
  laCanBoQuanLyCN,
  laChuNhat,
  layCanBoUser,
  layCongNhan,
  layCongTrinhChamCong,
  layDoiDA,
  layNgayLe,
  lichDieuDong,
  nhanLech,
  oDaPhan,
  timeSheetCongNhan,
  tongHopThang,
} from "@/lib/data/cong-nhan";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { thaoTacTabCongNhan, xemTabCongNhan } from "@/lib/auth/quyen";
import { MAY_CHU_KHOI_DONG } from "@/lib/build-time";
import { nhanThang } from "@/lib/format";
import { motGiaTri } from "@/lib/search-params";
import { NGAY_HIEN_TAI } from "@/lib/thresholds";
import {
  BangChamCong,
  BangChamCongDA,
  ChonNgayNhanh,
  DanhSachCanBo,
  DanhSachDoiTab,
  FormKhuVuc,
  FormThemNhieuCN,
  LichTimeSheet,
  MaTranPhanCong,
  NutXoaLichDieuDong,
  QuanLyDoiDA,
  QuanLyNgayLe,
} from "@/components/cong-nhan-form";

export const metadata = { title: "Quản lý công nhân" };

const MUC = [
  { id: "ho-so", nhan: "Hồ sơ chung" },
  { id: "phan-cong", nhan: "Phân công ngày" },
  { id: "cham-cong", nhan: "Chấm công" },
  { id: "tong-hop", nhan: "Tổng hợp tháng" },
  { id: "doi-chieu", nhan: "Đối chiếu" },
] as const;

/** Số công hiển thị gọn: 1 chứ không phải 1,00. */
function soCong(n: number) {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

/** Ngày dạng dd/mm/yyyy; riêng hôm nay thì gọi thẳng là "Hôm nay". */
function nhanNgay(ngay: string) {
  if (ngay === homNay()) return "Hôm nay";
  const [y, m, d] = ngay.split("-");
  return `${d}/${m}/${y}`;
}

export default async function TrangCongNhan({ searchParams }: PageProps<"/cong-nhan">) {
  const sp = await searchParams;
  const mucParam = motGiaTri(sp.muc);
  const ngayParam = motGiaTri(sp.ngay);
  const thangParam = motGiaTri(sp.thang);
  const cheParam = motGiaTri(sp.che);
  const viewParam = motGiaTri(sp.view);
  const cnParam = motGiaTri(sp.cn);
  const ctParam = motGiaTri(sp.ct);
  const daParam = motGiaTri(sp.da);
  const u = await nguoiDungHienTai();
  const laAdmin = u?.vaiTro === "ADMIN";
  // "Cán bộ quản lý CN" = được cử qua cột Người quản lý; mở khoá Hồ sơ + Phân công.
  const laCanBoQL = await laCanBoQuanLyCN();

  // Chỉ hiện những tab vai trò được XEM; tab yêu cầu ngoài quyền thì lùi về tab
  // đầu tiên thấy được. (Vai trò không có tab nào đã bị layout chặn từ trước.)
  const mucThay = MUC.filter((m) => xemTabCongNhan(u, m.id, laCanBoQL));
  const muc =
    mucParam && mucThay.some((m) => m.id === mucParam) ? mucParam : (mucThay[0]?.id ?? "ho-so");

  return (
    <>
      <DauTrang
        tieuDe="Quản lý công nhân"
        chiDan="Chấm công hai luồng: đội nội thành dùng chung đi qua bước phân công hằng ngày, đội ngoại thành chấm công trực tiếp. Cả hai đổ về một cơ sở chấm công chung."
      />

      <p className="mb-2 text-[11px] text-chunhat">
        Máy chủ chạy từ: <span className="">{MAY_CHU_KHOI_DONG}</span> — nếu vừa chạy{" "}
        <span className="">chay.cmd moi</span> mà mốc này không đổi sang giờ hiện tại thì
        bản cũ vẫn đang chạy.
      </p>

      <div className="mb-4 flex flex-wrap gap-1.5 border-b border-vien pb-2">
        {mucThay.map((m) => (
          <Link
            key={m.id}
            href={`/cong-nhan?muc=${m.id}`}
            scroll={false}
            className={
              muc === m.id
                ? "rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-md px-3 py-1.5 text-xs font-medium text-chunhat hover:bg-nen hover:text-chu"
            }
          >
            {m.nhan}
          </Link>
        ))}
      </div>

      {muc === "ho-so" ? (
        <HoSo duocSua={thaoTacTabCongNhan(u, "ho-so", laCanBoQL)} laAdmin={laAdmin} />
      ) : muc === "phan-cong" ? (
        <PhanCong
          ngay={ngayParam}
          che={cheParam ?? ""}
          duocSua={thaoTacTabCongNhan(u, "phan-cong", laCanBoQL)}
          laAdmin={laAdmin}
        />
      ) : muc === "cham-cong" ? (
        <ChamCong
          ngay={ngayParam}
          ct={ctParam}
          da={daParam}
          duocSua={thaoTacTabCongNhan(u, "cham-cong", laCanBoQL)}
        />
      ) : muc === "tong-hop" ? (
        <TongHop thang={thangParam} view={viewParam ?? ""} cn={cnParam} />
      ) : (
        <DoiChieu thang={thangParam} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- Hồ sơ chung
async function HoSo({ duocSua, laAdmin }: { duocSua: boolean; laAdmin: boolean }) {
  const [ds, congTrinh, canBo, ngayLe, dsDoiDA, canBoUser] = await Promise.all([
    layCongNhan(),
    layCongTrinhChamCong(),
    dsCanBo(),
    layNgayLe(),
    layDoiDA(),
    layCanBoUser(),
  ]);
  const noiThanh = ds.filter((c) => c.doi === "NOI_THANH");
  const ngoaiThanh = ds.filter((c) => c.doi === "NGOAI_THANH");

  return (
    <>
      <DanhSachCanBo ten={canBo} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <O nhan="Tổng công nhân" giaTri={ds.length} />
        <O nhan="Đội thi công" giaTri={noiThanh.length} />
        <O nhan="Đội DA" giaTri={ngoaiThanh.length} />
      </div>

      {duocSua ? (
        <div className="mb-4">
          <FormThemNhieuCN duocSua={duocSua} dsDoiDA={dsDoiDA} />
        </div>
      ) : null}

      <div className="space-y-4">
        <TheGap
          tieuDe="Danh sách công nhân"
          moTa={`${ds.length} công nhân · ${noiThanh.length} đội thi công · ${ngoaiThanh.length} đội DA`}
          chiDan="Xoá công nhân sẽ xoá luôn toàn bộ phân công và chấm công của người đó — thao tác không hoàn tác được, cân nhắc trước khi xoá người đã có dữ liệu công."
        >
          {ds.length ? (
            <DanhSachDoiTab ds={ds} duocSua={duocSua} dsDoiDA={dsDoiDA} />
          ) : (
            <Rong>Chưa có công nhân nào. Bấm “Thêm công nhân” để bắt đầu.</Rong>
          )}
        </TheGap>

        <TheGap
          tieuDe="Khu vực công trình"
          moTa="Khai báo công trình thuộc nội thành hay ngoại thành và ai là người chấm công tại chỗ"
          chiDan="Danh sách công trình lấy thẳng từ mục Công trình, không nhập lại. Module này chỉ bổ sung hai thuộc tính riêng của nghiệp vụ chấm công."
        >
          <Bang>
            <thead>
              <tr>
                <Th>Mã công trình</Th>
                <Th>Tên công trình</Th>
                <Th>Khu vực · Đội DA · Người phụ trách</Th>
              </tr>
            </thead>
            <tbody>
              {congTrinh.map((c) => (
                <tr key={c.id} className="hover:bg-nen">
                  <Td className="text-xs whitespace-nowrap">
                    <NhanCongTrinh tenRutGon={c.tenRutGon} ma={c.maCongTrinh} />
                  </Td>
                  <Td className="max-w-70 truncate text-xs" title={c.tenCongTrinh}>
                    {c.tenCongTrinh}
                  </Td>
                  <Td>
                    <FormKhuVuc ct={c} duocSua={duocSua} dsDoiDA={dsDoiDA} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Bang>
        </TheGap>

        <TheGap
          tieuDe="Đội dự án (Đội DA)"
          moTa={`${dsDoiDA.length} đội — sửa tên, gán người quản lý (chấm công dự án) và nhóm công trình vào dự án`}
        >
          <QuanLyDoiDA
            ds={dsDoiDA}
            duocSua={duocSua}
            dsCanBo={canBoUser}
            dsCongTrinh={congTrinh}
          />
        </TheGap>

        <TheGap
          tieuDe="Lịch ngày lễ"
          moTa="Quản trị hệ thống chọn ngày và gán tên ngày lễ. Ngày lễ tính như Chủ nhật khi tổng hợp — không có công thường, giờ làm dồn vào cột tăng ca ngày lễ"
        >
          <div className="p-4">
            <QuanLyNgayLe ds={ngayLe} laAdmin={laAdmin} />
          </div>
        </TheGap>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Phân công ngày
async function PhanCong({
  ngay: ngayTho,
  che,
  duocSua,
  laAdmin,
}: {
  ngay?: string;
  /** "" = ma trận điều động · "danh-sach" = lịch điều động theo tháng > ngày. */
  che: string;
  duocSua: boolean;
  laAdmin: boolean;
}) {
  // Mặc định là HÔM NAY theo đồng hồ máy — lịch điều động là việc của hiện tại,
  // không neo theo mốc dữ liệu demo.
  const ngay = ngayTho && /^\d{4}-\d{2}-\d{2}$/.test(ngayTho) ? ngayTho : homNay();
  const [congNhan, congTrinh, daPhan, lich, mauChep] = await Promise.all([
    layCongNhan(),
    layCongTrinhChamCong(),
    oDaPhan(ngay),
    lichDieuDong(),
    baNgayMauChep(ngay),
  ]);

  // Chỉ đội nội thành mới đi qua bước này (§4.3).
  const cnNoiThanh = congNhan.filter((c) => c.doi === "NOI_THANH");
  const khoaVinhVien = !choPhepSuaLich(ngay);
  const coLich = Object.keys(daPhan).length > 0;

  const chuyenChoDo = (c: string) =>
    `/cong-nhan?muc=phan-cong&ngay=${ngay}${c ? `&che=${c}` : ""}`;

  return (
    <>
      <CanhBaoBox bienThe="nhan" tieuDe="Phân công là KẾ HOẠCH, chưa phải thực tế">
        <p>
          Bước này do Cán bộ quản lý làm cho <strong>đội nội thành</strong>. Đội ngoại thành chấm
          công trực tiếp nên không xuất hiện ở đây. Số công thật ghi ở mục <strong>Chấm công</strong>
          , và có thể khác phân công — chênh lệch sẽ hiện ở mục <strong>Đối chiếu</strong>.
        </p>
      </CanhBaoBox>

      <ChonNgayNhanh ngay={ngay} muc="phan-cong" nhan="Ngày điều động" />

      <div className="mb-3 flex flex-wrap gap-1.5">
        <LocLink href={chuyenChoDo("")} dangChon={che === ""}>
          Điều động
        </LocLink>
        <LocLink href={chuyenChoDo("danh-sach")} dangChon={che === "danh-sach"}>
          Lịch sử điều động
        </LocLink>
      </div>

      {che === "danh-sach" ? (
        <The>
          <TheDau
            tieuDe="Lịch sử điều động"
            moTa={`${lich.reduce((a, t) => a + t.ngays.length, 0)} ngày · xếp theo tháng, bấm một ngày để mở bảng điều động`}
          />
          {lich.length ? (
            <div className="divide-y divide-vien">
              {lich.map((t, i) => (
                <details key={t.thang} open={i === 0} className="px-4 py-2">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {nhanThang(t.thang)}{" "}
                    <span className="font-normal text-chunhat">({t.ngays.length} ngày)</span>
                  </summary>
                  <div className="mt-1.5 space-y-1.5 pl-3">
                    {t.ngays.map((n) => (
                      <details key={n.ngay} className="rounded-lg border border-vien">
                        <summary className="cursor-pointer px-3 py-1.5 text-xs">
                          <strong>{nhanNgay(n.ngay)}</strong>
                          <span className="ml-2 text-chunhat">
                            {n.soCongTrinh} công trình · {n.soCongNhan} công nhân · {n.soLuot} lượt
                          </span>
                          <Link
                            href={`/cong-nhan?muc=phan-cong&ngay=${n.ngay}`}
                            className="ml-2 font-medium text-nhan hover:underline"
                          >
                            mở lịch
                          </Link>
                          {laAdmin ? (
                            <span className="ml-2 inline-block align-middle">
                              <NutXoaLichDieuDong ngay={n.ngay} laAdmin={laAdmin} />
                            </span>
                          ) : null}
                        </summary>
                        <Bang>
                          <thead>
                            <tr>
                              <Th>Công trình</Th>
                              <Th>Tên công trình</Th>
                              <Th>Công nhân</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {n.congTrinh.map((c) => (
                              <tr key={c.maCongTrinh} className="align-top hover:bg-nen">
                                <Td className="text-xs whitespace-nowrap">
                                  <NhanCongTrinh tenRutGon={c.tenRutGon} ma={c.maCongTrinh} />
                                </Td>
                                <Td className="max-w-70 truncate text-xs" title={c.tenCongTrinh}>
                                  {c.tenCongTrinh}
                                </Td>
                                <Td className="text-xs">
                                  <div className="flex flex-col gap-0.5">
                                    {c.congNhan.map((x, j) => (
                                      <span key={j}>{x}</span>
                                    ))}
                                  </div>
                                </Td>
                              </tr>
                            ))}
                          </tbody>
                        </Bang>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <Rong>Chưa có ngày nào được điều động.</Rong>
          )}
        </The>
      ) : (
        <The>
          <TheDau
            tieuDe={`Điều động ${nhanNgay(ngay)}`}
            moTa="Chọn buổi ở từng ô để điều công nhân (hàng) vào công trình (cột), rồi bấm Lưu"
          />
          {duocSua ? (
            <MaTranPhanCong
              key={ngay}
              ngay={ngay}
              congNhan={cnNoiThanh}
              congTrinh={congTrinh}
              daPhan={daPhan}
              khoaVinhVien={khoaVinhVien}
              coLich={coLich}
              mauChep={mauChep}
            />
          ) : (
            <p className="p-4 text-xs text-chunhat">
              Vai trò của bạn chỉ được xem. Chuyển sang “Lịch sử điều động” để tra cứu.
            </p>
          )}
        </The>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Chấm công
async function ChamCong({
  ngay: ngayTho,
  ct: ctTho,
  da: daTho,
  duocSua,
}: {
  ngay?: string;
  ct?: string;
  da?: string;
  duocSua: boolean;
}) {
  const ngay = ngayTho && /^\d{4}-\d{2}-\d{2}$/.test(ngayTho) ? ngayTho : homNay();
  const [congTrinh, ds] = await Promise.all([layCongTrinhChamCong(), chamCongNgay(ngay)]);

  // Nội thành: tab công trình, chấm theo điều động. Ngoại thành: gom thành các
  // Đội DA (dự án), chấm trực tiếp cả đội — công trình ngoại thành KHÔNG hiện tab
  // riêng mà nằm trong ô chọn của bảng chấm công dự án.
  const noiThanhCT = congTrinh.filter((c) => c.khuVuc === "NOI_THANH");
  const doiMap = new Map<string, string>();
  for (const c of congTrinh) {
    if (c.khuVuc === "NGOAI_THANH" && c.doiDAId) doiMap.set(c.doiDAId, c.tenDoiDA || "Đội DA");
  }
  const doiList = [...doiMap.entries()].map(([id, ten]) => ({ id, ten }));

  if (!noiThanhCT.length && !doiList.length) {
    return (
      <>
        <ChonNgayNhanh ngay={ngay} muc="cham-cong" nhan="Ngày chấm công" />
        <The>
          <TheDau tieuDe={`Chấm công ${nhanNgay(ngay)}`} />
          <Rong>Bạn chưa được giao công trình hay dự án nào để chấm công.</Rong>
        </The>
      </>
    );
  }

  // Gom điều động nội thành theo công trình — mỗi lượt là một dòng.
  const theoCT = new Map<string, typeof ds>();
  for (const d of ds) {
    const arr = theoCT.get(d.projectId);
    if (arr) arr.push(d);
    else theoCT.set(d.projectId, [d]);
  }

  // Lựa chọn hiện tại: ưu tiên ?da (dự án), rồi ?ct (công trình), rồi mặc định.
  const coPhan = (c: (typeof noiThanhCT)[number]) => (theoCT.get(c.id)?.length ?? 0) > 0;
  const daChon = daTho && doiMap.has(daTho) ? daTho : null;
  const ctChon = !daChon
    ? (noiThanhCT.find((c) => c.maCongTrinh === ctTho) ??
      (ctTho ? null : noiThanhCT.find(coPhan) ?? noiThanhCT[0]))
    : null;
  // Không khớp gì: nếu có công trình nội thành thì lấy công trình đầu, không thì đội đầu.
  const modeDoi = daChon ?? (ctChon ? null : doiList[0]?.id ?? null);
  const activeCT = ctChon ?? (modeDoi ? null : noiThanhCT.find(coPhan) ?? noiThanhCT[0]);
  const activeDoi = modeDoi;

  const tabCT = (c: (typeof noiThanhCT)[number]) => {
    const n = theoCT.get(c.id)?.length ?? 0;
    const laActive = !activeDoi && c.id === activeCT?.id;
    return (
      <Link
        key={c.id}
        href={`/cong-nhan?muc=cham-cong&ngay=${ngay}&ct=${encodeURIComponent(c.maCongTrinh)}`}
        scroll={false}
        title={`${c.maCongTrinh} — ${c.tenCongTrinh}`}
        className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
          laActive
            ? "bg-nhan text-white"
            : n > 0
              ? "border border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
              : "text-chunhat hover:bg-nen hover:text-chu"
        }`}
      >
        {c.tenRutGon || c.maCongTrinh}
        {n > 0 ? <span className="ml-1 font-semibold">({n})</span> : null}
      </Link>
    );
  };

  const tabDoi = (d: { id: string; ten: string }) => {
    const laActive = activeDoi === d.id;
    return (
      <Link
        key={d.id}
        href={`/cong-nhan?muc=cham-cong&ngay=${ngay}&da=${encodeURIComponent(d.id)}`}
        scroll={false}
        title={`Dự án ${d.ten}`}
        className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
          laActive
            ? "bg-violet-600 text-white"
            : "border border-violet-300 bg-violet-100 text-violet-900 hover:bg-violet-200 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
        }`}
      >
        DA · {d.ten}
      </Link>
    );
  };

  return (
    <>
      <ChonNgayNhanh ngay={ngay} muc="cham-cong" nhan="Ngày chấm công" />

      <The>
        {/* Thanh điều hướng: tab công trình nội thành + tab dự án (Đội DA). */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-vien p-3">
          {noiThanhCT.map(tabCT)}
          {doiList.map(tabDoi)}
        </div>

        {activeDoi ? (
          <ChamCongDoiPanel daId={activeDoi} ngay={ngay} duocSua={duocSua} />
        ) : (
          <>
            <TheDau
              tieuDe={`Chấm công ${nhanNgay(ngay)} — ${activeCT!.tenRutGon || activeCT!.maCongTrinh}`}
              moTa={`${activeCT!.maCongTrinh} · ${activeCT!.tenCongTrinh}`}
              chiDan="Danh sách lấy từ điều động của công trình trong ngày. Mỗi ca làm 0,5 công; vắng có phép vẫn tính công, vắng không phép thì không. Chủ nhật và ngày lễ chỉ tính giờ tăng ca. Tab tím (DA ·) là dự án ngoại thành — chấm trực tiếp cả đội."
            />
            <BangChamCong
              key={`${ngay}:${activeCT!.id}`}
              ngay={ngay}
              chuNhat={laChuNhat(ngay)}
              ds={theoCT.get(activeCT!.id) ?? []}
              daLuu={
                (theoCT.get(activeCT!.id)?.length ?? 0) > 0 &&
                (theoCT.get(activeCT!.id) ?? []).every((r) => r.daCham)
              }
              duocSua={duocSua}
            />
          </>
        )}
      </The>
    </>
  );
}

/** Panel chấm công một dự án (Đội DA): nạp dữ liệu đội rồi dựng bảng cả đội. */
async function ChamCongDoiPanel({
  daId,
  ngay,
  duocSua,
}: {
  daId: string;
  ngay: string;
  duocSua: boolean;
}) {
  const info = await chamCongDoiDA(daId, ngay);
  if (!info) {
    return (
      <>
        <TheDau tieuDe={`Chấm công dự án ${nhanNgay(ngay)}`} />
        <Rong>Dự án này ngoài phạm vi của bạn.</Rong>
      </>
    );
  }
  const daLuu = info.rows.length > 0 && info.rows.every((r) => r.daCham);
  return (
    <>
      <TheDau
        tieuDe={`Chấm công dự án ${nhanNgay(ngay)} — ${info.ten}`}
        moTa={`${info.rows.length} công nhân · ${info.congTrinhs.length} công trình trong dự án`}
        chiDan="Chấm công trực tiếp theo dự án: cả đội hiện sẵn, mỗi người chọn công trình của dự án rồi chấm ca. Bỏ chọn công trình nghĩa là người đó không làm hôm đó. Mỗi ca 0,5 công; Chủ nhật và ngày lễ chỉ tính giờ tăng ca."
      />
      <BangChamCongDA
        key={`${ngay}:${daId}`}
        ngay={ngay}
        doiDAId={daId}
        chuNhat={laChuNhat(ngay)}
        congTrinhs={info.congTrinhs}
        ds={info.rows}
        daLuu={daLuu}
        duocSua={duocSua}
      />
    </>
  );
}

// ---------------------------------------------------------------- Tổng hợp tháng
async function TongHop({
  thang: thangTho,
  view: viewTho,
  cn,
}: {
  thang?: string;
  view: string;
  cn?: string;
}) {
  const [dsThang, dsDoiDA] = await Promise.all([cacThangChamCong(), layDoiDA()]);
  const thang = dsThang.includes(thangTho ?? "") ? thangTho! : (dsThang[0] ?? homNay().slice(0, 7));
  const view = viewTho === "cong-nhan" ? "cong-nhan" : "cong-trinh";
  const goc = (v: string) => `/cong-nhan?muc=tong-hop&thang=${thang}&view=${v}`;

  return (
    <>
      <ChonThang thang={thang} dsThang={dsThang} muc="tong-hop" />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <LocLink href={goc("cong-trinh")} dangChon={view === "cong-trinh"}>
          Theo công trình
        </LocLink>
        <LocLink href={goc("cong-nhan")} dangChon={view === "cong-nhan"}>
          Theo công nhân
        </LocLink>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <span className="text-xs text-chunhat">Xuất Excel:</span>
          <a
            href={`/api/xuat-cham-cong?thang=${thang}&doi=NOI_THANH`}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            <FileDown className="size-3.5" /> Đội thi công
          </a>
          {/* Đội dự án: chọn đội muốn xuất từ danh sách (mỗi đội một file riêng). */}
          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 [&::-webkit-details-marker]:hidden">
              <FileDown className="size-3.5" /> Đội dự án ▾
            </summary>
            <div className="absolute right-0 z-20 mt-1 min-w-44 rounded-md border border-vien bg-the p-1 shadow-lg">
              {dsDoiDA.length ? (
                dsDoiDA.map((d) => (
                  <a
                    key={d.id}
                    href={`/api/xuat-cham-cong?thang=${thang}&doi=NGOAI_THANH&doiDAId=${encodeURIComponent(d.id)}`}
                    className="block rounded px-2 py-1 text-xs hover:bg-nen"
                  >
                    {d.ten}
                  </a>
                ))
              ) : (
                <p className="px-2 py-1 text-xs text-chunhat">Chưa có đội DA nào.</p>
              )}
            </div>
          </details>
        </span>
      </div>

      {view === "cong-nhan" && cn ? (
        <TimeSheet congNhanId={cn} thang={thang} quayLai={goc("cong-nhan")} />
      ) : (
        <TongHopBang thang={thang} view={view} />
      )}
    </>
  );
}

async function TongHopBang({ thang, view }: { thang: string; view: "cong-trinh" | "cong-nhan" }) {
  const th = await tongHopThang(thang);
  const rong = view === "cong-nhan" ? !th.theoCongNhan.length : !th.theoCongTrinh.length;

  if (rong) {
    return (
      <The>
        <TheDau tieuDe={`Tổng hợp ${nhanThang(thang)}`} />
        <Rong>Chưa có dữ liệu chấm công trong tháng này.</Rong>
      </The>
    );
  }

  if (view === "cong-nhan") {
    return (
      <The>
        <TheDau
          tieuDe="Tổng hợp theo công nhân"
          moTa={`${nhanThang(thang)} · bấm tên để xem time sheet`}
          chiDan="Số công = ngày đi làm thật (không gồm nghỉ phép). Tổng công = Số công + Nghỉ phép (nghỉ phép tính như ngày công). Chủ nhật và ngày lễ không tính công thường mà dồn giờ vào cột tăng ca riêng."
        />
        <Bang>
          <thead>
            <tr>
              <Th>Tên công nhân</Th>
              <Th phai>Số công</Th>
              <Th phai>Nghỉ phép</Th>
              <Th phai>Tổng công</Th>
              <Th phai>TC trong ngày (h)</Th>
              <Th phai>TC qua đêm (h)</Th>
              <Th phai>TC Chủ nhật (h)</Th>
              <Th phai>TC ngày lễ (h)</Th>
            </tr>
          </thead>
          <tbody>
            {th.theoCongNhan.map((r) => (
              <tr key={r.congNhanId} className="hover:bg-nen">
                <Td className="text-xs font-medium whitespace-nowrap">
                  <Link
                    href={`/cong-nhan?muc=tong-hop&thang=${thang}&view=cong-nhan&cn=${r.congNhanId}`}
                    className="text-nhan hover:underline"
                  >
                    {r.hoTen}
                  </Link>
                  <span className="ml-1 text-chunhat">{r.maCN}</span>
                </Td>
                <Td phai>{r.soCong ? soCong(r.soCong) : "—"}</Td>
                <Td phai>{r.nghiPhep ? soCong(r.nghiPhep) : "—"}</Td>
                <Td phai className="font-semibold">{soCong(r.tongCong)}</Td>
                <Td phai>{r.tcTrongNgay ? soCong(r.tcTrongNgay) : "—"}</Td>
                <Td phai>{r.tcQuaDem ? soCong(r.tcQuaDem) : "—"}</Td>
                <Td phai>{r.tcChuNhat ? soCong(r.tcChuNhat) : "—"}</Td>
                <Td phai>{r.tcNgayLe ? soCong(r.tcNgayLe) : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Bang>
      </The>
    );
  }

  return (
    <The>
      <TheDau tieuDe="Tổng hợp theo công trình" moTa={nhanThang(thang)} />
      <Bang>
        <thead>
          <tr>
            <Th>Mã CT</Th>
            <Th>Tên công trình</Th>
            <Th phai>Số người</Th>
            <Th phai>Số công</Th>
            <Th phai>TC trong ngày (h)</Th>
            <Th phai>TC qua đêm (h)</Th>
            <Th phai>TC Chủ nhật (h)</Th>
            <Th phai>TC ngày lễ (h)</Th>
          </tr>
        </thead>
        <tbody>
          {th.theoCongTrinh.map((r) => (
            <tr key={r.maCongTrinh} className="hover:bg-nen">
              <Td className="text-xs whitespace-nowrap">
                <NhanCongTrinh tenRutGon={r.tenRutGon} ma={r.maCongTrinh} />
              </Td>
              <Td className="max-w-55 truncate text-xs" title={r.tenCongTrinh}>
                {r.tenCongTrinh}
              </Td>
              <Td phai>{r.soNguoi}</Td>
              <Td phai className="font-semibold">
                {soCong(r.soCong)}
              </Td>
              <Td phai>{r.tcTrongNgay ? soCong(r.tcTrongNgay) : "—"}</Td>
              <Td phai>{r.tcQuaDem ? soCong(r.tcQuaDem) : "—"}</Td>
              <Td phai>{r.tcChuNhat ? soCong(r.tcChuNhat) : "—"}</Td>
              <Td phai>{r.tcNgayLe ? soCong(r.tcNgayLe) : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </Bang>
    </The>
  );
}

/** Time sheet của một công nhân: MỘT lịch tháng gộp, bấm ngày xem chi tiết. */
async function TimeSheet({
  congNhanId,
  thang,
  quayLai,
}: {
  congNhanId: string;
  thang: string;
  quayLai: string;
}) {
  const t = await timeSheetCongNhan(congNhanId, thang);
  if (!t) return <Rong>Không tìm thấy công nhân.</Rong>;

  // Tổng công = đi làm thật + nghỉ phép; tổng giờ tăng ca = TC ngày + TC đêm.
  const tongCong = t.ngays.reduce((a, n) => a + n.cong + n.nghiPhep, 0);
  const tongOT = t.ngays.reduce((a, n) => a + n.tcNgay + n.tcDem, 0);

  return (
    <The>
      <TheDau
        tieuDe={`Time sheet — ${t.hoTen}`}
        moTa={`${t.maCN} · ${nhanThang(thang)} · tổng ${soCong(tongCong)} công · ${soCong(tongOT)} giờ tăng ca`}
        phai={
          <Link href={quayLai} className="text-xs font-medium text-nhan hover:underline">
            ← Danh sách
          </Link>
        }
      />
      <LichTimeSheet ngays={t.ngays} />
    </The>
  );
}

// ---------------------------------------------------------------- Đối chiếu
async function DoiChieu({ thang: thangTho }: { thang?: string }) {
  const dsThang = await cacThangChamCong();
  const thang = dsThang.includes(thangTho ?? "") ? thangTho! : (dsThang[0] ?? NGAY_HIEN_TAI.slice(0, 7));
  const ds = await doiChieuThang(thang);

  const dem = new Map<string, number>();
  for (const d of ds) dem.set(d.loai, (dem.get(d.loai) ?? 0) + 1);

  return (
    <>
      <ChonThang thang={thang} dsThang={dsThang} muc="doi-chieu" />

      <The>
        <TheDau
          tieuDe={`Đối chiếu phân công với thực tế — ${nhanThang(thang)}`}
          moTa={
            ds.length
              ? [...dem.entries()].map(([k, v]) => `${nhanLech(k)}: ${v}`).join(" · ")
              : "Không có chênh lệch nào"
          }
          chiDan="Chỉ xét đội nội thành — đội ngoại thành theo thiết kế không đi qua bước phân công nên đưa vào đây thì dòng nào cũng báo lệch. Riêng “Tổng công trong ngày vượt 1” xét cả hai đội: một người làm hai công trình trong ngày là hợp lệ, nhưng cần soi lại xem có nhập nhầm không."
        />
        {ds.length ? (
          <Bang>
            <thead>
              <tr>
                <Th>Ngày</Th>
                <Th>Mã CN</Th>
                <Th>Họ tên</Th>
                <Th>Được phân</Th>
                <Th>Thực tế</Th>
                <Th phai>Số công</Th>
                <Th>Loại chênh lệch</Th>
                <Th>Ghi chú</Th>
              </tr>
            </thead>
            <tbody>
              {ds.map((d, i) => (
                <tr key={`${d.ngay}-${d.maCN}-${d.loai}-${i}`} className="hover:bg-nen">
                  <Td className="text-xs whitespace-nowrap">{d.ngay}</Td>
                  <Td className="text-xs whitespace-nowrap">{d.maCN}</Td>
                  <Td className="text-xs font-medium">{d.hoTen}</Td>
                  <Td className="text-xs">{d.maCTPhanCong || "—"}</Td>
                  <Td className="text-xs">{d.maCTThucTe || "—"}</Td>
                  <Td phai>{d.soCong ? soCong(d.soCong) : "—"}</Td>
                  <Td>
                    <Nhan bienThe={d.loai === "KHONG_CHAM" ? "do" : "vang"}>
                      {nhanLech(d.loai)}
                    </Nhan>
                  </Td>
                  <Td className="max-w-55 truncate text-xs" title={d.ghiChu}>
                    {d.ghiChu || "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Bang>
        ) : (
          <Rong>
            Không có chênh lệch: mọi công nhân nội thành đều làm đúng công trình được phân.
          </Rong>
        )}
      </The>
    </>
  );
}

// ---------------------------------------------------------------- Dùng chung
function O({ nhan, giaTri }: { nhan: string; giaTri: string | number }) {
  return (
    <div className="rounded-xl border border-vien bg-the p-3">
      <p className="text-xs text-chunhat">{nhan}</p>
      <p className="so mt-1 text-lg font-semibold">{giaTri}</p>
    </div>
  );
}

function ChonThang({
  thang,
  dsThang,
  muc,
}: {
  thang: string;
  dsThang: string[];
  muc: string;
}) {
  if (!dsThang.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-vien bg-the px-3 py-2">
      <span className="mr-1 text-xs font-medium text-chunhat">Tháng</span>
      {dsThang.map((t) => (
        <LocLink key={t} href={`/cong-nhan?muc=${muc}&thang=${t}`} dangChon={t === thang}>
          {nhanThang(t)}
        </LocLink>
      ))}
    </div>
  );
}
