import { DauTrang } from "@/components/ui";
import { KhoiDongTien } from "@/components/khoi-dong-tien";
import { dongTienTheoThang } from "@/lib/data/repository";

export const metadata = { title: "Dòng tiền" };

export default async function TrangDongTien() {
  const chuoi = await dongTienTheoThang();
  return (
    <>
      <DauTrang chiDan="Tiền thu (mã Doanh thu: Tạm ứng / Thanh toán / Quyết toán) và tiền chi (mã Chi phí) trên sổ giao dịch, tổng hợp theo phạm vi được xem. Bill là giá trị thực hiện — KHÔNG tính vào dòng tiền." />
      <KhoiDongTien chuoi={chuoi} />
    </>
  );
}
