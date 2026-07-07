export default function Loading() {
  return (
    <main className="flex flex-1 animate-pulse flex-col">
      <div className="mt-8 flex items-center gap-5">
        <div className="surface-2 h-20 w-20 shrink-0 rounded-full" />
        <div className="flex-1">
          <div className="h-9 w-40 rounded bg-white/5" />
          <div className="mt-3 h-3 w-32 rounded bg-white/5" />
        </div>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface-2 h-24 rounded-card" />
        ))}
      </div>
      <div className="surface-2 mt-6 h-32 rounded-card" />
    </main>
  );
}
