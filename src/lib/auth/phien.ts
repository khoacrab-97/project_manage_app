/**
 * Phiên đăng nhập.
 *
 * Token ngẫu nhiên 256 bit lưu trong bảng Session, cookie chỉ giữ token. Chọn
 * cách này thay vì JWT vì đăng xuất có hiệu lực tức thì (xoá bản ghi là xong) và
 * không phải quản lý khoá ký.
 */
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "../db";
import type { NguoiDung, VaiTro } from "./quyen";

const TEN_COOKIE = "prmana_phien";
const HAN_NGAY = 7;

export async function taoPhien(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const hetHan = new Date(Date.now() + HAN_NGAY * 86_400_000);

  await db.session.create({ data: { sessionToken: token, userId, expires: hetHan } });

  const kho = await cookies();
  kho.set(TEN_COOKIE, token, {
    httpOnly: true, // JavaScript trên trang không đọc được -> giảm rủi ro XSS
    sameSite: "lax", // chặn gửi cookie khi bị nhúng từ site khác
    secure: process.env.NODE_ENV === "production" && process.env.HTTPS === "true",
    path: "/",
    expires: hetHan,
  });
}

export async function xoaPhien(): Promise<void> {
  const kho = await cookies();
  const token = kho.get(TEN_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { sessionToken: token } });
  }
  kho.delete(TEN_COOKIE);
}

/**
 * Người dùng của request hiện tại, hoặc null nếu chưa đăng nhập.
 * Bọc `cache()` để nhiều component trong cùng một request chỉ truy vấn một lần.
 */
export const nguoiDungHienTai = cache(async (): Promise<NguoiDung | null> => {
  const kho = await cookies();
  const token = kho.get(TEN_COOKIE)?.value;
  if (!token) return null;

  const phien = await db.session.findUnique({
    where: { sessionToken: token },
    include: { user: { include: { phamViGiao: { include: { project: true } } } } },
  });

  if (!phien || phien.expires < new Date()) return null;
  if (!phien.user.isActive) return null;

  return {
    id: phien.user.id,
    email: phien.user.email,
    hoTen: phien.user.hoTen,
    vaiTro: phien.user.vaiTro as VaiTro,
    phamVi: phien.user.phamViGiao.map((p) => p.project.maCongTrinh),
  };
});

/** Dọn phiên hết hạn. Gọi lúc đăng nhập nên không cần tác vụ định kỳ. */
export async function donPhienHetHan(): Promise<void> {
  await db.session.deleteMany({ where: { expires: { lt: new Date() } } });
}
