/**
 * Xuất bảng chấm công tháng ra .xlsx cho một ĐỘI (nội thành hoặc ngoại thành).
 *
 * Ba sheet nối nhau bằng công thức sống — xem src/lib/excel/xuat-cham-cong.ts.
 * GET /api/xuat-cham-cong?thang=YYYY-MM&doi=NOI_THANH|NGOAI_THANH
 */
import { nguoiDungHienTai } from "@/lib/auth/phien";
import { xemModuleCongNhan } from "@/lib/auth/quyen";
import { duLieuXuatChamCong, type Doi } from "@/lib/data/cong-nhan";
import { taoWorkbookChamCong } from "@/lib/excel/xuat-cham-cong";
import { serverLogger, withApiLogging } from "@/lib/logger";

// Logo letterhead riêng từng đội (trích từ 2 form mẫu).
const LOGO: Record<Doi, { theoDoi: string; bang: string }> = {
  NOI_THANH: { theoDoi: "logo-theodoi.jpeg", bang: "logo-bang.jpeg" },
  NGOAI_THANH: { theoDoi: "logo-ngoai.png", bang: "logo-ngoai.png" },
};
const NHAN_FILE: Record<Doi, string> = { NOI_THANH: "noi_thanh", NGOAI_THANH: "ngoai_thanh" };

async function getXuatChamCong(req: Request) {
  const u = await nguoiDungHienTai();
  if (!u) return new Response("Chưa đăng nhập", { status: 401 });
  if (!xemModuleCongNhan(u.vaiTro)) return new Response("Không có quyền", { status: 403 });

  const url = new URL(req.url);
  const thang = url.searchParams.get("thang") ?? "";
  if (!/^\d{4}-\d{2}$/.test(thang)) return new Response("Thiếu tháng hợp lệ (YYYY-MM)", { status: 400 });

  const doiTho = url.searchParams.get("doi");
  const doi: Doi = doiTho === "NGOAI_THANH" ? "NGOAI_THANH" : "NOI_THANH";
  // Ngoại thành xuất theo TỪNG đội dự án — bắt buộc chọn đội.
  const doiDAId = url.searchParams.get("doiDAId") ?? "";
  if (doi === "NGOAI_THANH" && !doiDAId) {
    return new Response("Thiếu đội dự án cần xuất (doiDAId).", { status: 400 });
  }

  const dulieu = await duLieuXuatChamCong(thang, doi, doiDAId || undefined);
  if (!dulieu.congNhan.length) {
    const ten = doi === "NGOAI_THANH" ? `đội dự án ${dulieu.tenDoi || doiDAId}` : "đội thi công";
    serverLogger.warn("timesheet_export_rejected", {
      module: "timesheet_export",
      month: thang,
      teamType: doi,
      rowCount: 0,
      status: "no_data",
    });
    return new Response(`Tháng ${thang} chưa có dữ liệu chấm công ${ten}.`, { status: 404 });
  }

  // Tên file: nội thành giữ nguyên; ngoại thành kèm tên đội cho dễ phân biệt.
  const hau =
    doi === "NGOAI_THANH" && dulieu.tenDoi
      ? `${NHAN_FILE[doi]}_${dulieu.tenDoi.replace(/[^\p{L}\p{N}]+/gu, "_")}`
      : NHAN_FILE[doi];
  const buf = await taoWorkbookChamCong(dulieu, LOGO[doi]);
  serverLogger.info("timesheet_export_completed", {
    module: "timesheet_export",
    month: thang,
    teamType: doi,
    rowCount: dulieu.congNhan.length,
    status: "completed",
  });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Cham_cong_${hau}_${thang}.xlsx"`,
    },
  });
}

export const GET = withApiLogging("/api/xuat-cham-cong", getXuatChamCong);
