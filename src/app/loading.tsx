const dong = "h-3 rounded bg-vien/70";

export default function Loading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-6 w-56 rounded bg-vien/80" />
          <div className="h-3 w-[min(34rem,72vw)] rounded bg-vien/60" />
        </div>
        <div className="h-8 w-32 rounded bg-vien/70" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-vien bg-the p-4">
            <div className="h-3 w-20 rounded bg-vien/60" />
            <div className="mt-4 h-7 w-24 rounded bg-vien/80" />
            <div className="mt-3 h-2 w-full rounded bg-vien/50" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-vien bg-the p-4">
            <div className="mb-4 h-4 w-44 rounded bg-vien/70" />
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((__, j) => (
                <div key={j} className="grid grid-cols-[1fr_7rem_5rem] gap-3">
                  <div className={dong} />
                  <div className={dong} />
                  <div className={dong} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
