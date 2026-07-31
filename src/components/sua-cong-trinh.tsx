"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { suaCongTrinh, taoCongTrinh, type KetQuaCongTrinh } from "@/app/cong-trinh/actions";
import type { CongTrinh } from "@/lib/types";

const O = "rounded-md border border-vien bg-the px-2 py-1 text-xs";

/**
 * Gửi form mà KHÔNG để React xoá trắng các ô.
 *
 * Dùng prop `action` của React 19 thì form tự reset sau mỗi lần gửi, kể cả khi
 * bị từ chối. Form này có 11 trường — gõ sai một ô ngày mà mất sạch phần còn lại
 * là không chấp nhận được. Vì vậy chặn submit mặc định và tự gọi Server Action.
 */
function guiGiuNguyen(chay: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    chay(new FormData(e.currentTarget));
  };
}

function ThongBao({ kq }: { kq: KetQuaCongTrinh | null }) {
  if (!kq) return null;
  return (
    <p
      className={`mt-2 text-xs ${kq.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
    >
      {kq.thongDiep}
    </p>
  );
}

/**
 * Các ô dùng chung cho cả tạo mới và sửa.
 * `ct` rỗng = form tạo mới.
 */
function OChung({ ct }: { ct?: CongTrinh }) {
  // Ô "Ngày hoàn thành" chỉ hiện khi đã tích — hiện sẵn khi chưa tích thì thừa,
  // mà tích rồi lại bắt buộc nên phải theo dõi trạng thái ô tích ở client.
  const [xong, setXong] = useState(ct?.trangThai === "Đã nghiệm thu");

  return (
    <>
      <label className="text-xs sm:col-span-2">
        <span className="mb-0.5 block text-chunhat">Tên công trình</span>
        <input name="tenCongTrinh" defaultValue={ct?.tenCongTrinh} className={`${O} w-full`} required />
      </label>

      <label className="flex flex-col justify-end gap-1 pb-1 text-xs">
        <span className="text-chunhat">Trạng thái</span>
        <span className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="hoanThanh"
            checked={xong}
            onChange={(e) => setXong(e.target.checked)}
          />
          Đã hoàn thành (nghiệm thu)
        </span>
      </label>

      {xong ? (
        <label className="text-xs">
          <span className="mb-0.5 block text-chunhat">
            Ngày hoàn thành <span className="text-rose-600 dark:text-rose-400">*</span>
          </span>
          <input
            type="date"
            name="ngayHoanThanh"
            defaultValue={ct?.ngayHoanThanh}
            className={`${O} w-full`}
            required
          />
        </label>
      ) : null}

      <label className="text-xs sm:col-span-2">
        <span className="mb-0.5 block text-chunhat">Chủ đầu tư</span>
        <input name="chuDauTu" defaultValue={ct?.chuDauTu} className={`${O} w-full`} />
      </label>

      <label className="text-xs">
        <span className="mb-0.5 block text-chunhat">Chỉ huy trưởng</span>
        <input name="chiHuyTruong" defaultValue={ct?.chiHuyTruong} className={`${O} w-full`} />
      </label>

      <label className="text-xs">
        <span className="mb-0.5 block text-chunhat">Ngày bắt đầu</span>
        <input type="date" name="ngayBatDau" defaultValue={ct?.ngayBatDau} className={`${O} w-full`} />
      </label>

      <label className="text-xs">
        <span className="mb-0.5 block text-chunhat">Kết thúc kế hoạch</span>
        <input
          type="date"
          name="ngayKetThucKeHoach"
          defaultValue={ct?.ngayKetThucKeHoach}
          className={`${O} w-full`}
        />
      </label>

      <label className="text-xs">
        <span className="mb-0.5 block text-chunhat">Địa điểm</span>
        <input name="diaDiem" defaultValue={ct?.diaDiem} className={`${O} w-full`} />
      </label>

      <label className="text-xs">
        <span className="mb-0.5 block text-chunhat">Giá trị hợp đồng (đ)</span>
        <input
          name="giaTriHopDong"
          inputMode="numeric"
          defaultValue={ct?.giaTriHopDong != null ? String(ct.giaTriHopDong) : ""}
          className={`${O} w-full`}
          placeholder="0"
        />
      </label>

      <label className="text-xs">
        <span className="mb-0.5 block text-chunhat">Biên LN mục tiêu (%)</span>
        <input
          name="bienLNMucTieu"
          inputMode="decimal"
          defaultValue={ct?.bienLNMucTieu != null ? String(ct.bienLNMucTieu * 100) : ""}
          className={`${O} w-full`}
          placeholder="12"
        />
      </label>

      <label className="text-xs sm:col-span-2">
        <span className="mb-0.5 block text-chunhat">Link Google Sheet (tùy chọn)</span>
        <input
          name="googleSheetUrl"
          defaultValue={ct?.googleSheetUrl}
          className={`${O} w-full`}
          placeholder="https://docs.google.com/..."
        />
      </label>
    </>
  );
}

/**
 * Nút sửa công trình, mở form trong HỘP THOẠI GIỮA TRANG.
 *
 * Trước đây form bung ra ngay trong ô của bảng, đẩy các cột giãn ra và phải cuộn
 * ngang mới thấy hết — hộp thoại tách khỏi bảng nên không còn chuyện đó.
 */
export function NutSuaCongTrinh({ ct }: { ct: CongTrinh }) {
  const [mo, setMo] = useState(false);
  const [kq, setKq] = useState<KetQuaCongTrinh | null>(null);
  const [dangChay, batDau] = useTransition();

  // Đóng bằng Esc — hộp nổi mà không thoát được bằng bàn phím thì rất bí.
  useEffect(() => {
    if (!mo) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMo(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [mo]);

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        title={`Sửa ${ct.maCongTrinh}`}
        className="inline-flex items-center rounded p-1 text-nhan hover:bg-nen"
      >
        <Pencil className="size-3.5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-3xl rounded-xl border border-vien bg-the shadow-xl">
        <div className="flex items-center justify-between border-b border-vien px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Sửa công trình</h2>
            <p className="mt-0.5 font-mono text-xs text-chunhat">{ct.maCongTrinh}</p>
          </div>
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
          onSubmit={guiGiuNguyen((fd) =>
            batDau(async () => {
              const r = await suaCongTrinh(fd);
              setKq(r);
              if (r.ok) setTimeout(() => setMo(false), 900);
            })
          )}
          className="p-4"
        >
          <input type="hidden" name="maCongTrinh" value={ct.maCongTrinh} />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <OChung ct={ct} />
          </div>

          <label className="mt-3 flex items-center gap-1.5 text-xs">
            <input type="checkbox" name="isActive" defaultChecked />
            Còn theo dõi
          </label>
          <p className="mt-1 text-[11px] leading-relaxed text-chunhat">
            Mã công trình không đổi được — mọi giao dịch và phân quyền đều trỏ về mã này. Bỏ chọn
            “Còn theo dõi” để ẩn công trình khỏi báo cáo mà vẫn giữ nguyên dữ liệu quá khứ.
          </p>

          <div className="mt-3 flex gap-2 border-t border-vien pt-3">
            <button
              type="submit"
              disabled={dangChay}
              className="inline-flex items-center gap-1 rounded-md bg-nhan px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              <Check className="size-3.5" /> {dangChay ? "Đang lưu…" : "Lưu"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMo(false);
                setKq(null);
              }}
              className="inline-flex items-center gap-1 rounded-md border border-vien px-3 py-1.5 text-xs"
            >
              <X className="size-3.5" /> Hủy
            </button>
          </div>
          <ThongBao kq={kq} />
        </form>
      </div>
    </div>
  );
}

/** Form tạo công trình mới, đặt trên đầu trang danh mục công trình. */
export function FormThemCongTrinh() {
  const [mo, setMo] = useState(false);
  const [kq, setKq] = useState<KetQuaCongTrinh | null>(null);
  const [dangChay, batDau] = useTransition();

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-nhan px-3 py-1.5 text-xs font-medium text-white"
      >
        <Plus className="size-3.5" /> Thêm công trình
      </button>
    );
  }

  return (
    <form
      onSubmit={guiGiuNguyen((fd) => {
        const ma = String(fd.get("maCongTrinh") ?? "").trim().toUpperCase();
        batDau(async () => {
          const r = await taoCongTrinh(fd);
          setKq(r);
          // Tạo xong là chuyển thẳng sang Kế hoạch – Ngân sách của công trình đó:
          // công trình mới chưa có ngân sách thì mọi KPI so kế hoạch đều vô nghĩa.
          if (r.ok) {
            setTimeout(() => {
              window.location.href = `/ke-hoach?ct=${encodeURIComponent(ma)}`;
            }, 900);
          }
        });
      })}
      className="rounded-lg border border-nhan bg-nhannhat p-3"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="text-xs">
          <span className="mb-0.5 block text-chunhat">Mã công trình</span>
          <input
            name="maCongTrinh"
            className={`${O} w-full font-mono uppercase`}
            placeholder="HL-00250"
            required
          />
        </label>
        <OChung />
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={dangChay}
          className="rounded-md bg-nhan px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
        >
          {dangChay ? "Đang lưu…" : "Tạo công trình"}
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
