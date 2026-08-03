"use client";

/**
 * Các form nhập liệu của module Quản lý công nhân.
 *
 * Đều là form nhỏ nằm ngay trên trang chứ không mở hộp thoại: người phụ trách
 * chấm công cả chục người liên tiếp, mỗi lần phải mở/đóng hộp thoại là chậm hẳn.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { KetQuaCN } from "@/app/cong-nhan/actions";
import { Nhan, Td, Th } from "@/components/ui";
import {
  luuChamCongDoiDA,
  luuChamCongNgay,
  luuCongNhan,
  luuDoiDA,
  luuKhuVuc,
  luuNgayLe,
  luuPhanCongMaTran,
  suaDoiDA,
  themNhieuCongNhan,
  xoaCongNhan,
  xoaDoiDA,
  xoaLichDieuDong,
  xoaNgayLe,
} from "@/app/cong-nhan/actions";
// CHỈ import KIỂU — import giá trị runtime từ cong-nhan.ts sẽ kéo cả `db`
// vào bundle client và vỡ build. Nhãn buổi để cục bộ ở đây.
import type { Buoi, DongChamCongDA, ONgayTimeSheet } from "@/lib/data/cong-nhan";

const NHAN_BUOI: Record<Buoi, string> = {
  CA_NGAY: "Cả ngày",
  SANG: "Sáng",
  CHIEU: "Chiều",
};

const O = "rounded-md border border-vien bg-the px-2 py-1 text-xs";

export interface OChon {
  id: string;
  maCongTrinh: string;
  tenCongTrinh: string;
  khuVuc: string;
  /** Đội DA sở hữu công trình (khi ngoại thành). */
  doiDAId: string;
  tenDoiDA: string;
  nguoiPhuTrach: string;
}

export interface ODoiDA {
  id: string;
  ten: string;
}

export interface OCongNhan {
  id: string;
  maCN: string;
  hoTen: string;
  doi: string;
  /** Khóa đội DA (để lưu). */
  doiDAId: string;
  /** Tên đội DA để hiển thị/nhóm tab. */
  tenDoiDA: string;
  ngheNghiep: string;
  nguoiQuanLy: string;
  ghiChu: string;
}

/**
 * Nguồn gợi ý tên cán bộ, render MỘT lần cho cả trang. Mọi ô nhập tên cán bộ
 * dùng chung `list="ds-can-bo"` nên chỉ cần một datalist.
 */
export function DanhSachCanBo({ ten }: { ten: string[] }) {
  return (
    <datalist id="ds-can-bo">
      {ten.map((t) => (
        <option key={t} value={t} />
      ))}
    </datalist>
  );
}

