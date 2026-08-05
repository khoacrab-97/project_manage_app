"use client";

import { useState, useTransition } from "react";
import { luuQuyenMenu, type KetQuaMenu } from "@/app/quan-tri/nguoi-dung/menu-actions";
import { Bang, Nhan, Td, The, TheDau, Th } from "@/components/ui";
import { DS_VAI_TRO, VAI_TRO } from "@/lib/auth/quyen";
import { MENU } from "@/lib/menu";

/**
 * Bảng tích chọn: hàng là mục menu, cột là vai trò.
 * Cột ADMIN khoá sẵn — nếu Admin tự ẩn được mục Quản trị thì không còn đường vào
 * để mở lại.
 */
export function QuyenMenu({ cauHinh }: { cauHinh: Record<string, string[]> }) {
  const [kq, setKq] = useState<KetQuaMenu | null>(null);
  const [dangChay, batDau] = useTransition();

  return (
    <form
      action={(fd) =>
        batDau(async () => {
          const r = await luuQuyenMenu(fd);
          setKq(r);
        })
      }
    >
      <The>
        <TheDau
          tieuDe="Vai trò nào thấy mục nào"
          moTa="Bỏ tích để ẩn mục khỏi thanh menu của vai trò đó. Người dùng gõ thẳng đường dẫn cũng không vào được."
          phai={
            <button
              type="submit"
              disabled={dangChay}
              className="rounded-md bg-nhan px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              {dangChay ? "Đang lưu…" : "Lưu phân quyền menu"}
            </button>
          }
        />
        <Bang>
          <thead>
            <tr>
              <Th className="sticky left-0 z-20 min-w-45">Mục menu</Th>
              {DS_VAI_TRO.map((v) => (
                <Th key={v} className="min-w-27.5 text-center">
                  {VAI_TRO[v]}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MENU.map((m) => (
              <tr key={m.id} className="hover:bg-nen">
                <Td className="sticky left-0 z-10 bg-the text-xs font-medium whitespace-nowrap">
                  {m.nhan}
                </Td>
                {DS_VAI_TRO.map((v) => {
                  const laAdmin = v === "ADMIN";
                  return (
                    <Td key={v} className="text-center">
                      <input
                        type="checkbox"
                        name="thay"
                        value={`${v}|${m.id}`}
                        defaultChecked={laAdmin || (cauHinh[v] ?? []).includes(m.id)}
                        disabled={laAdmin}
                        title={laAdmin ? "Quản trị hệ thống luôn thấy mọi mục" : undefined}
                        className="size-4 accent-nhan disabled:opacity-40"
                      />
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Bang>

        <div className="border-t border-vien px-4 py-3">
          {kq ? (
            <p
              className={`text-xs ${
                kq.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {kq.thongDiep}
            </p>
          ) : (
            <p className="text-xs text-chunhat">
              <Nhan>Lưu ý</Nhan>{" "}
              <span className="ml-1">
                Ẩn mục chỉ giấu đi phần điều hướng, KHÔNG thay đổi phạm vi dữ liệu. Ai được xem
                công trình nào vẫn do vai trò quyết định.
              </span>
            </p>
          )}
        </div>
      </The>
    </form>
  );
}
