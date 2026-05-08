// Skeleton loading states — used on list pages while stores hydrate

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="animate-pulse rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2.5 flex-1">
              <div className="h-3.5 w-24 rounded bg-stone-200" />
              <div className="h-3 w-40 rounded bg-stone-100" />
              <div className="h-3 w-20 rounded bg-stone-100" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-5 w-14 rounded-md bg-stone-100" />
              <div className="h-7 w-16 rounded-lg bg-stone-200" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function LoadingStatCards() {
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_1.5fr_1fr] lg:gap-5 lg:items-start">
      {/* Left: KPI + analytics skeleton */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
              <div className="h-6 w-8 rounded bg-stone-200 mb-2" />
              <div className="h-3 w-20 rounded bg-stone-100" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-stone-200 bg-white px-3 py-3 shadow-sm">
              <div className="h-5 w-10 rounded bg-stone-200 mx-auto mb-1.5" />
              <div className="h-2.5 w-16 rounded bg-stone-100 mx-auto" />
            </div>
          ))}
        </div>
      </div>
      {/* Center: zone map skeleton */}
      <div className="animate-pulse rounded-xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
        <div className="h-3 w-24 rounded bg-stone-200 mb-4" />
        <div className="grid grid-cols-4 gap-2 mb-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-stone-100" />
          ))}
        </div>
        <div className="h-px bg-stone-200 my-3" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-stone-100" />
          ))}
        </div>
      </div>
      {/* Right: velocity skeleton */}
      <div className="animate-pulse rounded-xl border border-stone-200 bg-white px-4 py-4 shadow-sm space-y-3">
        <div className="h-3 w-20 rounded bg-stone-200" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className="h-2.5 w-16 rounded bg-stone-100 shrink-0" />
            <div className="flex-1 h-1.5 rounded-full bg-stone-100" />
            <div className="h-2.5 w-10 rounded bg-stone-100 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
