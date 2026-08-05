import { BieuDoKHTH } from "@/components/charts";
import {
  Bang,
  DauTrang,
  GhiChuNguon,
  LocLink,
  Nhan,
  O_So,
  Td,
  The,
  TheDau,
  Th,
  ThanhTyLe,
} from "@/components/ui";
import { tien } from "@/lib/format";
import {
  keHoachTheoMa,
  keHoachVsThucHien,
  layCongTrinh,
  layDanhMucTheoCay,
} from "@/lib/data/repository";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { coQuyen } from "@/lib/auth/quyen";
import { motGiaTri } from "@/lib/search-params";
import { MA_DOANH_THU_DIEU_HANH } from "@/lib/thresholds";
import { LuoiKeHoach } from "@/components/luoi-ke-hoach";
import type { CongTrinh } from "@/lib/types";

export const metadata = { title: "Kế hoạch – Ngân sách" };

/**
 * Kế hoạch – Ngân sách.
 *
 * Đã BỎ tab "Ánh xạ hệ mã": kế hoạch dùng thẳng danh mục mã hiện hành, không còn
 * khâu dịch từ hệ mã cũ DA* nữa. Số liệu không đổi vì mỗi dòng kế hoạch đã lưu
 * sẵn mã mới trong `PlanLine.maDTCP` từ lúc nạp dữ liệu.
 */
