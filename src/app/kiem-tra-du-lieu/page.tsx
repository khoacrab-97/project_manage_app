import Link from "next/link";
import { Bang, DauTrang, GhiChuNguon, Nhan, Rong, Td, The, TheDau, Th } from "@/components/ui";
import { ngay, nhanThang, tien } from "@/lib/format";
import {
  chatLuongDuLieu,
  diemChatLuong,
  layGiaoDichChoXuLy,
  layLoiDuLieu,
  layLoNhap,
} from "@/lib/data/repository";

export const metadata = { title: "Kiểm tra dữ liệu" };

export default async function TrangKiemTraDuLieu() {
  const chiTieu = await chatLuongDuLieu();
  const diem = await diemChatLuong();
  const loi = await layLoiDuLieu();
  const cho = await layGiaoDichChoXuLy();
  const traGD = new Map(cho.map((g) => [g.importBatchId + "|" + (g.sttNguon + 2), g]));
  const loLoi = (await layLoNhap()).filter((l) => l.trangThai === "ERROR");

  const tongLoiNghiemTrong = chiTieu.filter((c) => c.nghiemTrong).reduce((a, c) => a + c.soLuong, 0);

  return (
    <>
      <DauTrang
        tieuDe="Chất lượng dữ liệu"
        moTa="Báo cáo bắt buộc theo §4.5, không phải báo cáo phụ. 12 chỉ tiêu đo mức tin cậy của số liệu đang lên báo cáo điều hành."
        phai={
          <Nhan bienThe={diem >= 85 ? "xanh" : diem >= 60 ? "vang" : "do"}>
            Điểm chất lượng {diem}/100
          </Nhan>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <The className="xl:col-span-2">
          <TheDau
            tieuDe="12 chỉ tiêu chất lượng dữ liệu"
            moTa={`${tongLoiNghiemTrong} vấn đề nghiêm trọng đang tồn đọng`}
          />
          <Bang>
            <thead>
              <tr>
                <Th>Chỉ tiêu</Th>
                <Th>Mục đích kiểm soát</Th>
                <Th phai>Số lượng</Th>
                <Th>Mức</Th>
              </tr>
            </thead>
            <tbody>
              {chiTieu.map((c) => (
                <tr key={c.maChiTieu} className="hover:bg-nen">
                  <Td className="text-xs font-medium">{c.ten}</Td>
                  <Td className="text-xs text-chunhat">{c.mucDich}</Td>
                  <Td phai className="font-semibold">
                    {c.soLuong}
                  </Td>
                  <Td>
                    {c.soLuong === 0 ? (
                      <Nhan bienThe="xanh">Đạt</Nhan>
                    ) : c.nghiemTrong ? (
                      <Nhan bienThe="do">Cần xử lý</Nhan>
                    ) : (
                      <Nhan bienThe="vang">Theo dõi</Nhan>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Bang>
        </The>

        <The>
          <TheDau tieuDe="Cách chấm điểm" />
          <div className="space-y-3 p-4 text-xs text-chunhat">
            <p>
              Điểm phạt tính <strong className="text-chu">tương đối trên tổng số dòng</strong>, không
              theo số tuyệt đối: 30 dòng lỗi trên 300 dòng là tệ, trên 300.000 dòng thì không.
            </p>
            <p>
              Lỗi nghiêm trọng nhân hệ số 3, lỗi thường hệ số 1. §21 ghi rõ cách chấm phải được{" "}
              <strong className="text-chu">Data Owner thống nhất</strong> — trọng số hiện tại là đề
              xuất ban đầu, đặt tại <code className="text-chu">src/lib/data/repository.ts</code>.
            </p>
            <p className="border-t border-vien pt-3">
              Dòng lỗi nằm ở <strong className="text-chu">vùng chờ xử lý</strong>, chưa được cộng vào
              bất kỳ báo cáo nào — đúng tiêu chí §17.1.
            </p>
          </div>
        </The>
      </div>

      <The className="mt-4">
        <TheDau
          tieuDe={`Danh sách dòng đang chờ xử lý — ${cho.length} dòng`}
          moTa="Các dòng này KHÔNG nằm trong sổ chính thức và không ảnh hưởng số liệu dashboard"
        />
        {loi.length ? (
          <Bang>
            <thead>
              <tr>
                <Th>Công trình</Th>
                <Th phai>Dòng</Th>
                <Th>Cột</Th>
                <Th>Mức</Th>
                <Th>Mã lỗi</Th>
                <Th>Mô tả</Th>
                <Th phai>Số tiền</Th>
                <Th>Cách xử lý</Th>
              </tr>
            </thead>
            <tbody>
              {loi.map((l) => {
                const gd = traGD.get(l.importBatchId + "|" + l.dong);
                return (
                  <tr key={l.id} className="hover:bg-nen">
                    <Td className="text-xs font-medium whitespace-nowrap">
                      {gd ? (
                        <Link
                          href={`/cong-trinh/${encodeURIComponent(gd.maCongTrinh)}?tab=lich-su`}
                          className="text-nhan hover:underline"
                        >
                          {gd.maCongTrinh}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td phai className="text-xs text-chunhat">
                      {l.dong}
                    </Td>
                    <Td className="text-xs">{l.cot ?? "—"}</Td>
                    <Td>
                      <Nhan bienThe={l.mucDo === "Error" ? "do" : "vang"}>{l.mucDo}</Nhan>
                    </Td>
                    <Td className="font-mono text-[11px]">{l.maLoi}</Td>
                    <Td className="max-w-[300px] text-xs">{l.thongDiep}</Td>
                    <Td phai className="text-xs">
                      {gd ? tien(gd.soTien) : "—"}
                    </Td>
                    <Td className="max-w-[240px] text-xs text-chunhat">{l.cachXuLy}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Bang>
        ) : (
          <Rong>Không có dòng nào đang chờ xử lý</Rong>
        )}
      </The>

      <The className="mt-4">
        <TheDau tieuDe={`Lô nhập đang có lỗi — ${loLoi.length} lô`} />
        <Bang>
          <thead>
            <tr>
              <Th>Công trình</Th>
              <Th>Kỳ</Th>
              <Th>Tên file</Th>
              <Th>Người tải</Th>
              <Th>Thời điểm</Th>
              <Th phai>Dòng lỗi</Th>
              <Th>Trạng thái</Th>
            </tr>
          </thead>
          <tbody>
            {loLoi.map((l) => (
              <tr key={l.id} className="hover:bg-nen">
                <Td className="text-xs font-medium whitespace-nowrap">{l.maCongTrinh}</Td>
                <Td className="text-xs whitespace-nowrap">{nhanThang(l.kyDuLieu)}</Td>
                <Td className="max-w-[320px] truncate text-xs" title={l.tenFile}>
                  {l.tenFile}
                </Td>
                <Td className="text-xs whitespace-nowrap">{l.nguoiTai}</Td>
                <Td className="text-xs whitespace-nowrap">{ngay(l.thoiDiemTai.slice(0, 10))}</Td>
                <Td phai>
                  <Nhan bienThe="do">{l.soDongLoi}</Nhan>
                </Td>
                <Td>
                  <Nhan bienThe="do">{l.trangThai}</Nhan>
                </Td>
              </tr>
            ))}
          </tbody>
        </Bang>
      </The>

      <GhiChuNguon>
        Quy tắc kiểm tra lấy từ sheet <code>KIỂM TRA INPUT</code> của bộ chuẩn hóa, cài đặt tại{" "}
        <code>src/lib/validation.ts</code>. Cùng bộ quy tắc đó chạy khi bạn tải file lên trang{" "}
        <Link href="/nhap-du-lieu" className="text-nhan hover:underline">
          Nhập dữ liệu
        </Link>
        .
      </GhiChuNguon>
    </>
  );
}
