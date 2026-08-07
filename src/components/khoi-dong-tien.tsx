import { BieuDoDongTien } from "@/components/charts";
import { TheKPI } from "@/components/kpi-card";
import { Bang, O_So, Rong, Td, The, TheDau, Th } from "@/components/ui";
import { nhanThang, tien } from "@/lib/format";

export interface DiemDongTienChuoi {
  thang: string;
  thu: number;
  chi: number;
  rong: number;
  luyKe: number;
}

/**
 * Khối "Dòng tiền" dùng chung cho tab công trình và trang tổng hợp: KPI thu/chi/
 * ròng, biểu đồ dòng tiền, và bảng chi tiết theo tháng. Bill KHÔNG tính (là giá
 * trị thực hiện) — chỉ tiền thu (mã Doanh thu) và tiền chi (mã Chi phí) trên sổ.
 */
export function KhoiDongTien({ chuoi }: { chuoi: DiemDongTienChuoi[] }) {
  const thu = chuoi.reduce((a, c) => a + c.thu, 0);
  const chi = chuoi.reduce((a, c) => a + c.chi, 0);
  const rong = thu - chi;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TheKPI
          nhan="Tiền thu lũy kế"
          giaTri={thu}
          phuChu="Tạm ứng / Thanh toán / Quyết toán"
          chiDan="Tổng tiền thu thực tế trên sổ giao dịch (các mã Doanh thu: tạm ứng, thanh toán đợt, quyết toán). Không phải giá trị thực hiện (Bill)."
        />
        <TheKPI
          nhan="Tiền chi lũy kế"
          giaTri={chi}
          phuChu="Tổng các mã chi phí"
          chiDan="Tổng tiền chi thực tế trên sổ giao dịch (mọi mã Chi phí), lũy kế toàn kỳ."
        />
        <TheKPI
          nhan="Dòng tiền ròng"
          giaTri={rong}
          phuChu="Tiền thu − Tiền chi"
          chiDan="Dòng tiền ròng = Tiền thu lũy kế − Tiền chi lũy kế. Âm (đỏ) nghĩa là đang chi nhiều hơn thu."
        />
      </div>

      <The className="mt-4">
        <TheDau
          tieuDe="Dòng tiền theo tháng"
          chiDan="Tiền thu (mã Doanh thu) và tiền chi (mã Chi phí) từ Giao dịch. Bill không tính — đó là giá trị thực hiện, không phải dòng tiền."
        />
        <div className="p-3">
          {chuoi.length ? (
            <BieuDoDongTien data={chuoi.map((c) => ({ thang: c.thang, thu: c.thu, chi: c.chi, luyKe: c.luyKe }))} />
          ) : (
            <Rong>Chưa có dòng tiền nào — cần ghi giao dịch mã Doanh thu / Chi phí ở tab Giao dịch.</Rong>
          )}
        </div>
      </The>

      {chuoi.length ? (
        <The className="mt-4">
          <TheDau tieuDe="Chi tiết theo tháng" />
          <Bang>
            <thead>
              <tr>
                <Th>Tháng</Th>
                <Th phai>Tiền thu</Th>
                <Th phai>Tiền chi</Th>
                <Th phai>Dòng tiền ròng</Th>
                <Th phai>Lũy kế</Th>
              </tr>
            </thead>
            <tbody>
              {chuoi.map((c) => (
                <tr key={c.thang} className="hover:bg-nen">
                  <Td className="whitespace-nowrap">{nhanThang(c.thang)}</Td>
                  <Td phai>{c.thu ? tien(c.thu) : <span className="text-chunhat">—</span>}</Td>
                  <Td phai>{c.chi ? tien(c.chi) : <span className="text-chunhat">—</span>}</Td>
                  <Td phai>
                    <O_So am={c.rong < 0}>{tien(c.rong)}</O_So>
                  </Td>
                  <Td phai>
                    <O_So am={c.luyKe < 0}>{tien(c.luyKe)}</O_So>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Bang>
        </The>
      ) : null}
    </>
  );
}
