"use client";

import { useState, useTransition } from "react";
import { doiMatKhauCuaToi, type KetQuaDoiMatKhau } from "@/app/doi-mat-khau/actions";

const O = "w-full rounded-md border border-vien bg-nen px-3 py-2 text-sm";

/** Form tự đổi mật khẩu của người đang đăng nhập. */
export function DoiMatKhauToi() {
  const [kq, setKq] = useState<KetQuaDoiMatKhau | null>(null);
  const [dangChay, batDau] = useTransition();

  return (
    <form
      action={(fd) =>
        batDau(async () => {
          const r = await doiMatKhauCuaToi(fd);
          setKq(r);
          if (r.ok) (document.getElementById("form-doi-mk") as HTMLFormElement)?.reset();
        })
      }
      id="form-doi-mk"
      className="rounded-xl border border-vien bg-the p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-medium text-chunhat">Mật khẩu hiện tại</span>
        <input
          name="matKhauHienTai"
          type="password"
          required
          autoComplete="current-password"
          className={O}
        />
      </label>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs font-medium text-chunhat">Mật khẩu mới</span>
        <input
          name="matKhauMoi"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="ít nhất 8 ký tự"
          className={O}
        />
      </label>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs font-medium text-chunhat">Nhập lại mật khẩu mới</span>
        <input
          name="nhapLaiMoi"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={O}
        />
      </label>

      {kq ? (
        <p
          className={`mt-3 text-xs ${
            kq.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {kq.thongDiep}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={dangChay}
        className="mt-4 w-full rounded-md bg-nhan px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {dangChay ? "Đang đổi…" : "Đổi mật khẩu"}
      </button>
    </form>
  );
}
