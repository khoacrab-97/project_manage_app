"use client";

import { useSyncExternalStore } from "react";

const TRUY_VAN_TOI = "(prefers-color-scheme: dark)";

function dangKy(thayDoi: () => void) {
  const mq = window.matchMedia(TRUY_VAN_TOI);
  mq.addEventListener("change", thayDoi);
  return () => mq.removeEventListener("change", thayDoi);
}

const anhChupClient = () => window.matchMedia(TRUY_VAN_TOI).matches;
const anhChupServer = () => false;

/**
 * Theo dõi chế độ tối của hệ điều hành.
 * Recharts cần chuỗi màu thật, không nhận được biến CSS, nên phải biết chế độ
 * ở phía client. Lần render đầu trả false để server và client khớp nhau.
 */
export function useDark(): boolean {
  return useSyncExternalStore(dangKy, anhChupClient, anhChupServer);
}
