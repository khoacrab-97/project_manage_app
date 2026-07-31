/**
 * Vai trò nào được thấy mục menu nào.
 *
 * Admin cấu hình ở màn hình Quản trị. Bảng `MenuBiAn` lưu các mục BỊ ẨN, nên
 * bảng rỗng nghĩa là mọi vai trò thấy đủ — đúng mặc định "mở hết rồi tắt bớt".
 */
import { cache } from "react";
import { db } from "../db";
import { MENU } from "../menu";
import type { VaiTro } from "./quyen";

/** Tất cả các cặp (vai trò, mục) đang bị ẩn. */
export const layMenuBiAn = cache(async (): Promise<Set<string>> => {
  const ds = await db.menuBiAn.findMany();
  return new Set(ds.map((r) => `${r.vaiTro}|${r.maMenu}`));
});

/**
 * Vai trò này có được thấy mục menu này không.
 * ADMIN luôn thấy tất cả — nếu không, Admin có thể tự khoá mình khỏi chính màn
 * hình dùng để mở lại.
 */
export async function duocThayMenu(vaiTro: VaiTro, maMenu: string): Promise<boolean> {
  if (vaiTro === "ADMIN") return true;
  return !(await layMenuBiAn()).has(`${vaiTro}|${maMenu}`);
}

/** Danh sách mục menu vai trò này được thấy, giữ nguyên thứ tự hiển thị. */
export async function menuChoVaiTro(vaiTro: VaiTro): Promise<string[]> {
  if (vaiTro === "ADMIN") return MENU.map((m) => m.id);
  const biAn = await layMenuBiAn();
  return MENU.filter((m) => !biAn.has(`${vaiTro}|${m.id}`)).map((m) => m.id);
}
