import Link from "next/link";
import {
  Bang,
  DauTrang,
  GhiChuNguon,
  Nhan,
  NhanSucKhoe,
  O_So,
  Td,
  The,
  TheDau,
  Th,
  ThanhTyLe,
} from "@/components/ui";
import { ngay, phanTram, tien } from "@/lib/format";
import { Lock } from "lucide-react";
import {
  danhMucSucKhoe,
  layCongTrinhNgung,
  type DongDanhMuc,
} from "@/lib/data/repository";
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { coQuyen, phamViCongTrinh } from "@/lib/auth/quyen";
import { FormThemCongTrinh, NutMoLaiTheoDoi, NutSuaCongTrinh } from "@/components/sua-cong-trinh";

export const metadata = { title: "Danh mục công trình" };

export default async function TrangDanhMucCongTrinh() {
  // Danh mục hiện MỌI công trình (kể cả ngoài phạm vi) — nhưng công trình ngoài
  // phạm vi chỉ hiện tên, không bấm vào chi tiết được (chặn ở trang chi tiết).
  const [ds, nguoiDung] = await Promise.all([danhMucSucKhoe(true), nguoiDungHienTai()]);
  const pv = phamViCongTrinh(nguoiDung); // null = thấy tất cả (ADMIN, BGĐ, thư ký)
  const trongPhamVi = (ma: string) => pv === null || pv.includes(ma);

  const dem = { Xanh: 0, "Vàng": 0, "Đỏ": 0 } as Record<string, number>;
  for (const r of ds) dem[r.sucKhoe]++;

  // Ẩn nút với vai trò không được phép. Chốt chặn thật nằm trong Server Action.
  const duocSua = coQuyen(nguoiDung, "tao_cong_trinh");
  // Công trình đã ngừng theo dõi — chỉ hiện cho người được sửa, để mở lại.
  const dsNgung = duocSua ? await layCongTrinhNgung() : [];

  // Hai nhóm tách bạch: đã nghiệm thu lên trên (đóng sổ, chỉ tra cứu), đang thi
  // công xuống dưới (nơi số liệu còn chạy hằng ngày).
  const daXong = ds.filter((r) => r.congTrinh.trangThai === "Đã nghiệm thu");
  const dangChay = ds.filter((r) => r.congTrinh.trangThai !== "Đã nghiệm thu");

  return (
    <>
      <DauTrang
        tieuDe="Danh mục công trình"
        moTa="So sánh toàn bộ công trình trên cùng một bảng theo §4.2. Bấm mã công trình để xem chi tiết và truy vết xuống từng giao dịch."
        phai={
          <>
            <Nhan bienThe="xanh">Xanh {dem.Xanh}</Nhan>
            <Nhan bienThe="vang">Vàng {dem["Vàng"]}</Nhan>
            <Nhan bienThe="do">Đỏ {dem["Đỏ"]}</Nhan>
          </>
        }
      />

      {duocSua ? (
        <div className="mb-4">
          <FormThemCongTrinh />
        </div>
      ) : null}

      <The className="mb-4">
        <TheDau tieuDe={`Đang thi công (${dangChay.length})`} />
        <BangCongTrinh ds={dangChay} duocSua={duocSua} trongPhamVi={trongPhamVi} />
      </The>

      {daXong.length ? (
        <The>
          <TheDau
            tieuDe={`Đã hoàn thành / nghiệm thu (${daXong.length})`}
            moTa="Dữ liệu đã đóng băng — chỉ tra cứu, không thêm hay sửa được nữa"
          />
          <BangCongTrinh ds={daXong} duocSua={duocSua} trongPhamVi={trongPhamVi} mo />
        </The>
      ) : null}

      {dsNgung.length ? (
        <The className="mt-4">
          <TheDau
            tieuDe={`Ngừng theo dõi (${dsNgung.length})`}
            moTa="Công trình đã bỏ tích “Còn theo dõi” — ẩn khỏi báo cáo. Bấm “Mở lại theo dõi” để đưa về danh mục."
          />
          <Bang>
            <thead>
              <tr>
                <Th>Mã công trình</Th>
                <Th>Tên công trình</Th>
                <Th className="w-40" />
              </tr>
            </thead>
            <tbody>
              {dsNgung.map((c) => (
                <tr key={c.maCongTrinh} className="text-chunhat hover:bg-nen">
                  <Td className="font-mono whitespace-nowrap">{c.maCongTrinh}</Td>
                  <Td className="max-w-70 truncate text-xs" title={c.tenCongTrinh}>
                    {c.tenCongTrinh}
                  </Td>
                  <Td>
                    <NutMoLaiTheoDoi maCongTrinh={c.maCongTrinh} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Bang>
        </The>
      ) : null}

      <GhiChuNguon>
        <strong>BOQ</strong> là giá trị hợp đồng theo bảng khối lượng; <strong>Bill</strong> là lũy
        kế giá trị thực hiện đã được xác nhận; <strong>Tiến độ TH</strong> = Bill / BOQ. Công trình
        chưa nhập BOQ để trống ba cột này. Biên LN để trống khi chưa ghi nhận doanh thu — không quy
        về 0% để tránh hiểu nhầm.
      </GhiChuNguon>
    </>
  );
}

/**
 * Bảng công trình rút gọn còn 12 cột để xem hết trong một màn hình, không phải
 * kéo ngang. Nút sửa nằm ở cột đầu tiên (trước mã công trình) thay cho cột
 * "Thao tác" ở tận cùng bên phải.
 */
function BangCongTrinh({
  ds,
  duocSua,
  trongPhamVi,
  mo,
}: {
  ds: DongDanhMuc[];
  duocSua: boolean;
  /** Công trình này có nằm trong phạm vi người dùng không — quyết định bấm được hay không. */
  trongPhamVi: (ma: string) => boolean;
  /** Làm tối cả nhóm — dùng cho công trình đã nghiệm thu. */
  mo?: boolean;
}) {
  return (
    <Bang>
      <thead>
        <tr>
          {duocSua ? <Th className="w-8" /> : null}
          <Th className="sticky left-0 z-20">Mã công trình</Th>
          <Th>Tên công trình</Th>
          <Th>Chủ đầu tư</Th>
          <Th>Chỉ huy trưởng</Th>
          <Th>Bắt đầu</Th>
          <Th phai>BOQ</Th>
          <Th phai>Bill</Th>
          <Th phai>CP thực hiện</Th>
          <Th phai>LN gộp</Th>
          <Th phai>Biên LN</Th>
          <Th>Tiến độ TH</Th>
          <Th>Sức khỏe</Th>
        </tr>
      </thead>
      <tbody>
        {ds.map((r) => (
          <tr
            key={r.congTrinh.id}
            className={mo ? "bg-nen/70 text-chunhat hover:bg-nen" : "hover:bg-nen"}
          >
            {duocSua ? (
              <Td className="w-8">
                <NutSuaCongTrinh ct={r.congTrinh} />
              </Td>
            ) : null}
            <Td className={`sticky left-0 z-10 whitespace-nowrap ${mo ? "bg-nen/70" : "bg-the"}`}>
              {trongPhamVi(r.congTrinh.maCongTrinh) ? (
                <Link
                  href={`/cong-trinh/${encodeURIComponent(r.congTrinh.maCongTrinh)}`}
                  className="font-medium text-nhan hover:underline"
                >
                  {r.congTrinh.maCongTrinh}
                </Link>
              ) : (
                <span
                  className="inline-flex items-center gap-1 font-medium text-chunhat"
                  title="Ngoài phạm vi được giao — không xem chi tiết được"
                >
                  <Lock className="size-3" />
                  {r.congTrinh.maCongTrinh}
                </span>
              )}
            </Td>
            <Td className="max-w-60 truncate text-xs" title={r.congTrinh.tenCongTrinh}>
              {r.congTrinh.tenCongTrinh}
            </Td>
            <Td className="max-w-45 truncate text-xs" title={r.congTrinh.chuDauTu}>
              {r.congTrinh.chuDauTu}
            </Td>
            <Td className="text-xs whitespace-nowrap">{r.congTrinh.chiHuyTruong}</Td>
            <Td className="text-xs whitespace-nowrap">{ngay(r.congTrinh.ngayBatDau)}</Td>
            <Td phai>
              {r.boqHopDong !== null ? (
                tien(r.boqHopDong)
              ) : (
                <span className="text-chunhat">chưa có BOQ</span>
              )}
            </Td>
            <Td phai>{tien(r.doanhThu)}</Td>
            <Td phai>{tien(r.chiPhi)}</Td>
            <Td phai>
              <O_So am={r.loiNhuan < 0}>{tien(r.loiNhuan)}</O_So>
            </Td>
            <Td phai>{phanTram(r.bienLN)}</Td>
            <Td>
              {r.boqHopDong ? (
                <ThanhTyLe tyLe={r.doanhThu / r.boqHopDong} />
              ) : (
                <span className="text-xs text-chunhat">—</span>
              )}
            </Td>
            <Td>
              <NhanSucKhoe sucKhoe={r.sucKhoe} lyDo={r.lyDo} />
            </Td>
          </tr>
        ))}
      </tbody>
    </Bang>
  );
}