function ThongBao({ kq }: { kq: KetQuaCN | null }) {
  if (!kq) return null;
  return (
    <p
      className={`mt-2 text-xs ${kq.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
    >
      {kq.thongDiep}
    </p>
  );
}

/** Nút bấm gọi một Server Action đơn giản, kèm xác nhận tại chỗ. */
function NutHanhDong({
  hanhDong,
  truong,
  nhan,
  bienThe = "thuong",
  title,
}: {
  hanhDong: (fd: FormData) => Promise<KetQuaCN>;
  truong: Record<string, string>;
  nhan: React.ReactNode;
  bienThe?: "thuong" | "do";
  title?: string;
}) {
  const [kq, setKq] = useState<KetQuaCN | null>(null);
  const [dangChay, batDau] = useTransition();

  return (
    <form
      action={(fd) => batDau(async () => setKq(await hanhDong(fd)))}
      className="inline-flex items-center gap-1"
    >
      {Object.entries(truong).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={dangChay}
        title={title}
        className={
          bienThe === "do"
            ? "inline-flex items-center rounded p-1 text-rose-600 hover:bg-nen disabled:opacity-50 dark:text-rose-400"
            : "inline-flex items-center gap-1 rounded-md border border-vien px-2 py-0.5 text-xs disabled:opacity-50"
        }
      >
        {nhan}
      </button>
      {kq && !kq.ok ? <span className="text-[11px] text-rose-600">{kq.thongDiep}</span> : null}
    </form>
  );
}

// ------------------------------------------------------------ Hồ sơ công nhân
export function FormCongNhan({
  suaCN,
  duocSua,
  dsDoiDA,
}: {
  suaCN: OCongNhan;
  duocSua: boolean;
  dsDoiDA: ODoiDA[];
}) {
  const [mo, setMo] = useState(false);
  const [kq, setKq] = useState<KetQuaCN | null>(null);
  const [doiChon, setDoiChon] = useState(suaCN.doi);
  const [dangChay, batDau] = useTransition();

  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMo(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [mo]);

  if (!duocSua) return null;

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        title={`Sửa ${suaCN.maCN}`}
        className="inline-flex items-center rounded p-1 text-nhan hover:bg-nen"
      >
        <Pencil className="size-3.5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-xl border border-vien bg-the shadow-xl">
        <div className="flex items-center justify-between border-b border-vien px-4 py-3">
          <h2 className="text-sm font-semibold">Sửa công nhân {suaCN.maCN}</h2>
          <button
            type="button"
            onClick={() => setMo(false)}
            title="Đóng (Esc)"
            className="rounded-md border border-vien p-1.5"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          action={(fd) =>
            batDau(async () => {
              const r = await luuCongNhan(fd);
              setKq(r);
              if (r.ok) setTimeout(() => setMo(false), 800);
            })
          }
          className="p-4"
        >
          <input type="hidden" name="id" value={suaCN.id} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs">
              <span className="mb-0.5 block text-chunhat">Mã công nhân</span>
              <input
                name="maCN"
                defaultValue={suaCN.maCN}
                className={`${O} w-full font-mono`}
                placeholder="CN-001"
                required
              />
            </label>
            <label className="text-xs">
              <span className="mb-0.5 block text-chunhat">Họ tên</span>
              <input name="hoTen" defaultValue={suaCN.hoTen} className={`${O} w-full`} required />
            </label>

            <label className="text-xs">
              <span className="mb-0.5 block text-chunhat">Đội</span>
              <select
                name="doi"
                value={doiChon}
                onChange={(e) => setDoiChon(e.target.value)}
                className={`${O} w-full`}
              >
                <option value="NOI_THANH">Đội thi công — nhân lực dùng chung</option>
                <option value="NGOAI_THANH">Đội DA — chấm công trực tiếp theo dự án</option>
              </select>
            </label>
            {doiChon === "NGOAI_THANH" ? (
              <label className="text-xs">
                <span className="mb-0.5 block text-chunhat">Tên đội DA / dự án</span>
                <select name="doiDAId" defaultValue={suaCN.doiDAId} className={`${O} w-full`}>
                  <option value="">— Chọn đội DA —</option>
                  {dsDoiDA.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.ten}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="text-xs">
              <span className="mb-0.5 block text-chunhat">Nghề</span>
              <input
                name="ngheNghiep"
                defaultValue={suaCN.ngheNghiep}
                className={`${O} w-full`}
                placeholder="Thợ xây"
              />
            </label>

            {/* Gõ từ khoá là hiện danh sách cán bộ, không phải gõ đủ tên. */}
            <label className="text-xs sm:col-span-2">
              <span className="mb-0.5 block text-chunhat">Người quản lý (CBQL / CBPT)</span>
              <input
                name="nguoiQuanLy"
                defaultValue={suaCN.nguoiQuanLy}
                list="ds-can-bo"
                className={`${O} w-full`}
                placeholder="Gõ để tìm cán bộ…"
              />
            </label>

            <label className="flex items-center gap-1.5 text-xs sm:col-span-2">
              <input type="checkbox" name="apDungTatCaDoi" />
              Áp dụng người quản lý này cho tất cả công nhân trong{" "}
              {doiChon === "NGOAI_THANH" ? "đội DA này" : "Đội thi công"}
            </label>

            <label className="text-xs sm:col-span-2">
              <span className="mb-0.5 block text-chunhat">Ghi chú</span>
              <input name="ghiChu" defaultValue={suaCN.ghiChu} className={`${O} w-full`} />
            </label>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={dangChay}
              className="inline-flex items-center gap-1 rounded-md bg-nhan px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              <Check className="size-3" /> {dangChay ? "Đang lưu…" : "Lưu"}
            </button>
            <button
              type="button"
              onClick={() => setMo(false)}
              className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs"
            >
              <X className="size-3" /> Hủy
            </button>
          </div>
          <ThongBao kq={kq} />
        </form>
      </div>
    </div>
  );
}

export function NutXoaCongNhan({ id, maCN }: { id: string; maCN: string }) {
  return (
    <NutHanhDong
      hanhDong={xoaCongNhan}
      truong={{ id }}
      bienThe="do"
      title={`Xoá ${maCN}`}
      nhan={<Trash2 className="size-3.5" />}
    />
  );
}

/**
 * Thêm NHIỀU công nhân một lượt: lưới nhập nhiều dòng, mỗi dòng một người.
 * Bấm "+ dòng" để có thêm hàng trống; các trường để uncontrolled và gửi dạng
 * mảng cùng tên nên chỉ cần theo dõi số dòng, không cần state từng ô.
 */
export function FormThemNhieuCN({ duocSua, dsDoiDA }: { duocSua: boolean; dsDoiDA: ODoiDA[] }) {
  const [mo, setMo] = useState(false);
  const [soDong, setSoDong] = useState(5);
  // Đội của từng dòng — điều khiển việc KHÓA ô "Tên đội DA": chỉ mở khi Đội DA.
  const [doiRows, setDoiRows] = useState<string[]>(() => Array(5).fill("NOI_THANH"));
  const [kq, setKq] = useState<KetQuaCN | null>(null);
  const [dangChay, batDau] = useTransition();
  const luoiRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMo(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [mo]);

  /*
   * Di chuyển như bảng tính bằng phím mũi tên. CHỈ bắt trên ô nhập chữ — ô select
   * "Đội" giữ hành vi gốc để còn đổi Nội/Ngoại thành bằng bàn phím. Trái/phải chỉ
   * nhảy cột khi con trỏ ở đầu/cuối chữ, nếu không thì vẫn di con trỏ trong ô.
   */
  const diChuyen = (e: React.KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (el.tagName !== "INPUT") return;
    const inp = el as HTMLInputElement;
    const r = Number(inp.dataset.r);
    const c = Number(inp.dataset.c);
    if (Number.isNaN(r) || Number.isNaN(c)) return;

    const den = (rr: number, cc: number) => {
      const t = luoiRef.current?.querySelector<HTMLElement>(`[data-r="${rr}"][data-c="${cc}"]`);
      if (t) {
        e.preventDefault();
        t.focus();
      }
    };

    if (e.key === "ArrowUp") den(r - 1, c);
    else if (e.key === "ArrowDown") den(r + 1, c);
    else if (e.key === "ArrowLeft" && inp.selectionStart === 0 && inp.selectionEnd === 0)
      den(r, c - 1);
    else if (e.key === "ArrowRight" && inp.selectionStart === inp.value.length) den(r, c + 1);
  };

  if (!duocSua) return null;

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-nhan px-3 py-1.5 text-xs font-medium text-white"
      >
        <Plus className="size-3.5" /> Thêm công nhân
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-4xl rounded-xl border border-vien bg-the shadow-xl">
        <div className="flex items-center justify-between border-b border-vien px-4 py-3">
          <h2 className="text-sm font-semibold">Thêm nhiều công nhân</h2>
          <button
            type="button"
            onClick={() => setMo(false)}
            title="Đóng (Esc)"
            className="rounded-md border border-vien p-1.5"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          action={(fd) =>
            batDau(async () => {
              const r = await themNhieuCongNhan(fd);
              setKq(r);
              // Thành công trọn vẹn (không dòng nào bị bỏ) mới đóng; còn lỗi thì
              // giữ lại để người dùng sửa các mã bị trùng.
              if (r.ok && !r.thongDiep.includes("Bỏ qua")) setTimeout(() => setMo(false), 900);
            })
          }
          className="p-4"
        >
          <div className="cuon-ngang">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-vien px-2 py-1.5 text-left text-xs font-semibold text-chunhat">
                    Mã CN *
                  </th>
                  <th className="border-b border-vien px-2 py-1.5 text-left text-xs font-semibold text-chunhat">
                    Họ tên *
                  </th>
                  <th className="border-b border-vien px-2 py-1.5 text-left text-xs font-semibold text-chunhat">
                    Đội
                  </th>
                  <th className="border-b border-vien px-2 py-1.5 text-left text-xs font-semibold text-chunhat">
                    Tên đội DA
                  </th>
                  <th className="border-b border-vien px-2 py-1.5 text-left text-xs font-semibold text-chunhat">
                    Nghề
                  </th>
                  <th className="border-b border-vien px-2 py-1.5 text-left text-xs font-semibold text-chunhat">
                    Người quản lý
                  </th>
                </tr>
              </thead>
              <tbody ref={luoiRef} onKeyDown={diChuyen}>
                {Array.from({ length: soDong }).map((_, i) => (
                  <tr key={i}>
                    <td className="border-b border-vien px-1 py-1">
                      <input
                        name="maCN"
                        data-r={i}
                        data-c={0}
                        className={`${O} w-28 font-mono`}
                        placeholder="CN-001"
                      />
                    </td>
                    <td className="border-b border-vien px-1 py-1">
                      <input name="hoTen" data-r={i} data-c={1} className={`${O} w-44`} />
                    </td>
                    <td className="border-b border-vien px-1 py-1">
                      <select
                        name="doi"
                        data-r={i}
                        data-c={2}
                        value={doiRows[i] ?? "NOI_THANH"}
                        onChange={(e) =>
                          setDoiRows((a) => {
                            const b = [...a];
                            b[i] = e.target.value;
                            return b;
                          })
                        }
                        className={`${O} w-28`}
                      >
                        <option value="NOI_THANH">Đội thi công</option>
                        <option value="NGOAI_THANH">Đội DA</option>
                      </select>
                    </td>
                    <td className="border-b border-vien px-1 py-1">
                      {/* KHÓA khi dòng không phải Đội DA. Ô khóa không gửi name (dùng
                          hidden "" thay) để giữ đúng thứ tự cột khi server đọc theo dòng. */}
                      {doiRows[i] === "NGOAI_THANH" ? (
                        <select name="doiDAId" data-r={i} data-c={3} defaultValue="" className={`${O} w-36`}>
                          <option value="">— Chọn đội DA —</option>
                          {dsDoiDA.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.ten}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input type="hidden" name="doiDAId" value="" />
                          <select disabled defaultValue="" className={`${O} w-36 opacity-50`}>
                            <option value="">— (chọn Đội DA trước)</option>
                          </select>
                        </>
                      )}
                    </td>
                    <td className="border-b border-vien px-1 py-1">
                      <input
                        name="ngheNghiep"
                        data-r={i}
                        data-c={4}
                        className={`${O} w-32`}
                        placeholder="Thợ xây"
                      />
                    </td>
                    <td className="border-b border-vien px-1 py-1">
                      {/* Không gợi ý cán bộ ở đây: lúc thêm mới hàng loạt, gợi ý
                          tên quản lý là vô nghĩa. Gợi ý chỉ ở ô sửa và khu vực. */}
                      <input name="nguoiQuanLy" data-r={i} data-c={5} className={`${O} w-40`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSoDong((n) => n + 3);
                setDoiRows((a) => [...a, "NOI_THANH", "NOI_THANH", "NOI_THANH"]);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs"
            >
              <Plus className="size-3" /> Thêm dòng
            </button>
            <button
              type="submit"
              disabled={dangChay}
              className="inline-flex items-center gap-1 rounded-md bg-nhan px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              <Check className="size-3" /> {dangChay ? "Đang lưu…" : "Lưu tất cả"}
            </button>
            <span className="text-[11px] text-chunhat">Dòng để trống mã sẽ bỏ qua.</span>
          </div>
          <ThongBao kq={kq} />
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Khu vực công trình
export function FormKhuVuc({ ct, duocSua, dsDoiDA }: { ct: OChon; duocSua: boolean; dsDoiDA: ODoiDA[] }) {
  const [kq, setKq] = useState<KetQuaCN | null>(null);
  const [khuVuc, setKhuVuc] = useState(ct.khuVuc);
  const [dangChay, batDau] = useTransition();

  if (!duocSua) {
    // Chỉ xem: hiện người phụ trách; nếu ngoại thành kèm tên đội DA.
    return (
      <span className="text-xs text-chunhat">
        {ct.nguoiPhuTrach || "—"}
        {ct.khuVuc === "NGOAI_THANH" && ct.tenDoiDA ? ` · Đội ${ct.tenDoiDA}` : ""}
      </span>
    );
  }

  return (
    <form
      action={(fd) => batDau(async () => setKq(await luuKhuVuc(fd)))}
      className="flex flex-wrap items-center gap-1"
    >
      <input type="hidden" name="projectId" value={ct.id} />
      <select
        name="khuVuc"
        value={khuVuc}
        onChange={(e) => setKhuVuc(e.target.value)}
        className={O}
      >
        <option value="NOI_THANH">Nội thành</option>
        <option value="NGOAI_THANH">Ngoại thành</option>
      </select>
      {khuVuc === "NGOAI_THANH" ? (
        <select name="doiDAId" defaultValue={ct.doiDAId} className={O} title="Đội DA sở hữu công trình">
          <option value="">— Đội DA —</option>
          {dsDoiDA.map((d) => (
            <option key={d.id} value={d.id}>
              {d.ten}
            </option>
          ))}
        </select>
      ) : null}
      {/* Người phụ trách tự động theo phạm vi giao trong Quản trị — chỉ đọc. */}
      <span className="text-xs text-chunhat" title="Tự động theo phạm vi được giao trong Quản trị">
        {ct.nguoiPhuTrach || "— (chưa giao trong Quản trị)"}
      </span>
      <button
        type="submit"
        disabled={dangChay}
        className="rounded-md border border-vien px-2 py-1 text-xs disabled:opacity-50"
      >
        {dangChay ? "…" : "Lưu"}
      </button>
      {kq ? (
        <span className={`text-[11px] ${kq.ok ? "text-emerald-600" : "text-rose-600"}`}>
          {kq.ok ? "đã lưu" : kq.thongDiep}
        </span>
      ) : null}
    </form>
  );
}

// ------------------------------------------------------------ Ngày lễ
export interface ONgayLe {
  id: string;
  thang: number;
  ngay: number;
  /** null = lặp lại hằng năm; có năm = chỉ năm đó. */
  nam: number | null;
  ten: string;
}

/**
 * Lịch ngày lễ dạng bảng: ADMIN chọn khoảng ngày (từ → đến, để trống "đến" nếu
 * một ngày), tích "Lặp lại hằng năm" cho lễ dương lịch cố định. Người không phải
 * ADMIN chỉ xem. Ngày lễ tính như Chủ nhật khi tổng hợp (giờ dồn vào cột tăng ca
 * ngày lễ).
 */
export function QuanLyNgayLe({ ds, laAdmin }: { ds: ONgayLe[]; laAdmin: boolean }) {
  const [kq, setKq] = useState<KetQuaCN | null>(null);
  const [dangChay, batDau] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const dd = (n: number) => String(n).padStart(2, "0");

  return (
    <div>
      {laAdmin ? (
        <form
          ref={formRef}
          action={(fd) =>
            batDau(async () => {
              const r = await luuNgayLe(fd);
              setKq(r);
              if (r.ok) formRef.current?.reset();
            })
          }
          className="mb-3 flex flex-wrap items-end gap-2"
        >
          <label className="text-xs">
            <span className="mb-0.5 block text-chunhat">Từ ngày</span>
            <input type="date" name="tu" className={O} required />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block text-chunhat">Đến ngày</span>
            <input type="date" name="den" className={O} />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block text-chunhat">Tên ngày lễ</span>
            <input name="ten" className={`${O} w-56`} placeholder="VD: Tết Nguyên đán" required />
          </label>
          <label className="flex items-center gap-1 pb-1 text-xs">
            <input type="checkbox" name="lapLai" value="1" />
            Lặp lại hằng năm
          </label>
          <button
            type="submit"
            disabled={dangChay}
            className="inline-flex items-center gap-1 rounded-md border border-vien px-2 py-1 text-xs disabled:opacity-50"
          >
            <Plus className="size-3.5" /> {dangChay ? "…" : "Thêm"}
          </button>
          {kq ? (
            <span className={`text-[11px] ${kq.ok ? "text-emerald-600" : "text-rose-600"}`}>
              {kq.thongDiep}
            </span>
          ) : null}
        </form>
      ) : null}

      {ds.length ? (
        <div className="cuon-ngang">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <Th>Ngày</Th>
                <Th>Phạm vi</Th>
                <Th>Tên ngày lễ</Th>
                {laAdmin ? <Th className="w-10" /> : null}
              </tr>
            </thead>
            <tbody>
              {ds.map((n) => (
                <tr key={n.id} className="hover:bg-nen">
                  <Td className="font-mono text-xs whitespace-nowrap">
                    {dd(n.ngay)}/{dd(n.thang)}
                  </Td>
                  <Td className="text-xs whitespace-nowrap">
                    {n.nam === null ? (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                        Hằng năm
                      </span>
                    ) : (
                      `Năm ${n.nam}`
                    )}
                  </Td>
                  <Td className="text-xs">{n.ten}</Td>
                  {laAdmin ? (
                    <Td className="px-2">
                      <NutHanhDong
                        hanhDong={xoaNgayLe}
                        truong={{ id: n.id }}
                        bienThe="do"
                        title={`Xoá ngày lễ ${dd(n.ngay)}/${dd(n.thang)}`}
                        nhan={<Trash2 className="size-3.5" />}
                      />
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-chunhat">Chưa khai báo ngày lễ nào.</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------ Phân công ngày
const DS_BUOI: Buoi[] = ["CA_NGAY", "SANG", "CHIEU"];

/** dd/mm/yyyy cho nhãn nút chép. */
function ddmmyyyy(ngay: string) {
  const [y, m, d] = ngay.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Ô chọn ngày kiểu tự chuyển: đổi ngày trong lịch là chuyển thẳng tới ngày đó,
 * không cần nút "Xem" và không hiển thị các ngày gần đây. Dùng cho cả tab Điều
 * động và Chấm công (khác nhau ở `muc`).
 */
export function ChonNgayNhanh({ ngay, muc, nhan }: { ngay: string; muc: string; nhan: string }) {
  const router = useRouter();
  return (
    <div className="mb-4 rounded-xl border border-vien bg-the px-3 py-2">
      <label className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-chunhat">{nhan}</span>
        <input
          type="date"
          defaultValue={ngay}
          onChange={(e) => {
            const v = e.target.value;
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) router.push(`/cong-nhan?muc=${muc}&ngay=${v}`);
          }}
          className="rounded-md border border-vien bg-the px-2 py-1 text-xs"
        />
      </label>
    </div>
  );
}

/**
 * Ma trận điều động: HÀNG = công nhân nội thành, CỘT = công trình. Mỗi ô là một
 * select {—, Cả ngày, Sáng, Chiều}.
 *
 * Ràng buộc mỗi hàng (một công nhân/ngày): cả ngày một nơi HOẶC sáng một nơi +
 * chiều một nơi khác. Khoá theo đúng đó — chọn cả ngày thì mọi ô khác của người
 * đó khoá; chọn một buổi thì cả ngày và cùng buổi ở nơi khác bị khoá.
 */
export function MaTranPhanCong({
  ngay,
  congNhan,
  congTrinh,
  daPhan,
  khoaVinhVien,
  coLich,
  mauChep,
}: {
  ngay: string;
  congNhan: OCongNhan[];
  congTrinh: OChon[];
  /** Ô đã phân: `congNhanId|projectId` -> buổi. */
  daPhan: Record<string, Buoi>;
  /** Ngày quá hạn sửa (quá một ngày): khoá hẳn, không có nút Sửa. */
  khoaVinhVien: boolean;
  /** Ngày này đã có lịch — mở ra là khoá sẵn, phải bấm Sửa mới sửa. */
  coLich: boolean;
  /** Tối đa 3 ngày điều động gần nhất, làm nguồn chép cho ngày mới. */
  mauChep: { ngay: string; o: Record<string, Buoi> }[];
}) {
  const [kq, setKq] = useState<KetQuaCN | null>(null);
  const [dangChay, batDau] = useTransition();
  const doiSangO = (r: Record<string, Buoi>) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(r)) o[k.replace("|", ":")] = v;
    return o;
  };
  // Trạng thái từng ô để tính khoá tương tác. Key `cnId:ctId` -> "" | buổi.
  const [chon, setChon] = useState<Record<string, string>>(() => doiSangO(daPhan));
  // Ngày mới (còn hạn, chưa có lịch): hỏi Bảng mới hay Sao chép TRƯỚC khi cho thao tác.
  const [hienChep, setHienChep] = useState(!khoaVinhVien && !coLich);
  /*
   * `sua` = đang cho phép chỉnh. Bảng LUÔN khoá lúc mở: ngày mới phải chọn Bảng
   * mới / Sao chép mới mở; ngày đã có lịch phải bấm Sửa; ngày quá hạn khoá hẳn.
   */
  const [sua, setSua] = useState(false);

  if (!congNhan.length) {
    return (
      <p className="p-4 text-xs text-chunhat">
        Chưa có công nhân nội thành nào. Thêm ở mục Hồ sơ công nhân trước khi phân công.
      </p>
    );
  }

  /** Với một công nhân, xét các buổi đã dùng ở CÁC công trình KHÁC ô đang xét. */
  const khoaOptions = (cnId: string, ctId: string, opt: Buoi) => {
    const khac = congTrinh
      .filter((ct) => ct.id !== ctId)
      .map((ct) => chon[`${cnId}:${ct.id}`])
      .filter(Boolean);
    const coCaNgayKhac = khac.includes("CA_NGAY");
    if (opt === "CA_NGAY") return khac.length > 0; // đã phân nơi khác thì không cả ngày
    // SANG / CHIEU: khoá nếu nơi khác đã cả ngày, hoặc đã dùng đúng buổi đó.
    return coCaNgayKhac || khac.includes(opt);
  };

  /** Xoá điều động của MỘT công trình trong ngày (một cột). */
  const resetCot = (ctId: string) =>
    setChon((s) => {
      const o = { ...s };
      for (const c of congNhan) o[`${c.id}:${ctId}`] = "";
      return o;
    });

  return (
    <form
      action={(fd) =>
        batDau(async () => {
          const r = await luuPhanCongMaTran(fd);
          setKq(r);
          // Lưu xong thì khoá lại; muốn sửa tiếp phải bấm Sửa.
          if (r.ok) setSua(false);
        })
      }
    >
      <input type="hidden" name="ngay" value={ngay} />

      {khoaVinhVien ? (
        <p className="border-b border-vien bg-nen px-3 py-2 text-xs text-chunhat">
          Lịch ngày này đã quá một ngày nên <strong>khoá</strong> — chỉ xem. Chỉ sửa được lịch từ hôm
          qua trở đi.
        </p>
      ) : hienChep ? (
        // Ngày mới: bảng khoá cho đến khi chọn Bảng mới hoặc Sao chép.
        <div className="flex flex-wrap items-center gap-2 border-b border-vien bg-nhannhat px-3 py-2">
          <span className="text-xs">Ngày này chưa có lịch — bắt đầu thế nào?</span>
          <button
            type="button"
            onClick={() => {
              setSua(true);
              setHienChep(false);
            }}
            className="rounded-md bg-nhan px-2.5 py-1 text-xs font-medium text-white"
          >
            Bảng mới
          </button>
          {mauChep.map((m) => (
            <button
              key={m.ngay}
              type="button"
              onClick={() => {
                setChon(doiSangO(m.o));
                setSua(true);
                setHienChep(false);
              }}
              className="rounded-md border border-nhan px-2.5 py-1 text-xs font-medium text-nhan"
            >
              Sao chép {ddmmyyyy(m.ngay)}
            </button>
          ))}
        </div>
      ) : !sua ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-vien bg-nen px-3 py-2 text-xs">
          <span className="text-chunhat">
            Lịch đã lưu, đang <strong>khoá</strong>. Bấm Sửa để chỉnh.
          </span>
          <button
            type="button"
            onClick={() => setSua(true)}
            className="inline-flex items-center gap-1 rounded-md border border-nhan px-2.5 py-1 font-medium text-nhan"
          >
            <Pencil className="size-3" /> Sửa
          </button>
        </div>
      ) : null}

      <div className="cuon-ngang">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-vien bg-the px-3 py-2 text-left text-xs font-semibold text-chunhat">
                Công nhân \ Công trình
              </th>
              {congTrinh.map((ct) => (
                <th
                  key={ct.id}
                  className="border-b border-vien bg-the px-2 py-2 text-center font-mono text-xs font-semibold whitespace-nowrap text-chunhat"
                  title={ct.tenCongTrinh}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{ct.maCongTrinh}</span>
                    {sua ? (
                      <button
                        type="button"
                        onClick={() => resetCot(ct.id)}
                        title={`Xoá điều động của ${ct.maCongTrinh} trong ngày`}
                        className="rounded p-0.5 font-sans text-[10px] font-normal text-rose-600 hover:bg-nen dark:text-rose-400"
                      >
                        reset
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {congNhan.map((c) => (
              <tr key={c.id} className="hover:bg-nen">
                <td
                  className="sticky left-0 z-10 border-b border-vien bg-the px-3 py-1.5 text-xs whitespace-nowrap"
                  title={c.hoTen}
                >
                  <span className="font-mono">{c.maCN}</span> — {c.hoTen}
                </td>
                {congTrinh.map((ct) => {
                  const k = `${c.id}:${ct.id}`;
                  const v = chon[k] ?? "";
                  return (
                    <td key={ct.id} className="border-b border-vien px-1 py-1 text-center">
                      <select
                        name={`cell:${c.id}:${ct.id}`}
                        value={v}
                        disabled={!sua}
                        onChange={(e) => setChon((s) => ({ ...s, [k]: e.target.value }))}
                        className="rounded-md border border-vien bg-the px-1 py-0.5 text-xs disabled:opacity-60"
                      >
                        <option value="">—</option>
                        {DS_BUOI.map((b) => (
                          // Ô đang chọn buổi nào thì buổi đó luôn bật để không kẹt control.
                          <option key={b} value={b} disabled={v !== b && khoaOptions(c.id, ct.id, b)}>
                            {NHAN_BUOI[b]}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sua ? (
        <div className="flex flex-wrap items-center gap-3 p-3">
          <button
            type="submit"
            disabled={dangChay}
            className="inline-flex items-center gap-1 rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            <Check className="size-3" /> {dangChay ? "Đang lưu…" : "Lưu phân công"}
          </button>
          <button
            type="button"
            onClick={() => setChon({})}
            className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs text-rose-600 dark:text-rose-400"
          >
            <Trash2 className="size-3" /> Reset tất cả
          </button>
          <span className="text-[11px] text-chunhat">
            Reset chỉ xoá trên màn hình — bấm Lưu mới ghi lại.
          </span>
          {kq ? (
            <span className={`text-xs ${kq.ok ? "text-emerald-600" : "text-rose-600"}`}>
              {kq.thongDiep}
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

// ------------------------------------------------------------ Chấm công
export interface ODong {
  congNhanId: string;
  projectId: string;
  maCN: string;
  hoTen: string;
  maCongTrinh: string;
  buoiPhanCong: string;
  caSang: boolean;
  caChieu: boolean;
  loaiVang: string | null;
  lyDoVang: string;
  gioTangCaNgay: number;
  gioTangCaDem: number;
}

interface TrangThaiDong {
  // Mỗi ca: Công hoặc Vắng (loại trừ nhau); có thể chưa đánh dấu (cả hai false).
  sangLam: boolean;
  sangVang: boolean;
  chieuLam: boolean;
  chieuVang: boolean;
  vang: string; // loại vắng đã chọn: CO_PHEP | KHONG_PHEP (mặc định CO_PHEP)
  lydo: string;
  // Hai loại tăng ca độc lập — có thể bật cả hai trong cùng ngày.
  otNgay: boolean;
  gtcNgay: string;
  otDem: boolean;
  gtcDem: string;
}

/** Một ca (sáng/chiều): hai ô Công và Vắng loại trừ nhau, để thấy ca đó có công hay vắng. */
function CaChon({
  nhan,
  lam,
  vang,
  ro,
  onLam,
  onVang,
}: {
  nhan: string;
  lam: boolean;
  vang: boolean;
  ro: boolean;
  onLam: (v: boolean) => void;
  onVang: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-chunhat">{nhan}</span>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={lam} disabled={ro} onChange={(e) => onLam(e.target.checked)} />
        Công
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={vang} disabled={ro} onChange={(e) => onVang(e.target.checked)} />
        Vắng
      </label>
    </div>
  );
}

/** Một loại tăng ca: checkbox bật + ô giờ (giờ khoá cho tới khi tích). */
function OTChon({
  nhan,
  on,
  gio,
  ro,
  onOn,
  onGio,
}: {
  nhan: string;
  on: boolean;
  gio: string;
  ro: boolean;
  onOn: (v: boolean) => void;
  onGio: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex w-24 items-center gap-1">
        <input type="checkbox" checked={on} disabled={ro} onChange={(e) => onOn(e.target.checked)} />
        {nhan}
      </label>
      <input
        type="number"
        step="0.5"
        min="0"
        max="12"
        value={gio}
        disabled={ro || !on}
        onChange={(e) => onGio(e.target.value)}
        placeholder="giờ"
        className={`${O} w-16 ${ro || !on ? "opacity-50" : ""}`}
      />
    </div>
  );
}

/**
 * Bảng chấm công một ngày: mỗi dòng là một lượt điều động, cán bộ phụ trách xác
 * nhận từng ca. Toàn bảng lưu một lượt. Chủ nhật chỉ tính giờ tăng ca.
 */
export function BangChamCong({
  ngay,
  chuNhat,
  ds,
  daLuu,
  duocSua,
}: {
  ngay: string;
  chuNhat: boolean;
  ds: ODong[];
  /** Công trình này của ngày đã lưu chấm công đủ → mở ra là khóa, phải bấm Sửa. */
  daLuu: boolean;
  duocSua: boolean;
}) {
  const [kq, setKq] = useState<KetQuaCN | null>(null);
  const [dangChay, batDau] = useTransition();
  // Đã lưu thì khóa (phải bấm Sửa mới chỉnh); chưa lưu thì mở sẵn để chấm.
  const [sua, setSua] = useState(!daLuu);
  const [tt, setTt] = useState<Record<string, TrangThaiDong>>(() => {
    const o: Record<string, TrangThaiDong> = {};
    for (const d of ds) {
      const coVang = !!d.loaiVang;
      o[`${d.congNhanId}:${d.projectId}`] = {
        sangLam: d.caSang,
        sangVang: !d.caSang && coVang,
        chieuLam: d.caChieu,
        chieuVang: !d.caChieu && coVang,
        vang: d.loaiVang ?? "CO_PHEP",
        lydo: d.lyDoVang,
        otNgay: d.gioTangCaNgay > 0,
        gtcNgay: d.gioTangCaNgay ? String(d.gioTangCaNgay) : "",
        otDem: d.gioTangCaDem > 0,
        gtcDem: d.gioTangCaDem ? String(d.gioTangCaDem) : "",
      };
    }
    return o;
  });

  // Đang sửa lại bản đã lưu mà rời trang: cảnh báo mất thay đổi chưa Lưu.
  useEffect(() => {
    if (!(sua && daLuu)) return;
    const canhBao = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", canhBao);
    return () => window.removeEventListener("beforeunload", canhBao);
  }, [sua, daLuu]);

  if (!ds.length) {
    return (
      <p className="p-4 text-xs text-chunhat">
        Ngày này chưa có điều động. Sang tab <strong>Điều động</strong> để phân công trước, rồi mới
        chấm công theo danh sách.
      </p>
    );
  }

  const suaO = (k: string, p: Partial<TrangThaiDong>) =>
    setTt((s) => ({ ...s, [k]: { ...s[k], ...p } }));

  // Khóa khi không có quyền, hoặc bản đã lưu và chưa bấm Sửa.
  const ro = !duocSua || (daLuu && !sua);

  return (
    <form
      action={(fd) =>
        batDau(async () => {
          const r = await luuChamCongNgay(fd);
          setKq(r);
          if (r.ok) setSua(false); // lưu xong thì khóa lại
        })
      }
    >
      <input type="hidden" name="ngay" value={ngay} />
      {/* Chỉ lưu ĐÚNG công trình đang mở — mỗi tab một công trình. Thiếu dòng này
          thì server lưu cả ngày và XOÁ SẠCH chấm công của công trình khác. */}
      <input type="hidden" name="projectId" value={ds[0]?.projectId ?? ""} />
      {daLuu && !sua ? (
        <p className="border-b border-vien bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          Ngày này đã lưu chấm công cho công trình — đang khóa. Bấm <strong>Sửa</strong> để chỉnh.
        </p>
      ) : null}
      {daLuu && sua ? (
        <p className="border-b border-vien bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Đang sửa bản đã lưu — bấm <strong>Lưu chấm công</strong> để cập nhật. Rời trang khi chưa
          lưu thì thay đổi sẽ mất.
        </p>
      ) : null}
      {chuNhat ? (
        <p className="border-b border-vien bg-nen px-3 py-2 text-xs text-chunhat">
          <strong>Chủ nhật</strong>: không tính công thường — chỉ nhập giờ tăng ca (được xác nhận
          bởi cán bộ phụ trách).
        </p>
      ) : null}
      <div className="cuon-ngang">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Mã CN</Th>
              <Th>Họ tên</Th>
              <Th>Công trình</Th>
              <Th>Ca làm / Vắng</Th>
              <Th>Tăng ca</Th>
            </tr>
          </thead>
          <tbody>
            {ds.map((d) => {
              const k = `${d.congNhanId}:${d.projectId}`;
              const s = tt[k];
              const coVang = s.sangVang || s.chieuVang;
              const khoaVang = ro || !coVang;
              return (
                <tr key={k} className="align-top hover:bg-nen">
                  <Td className="font-mono text-xs whitespace-nowrap">{d.maCN}</Td>
                  <Td className="text-xs font-medium whitespace-nowrap">{d.hoTen}</Td>
                  <Td className="font-mono text-xs whitespace-nowrap" title={d.buoiPhanCong}>
                    {d.maCongTrinh}
                  </Td>
                  {/* Ca làm + Vắng gộp một cột: mỗi ca chọn Công hoặc Vắng. Ô loại
                      vắng luôn hiện nhưng mờ + khoá, mở khi có ca vắng. */}
                  <Td className="text-xs">
                    {chuNhat ? (
                      <span className="text-chunhat">— (Chủ nhật)</span>
                    ) : (
                      <div className="space-y-1">
                        {/* Hidden nộp về server: caSang/caChieu + loại vắng + lý do. */}
                        <input type="hidden" name={`cs:${k}`} value={s.sangLam ? "1" : ""} />
                        <input type="hidden" name={`cc:${k}`} value={s.chieuLam ? "1" : ""} />
                        <input type="hidden" name={`vang:${k}`} value={coVang ? s.vang : ""} />
                        <input type="hidden" name={`lydo:${k}`} value={s.lydo} />

                        <CaChon
                          nhan="Sáng"
                          lam={s.sangLam}
                          vang={s.sangVang}
                          ro={ro}
                          onLam={(v) => suaO(k, { sangLam: v, sangVang: v ? false : s.sangVang })}
                          onVang={(v) => suaO(k, { sangVang: v, sangLam: v ? false : s.sangLam })}
                        />
                        <CaChon
                          nhan="Chiều"
                          lam={s.chieuLam}
                          vang={s.chieuVang}
                          ro={ro}
                          onLam={(v) => suaO(k, { chieuLam: v, chieuVang: v ? false : s.chieuVang })}
                          onVang={(v) => suaO(k, { chieuVang: v, chieuLam: v ? false : s.chieuLam })}
                        />

                        <div className={`flex flex-wrap items-center gap-1 ${khoaVang ? "opacity-50" : ""}`}>
                          <select
                            value={s.vang}
                            disabled={khoaVang}
                            onChange={(e) => suaO(k, { vang: e.target.value })}
                            className={O}
                          >
                            <option value="CO_PHEP">Có phép</option>
                            <option value="KHONG_PHEP">Không phép</option>
                          </select>
                          <input
                            value={s.lydo}
                            disabled={khoaVang}
                            onChange={(e) => suaO(k, { lydo: e.target.value })}
                            placeholder="Lý do (nếu có)"
                            className={`${O} w-36`}
                          />
                        </div>
                      </div>
                    )}
                  </Td>
                  {/* Tăng ca: hai loại độc lập, tích loại nào nhập giờ loại đó.
                      Chủ nhật gộp mọi giờ vào tăng ca Chủ nhật nên chỉ một ô. */}
                  <Td className="text-xs">
                    <input type="hidden" name={`gtcNgay:${k}`} value={s.otNgay ? s.gtcNgay : ""} />
                    <input type="hidden" name={`gtcDem:${k}`} value={s.otDem ? s.gtcDem : ""} />
                    {chuNhat ? (
                      <OTChon
                        nhan="Giờ Chủ nhật"
                        on={s.otNgay}
                        gio={s.gtcNgay}
                        ro={ro}
                        onOn={(v) => suaO(k, { otNgay: v })}
                        onGio={(v) => suaO(k, { gtcNgay: v })}
                      />
                    ) : (
                      <div className="space-y-1">
                        <OTChon
                          nhan="Trong ngày"
                          on={s.otNgay}
                          gio={s.gtcNgay}
                          ro={ro}
                          onOn={(v) => suaO(k, { otNgay: v })}
                          onGio={(v) => suaO(k, { gtcNgay: v })}
                        />
                        <OTChon
                          nhan="Qua đêm"
                          on={s.otDem}
                          gio={s.gtcDem}
                          ro={ro}
                          onOn={(v) => suaO(k, { otDem: v })}
                          onGio={(v) => suaO(k, { gtcDem: v })}
                        />
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {duocSua ? (
        <div className="flex flex-wrap items-center gap-3 p-3">
          {daLuu && !sua ? (
            // key riêng + preventDefault BẮT BUỘC: nếu để React dùng lại cùng một
            // <button> rồi đổi type "button"→"submit" giữa cú click, trình duyệt xử
            // lý cú click Sửa như bấm Lưu (submit) ngay → tự lưu rồi khóa lại, không
            // vào được chế độ sửa. key khác nhau buộc React gỡ hẳn nút này và dựng
            // nút Lưu mới; preventDefault chặn nốt mọi submit lỡ phát sinh.
            <button
              key="nut-sua"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setSua(true);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-vien px-3 py-1.5 text-xs font-medium"
            >
              <Pencil className="size-3" /> Sửa
            </button>
          ) : (
            <button
              key="nut-luu"
              type="submit"
              disabled={dangChay}
              className="inline-flex items-center gap-1 rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              <Check className="size-3" /> {dangChay ? "Đang lưu…" : "Lưu chấm công"}
            </button>
          )}
          {kq ? (
            <span className={`text-xs ${kq.ok ? "text-emerald-600" : "text-rose-600"}`}>
              {kq.thongDiep}
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

// ------------------------------------------------------------ Chấm công Đội DA
interface TrangThaiDongDA extends TrangThaiDong {
  /** projectId công trình của dự án mà người này làm ngày đó ("" = chưa chọn). */
  ctId: string;
}

/**
 * Bảng chấm công theo DỰ ÁN (Đội DA): liệt kê SẴN cả đội (không qua điều động),
 * mỗi công nhân một dòng kèm ô CHỌN CÔNG TRÌNH trong dự án. Bỏ chọn công trình =
 * không chấm người đó. Còn lại (ca, vắng, tăng ca) giống bảng đội thi công.
 */
export function BangChamCongDA({
  ngay,
  doiDAId,
  chuNhat,
  congTrinhs,
  ds,
  daLuu,
  duocSua,
}: {
  ngay: string;
  doiDAId: string;
  chuNhat: boolean;
  congTrinhs: { id: string; maCongTrinh: string; tenCongTrinh: string }[];
  ds: DongChamCongDA[];
  /** Cả đội đã chấm đủ → mở ra là khóa, phải bấm Sửa. */
  daLuu: boolean;
  duocSua: boolean;
}) {
  const [kq, setKq] = useState<KetQuaCN | null>(null);
  const [dangChay, batDau] = useTransition();
  const [sua, setSua] = useState(!daLuu);
  const [tt, setTt] = useState<Record<string, TrangThaiDongDA>>(() => {
    const o: Record<string, TrangThaiDongDA> = {};
    for (const d of ds) {
      const coVang = !!d.loaiVang;
      o[d.congNhanId] = {
        ctId: d.projectId,
        sangLam: d.caSang,
        sangVang: !d.caSang && coVang,
        chieuLam: d.caChieu,
        chieuVang: !d.caChieu && coVang,
        vang: d.loaiVang ?? "CO_PHEP",
        lydo: d.lyDoVang,
        otNgay: d.gioTangCaNgay > 0,
        gtcNgay: d.gioTangCaNgay ? String(d.gioTangCaNgay) : "",
        otDem: d.gioTangCaDem > 0,
        gtcDem: d.gioTangCaDem ? String(d.gioTangCaDem) : "",
      };
    }
    return o;
  });

  useEffect(() => {
    if (!(sua && daLuu)) return;
    const canhBao = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", canhBao);
    return () => window.removeEventListener("beforeunload", canhBao);
  }, [sua, daLuu]);

  if (!congTrinhs.length) {
    return (
      <p className="p-4 text-xs text-chunhat">
        Dự án chưa có công trình nào. Vào mục <strong>Đội dự án (Đội DA)</strong> ở Hồ sơ chung, bấm
        Sửa và tích công trình để nhóm vào dự án trước khi chấm công.
      </p>
    );
  }
  if (!ds.length) {
    return (
      <p className="p-4 text-xs text-chunhat">
        Đội này chưa có công nhân nào. Thêm công nhân (chọn đội = Đội DA này) ở mục Hồ sơ công nhân.
      </p>
    );
  }

  const suaO = (k: string, p: Partial<TrangThaiDongDA>) =>
    setTt((s) => ({ ...s, [k]: { ...s[k], ...p } }));
  const ro = !duocSua || (daLuu && !sua);

  return (
    <form
      action={(fd) =>
        batDau(async () => {
          const r = await luuChamCongDoiDA(fd);
          setKq(r);
          if (r.ok) setSua(false);
        })
      }
    >
      <input type="hidden" name="ngay" value={ngay} />
      <input type="hidden" name="doiDAId" value={doiDAId} />
      {daLuu && !sua ? (
        <p className="border-b border-vien bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          Dự án này đã lưu chấm công — đang khóa. Bấm <strong>Sửa</strong> để chỉnh.
        </p>
      ) : null}
      {daLuu && sua ? (
        <p className="border-b border-vien bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Đang sửa bản đã lưu — bấm <strong>Lưu chấm công</strong> để cập nhật. Rời trang khi chưa
          lưu thì thay đổi sẽ mất.
        </p>
      ) : null}
      {chuNhat ? (
        <p className="border-b border-vien bg-nen px-3 py-2 text-xs text-chunhat">
          <strong>Chủ nhật</strong>: không tính công thường — chỉ nhập giờ tăng ca.
        </p>
      ) : null}
      <div className="cuon-ngang">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Mã CN</Th>
              <Th>Họ tên</Th>
              <Th>Công trình</Th>
              <Th>Ca làm / Vắng</Th>
              <Th>Tăng ca</Th>
            </tr>
          </thead>
          <tbody>
            {ds.map((d) => {
              const k = d.congNhanId;
              const s = tt[k];
              const coVang = s.sangVang || s.chieuVang;
              const khoaVang = ro || !coVang;
              return (
                <tr key={k} className="align-top hover:bg-nen">
                  <Td className="font-mono text-xs whitespace-nowrap">{d.maCN}</Td>
                  <Td className="text-xs font-medium whitespace-nowrap">{d.hoTen}</Td>
                  {/* Ô chọn công trình của dự án — quyết định nơi làm thực tế. */}
                  <Td className="text-xs">
                    <select
                      name={`ct:${k}`}
                      value={s.ctId}
                      disabled={ro}
                      onChange={(e) => suaO(k, { ctId: e.target.value })}
                      className={`${O} max-w-45`}
                    >
                      <option value="">— Không làm —</option>
                      {congTrinhs.map((ct) => (
                        <option key={ct.id} value={ct.id} title={ct.tenCongTrinh}>
                          {ct.maCongTrinh}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td className="text-xs">
                    {chuNhat ? (
                      <span className="text-chunhat">— (Chủ nhật)</span>
                    ) : (
                      <div className="space-y-1">
                        <input type="hidden" name={`cs:${k}`} value={s.sangLam ? "1" : ""} />
                        <input type="hidden" name={`cc:${k}`} value={s.chieuLam ? "1" : ""} />
                        <input type="hidden" name={`vang:${k}`} value={coVang ? s.vang : ""} />
                        <input type="hidden" name={`lydo:${k}`} value={s.lydo} />

                        <CaChon
                          nhan="Sáng"
                          lam={s.sangLam}
                          vang={s.sangVang}
                          ro={ro}
                          onLam={(v) => suaO(k, { sangLam: v, sangVang: v ? false : s.sangVang })}
                          onVang={(v) => suaO(k, { sangVang: v, sangLam: v ? false : s.sangLam })}
                        />
                        <CaChon
                          nhan="Chiều"
                          lam={s.chieuLam}
                          vang={s.chieuVang}
                          ro={ro}
                          onLam={(v) => suaO(k, { chieuLam: v, chieuVang: v ? false : s.chieuVang })}
                          onVang={(v) => suaO(k, { chieuVang: v, chieuLam: v ? false : s.chieuLam })}
                        />

                        <div className={`flex flex-wrap items-center gap-1 ${khoaVang ? "opacity-50" : ""}`}>
                          <select
                            value={s.vang}
                            disabled={khoaVang}
                            onChange={(e) => suaO(k, { vang: e.target.value })}
                            className={O}
                          >
                            <option value="CO_PHEP">Có phép</option>
                            <option value="KHONG_PHEP">Không phép</option>
                          </select>
                          <input
                            value={s.lydo}
                            disabled={khoaVang}
                            onChange={(e) => suaO(k, { lydo: e.target.value })}
                            placeholder="Lý do (nếu có)"
                            className={`${O} w-36`}
                          />
                        </div>
                      </div>
                    )}
                  </Td>
                  <Td className="text-xs">
                    <input type="hidden" name={`gtcNgay:${k}`} value={s.otNgay ? s.gtcNgay : ""} />
                    <input type="hidden" name={`gtcDem:${k}`} value={s.otDem ? s.gtcDem : ""} />
                    {chuNhat ? (
                      <OTChon
                        nhan="Giờ Chủ nhật"
                        on={s.otNgay}
                        gio={s.gtcNgay}
                        ro={ro}
                        onOn={(v) => suaO(k, { otNgay: v })}
                        onGio={(v) => suaO(k, { gtcNgay: v })}
                      />
                    ) : (
                      <div className="space-y-1">
                        <OTChon
                          nhan="Trong ngày"
                          on={s.otNgay}
                          gio={s.gtcNgay}
                          ro={ro}
                          onOn={(v) => suaO(k, { otNgay: v })}
                          onGio={(v) => suaO(k, { gtcNgay: v })}
                        />
                        <OTChon
                          nhan="Qua đêm"
                          on={s.otDem}
                          gio={s.gtcDem}
                          ro={ro}
                          onOn={(v) => suaO(k, { otDem: v })}
                          onGio={(v) => suaO(k, { gtcDem: v })}
                        />
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {duocSua ? (
        <div className="flex flex-wrap items-center gap-3 p-3">
          {daLuu && !sua ? (
            <button
              key="nut-sua"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setSua(true);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-vien px-3 py-1.5 text-xs font-medium"
            >
              <Pencil className="size-3" /> Sửa
            </button>
          ) : (
            <button
              key="nut-luu"
              type="submit"
              disabled={dangChay}
              className="inline-flex items-center gap-1 rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              <Check className="size-3" /> {dangChay ? "Đang lưu…" : "Lưu chấm công"}
            </button>
          )}
          {kq ? (
            <span className={`text-xs ${kq.ok ? "text-emerald-600" : "text-rose-600"}`}>
              {kq.thongDiep}
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

/** Nút xoá cả lịch điều động của một ngày — chỉ ADMIN thấy. */
export function NutXoaLichDieuDong({ ngay, laAdmin }: { ngay: string; laAdmin: boolean }) {
  if (!laAdmin) return null;
  return (
    <NutHanhDong
      hanhDong={xoaLichDieuDong}
      truong={{ ngay }}
      bienThe="do"
      title={`Xoá lịch điều động ngày ${ngay}`}
      nhan={<Trash2 className="size-3.5" />}
    />
  );
}

// ------------------------------------------------------------ Time sheet
const THU_TS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/** 1 chứ không phải 1,00; 0,5 giữ dấu phẩy kiểu Việt. */
function soVN(n: number) {
  return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

const ddmm = (ngay: string) => `${ngay.slice(8)}/${ngay.slice(5, 7)}`;

/**
 * Time sheet gộp của một công nhân: MỘT lịch tháng duy nhất (không tách bảng công
 * / bảng tăng ca). Bấm vào một ngày để xem chi tiết ngày đó: số công, nghỉ phép,
 * tăng ca ngày, tăng ca đêm. Ngày lễ bôi màu tím, Chủ nhật bôi xanh.
 */
export function LichTimeSheet({ ngays }: { ngays: ONgayTimeSheet[] }) {
  const [chon, setChon] = useState<ONgayTimeSheet | null>(null);
  const offset = (ngays[0].thu + 6) % 7; // ô trống đầu tháng theo thứ ngày 1

  return (
    <div className="p-3">
      <div className="grid grid-cols-7 gap-1">
        {THU_TS.map((t, i) => (
          <div
            key={t}
            className={`px-1 py-0.5 text-center text-[11px] font-semibold ${i === 6 ? "text-rose-600 dark:text-rose-400" : "text-chunhat"}`}
          >
            {t}
          </div>
        ))}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`o${i}`} />
        ))}
        {ngays.map((n) => {
          const d = Number(n.ngay.slice(8));
          const coOT = n.tcNgay > 0 || n.tcDem > 0;
          let mau = "bg-nen text-chunhat";
          if (n.laNgayLe) mau = "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300";
          else if (n.laChuNhat) mau = "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
          else if (n.cong >= 1) mau = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
          else if (n.cong > 0) mau = "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
          else if (n.nghiPhep > 0) mau = "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300";
          else if (n.coCham) mau = "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
          // Ô hiển thị: công nếu có; nếu không có công mà có nghỉ phép thì "P".
          const chinh = n.cong ? soVN(n.cong) : n.nghiPhep ? "P" : "";
          const dangChon = chon?.ngay === n.ngay;
          return (
            <button
              key={n.ngay}
              type="button"
              onClick={() => setChon(dangChon ? null : n)}
              className={`rounded-md px-1 py-1 text-center ${mau} ${dangChon ? "ring-2 ring-nhan" : ""}`}
            >
              <div className="text-[11px] leading-none opacity-70">{d}</div>
              <div className="mt-0.5 text-xs leading-none font-semibold">{chinh || "·"}</div>
              {coOT ? (
                <div className="mt-0.5 text-[9px] leading-none opacity-80">+{soVN(n.tcNgay + n.tcDem)}h</div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-chunhat">
        <Legend2 mau="bg-emerald-100 dark:bg-emerald-950/40" nhan="Đủ công (1)" />
        <Legend2 mau="bg-amber-100 dark:bg-amber-950/40" nhan="Thiếu công (0,5)" />
        <Legend2 mau="bg-orange-100 dark:bg-orange-950/40" nhan="Nghỉ phép (P)" />
        <Legend2 mau="bg-rose-100 dark:bg-rose-950/40" nhan="Không công" />
        <Legend2 mau="bg-sky-100 dark:bg-sky-950/40" nhan="Chủ nhật" />
        <Legend2 mau="bg-violet-100 dark:bg-violet-950/40" nhan="Ngày lễ" />
        <span>+h = giờ tăng ca trong ngày</span>
      </div>

      {chon ? (
        <ChiTietNgay n={chon} />
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-vien px-3 py-2 text-xs text-chunhat">
          Bấm vào một ngày để xem chi tiết công, nghỉ phép và giờ tăng ca của ngày đó.
        </p>
      )}
    </div>
  );
}

function Legend2({ mau, nhan }: { mau: string; nhan: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block size-3 rounded ${mau}`} /> {nhan}
    </span>
  );
}

