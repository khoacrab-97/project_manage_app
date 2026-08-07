import Link from "next/link";
import { Bang, DauTrang, GhiChuNguon, Nhan, Rong, Td, The, TheDau, Th } from "@/components/ui";
import { nhanThang, tien } from "@/lib/format";
import {
  chatLuongDuLieu,
  diemChatLuong,
  layGiaoDichChoXuLy,
  layLoiDuLieu,
  layLoNhap,
} from "@/lib/data/repository";

export const metadata = { title: "Kiểm tra dữ liệu" };

export default async function TrangKiemTraDuLieu() {
  const [chiTieu, diem, loi, cho, loNhap] = await Promise.all([
    chatLuongDuLieu(),
    diemChatLuong(),
    layLoiDuLieu(),
    layGiaoDichChoXuLy(),
    layLoNhap(),
  ]);
  const traGD = new Map(cho.map((g) => [`${g.importBatchId}|${g.sttNguon + 2}`, g]));
  // Lịch sử nhập (chuyển từ tab Lịch sử của chi tiết công trình về đây) — mọi lô
  // nhập của tất cả công trình, mới nhất trước.
  const lichSu = [...loNhap].sort((a, b) => b.thoiDiemTai.localeCompare(a.thoiDiemTai));

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
                const gd = traGD.get(`${l.importBatchId}|${l.dong}`);
                return (
                  <tr key={l.id} className="hover:bg-nen">
                    <Td className="text-xs font-medium whitespace-nowrap">
                      {gd ? (
                        <Link
                          href={`/cong-trinh/${encodeURIComponent(gd.maCongTrinh)}`}
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
                    <Td className="text-[11px]">{l.maLoi}</Td>
                    <Td className="max-w-75 text-xs">{l.thongDiep}</Td>
                    <Td phai className="text-xs">
                      {gd ? tien(gd.soTien) : "—"}
                    </Td>
                    <Td className="max-w-60 text-xs text-chunhat">{l.cachXuLy}</Td>
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
        <TheDau
          tieuDe={`Lịch sử nhập và phê duyệt — ${lichSu.length} lô`}
          moTa="Mỗi lô nhập tương ứng một lần nộp file — tất cả công trình, mới nhất trước"
        />
        {lichSu.length ? (
          <Bang>
            <thead>
              <tr>
                <Th>Công trình</Th>
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
              {lichSu.map((l) => (
                <tr key={l.id} className="hover:bg-nen">
                  <Td className="text-xs font-medium whitespace-nowrap">{l.maCongTrinh}</Td>
                  <Td className="text-xs whitespace-nowrap">{nhanThang(l.kyDuLieu)}</Td>
                  <Td className="max-w-80 truncate text-xs" title={l.tenFile}>
                    {l.tenFile}
                  </Td>
                  <Td className="text-xs whitespace-nowrap">{l.nguoiTai}</Td>
                  <Td className="text-xs whitespace-nowrap">{l.thoiDiemTai.replace("T", " ")}</Td>
                  <Td phai>{l.soDong}</Td>
                  <Td phai>{l.soDongHopLe}</Td>
                  <Td phai>{l.soDongLoi ? <Nhan bienThe="do">{l.soDongLoi}</Nhan> : "0"}</Td>
                  <Td>
                    <Nhan bienThe={l.trangThai === "POSTED" ? "xanh" : "do"}>{l.trangThai}</Nhan>
                  </Td>
                  <Td className="text-xs">{l.nguoiDuyet ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Bang>
        ) : (
          <Rong>Chưa có lô nhập nào</Rong>
        )}
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
