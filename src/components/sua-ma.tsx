"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { suaMa, themMa, xoaMa, type KetQuaAction } from "@/app/danh-muc/actions";
import type { MaDTCP } from "@/lib/types";

const O = "rounded-md border border-vien bg-the px-2 py-1 text-xs";

/** Đóng hộp thoại bằng Esc — hộp nổi mà không thoát được bằng bàn phím thì rất bí. */
function useThoatEsc(mo: boolean, dong: () => void) {
  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") dong();
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [mo, dong]);
}

/** Khung hộp thoại giữa trang, dùng chung cho sửa và xoá. */
function HopThoai({
  tieuDe,
  ma,
  dong,
  children,
}: {
  tieuDe: string;
  ma: string;
  dong: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-xl rounded-xl border border-vien bg-the shadow-xl">
        <div className="flex items-center justify-between border-b border-vien px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{tieuDe}</h2>
            <p className="mt-0.5 text-xs text-chunhat">{ma}</p>
          </div>
          <button
            type="button"
            onClick={dong}
            title="Đóng (Esc)"
            className="rounded-md border border-vien p-1.5"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ThongBao({ kq }: { kq: KetQuaAction | null }) {
  if (!kq) return null;
  return (
    <p
      className={`mt-2 text-xs ${kq.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
    >
      {kq.thongDiep}
    </p>
  );
}

/** Nút sửa mã, mở form trong HỘP THOẠI GIỮA TRANG. */
export function NutSuaMa({ ma, soGiaoDich }: { ma: MaDTCP; soGiaoDich: number }) {
  const [mo, setMo] = useState(false);
  const [kq, setKq] = useState<KetQuaAction | null>(null);
  const [dangChay, batDau] = useTransition();

  // Mã đã có giao dịch thì khoá hai trường có thể làm sai báo cáo quá khứ.
  const khoaLoai = soGiaoDich > 0;

  useThoatEsc(mo, () => setMo(false));

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        title={`Sửa ${ma.ma}`}
        className="inline-flex items-center rounded p-1 text-nhan hover:bg-nen"
      >
        <Pencil className="size-3.5" />
      </button>
    );
  }

  return (
    <HopThoai
      tieuDe="Sửa mã doanh thu – chi phí"
      ma={ma.ma}
      dong={() => {
        setMo(false);
        setKq(null);
      }}
    >
    <form
      action={(fd) =>
        batDau(async () => {
          const r = await suaMa(fd);
          setKq(r);
          if (r.ok) setTimeout(() => setMo(false), 900);
        })
      }
      className="p-4"
    >
      <input type="hidden" name="ma" value={ma.ma} />
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 text-xs">
          <span className="mb-0.5 block text-chunhat">Tên mã</span>
          <input name="ten" defaultValue={ma.ten} className={`${O} w-full`} required />
        </label>

        <label className="text-xs">
          <span className="mb-0.5 block text-chunhat">Loại</span>
          <select name="loai" defaultValue={ma.loai} disabled={khoaLoai} className={`${O} w-full disabled:opacity-60`}>
            <option>Doanh thu</option>
            <option>Chi phí</option>
          </select>
        </label>

        <div className="flex flex-col justify-end gap-1.5 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name="choPhepNhapTrucTiep"
              defaultChecked={ma.choPhepNhapTrucTiep}
              disabled={khoaLoai && ma.choPhepNhapTrucTiep}
            />
            Cho nhập trực tiếp
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="isActive" defaultChecked />
            Còn hiệu lực
          </label>
        </div>
      </div>

      {khoaLoai ? (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
          Mã này đã có {soGiaoDich.toLocaleString("vi-VN")} giao dịch nên không đổi được Loại —
          đổi sẽ làm sai báo cáo các kỳ đã chốt. Muốn ngừng dùng thì bỏ chọn “Còn hiệu lực”.
        </p>
      ) : null}

      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={dangChay}
          className="inline-flex items-center gap-1 rounded-md bg-nhan px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          <Check className="size-3" /> {dangChay ? "Đang lưu…" : "Lưu"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMo(false);
            setKq(null);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs"
        >
          <X className="size-3" /> Hủy
        </button>
      </div>
      <ThongBao kq={kq} />
    </form>
    </HopThoai>
  );
}

/**
 * Nút xoá mã, mở hộp thoại xác nhận giữa trang.
 *
 * Nút bị vô hiệu ngay trên giao diện khi mã đang được dùng, nhưng chốt chặn
 * thật nằm ở `xoaMa` phía máy chủ — giao diện chỉ để người dùng biết trước.
 */
export function NutXoaMa({
  ma,
  soGiaoDich,
  soCon,
}: {
  ma: MaDTCP;
  soGiaoDich: number;
  soCon: number;
}) {
  const [mo, setMo] = useState(false);
  const [kq, setKq] = useState<KetQuaAction | null>(null);
  const [dangChay, batDau] = useTransition();

  useThoatEsc(mo, () => setMo(false));

  const canTro =
    soGiaoDich > 0
      ? `đã có ${soGiaoDich.toLocaleString("vi-VN")} giao dịch ghi theo mã này`
      : soCon > 0
        ? `còn ${soCon} mã con thuộc nhóm này`
        : null;

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        title={canTro ? `Không xoá được ${ma.ma}: ${canTro}` : `Xoá ${ma.ma}`}
        disabled={!!canTro}
        className="inline-flex items-center rounded p-1 text-rose-600 hover:bg-nen disabled:cursor-not-allowed disabled:text-chunhat disabled:hover:bg-transparent dark:text-rose-400"
      >
        <Trash2 className="size-3.5" />
      </button>
    );
  }

  return (
    <HopThoai
      tieuDe="Xoá mã doanh thu – chi phí"
      ma={ma.ma}
      dong={() => {
        setMo(false);
        setKq(null);
      }}
    >
      <form
        action={(fd) =>
          batDau(async () => {
            const r = await xoaMa(fd);
            setKq(r);
            if (r.ok) setTimeout(() => setMo(false), 900);
          })
        }
        className="p-4"
      >
        <input type="hidden" name="ma" value={ma.ma} />
        <p className="text-xs leading-relaxed">
          Xoá hẳn mã <strong className="">{ma.ma}</strong> — {ma.ten} ({ma.loai}) khỏi danh
          mục. Thao tác này không hoàn tác được.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-chunhat">
          Chỉ xoá được mã chưa có giao dịch, chưa có dòng kế hoạch và không còn mã con. Mã đang dùng
          mà muốn ngừng thì bỏ chọn “Còn hiệu lực” ở nút sửa thay vì xoá.
        </p>

        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            disabled={dangChay}
            className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
          >
            <Trash2 className="size-3" /> {dangChay ? "Đang xoá…" : "Xoá mã"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMo(false);
              setKq(null);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-vien px-2.5 py-1 text-xs"
          >
            <X className="size-3" /> Hủy
          </button>
        </div>
        <ThongBao kq={kq} />
      </form>
    </HopThoai>
  );
}

/** Form thêm mã mới, đặt trên đầu trang danh mục. */
export function FormThemMa({ danhMuc }: { danhMuc: MaDTCP[] }) {
  const [mo, setMo] = useState(false);
  const [kq, setKq] = useState<KetQuaAction | null>(null);
  const [dangChay, batDau] = useTransition();

  const maNhom = danhMuc.filter((c) => !c.choPhepNhapTrucTiep);

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-nhan px-3 py-1.5 text-xs font-medium text-white"
      >
        <Plus className="size-3.5" /> Thêm mã mới
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        batDau(async () => {
          const r = await themMa(fd);
          setKq(r);
        })
      }
      className="rounded-lg border border-nhan bg-nhannhat p-3"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <label className="text-xs">
          <span className="mb-0.5 block text-chunhat">Mã</span>
          <input name="ma" className={`${O} w-full`} placeholder="CP-060" required />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-chunhat">Tên mã</span>
          <input name="ten" className={`${O} w-full`} placeholder="Chi phí ..." required />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-chunhat">Loại</span>
          <select name="loai" defaultValue="Chi phí" className={`${O} w-full`}>
            <option>Chi phí</option>
            <option>Doanh thu</option>
          </select>
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-chunhat">Thuộc nhóm (tùy chọn)</span>
          <select name="maCha" defaultValue="" className={`${O} w-full`}>
            <option value="">— Không, là mã gốc —</option>
            {maNhom.map((c) => (
              <option key={c.ma} value={c.ma}>
                {c.ma} — {c.ten}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-1.5 pb-1 text-xs sm:col-span-2">
          <input type="checkbox" name="choPhepNhapTrucTiep" defaultChecked />
          Cho ghi giao dịch trực tiếp vào mã này
        </label>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={dangChay}
          className="rounded-md bg-nhan px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {dangChay ? "Đang lưu…" : "Thêm mã"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMo(false);
            setKq(null);
          }}
          className="rounded-md border border-vien px-3 py-1 text-xs"
        >
          Đóng
        </button>
      </div>
      <ThongBao kq={kq} />
    </form>
  );
}