function ChiTietNgay({ n }: { n: ONgayTimeSheet }) {
  const loaiNgay = n.laNgayLe ? "Ngày lễ" : n.laChuNhat ? "Chủ nhật" : null;
  return (
    <div className="mt-3 rounded-md border border-vien bg-nen px-3 py-2 text-xs">
      <p className="mb-1 font-semibold">
        Ngày {ddmm(n.ngay)}
        {loaiNgay ? <span className="ml-1 font-normal text-chunhat">· {loaiNgay}</span> : null}
        {!n.coCham ? <span className="ml-1 font-normal text-chunhat">· chưa chấm công</span> : null}
      </p>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        <ODl nhan="Số công" giaTri={n.cong ? soVN(n.cong) : "0"} />
        <ODl nhan="Nghỉ phép" giaTri={n.nghiPhep ? `Có (${soVN(n.nghiPhep)})` : "Không"} />
        <ODl nhan="Tăng ca ngày" giaTri={n.tcNgay ? `${soVN(n.tcNgay)} h` : "—"} />
        <ODl nhan="Tăng ca đêm" giaTri={n.tcDem ? `${soVN(n.tcDem)} h` : "—"} />
      </dl>
    </div>
  );
}

function ODl({ nhan, giaTri }: { nhan: string; giaTri: string }) {
  return (
    <div>
      <dt className="text-[11px] text-chunhat">{nhan}</dt>
      <dd className="font-semibold">{giaTri}</dd>
    </div>
  );
}

