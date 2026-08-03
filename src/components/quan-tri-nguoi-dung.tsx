"use client";

import { useState, useTransition } from "react";
import { KeyRound, Plus } from "lucide-react";
import {
  datLaiMatKhau,
  doiVaiTro,
  taoNguoiDung,
  type KetQuaNguoiDung,
} from "@/app/quan-tri/nguoi-dung/actions";
import { Bang, Nhan, Td, The, TheDau, Th } from "@/components/ui";
import { DS_VAI_TRO, laTatCaCongTrinh, moTaPhamVi, VAI_TRO, type VaiTro } from "@/lib/auth/quyen";

const O = "rounded-md border border-vien bg-the px-2 py-1 text-xs";

interface Dong {
  id: string;
  email: string;
  hoTen: string;
  vaiTro: string;
  isActive: boolean;
  phamVi: string[];
}

function ThongBao({ kq }: { kq: KetQuaNguoiDung | null }) {
  if (!kq) return null;
  return (
    <p
      className={`mt-2 text-xs ${
        kq.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {kq.thongDiep}
    </p>
  );
}

/** Hai ô mật khẩu dùng chung cho form tạo mới và form đặt lại. */
function OMatKhau({ ten, tenNhapLai }: { ten: string; tenNhapLai: string }) {
  return (
    <>
      <label className="text-xs">
        <span className="mb-0.5 block text-chunhat">Mật khẩu</span>
        <input
          name={ten}
          type="text"
          required
          minLength={8}
          autoComplete="off"
          placeholder="ít nhất 8 ký tự"
          className={`${O} w-full`}
        />
      </label>
      <label className="text-xs">
        <span className="mb-0.5 block text-chunhat">Nhập lại mật khẩu</span>
        <input
          name={tenNhapLai}
          type="text"
          required
          minLength={8}
          autoComplete="off"
          className={`${O} w-full`}
        />
      </label>
    </>
  );
}

export function QuanTriNguoiDung({
  nguoiDung,
  congTrinh,
  toiLaAi,
}: {
  nguoiDung: Dong[];
  congTrinh: { ma: string; ten: string; rutGon: string }[];
  toiLaAi: string;
}) {
  const [moTao, setMoTao] = useState(false);
  const [kqTao, setKqTao] = useState<KetQuaNguoiDung | null>(null);
  const [kqSua, setKqSua] = useState<Record<string, KetQuaNguoiDung | null>>({});
  const [dangChay, batDau] = useTransition();
  const [dangSua, setDangSua] = useState<string | null>(null);
  const [dangDoiMK, setDangDoiMK] = useState<string | null>(null);

  return (
    <>
      {/* ---- Tạo tài khoản ---- */}
      <div className="mb-4">
        {moTao ? (
          <form
            action={(fd) =>
              batDau(async () => {
                const r = await taoNguoiDung(fd);
                // Tạo xong thì đóng hộp thoại; tài khoản mới hiện ngay ở bảng dưới.
                if (r.ok) {
                  setMoTao(false);
                  setKqTao(null);
                } else {
                  setKqTao(r);
                }
              })
            }
            className="rounded-lg border border-nhan bg-nhannhat p-3"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="text-xs">
                <span className="mb-0.5 block text-chunhat">Email</span>
                <input name="email" type="email" required className={`${O} w-full`} />
              </label>
              <label className="text-xs">
                <span className="mb-0.5 block text-chunhat">Họ tên</span>
                <input name="hoTen" required className={`${O} w-full`} />
              </label>
              <label className="text-xs">
                <span className="mb-0.5 block text-chunhat">Vai trò</span>
                <select name="vaiTro" defaultValue="THU_KY" className={`${O} w-full`}>
                  {DS_VAI_TRO.map((v) => (
                    <option key={v} value={v}>
                      {VAI_TRO[v]} — {moTaPhamVi(v)}
                    </option>
                  ))}
                </select>
              </label>
              <OMatKhau ten="matKhau" tenNhapLai="nhapLai" />
            </div>

            <p className="mt-2 text-[11px] text-chunhat">
              Mật khẩu hiển thị dạng chữ thường để bạn đọc lại cho người dùng. Sau khi lưu, hệ thống
              chỉ giữ bản băm — không ai xem lại được, kể cả quản trị.
            </p>

            <div className="mt-2 flex gap-2">
              <button
                type="submit"
                disabled={dangChay}
                className="rounded-md bg-nhan px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
              >
                {dangChay ? "Đang tạo…" : "Tạo tài khoản"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMoTao(false);
                  setKqTao(null);
                }}
                className="rounded-md border border-vien px-3 py-1 text-xs"
              >
                Hủy
              </button>
            </div>
            <ThongBao kq={kqTao} />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setMoTao(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-nhan px-3 py-1.5 text-xs font-medium text-white"
          >
            <Plus className="size-3.5" /> Cấp tài khoản mới
          </button>
        )}
      </div>

      {/* ---- Danh sách ---- */}
      <The>
        <TheDau tieuDe={`${nguoiDung.length} tài khoản`} />
        <Bang>
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>Họ tên</Th>
              <Th>Vai trò</Th>
              <Th>Phạm vi công trình</Th>
              <Th>Trạng thái</Th>
              <Th>Thao tác</Th>
            </tr>
          </thead>
          <tbody>
            {nguoiDung.map((u) => {
              const laToi = u.id === toiLaAi;
              const tatCaCongTrinh = laTatCaCongTrinh(u.vaiTro as VaiTro);
              return (
                <tr key={u.id} className="hover:bg-nen">
                  <Td className="text-xs font-medium">
                    {u.email}
                    {laToi ? <span className="ml-1 text-chunhat">(bạn)</span> : null}
                  </Td>
                  <Td className="text-xs">{u.hoTen}</Td>
                  <Td>
                    <Nhan bienThe={u.vaiTro === "ADMIN" ? "nhan" : "trung_tinh"}>
                      {VAI_TRO[u.vaiTro as VaiTro] ?? u.vaiTro}
                    </Nhan>
                  </Td>
                  <Td className="max-w-[280px] text-xs text-chunhat">
                    {tatCaCongTrinh ? (
                      <span className="text-chu">Tất cả công trình</span>
                    ) : u.phamVi.length ? (
                      u.phamVi.join(", ")
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400">
                        chưa gán công trình nào
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Nhan bienThe={u.isActive ? "xanh" : "do"}>
                      {u.isActive ? "Hoạt động" : "Đã khoá"}
                    </Nhan>
                  </Td>
                  <Td>
                    <div className="flex gap-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setDangSua(dangSua === u.id ? null : u.id);
                          setDangDoiMK(null);
                        }}
                        className="text-xs font-medium text-nhan hover:underline"
                      >
                        {dangSua === u.id ? "Đóng" : "Sửa quyền"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDangDoiMK(dangDoiMK === u.id ? null : u.id);
                          setDangSua(null);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-chunhat hover:text-nhan hover:underline"
                      >
                        <KeyRound className="size-3" />
                        {dangDoiMK === u.id ? "Đóng" : "Đổi mật khẩu"}
                      </button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Bang>

        {/* ---- Form sửa quyền ---- */}
        {nguoiDung
          .filter((u) => u.id === dangSua)
          .map((u) => (
            <form
              key={u.id}
              action={(fd) =>
                batDau(async () => {
                  const r = await doiVaiTro(fd);
                  // Lưu xong thì tự đóng form; đổi vai trò/phạm vi hiện ngay ở bảng.
                  if (r.ok) {
                    setDangSua(null);
                    setKqSua((s) => ({ ...s, [u.id]: null }));
                  } else {
                    setKqSua((s) => ({ ...s, [u.id]: r }));
                  }
                })
              }
              className="border-t border-vien bg-nhannhat p-4"
            >
              <p className="mb-2 text-xs font-semibold">Sửa quyền: {u.email}</p>
              <input type="hidden" name="userId" value={u.id} />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-xs">
                  <span className="mb-0.5 block text-chunhat">Vai trò</span>
                  <select name="vaiTro" defaultValue={u.vaiTro} className={`${O} w-full`}>
                    {DS_VAI_TRO.map((v) => (
                      <option key={v} value={v}>
                        {VAI_TRO[v]} — {moTaPhamVi(v)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-end gap-1.5 pb-1 text-xs">
                  <input type="checkbox" name="isActive" defaultChecked={u.isActive} />
                  Cho phép đăng nhập
                </label>
              </div>

              <fieldset className="mt-3">
                <legend className="mb-1 text-xs text-chunhat">
                  Phạm vi công trình (không dùng nếu vai trò đã thấy tất cả công trình)
                </legend>
                <div className="max-h-40 overflow-y-auto rounded-md border border-vien bg-the p-2">
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {congTrinh.map((c) => (
                      <label
                        key={c.ma}
                        className="flex items-center gap-1.5 text-xs"
                        title={`${c.ma} — ${c.ten}`}
                      >
                        <input
                          type="checkbox"
                          name="phamVi"
                          value={c.ma}
                          defaultChecked={u.phamVi.includes(c.ma)}
                        />
                        <span className="truncate">{c.rutGon || c.ma}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={dangChay}
                className="mt-3 rounded-md bg-nhan px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
              >
                {dangChay ? "Đang lưu…" : "Lưu quyền"}
              </button>
              <ThongBao kq={kqSua[u.id] ?? null} />
            </form>
          ))}

        {/* ---- Form đổi mật khẩu ---- */}
        {nguoiDung
          .filter((u) => u.id === dangDoiMK)
          .map((u) => (
            <form
              key={u.id}
              action={(fd) =>
                batDau(async () => {
                  const r = await datLaiMatKhau(fd);
                  setKqSua((s) => ({ ...s, [u.id]: r }));
                })
              }
              className="border-t border-vien bg-nhannhat p-4"
            >
              <p className="mb-2 text-xs font-semibold">Đặt mật khẩu mới: {u.email}</p>
              <input type="hidden" name="userId" value={u.id} />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <OMatKhau ten="matKhauMoi" tenNhapLai="nhapLaiMoi" />
              </div>

              <p className="mt-2 text-[11px] text-chunhat">
                Người dùng đang đăng nhập sẽ bị đăng xuất ngay và phải vào lại bằng mật khẩu mới.
              </p>

              <button
                type="submit"
                disabled={dangChay}
                className="mt-3 rounded-md bg-nhan px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
              >
                {dangChay ? "Đang lưu…" : "Đặt mật khẩu"}
              </button>
              <ThongBao kq={kqSua[u.id] ?? null} />
            </form>
          ))}
      </The>
    </>
  );
}
