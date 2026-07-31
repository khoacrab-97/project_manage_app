/**
 * Băm và kiểm tra mật khẩu bằng scrypt của Node.
 *
 * Không dùng bcrypt/argon2 vì cả hai đều là native module — sẽ lại phải ép đóng
 * gói file .node như đã gặp với better-sqlite3. scrypt có sẵn trong Node, đủ mạnh
 * và không thêm phụ thuộc nào.
 *
 * Định dạng lưu: "salt_hex:hash_hex".
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  matKhau: string,
  muoi: Buffer,
  doDai: number
) => Promise<Buffer>;

const DO_DAI = 64;

export async function bamMatKhau(matKhau: string): Promise<string> {
  const muoi = randomBytes(16);
  const bam = await scryptAsync(matKhau, muoi, DO_DAI);
  return `${muoi.toString("hex")}:${bam.toString("hex")}`;
}

export async function kiemTraMatKhau(matKhau: string, luuTru: string): Promise<boolean> {
  if (!luuTru || !luuTru.includes(":")) return false;
  const [muoiHex, bamHex] = luuTru.split(":");
  const muoi = Buffer.from(muoiHex, "hex");
  const mongDoi = Buffer.from(bamHex, "hex");
  if (mongDoi.length !== DO_DAI) return false;

  const thucTe = await scryptAsync(matKhau, muoi, DO_DAI);
  // So sánh theo thời gian hằng số để không rò rỉ thông tin qua thời gian phản hồi.
  return timingSafeEqual(thucTe, mongDoi);
}

