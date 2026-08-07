"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Columns3, Plus, Trash2 } from "lucide-react";
import {
  chuyenCot,
  luuOCot,
  themCot,
  themDongBOQ,
  xoaCot,
  type KetQuaBOQ,
} from "@/app/cong-trinh/boq-actions";

const O = "rounded-md border border-vien bg-the px-2 py-1 text-xs";

function ThongBao({ kq }: { kq: KetQuaBOQ | null }) {
  if (!kq) return null;
  return (
    <p
      className={`mt-2 text-xs ${kq.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
    >
      {kq.thongDiep}
    </p>
  );
}

/** Nút thêm một cột tùy chỉnh vào BOQ. */
export function NutThemCot({ maCongTrinh }: { maCongTrinh: string }) {
  const [mo, setMo] = useState(false);
  const [kq, setKq] = useState<KetQuaBOQ | null>(null);
  const [dangChay, batDau] = useTransition();

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-vien px-3 py-1.5 text-xs font-medium"
      >
        <Columns3 className="size-3.5" /> Thêm cột
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        batDau(async () => setKq(await themCot(fd)));
      }}
      className="rounded-lg border border-nhan bg-nhannhat p-3"
    >
      <input type="hidden" name="maCongTrinh" value={maCongTrinh} />
      <label className="text-xs">
        <span className="mb-0.5 block text-chunhat">Tên cột mới</span>
        <input name="ten" placeholder="Ghi chú / Vị trí / Nhà thầu phụ…" className={`${O} w-64`} required />
      </label>
      <p className="mt-1 text-[11px] text-chunhat">
        Cột mới dạng general: nhập chữ hay số đều được, không tham gia tính toán. Sửa giá trị ngay
        trên bảng BOQ; dùng mũi tên ở tiêu đề để đổi vị trí cột.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={dangChay}
          className="rounded-md bg-nhan px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {dangChay ? "Đang thêm…" : "Thêm cột"}
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

/** Tiêu đề cột tùy chỉnh, kèm nút chuyển trái/phải và nút xoá. */
export function TieuDeCot({
  maCongTrinh,
  cotId,
  ten,
  dauTien,
  cuoiCung,
}: {
  maCongTrinh: string;
  cotId: string;
  ten: string;
  dauTien: boolean;
  cuoiCung: boolean;
}) {
  const [dangChay, batDau] = useTransition();

  const goi = (fn: (fd: FormData) => Promise<KetQuaBOQ>, them?: Record<string, string>) => {
    const fd = new FormData();
    fd.set("maCongTrinh", maCongTrinh);
    fd.set("cotId", cotId);
    for (const [k, v] of Object.entries(them ?? {})) fd.set(k, v);
    batDau(async () => {
      await fn(fd);
    });
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={dangChay || dauTien}
        onClick={() => goi(chuyenCot, { huong: "trai" })}
        title="Chuyển cột sang trái"
        className="disabled:opacity-30"
      >
        <ChevronLeft className="size-3" />
      </button>
      {ten}
      <button
        type="button"
        disabled={dangChay || cuoiCung}
        onClick={() => goi(chuyenCot, { huong: "phai" })}
        title="Chuyển cột sang phải"
        className="disabled:opacity-30"
      >
        <ChevronRight className="size-3" />
      </button>
      <button
        type="button"
        disabled={dangChay}
        onClick={() => {
          if (confirm(`Xoá cột "${ten}" và toàn bộ giá trị của nó?`)) goi(xoaCot);
        }}
        title={`Xoá cột ${ten}`}
        className="text-rose-600 disabled:opacity-30 dark:text-rose-400"
      >
        <Trash2 className="size-3" />
      </button>
    </span>
  );
}

/**
 * Một ô cột tùy chỉnh, sửa ngay tại chỗ trên bảng BOQ.
 * Lưu khi rời ô (blur) và chỉ khi giá trị thực sự đổi — tránh gọi máy chủ vô ích.
 */
export function ONhapCot({
  maCongTrinh,
  cotId,
  boqLineId,
  giaTri,
}: {
  maCongTrinh: string;
  cotId: string;
  boqLineId: string;
  giaTri: string;
}) {
  const [v, setV] = useState(giaTri);
  const [dangChay, batDau] = useTransition();

  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v === giaTri) return;
        const fd = new FormData();
        fd.set("maCongTrinh", maCongTrinh);
        fd.set("cotId", cotId);
        fd.set("boqLineId", boqLineId);
        fd.set("giaTri", v);
        batDau(async () => {
          await luuOCot(fd);
        });
      }}
      placeholder="—"
      className={`w-32 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs hover:border-vien focus:border-nhan focus:bg-the focus:outline-none ${dangChay ? "opacity-50" : ""}`}
    />
  );
}

/** Thêm một dòng BOQ phát sinh, chọn được chèn sau dòng nào. */
export function NutThemDong({
  maCongTrinh,
  dongs,
}: {
  maCongTrinh: string;
  dongs: { id: string; stt: string; noiDung: string }[];
}) {
  const [mo, setMo] = useState(false);
  const [kq, setKq] = useState<KetQuaBOQ | null>(null);
  const [dangChay, batDau] = useTransition();

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-vien px-3 py-1.5 text-xs font-medium"
      >
        <Plus className="size-3.5" /> Thêm dòng BOQ
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        batDau(async () => {
          const r = await themDongBOQ(fd);
          setKq(r);
        });
      }}
      className="rounded-lg border border-nhan bg-nhannhat p-3"
    >
      <input type="hidden" name="maCongTrinh" value={maCongTrinh} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-6">
        <label className="text-xs">
          <span className="mb-0.5 block text-chunhat">STT</span>
          <input name="stt" placeholder="1.8" className={`${O} w-full`} />
        </label>
        <label className="text-xs sm:col-span-3">
          <span className="mb-0.5 block text-chunhat">Nội dung công việc</span>
          <input name="noiDung" placeholder="Công tác phát sinh…" className={`${O} w-full`} required />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-chunhat">ĐVT</span>
          <input name="dvt" placeholder="m3" className={`${O} w-full`} />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-chunhat">KL hợp đồng</span>
          <input name="khoiLuong" inputMode="decimal" placeholder="0" className={`${O} w-full`} />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-chunhat">Đơn giá (đ)</span>
          <input name="donGia" inputMode="numeric" placeholder="0" className={`${O} w-full`} />
        </label>
        <label className="text-xs sm:col-span-4">
          <span className="mb-0.5 block text-chunhat">Chèn vào vị trí</span>
          <select name="sauDongId" defaultValue={dongs.at(-1)?.id ?? ""} className={`${O} w-full`}>
            <option value="">— Lên đầu bảng —</option>
            {dongs.map((d) => (
              <option key={d.id} value={d.id}>
                Sau {d.stt} — {d.noiDung.replace(/<[^>]*>/g, "").slice(0, 40)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={dangChay}
          className="rounded-md bg-nhan px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {dangChay ? "Đang thêm…" : "Thêm dòng"}
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
