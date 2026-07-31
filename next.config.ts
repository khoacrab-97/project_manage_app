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

  /*
   * better-sqlite3 là native module: phần chạy được nằm ở file .node biên dịch sẵn,
   * không phải JavaScript. Bộ dò phụ thuộc của Next đi theo lệnh `import` nên
   * thường KHÔNG thấy file này, và bản đóng gói sẽ chết ngay ở truy vấn đầu tiên.
   * Vì vậy phải chỉ đích danh để ép đưa vào.
   */
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/better-sqlite3/build/Release/*.node"],
  },
};

export default nextConfig;
