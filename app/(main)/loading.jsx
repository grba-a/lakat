export default function Loading() {
  return (
    <main className="flex flex-1 animate-pulse flex-col">
      <div className="surface-2 mt-6 h-40 w-full rounded-hero" />
      <div className="surface-2 mt-3 h-12 w-full rounded-button" />
      <div className="mt-10">
        <div className="h-3 w-24 rounded bg-white/5" />
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="surface-2 h-14 rounded-row" />
          ))}
        </div>
      </div>
    </main>
  );
}
