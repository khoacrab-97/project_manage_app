"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export function NutDangNhap() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-nhan px-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? "Đang đăng nhập..." : "Đăng nhập"}
    </button>
  );
}
