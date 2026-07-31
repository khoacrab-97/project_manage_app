import { ImportWizard } from "@/components/import-wizard";
import { Bang, CanhBaoBox, DauTrang, Nhan, Td, The, TheDau, Th } from "@/components/ui";
import { nhanThang } from "@/lib/format";
import { layLoNhap } from "@/lib/data/repository";
import { COT_CHUAN, TEN_SHEET, TEN_TABLE } from "@/lib/excel/parse-chitiet-th";

export const metadata = { title: "Nhập dữ liệu" };

export default async function TrangNhapDuLieu() {
  const loGanDay = [...(await layLoNhap())]
    .sort((a, b) => b.thoiDiemTai.localeCompare(a.thoiDiemTai))
    .slice(0, 12);

  return (
    <>
      <DauTrang
        tieuDe="Nhập dữ liệu từ file công trình"
        moTa="Thay thao tác mở từng file rồi copy–paste vào sheet INPUT bằng quy trình có kiểm soát (§8.2). Bộ kiểm tra chạy thật trên file bạn tải lên."
      />

      <div className="mb-4">
        <CanhBaoBox bienThe="nhan" tieuDe="Thử ngay với file gốc của bạn">
          Kéo thả chính file <code>MẪU DOANH THU - CHI PHÍ.xlsx</code> vào khung dưới. Hệ thống sẽ
          báo đúng những lỗi mà sheet <code>KIỂM TRA INPUT</code> đã chỉ ra: thiếu Tháng thực hiện và
          thiếu Mã DT–CP.
        </CanhBaoBox>
      </div>

      <ImportWizard />

      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <The>
          <TheDau tieuDe="Yêu cầu về file nguồn" />
          <ul className="space-y-2 p-4 text-xs text-chunhat">
            <li>
              Vùng dữ liệu là Table <code className="text-chu">{TEN_TABLE}</code>, hoặc sheet{" "}
              <code className="text-chu">{TEN_SHEET}</code>.
            </li>
            <li>Đủ 15 cột chuẩn, không đổi tên cột.</li>
            <li>Tháng thực hiện ghi bằng ngày đầu tháng.</li>
            <li>Mã DT–CP chọn trong danh mục 55 mã của công ty.</li>
            <li>Số tiền để định dạng số, không gõ chữ vào ô.</li>
            <li>Không tải file tạm của Excel (tên bắt đầu bằng ~$).</li>
          </ul>
        </The>

        <The className="xl:col-span-2">
          <TheDau tieuDe="15 cột chuẩn" moTa="Cột thứ 16 trở đi trong file sẽ bị bỏ qua" />
          <div className="flex flex-wrap gap-1.5 p-4">
            {COT_CHUAN.map((c, i) => (
              <Nhan key={c}>
                <span className="text-chunhat">{i + 1}.</span> {c}
              </Nhan>
            ))}
          </div>
        </The>
      </div>

      <The className="mt-4">
        <TheDau tieuDe="Lô nhập gần đây" moTa="Dữ liệu demo — minh họa cách theo dõi lịch sử nộp file" />
        <Bang>
          <thead>
            <tr>
              <Th>Công trình</Th>
              <Th>Kỳ</Th>
              <Th>Tên file</Th>
              <Th>Người tải</Th>
              <Th phai>Dòng</Th>
              <Th phai>Lỗi</Th>
              <Th>Trạng thái</Th>
            </tr>
          </thead>
          <tbody>
            {loGanDay.map((l) => (
              <tr key={l.id} className="hover:bg-nen">
                <Td className="text-xs font-medium whitespace-nowrap">{l.maCongTrinh}</Td>
                <Td className="text-xs whitespace-nowrap">{nhanThang(l.kyDuLieu)}</Td>
                <Td className="max-w-[340px] truncate text-xs" title={l.tenFile}>
                  {l.tenFile}
                </Td>
                <Td className="text-xs whitespace-nowrap">{l.nguoiTai}</Td>
                <Td phai>{l.soDong}</Td>
                <Td phai>{l.soDongLoi ? <Nhan bienThe="do">{l.soDongLoi}</Nhan> : "0"}</Td>
                <Td>
                  <Nhan bienThe={l.trangThai === "POSTED" ? "xanh" : "do"}>{l.trangThai}</Nhan>
                </Td>
              </tr>
            ))}
          </tbody>
        </Bang>
      </The>
    </>
  );
}
