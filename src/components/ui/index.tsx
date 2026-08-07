/** Bộ primitive dùng chung. Giữ nhỏ và không phụ thuộc thư viện ngoài. */
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { ChiDan } from "@/components/chi-dan";
import { cn } from "@/lib/cn";
import { MAU_SUC_KHOE } from "@/lib/kpi";
import type { SucKhoe } from "@/lib/types";

// ---------------------------------------------------------------- Thẻ
export function The({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-vien bg-the shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Thẻ THU GỌN được: tiêu đề luôn hiện, bấm để mở/đóng phần thân. Dùng `<details>`
 * gốc nên gập/mở không cần JavaScript. `moSan` = mở sẵn khi tải trang.
 */
export function TheGap({
  tieuDe,
  moTa,
  moSan = false,
  children,
  chiDan,
  className,
}: {
  tieuDe: ReactNode;
  moTa?: ReactNode;
  moSan?: boolean;
  children: ReactNode;
  /** Nội dung giải thích dồn vào icon (i) cạnh tiêu đề, thay cho ghi chú dài. */
  chiDan?: ReactNode;
  className?: string;
}) {
  return (
    <details
      open={moSan}
      className={cn(
        "group rounded-xl border border-vien bg-the shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h2 className="truncate text-sm font-semibold">{tieuDe}</h2>
            {chiDan ? (
              <ChiDan tieuDe={typeof tieuDe === "string" ? tieuDe : undefined}>{chiDan}</ChiDan>
            ) : null}
          </div>
          {moTa ? <p className="mt-0.5 text-xs text-chunhat">{moTa}</p> : null}
        </div>
        <ChevronDown className="mt-0.5 size-4 shrink-0 text-chunhat transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-vien">{children}</div>
    </details>
  );
}

export function TheDau({
  tieuDe,
  moTa,
  phai,
  chiDan,
  className,
}: {
  tieuDe: ReactNode;
  moTa?: ReactNode;
  phai?: ReactNode;
  /** Nội dung giải thích dồn vào icon (i) cạnh tiêu đề, thay cho ghi chú dài. */
  chiDan?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-vien px-4 py-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <h2 className="truncate text-sm font-semibold">{tieuDe}</h2>
          {chiDan ? (
            <ChiDan tieuDe={typeof tieuDe === "string" ? tieuDe : undefined}>{chiDan}</ChiDan>
          ) : null}
        </div>
        {moTa ? <p className="mt-0.5 text-xs text-chunhat">{moTa}</p> : null}
      </div>
      {phai ? <div className="shrink-0">{phai}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- Nhãn trạng thái
const BIEN_THE = {
  trung_tinh: "bg-nen text-chunhat border-vien",
  nhan: "bg-nhannhat text-nhan border-transparent",
  xanh: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
  vang: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
  do: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900",
} as const;

export function Nhan({
  children,
  bienThe = "trung_tinh",
  className,
}: {
  children: ReactNode;
  bienThe?: keyof typeof BIEN_THE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        BIEN_THE[bienThe],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Đèn giao thông sức khỏe công trình. */
export function NhanSucKhoe({ sucKhoe, lyDo }: { sucKhoe: SucKhoe; lyDo?: string[] }) {
  const bienThe = sucKhoe === "Xanh" ? "xanh" : sucKhoe === "Vàng" ? "vang" : "do";
  return (
    <Nhan bienThe={bienThe} className="cursor-help" >
      <span className={cn("size-1.5 rounded-full", MAU_SUC_KHOE[sucKhoe].cham)} />
      <span title={lyDo?.length ? lyDo.join(" · ") : undefined}>{sucKhoe}</span>
    </Nhan>
  );
}

// ---------------------------------------------------------------- Số liệu
/** Số tiền căn phải, âm tô đỏ và bọc ngoặc theo quy ước kế toán. */
export function O_So({
  children,
  am,
  className,
}: {
  children: ReactNode;
  am?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("so tabular-nums", am && "text-rose-600 dark:text-rose-400", className)}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Trạng thái rỗng
export function Rong({ children = "Chưa có dữ liệu" }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-32 items-center justify-center px-4 py-10 text-center text-sm text-chunhat">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------- Tiêu đề trang
export function DauTrang({
  tieuDe,
  moTa,
  phai,
  chiDan,
  moTaRong,
}: {
  tieuDe: string;
  moTa?: ReactNode;
  phai?: ReactNode;
  /** Nội dung giải thích dồn vào icon (i) cạnh tiêu đề, thay cho mô tả dài. */
  chiDan?: ReactNode;
  /** Cho phần mô tả trải hết bề ngang tới sát khối bên phải (bỏ giới hạn max-w). */
  moTaRong?: boolean;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className={moTaRong ? "min-w-0 flex-1" : undefined}>
        <div className="flex items-center gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{tieuDe}</h1>
          {chiDan ? <ChiDan tieuDe={tieuDe}>{chiDan}</ChiDan> : null}
        </div>
        {moTa ? (
          <p className={`mt-1 text-sm text-chunhat ${moTaRong ? "" : "max-w-3xl"}`}>{moTa}</p>
        ) : null}
      </div>
      {phai ? <div className="flex shrink-0 flex-wrap gap-2">{phai}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- Bộ lọc dạng link
export function LocLink({
  href,
  dangChon,
  children,
  title,
}: {
  href: string;
  dangChon: boolean;
  children: ReactNode;
  /** Chú thích khi rê chuột — dùng để hiện tên đầy đủ khi nhãn chỉ là mã. */
  title?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      title={title}
      className={cn(
        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        dangChon
          ? "border-transparent bg-nhan text-white"
          : "border-vien bg-the text-chunhat hover:border-nhan hover:text-nhan"
      )}
    >
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------- Nhãn công trình
/**
 * Nhận diện công trình theo tên rút gọn: Tên rút gọn in đậm dòng trên, mã công
 * trình nhỏ/mờ dòng dưới. Chưa nhập rút gọn thì mã làm dòng chính (fallback).
 * `href` có thì dòng chính là link (dùng ở danh mục). `khoa` = ngoài phạm vi.
 */
export function NhanCongTrinh({
  tenRutGon,
  ma,
  href,
  khoa,
}: {
  tenRutGon?: string | null;
  ma: string;
  href?: string;
  khoa?: boolean;
}) {
  const rg = tenRutGon?.trim();
  const chinh = rg || ma;
  return (
    <span className="flex flex-col leading-tight">
      {href ? (
        <Link href={href} className="font-medium text-nhan hover:underline">
          {chinh}
        </Link>
      ) : (
        <span className={cn("font-medium", khoa && "inline-flex items-center gap-1 text-chunhat")}>
          {khoa ? <Lock className="size-3" /> : null}
          {chinh}
        </span>
      )}
      {rg ? <span className="text-[11px] text-chunhat">{ma}</span> : null}
    </span>
  );
}

// ---------------------------------------------------------------- Thanh tỷ lệ
export function ThanhTyLe({
  tyLe,
  nguong = 1,
  mau,
}: { tyLe: number | null; nguong?: number; mau?: string }) {
  if (tyLe === null) return <span className="text-xs text-chunhat">—</span>;
  const rong = Math.min(100, Math.max(0, tyLe * 100));
  const mauBar =
    mau ??
    (tyLe > nguong ? "bg-rose-500" : tyLe > nguong * 0.9 ? "bg-amber-500" : "bg-emerald-500");
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-vien">
        <div className={cn("h-full rounded-full", mauBar)} style={{ width: `${rong}%` }} />
      </div>
      <span className="so text-xs text-chunhat">{(tyLe * 100).toFixed(0)}%</span>
    </div>
  );
}

// ---------------------------------------------------------------- Bảng
export function Bang({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="cuon-ngang">
      <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>
    </div>
  );
}

export function Th({
  children,
  phai,
  className,
  ...rest
}: { children?: ReactNode; phai?: boolean; className?: string } & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 border-b border-vien bg-the px-3 py-2 text-xs font-semibold whitespace-nowrap text-chunhat",
        phai ? "text-right" : "text-left",
        className
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  phai,
  className,
  ...rest
}: { children?: ReactNode; phai?: boolean; className?: string } & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "border-b border-vien px-3 py-2 align-middle",
        phai ? "so text-right" : "",
        className
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

// ---------------------------------------------------------------- Ghi chú nguồn số liệu
/** Chú thích nguồn gốc con số — yêu cầu truy vết §3.3. */
export function GhiChuNguon({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs leading-relaxed text-chunhat">{children}</p>;
}

export function CanhBaoBox({
  bienThe = "vang",
  tieuDe,
  children,
}: {
  bienThe?: "vang" | "do" | "nhan";
  tieuDe: ReactNode;
  children?: ReactNode;
}) {
  const mau =
    bienThe === "do"
      ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40"
      : bienThe === "nhan"
        ? "border-blue-200 bg-nhannhat dark:border-blue-900"
        : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40";
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", mau)}>
      <p className="font-semibold">{tieuDe}</p>
      {children ? <div className="mt-1 text-sm opacity-90">{children}</div> : null}
    </div>
  );
}
