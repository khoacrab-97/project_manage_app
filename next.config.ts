import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Máy dev có lockfile ở thư mục cha nên Next đoán nhầm workspace root.
  // Neo rõ về thư mục app để build ổn định.
  turbopack: { root: path.resolve(process.cwd()) },

  // Gói sẵn server + đúng những node_modules cần dùng vào .next/standalone.
  // Nhờ vậy image Docker không phải cài lại dependency, và server nội bộ chỉ cần
  // Node là chạy được. Xem HUONG_DAN_TRIEN_KHAI.md.
  output: "standalone",

};

export default nextConfig;