// ------------------------------------------------------------ Danh sách công nhân theo đội (tab ngang)
/**
 * Danh sách công nhân dạng TAB NGANG phân theo đội: "Đội thi công" (nội thành) và
 * mỗi Đội DA (ngoại thành, gộp theo tên đội DA) một tab. Tab bằng state client để
 * bấm chuyển không rời trang (nằm trong khối gập).
 */
export function DanhSachDoiTab({
  ds,
  duocSua,
  dsDoiDA,
}: {
  ds: OCongNhan[];
  duocSua: boolean;
  dsDoiDA: ODoiDA[];
}) {
  const thiCong = ds.filter((c) => c.doi === "NOI_THANH");
  const daMap = new Map<string, OCongNhan[]>();
  for (const c of ds) {
    if (c.doi !== "NGOAI_THANH") continue;
    const key = c.tenDoiDA || "Đội DA (chưa đặt tên)";
    const a = daMap.get(key);
    if (a) a.push(c);
    else daMap.set(key, [c]);
  }
  const tabs = [
    { nhan: "Đội thi công", ds: thiCong },
    ...[...daMap.entries()].map(([ten, list]) => ({ nhan: ten, ds: list })),
  ];
  const [active, setActive] = useState(0);
  const i = Math.min(active, tabs.length - 1);
  const cur = tabs[i];

  return (
    <div>
      {/* Thanh tab ngang, tràn thì cuộn. */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-vien p-3">
        {tabs.map((t, idx) => (
          <button
            key={t.nhan}
            type="button"
            onClick={() => setActive(idx)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              idx === i ? "bg-nhan text-white" : "text-chunhat hover:bg-nen hover:text-chu"
            }`}
          >
            {t.nhan} <span className="font-semibold">({t.ds.length})</span>
          </button>
        ))}
      </div>
      {cur.ds.length ? (
        <div className="cuon-ngang">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {duocSua ? <Th className="w-10" /> : null}
                <Th>Mã CN</Th>
                <Th>Họ tên</Th>
                <Th>Đội</Th>
                <Th>Nghề</Th>
                <Th>Người quản lý</Th>
                <Th>Ghi chú</Th>
              </tr>
            </thead>
            <tbody>
              {cur.ds.map((c) => (
                <tr key={c.id} className="hover:bg-nen">
                  {duocSua ? (
                    <Td className="px-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <FormCongNhan suaCN={c} duocSua={duocSua} dsDoiDA={dsDoiDA} />
                        <NutXoaCongNhan id={c.id} maCN={c.maCN} />
                      </div>
                    </Td>
                  ) : null}
                  <Td className="font-mono text-xs whitespace-nowrap">{c.maCN}</Td>
                  <Td className="text-xs font-medium">{c.hoTen}</Td>
                  <Td>
                    <Nhan bienThe={c.doi === "NOI_THANH" ? "nhan" : "trung_tinh"}>
                      {c.doi === "NOI_THANH" ? "Đội thi công" : "Đội DA"}
                    </Nhan>
                  </Td>
                  <Td className="text-xs">{c.ngheNghiep || "—"}</Td>
                  <Td className="text-xs">{c.nguoiQuanLy || "—"}</Td>
                  <Td className="max-w-50 truncate text-xs" title={c.ghiChu}>
                    {c.ghiChu || "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-3 text-xs text-chunhat">Chưa có công nhân trong nhóm này.</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------ Danh mục Đội DA
export interface ODoiDADayDu {
  id: string;
  ten: string;
  soCongNhan: number;
  soCongTrinh: number;
  nguoiQuanLyId: string;
  nguoiQuanLy: string;
  /** projectId các công trình đã nhóm vào dự án. */
  congTrinhIds: string[];
}

/**
 * Quản lý danh mục Đội DA (dự án ngoại thành): thêm, XOÁ (chặn nếu còn dùng), và
 * SỬA — đổi tên, gán người quản lý (chấm công cho dự án), và NHÓM công trình vào
 * dự án bằng danh sách tích chọn.
 */
export function QuanLyDoiDA({
  ds,
  duocSua,
  dsCanBo,
  dsCongTrinh,
}: {
  ds: ODoiDADayDu[];
  duocSua: boolean;
  dsCanBo: { id: string; hoTen: string }[];
  dsCongTrinh: OChon[];
}) {
  const [kq, setKq] = useState<KetQuaCN | null>(null);
  const [dangChay, batDau] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [sua, setSua] = useState<string | null>(null);
  const doiSua = ds.find((d) => d.id === sua) ?? null;

  return (
    <div className="p-4">
      {duocSua ? (
        <form
          ref={formRef}
          action={(fd) =>
            batDau(async () => {
              const r = await luuDoiDA(fd);
              setKq(r);
              if (r.ok) formRef.current?.reset();
            })
          }
          className="mb-3 flex flex-wrap items-center gap-2"
        >
          <input name="ten" className={`${O} w-56`} placeholder="Tên đội DA mới (VD: TSLA)" required />
          <button
            type="submit"
            disabled={dangChay}
            className="inline-flex items-center gap-1 rounded-md bg-nhan px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
          >
            <Plus className="size-3" /> Thêm đội DA
          </button>
          {kq ? (
            <span className={`text-xs ${kq.ok ? "text-emerald-600" : "text-rose-600"}`}>{kq.thongDiep}</span>
          ) : null}
        </form>
      ) : null}
      {ds.length ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Tên đội DA</Th>
              <Th>Người quản lý</Th>
              <Th phai>Công nhân</Th>
              <Th phai>Công trình</Th>
              {duocSua ? <Th className="w-20" /> : null}
            </tr>
          </thead>
          <tbody>
            {ds.map((d) => (
              <tr key={d.id} className="hover:bg-nen">
                <Td className="text-xs font-medium">{d.ten}</Td>
                <Td className="text-xs">{d.nguoiQuanLy || "—"}</Td>
                <Td phai>{d.soCongNhan}</Td>
                <Td phai>{d.soCongTrinh}</Td>
                {duocSua ? (
                  <Td className="px-2">
                    <div className="flex items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setSua(d.id)}
                        title={`Sửa đội ${d.ten}`}
                        className="inline-flex items-center rounded p-1 text-nhan hover:bg-nen"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <NutHanhDong
                        hanhDong={xoaDoiDA}
                        truong={{ id: d.id }}
                        bienThe="do"
                        title={`Xoá đội ${d.ten}`}
                        nhan={<Trash2 className="size-3.5" />}
                      />
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-chunhat">Chưa có đội DA nào. Thêm ở trên để bắt đầu.</p>
      )}

      {doiSua ? (
        <SuaDoiDAModal
          doi={doiSua}
          dsCanBo={dsCanBo}
          dsCongTrinh={dsCongTrinh}
          onDong={() => setSua(null)}
        />
      ) : null}
    </div>
  );
}

/** Hộp thoại sửa đội DA: tên + người quản lý + nhóm công trình vào dự án. */
function SuaDoiDAModal({
  doi,
  dsCanBo,
  dsCongTrinh,
  onDong,
}: {
  doi: ODoiDADayDu;
  dsCanBo: { id: string; hoTen: string }[];
  dsCongTrinh: OChon[];
  onDong: () => void;
}) {
  const [kq, setKq] = useState<KetQuaCN | null>(null);
  const [dangChay, batDau] = useTransition();
  const daChon = new Set(doi.congTrinhIds);

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDong();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onDong]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-xl border border-vien bg-the shadow-xl">
        <div className="flex items-center justify-between border-b border-vien px-4 py-3">
          <h2 className="text-sm font-semibold">Sửa đội DA — {doi.ten}</h2>
          <button
            type="button"
            onClick={onDong}
            title="Đóng (Esc)"
            className="rounded-md border border-vien p-1.5"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          action={(fd) =>
            batDau(async () => {
              const r = await suaDoiDA(fd);
              setKq(r);
              if (r.ok) setTimeout(onDong, 700);
            })
          }
          className="p-4"
        >
          <input type="hidden" name="id" value={doi.id} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs">
              <span className="mb-0.5 block text-chunhat">Tên đội DA / dự án</span>
              <input name="ten" defaultValue={doi.ten} className={`${O} w-full`} required />
            </label>
            <label className="text-xs">
              <span className="mb-0.5 block text-chunhat">Người quản lý (chấm công dự án)</span>
              <select name="nguoiQuanLyId" defaultValue={doi.nguoiQuanLyId} className={`${O} w-full`}>
                <option value="">— Chưa gán —</option>
                {dsCanBo.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.hoTen}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3">
            <p className="mb-1 text-xs text-chunhat">
              Công trình thuộc dự án (tích để nhóm vào dự án — sẽ chuyển sang ngoại thành):
            </p>
            {dsCongTrinh.length ? (
              <div className="max-h-64 overflow-y-auto rounded-md border border-vien">
                {dsCongTrinh.map((c) => {
                  const doiKhac = c.doiDAId && c.doiDAId !== doi.id;
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 border-b border-vien px-2 py-1 text-xs last:border-b-0 hover:bg-nen"
                    >
                      <input
                        type="checkbox"
                        name="ctId"
                        value={c.id}
                        defaultChecked={daChon.has(c.id)}
                      />
                      <span className="font-mono">{c.maCongTrinh}</span>
                      <span className="truncate text-chunhat" title={c.tenCongTrinh}>
                        {c.tenCongTrinh}
                      </span>
                      {doiKhac ? (
                        <span className="ml-auto shrink-0 text-[11px] text-amber-600 dark:text-amber-400">
                          đang ở đội {c.tenDoiDA || "khác"}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-chunhat">Không có công trình nào trong phạm vi của bạn.</p>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={dangChay}
              className="inline-flex items-center gap-1 rounded-md bg-nhan px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              <Check className="size-3" /> {dangChay ? "Đang lưu…" : "Lưu"}
            </button>
            <button
              type="button"
              onClick={onDong}
              className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs"
            >
              <X className="size-3" /> Hủy
            </button>
          </div>
          <ThongBao kq={kq} />
        </form>
      </div>
    </div>
  );
}
