"use client";

import { useEffect, useState } from "react";

/**
 * Theo dõi chế độ tối của hệ điều hành.
 * Recharts cần chuỗi màu thật, không nhận được biến CSS, nên phải biết chế độ
 * ở phía client. Lần render đầu trả false để server và client khớp nhau.
 */
export function useDark(): boolean {
  const [toi, setToi] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setToi(mq.matches);
    const doi = (e: MediaQueryListEvent) => setToi(e.matches);
    mq.addEventListener("change", doi);
    return () => mq.removeEventListener("change", doi);
  }, []);

  return toi;
}