export default async function TrangKeHoach({ searchParams }: PageProps<"/ke-hoach">) {
  const sp = await searchParams;
  const dsCongTrinh = await layCongTrinh();
  const ctParam = motGiaTri(sp.ct);
  const ctChon = dsCongTrinh.find((c) => c.maCongTrinh === ctParam);
  const duocSua = coQuyen(await nguoiDungHienTai(), "sua_ke_hoach");

  // Chọn công trình thì MỌI thứ bên dưới (thẻ tổng, biểu đồ, bảng chi tiết) đều
  // lọc theo công trình đó; không chọn thì là số tổng hợp toàn bộ.
  const ds = await keHoachVsThucHien(ctChon?.maCongTrinh);
  const phamVi = ctChon ? `${ctChon.maCongTrinh} — ${ctChon.tenCongTrinh}` : "Tất cả công trình";

  const chiPhi = ds.filter((d) => d.loai === "Chi phí" && (d.keHoach > 0 || d.thucHien > 0));

  const tongKH = chiPhi.reduce((a, d) => a + d.keHoach, 0);
  const tongTH = chiPhi.reduce((a, d) => a + d.thucHien, 0);

  /*
   * Bảng chi tiết dựng từ TOÀN BỘ danh mục theo cây 2 cấp, cùng trật tự với lưới
   * nhập và bảng chi phí ở màn hình công trình — không chỉ liệt kê mã có phát
   * sinh, để nhìn ra ngay mã nào chưa được cấp ngân sách.
   *
   * Bỏ mã Bill: đó là giá trị khối lượng thực hiện, không phải khoản lập ngân sách.
   */
  const traKQ = new Map(ds.map((d) => [d.ma, d]));
  const bangChiTiet = (await layDanhMucTheoCay())
    .filter((c) => c.ma !== MA_DOANH_THU_DIEU_HANH)
    .map((c) => {
      const d = traKQ.get(c.ma);
      const keHoach = d?.keHoach ?? 0;
      const thucHien = d?.thucHien ?? 0;
      return {
        ma: c.ma,
        ten: c.ten,
        loai: c.loai,
        capCon: c.capCon,
        keHoach,
        thucHien,
        chenhLech: keHoach - thucHien,
        tyLe: keHoach ? thucHien / keHoach : null,
      };
    });

  const chartData = chiPhi.slice(0, 12).map((d) => ({
    ten: d.ten.length > 32 ? `${d.ten.slice(0, 30)}…` : d.ten,
    keHoach: d.keHoach,
    thucHien: d.thucHien,
  }));

  return (
    <>
      <DauTrang
        tieuDe="Kế hoạch – Ngân sách"
        moTa="So sánh ngân sách được duyệt với chi phí, doanh thu thực hiện. Kế hoạch lập theo danh mục mã doanh thu – chi phí hiện hành."
      />

      {/* ---- Chọn công trình để nhập kế hoạch ---- */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-chunhat">Công trình:</span>
        <LocLink href="/ke-hoach" dangChon={!ctChon}>
          Tổng hợp tất cả
        </LocLink>
        {dsCongTrinh.map((c) => (
          <LocLink
            key={c.maCongTrinh}
            href={`/ke-hoach?ct=${encodeURIComponent(c.maCongTrinh)}`}
            dangChon={ctChon?.maCongTrinh === c.maCongTrinh}
            title={`${c.maCongTrinh} — ${c.tenCongTrinh}`}
          >
            {c.tenRutGon || c.maCongTrinh}
          </LocLink>
        ))}
      </div>

      {ctChon ? <NhapKeHoach ct={ctChon} duocSua={duocSua} /> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-vien bg-the p-4">
          <p className="text-xs text-chunhat">Chi phí kế hoạch</p>
          <p className="so mt-1 text-xl font-semibold">{tien(tongKH)}</p>
        </div>
        <div className="rounded-xl border border-vien bg-the p-4">
          <p className="text-xs text-chunhat">Chi phí thực hiện</p>
          <p className="so mt-1 text-xl font-semibold">{tien(tongTH)}</p>
        </div>
        <div className="rounded-xl border border-vien bg-the p-4">
          <p className="text-xs text-chunhat">Chênh lệch</p>
          <p
            className={`so mt-1 text-xl font-semibold ${tongKH - tongTH < 0 ? "text-rose-600 dark:text-rose-400" : ""}`}
          >
            {tien(tongKH - tongTH)}
          </p>
        </div>
      </div>

      <The className="mt-4">
        <TheDau tieuDe="12 nhóm chi phí lớn nhất — Kế hoạch so với Thực hiện" moTa={phamVi} />
        <div className="p-3">
          <BieuDoKHTH data={chartData} />
        </div>
      </The>

      <The className="mt-4">
        <TheDau tieuDe="Chi tiết theo mã" moTa={`${phamVi} · lũy kế`} />
        <Bang>
          <thead>
            <tr>
              <Th>Mã</Th>
              <Th>Hạng mục</Th>
              <Th>Loại</Th>
              <Th phai>Kế hoạch</Th>
              <Th phai>Thực hiện</Th>
              <Th phai>Chênh lệch</Th>
              <Th>Tỷ lệ</Th>
            </tr>
          </thead>
          <tbody>
            {bangChiTiet.map((d) => (
              <tr key={d.ma} className={d.capCon ? "hover:bg-nen" : "bg-nen/60 hover:bg-nen"}>
                <Td className={`text-xs ${d.capCon ? "pl-8" : "font-semibold"}`}>
                  {d.ma}
                </Td>
                <Td
                  className={`max-w-70 truncate text-xs ${d.capCon ? "" : "font-semibold"}`}
                  title={d.ten}
                >
                  {d.ten}
                </Td>
                <Td>
                  <Nhan bienThe={d.loai === "Doanh thu" ? "nhan" : "trung_tinh"}>{d.loai}</Nhan>
                </Td>
                <Td phai>{d.keHoach ? tien(d.keHoach) : <span className="text-chunhat">—</span>}</Td>
                <Td phai>{tien(d.thucHien)}</Td>
                <Td phai>
                  <O_So am={d.chenhLech < 0}>{d.keHoach ? tien(d.chenhLech) : "—"}</O_So>
                </Td>
                <Td>
                  {d.tyLe !== null ? (
                    <ThanhTyLe tyLe={d.tyLe} />
                  ) : (
                    <span className="text-xs text-chunhat">chưa có KH</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Bang>
        <GhiChuNguon>
          Liệt kê đầy đủ danh mục mã theo cây 2 cấp (mã nhóm in đậm, mã chi tiết thụt vào), trừ mã{" "}
          <strong>Bill</strong> vì đó là giá trị khối lượng thực hiện chứ không phải khoản lập ngân
          sách. Chênh lệch = Kế hoạch − Thực hiện. Dòng “chưa có KH” là mã chưa được cấp ngân sách —
          nếu có phát sinh thực tế thì cần bổ sung kế hoạch hoặc xác nhận là chi ngoài kế hoạch.
        </GhiChuNguon>
      </The>
    </>
  );
}

/**
 * Khu nhập kế hoạch cho một công trình: lưới nhập tay hoặc tải file Excel.
 * Chỉ vai trò có quyền `sua_ke_hoach` mới thấy lưới; còn lại xem số đã lập.
 */
async function NhapKeHoach({ ct, duocSua }: { ct: CongTrinh; duocSua: boolean }) {
  /*
   * Xếp theo CÂY 2 CẤP, cùng trật tự với bảng chi phí ở màn hình công trình —
   * thứ tự lưu trong bảng xen kẽ cha con nên đọc rất rối.
   *
   * Lấy TOÀN BỘ danh mục kể cả mã nhóm: dữ liệu kế hoạch hiện có ĐANG nằm ở cả mã
   * nhóm (CP-041, CP-043…). Lọc bỏ chúng thì khi lưu sẽ xoá mất phần ngân sách đó.
   */
  const dsMa = (await layDanhMucTheoCay()).map((c) => ({
    ma: c.ma,
    ten: c.ten,
    loai: c.loai,
    capCon: c.capCon,
    laNhom: !c.choPhepNhapTrucTiep,
  }));

  const hienTai = await keHoachTheoMa(ct.maCongTrinh);
  const daLap = [...hienTai.values()].filter((v) => v > 0).length;

  if (!duocSua) {
    return (
      <The className="mb-4">
        <TheDau
          tieuDe={`Kế hoạch ${ct.maCongTrinh}`}
          moTa={`${daLap} mã đã có ngân sách · chỉ Quản trị hệ thống được sửa kế hoạch`}
        />
      </The>
    );
  }

  if (ct.trangThai === "Đã nghiệm thu") {
    return (
      <The className="mb-4">
        <TheDau
          tieuDe={`Kế hoạch ${ct.maCongTrinh}`}
          moTa="Công trình đã nghiệm thu — kế hoạch đóng băng, chỉ xem"
        />
      </The>
    );
  }

  return (
    <The className="mb-4">
      <TheDau
        tieuDe={`Kế hoạch — ${ct.maCongTrinh}`}
        moTa={`${ct.tenCongTrinh} · ${daLap}/${dsMa.length} mã đã có ngân sách`}
      />
      <LuoiKeHoach
        maCongTrinh={ct.maCongTrinh}
        tenCongTrinh={ct.tenCongTrinh}
        dsMa={dsMa}
        giaTriHienTai={Object.fromEntries(hienTai)}
      />
    </The>
  );
}
