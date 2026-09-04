const lines = ["w-24", "w-40", "w-32", "w-48", "w-28", "w-36"];

export default function InboxLoading() {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="받은편지함 불러오는 중">
      <div className="h-7 w-52 animate-pulse rounded bg-neutral-800" />
      <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
        <div className="w-80 shrink-0 border-r border-neutral-800 p-4 space-y-4">
          {lines.map((width) => <div key={width} className={`h-4 animate-pulse rounded bg-neutral-800 ${width}`} />)}
        </div>
        <div className="hidden min-w-0 flex-1 border-r border-neutral-800 p-6 lg:block space-y-5">
          <div className="h-6 w-2/5 animate-pulse rounded bg-neutral-800" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-800" />
          <div className="h-4 w-full animate-pulse rounded bg-neutral-800" />
        </div>
        <div className="hidden w-[440px] shrink-0 p-5 lg:block space-y-4">
          <div className="h-5 w-1/3 animate-pulse rounded bg-neutral-800" />
          <div className="h-24 animate-pulse rounded bg-neutral-800" />
        </div>
      </div>
    </div>
  );
}
