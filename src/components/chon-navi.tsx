"use client";

import { useRouter } from "next/navigation";

/** Dropdown điều hướng: chọn một mục sẽ chuyển URL theo `href` của mục đó. */
export function ChonNavi({
  giaTri,
  tuyChon,
  className,
}: {
  giaTri: string;
  tuyChon: { value: string; nhan: string; href: string }[];
  className?: string;
}) {
  const router = useRouter();
  return (
    <select
      value={giaTri}
      onChange={(e) => {
        const t = tuyChon.find((o) => o.value === e.target.value);
        if (t) router.push(t.href, { scroll: false });
      }}
      className={
        className ?? "max-w-60 rounded-md border border-vien bg-the px-2 py-1 text-xs"
      }
    >
      {tuyChon.map((o) => (
        <option key={o.value} value={o.value}>
          {o.nhan}
        </option>
      ))}
    </select>
  );
}
