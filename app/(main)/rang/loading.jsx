export default function Loading() {
  return (
    <main className="flex flex-1 animate-pulse flex-col">
      <div className="surface-2 mt-8 h-16 w-2/3 rounded-card" />
      <div className="surface-2 mt-6 h-24 w-full rounded-card" />
      <div className="mt-8 flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="surface-2 h-14 rounded-row" />
        ))}
      </div>
    </main>
  );
}
