import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gộp class Tailwind, class sau ghi đè class trước khi trùng nhóm. */
export function cn(...v: ClassValue[]) {
  return twMerge(clsx(v));
}
