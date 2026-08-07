"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { nhanNam, nhanQuy, nhanThang, tien, tienGon } from "@/lib/format";
import { bangMau, chrome } from "./palette";
import { useDark } from "./use-dark";

// ---------------------------------------------------------------- Tooltip chung
function KhungTooltip({
  active,
  payload,
  label,
  nhanTruc,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  nhanTruc?: (v: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-vien bg-the px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{nhanTruc ? nhanTruc(String(label)) : label}</p>
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="so font-medium">{tien(p.value ?? 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- Xu hướng theo tháng
export interface DiemXuHuong {
  thang: string;
  doanhThu: number;
  chiPhi: number;
  loiNhuan: number;
}

/**
 * Doanh thu / Chi phí (cột) và Lợi nhuận gộp (đường) theo tháng.
 * MỘT trục giá trị duy nhất — cả ba chỉ tiêu đều là VNĐ nên so sánh trực tiếp
 * được. Tuyệt đối không thêm trục thứ hai.
 */
export function BieuDoXuHuong({
  data,
  loaiKy = "thang",
}: {
  data: DiemXuHuong[];
  /**
   * Khóa trong `data.thang` là tháng ("2026-01"), quý ("2026-Q1") hay năm ("2026").
   * Truyền chuỗi chứ KHÔNG truyền hàm định dạng: không thể chuyển hàm từ Server
   * Component sang Client Component, nên component tự chọn cách gắn nhãn.
   */
  loaiKy?: "thang" | "quy" | "nam";
}) {
  const toi = useDark();
  const mau = bangMau(toi);
  const c = chrome(toi);
  const nhanTruc = loaiKy === "quy" ? nhanQuy : loaiKy === "nam" ? nhanNam : nhanThang;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={c.luoi} vertical={false} />
        <XAxis
          dataKey="thang"
          tickFormatter={nhanTruc}
          tick={{ fontSize: 11, fill: c.chuMo }}
          axisLine={{ stroke: c.truc }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => tienGon(v as number)}
          tick={{ fontSize: 11, fill: c.chuMo }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          content={<KhungTooltip nhanTruc={nhanTruc} />}
          cursor={{ fill: toi ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          iconType="square"
          iconSize={9}
        />
        {/* Khe 2px giữa hai cột kề nhau: barGap */}
        <Bar dataKey="doanhThu" name="Doanh thu" fill={mau[0]} radius={[4, 4, 0, 0]} barSize={18} />
        <Bar dataKey="chiPhi" name="Chi phí" fill={mau[1]} radius={[4, 4, 0, 0]} barSize={18} />
        <Line
          dataKey="loiNhuan"
          name="Lợi nhuận gộp"
          stroke={mau[2]}
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0, fill: mau[2] }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------- Dòng tiền
export interface DiemDongTien {
  thang: string;
  thu: number;
  chi: number;
  luyKe: number;
}

/**
 * Dòng tiền theo tháng: Tiền thu / Tiền chi (cột) và Dòng tiền ròng lũy kế (đường).
 * Một trục giá trị (VNĐ). Bill KHÔNG tính vào đây — chỉ mã Doanh thu và Chi phí.
 */
export function BieuDoDongTien({
  data,
  loaiKy = "thang",
}: {
  data: DiemDongTien[];
  loaiKy?: "thang" | "quy";
}) {
  const toi = useDark();
  const mau = bangMau(toi);
  const c = chrome(toi);
  const nhanTruc = loaiKy === "quy" ? nhanQuy : nhanThang;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={c.luoi} vertical={false} />
        <XAxis
          dataKey="thang"
          tickFormatter={nhanTruc}
          tick={{ fontSize: 11, fill: c.chuMo }}
          axisLine={{ stroke: c.truc }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => tienGon(v as number)}
          tick={{ fontSize: 11, fill: c.chuMo }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          content={<KhungTooltip nhanTruc={nhanTruc} />}
          cursor={{ fill: toi ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="square" iconSize={9} />
        <Bar dataKey="thu" name="Tiền thu" fill={mau[0]} radius={[4, 4, 0, 0]} barSize={18} />
        <Bar dataKey="chi" name="Tiền chi" fill={mau[1]} radius={[4, 4, 0, 0]} barSize={18} />
        <Line
          dataKey="luyKe"
          name="Dòng tiền ròng lũy kế"
          stroke={mau[2]}
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0, fill: mau[2] }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------- Cơ cấu chi phí
export interface DongCoCauChart {
  ma: string;
  ten: string;
  soTien: number;
  tyTrong: number;
}

/**
 * Cơ cấu chi phí — dùng CỘT NGANG, không dùng donut.
 * Với 8+ nhóm, mắt so sánh độ dài chính xác hơn nhiều so với so sánh góc quạt.
 * Nhãn tên nằm ngay trên trục nên mỗi thanh tự định danh, không phụ thuộc màu.
 */
export function BieuDoCoCau({ data }: { data: DongCoCauChart[] }) {
  const toi = useDark();
  const mau = bangMau(toi);
  const c = chrome(toi);

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={c.luoi} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => tienGon(v as number)}
          tick={{ fontSize: 11, fill: c.chuMo }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="ten"
          tick={{ fontSize: 11, fill: c.chuMo }}
          axisLine={false}
          tickLine={false}
          width={190}
        />
        <Tooltip
          content={<KhungTooltip />}
          cursor={{ fill: toi ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
        />
        <Bar dataKey="soTien" name="Chi phí" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((d, i) => (
            <Cell key={d.ma} fill={mau[i % mau.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------- Kế hoạch vs Thực hiện
export function BieuDoKHTH({
  data,
}: {
  data: { ten: string; keHoach: number; thucHien: number }[];
}) {
  const toi = useDark();
  const mau = bangMau(toi);
  const c = chrome(toi);

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 40 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={c.luoi} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => tienGon(v as number)}
          tick={{ fontSize: 11, fill: c.chuMo }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="ten"
          tick={{ fontSize: 11, fill: c.chuMo }}
          axisLine={false}
          tickLine={false}
          width={190}
        />
        <Tooltip
          content={<KhungTooltip />}
          cursor={{ fill: toi ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="square" iconSize={9} />
        <Bar dataKey="keHoach" name="Kế hoạch" fill={mau[0]} radius={[0, 4, 4, 0]} barSize={11} />
        <Bar dataKey="thucHien" name="Thực hiện" fill={mau[1]} radius={[0, 4, 4, 0]} barSize={11} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------- EVM: EV vs AC
/**
 * Giá trị thu được (EV) so với Chi phí thực tế (AC), LŨY TIẾN theo tháng.
 *
 * CỐ Ý không vẽ đường PV: baseline kế hoạch chỉ trải T1–T7/2026 trong khi công
 * trình chạy sang 2027, vẽ PV vào sẽ mời người xem tự suy ra SPI — con số đó
 * đang sai. Hai đường là đủ để đọc ra khoảng cách chi phí.
 *
 * Một trục giá trị duy nhất, cả hai đều là VNĐ.
 */
export function BieuDoEVM({ data }: { data: { thang: string; ev: number; ac: number }[] }) {
  const toi = useDark();
  const mau = bangMau(toi);
  const c = chrome(toi);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={c.luoi} vertical={false} />
        <XAxis
          dataKey="thang"
          tickFormatter={nhanThang}
          tick={{ fontSize: 11, fill: c.chuMo }}
          axisLine={{ stroke: c.truc }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => tienGon(v as number)}
          tick={{ fontSize: 11, fill: c.chuMo }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          content={<KhungTooltip nhanTruc={nhanThang} />}
          cursor={{ fill: toi ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="square" iconSize={9} />
        <Line
          dataKey="ev"
          name="EV — giá trị thu được"
          stroke={mau[0]}
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0, fill: mau[0] }}
          activeDot={{ r: 5 }}
        />
        <Line
          dataKey="ac"
          name="AC — chi phí thực tế"
          stroke={mau[5]}
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0, fill: mau[5] }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
