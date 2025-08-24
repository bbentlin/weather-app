export default function Loading() {
  return (
    <main className="min-h-screen px-6 py-8">
      <div className="h-8 w-64 bg-white/20 rounded animate-pulse mb-6" />
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white/10 p-4">
            <div className="h-10 w-24 bg-white/20 rounded animate-pulse mb-2" />
            <div className="h-4 w-40 bg-white/20 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white/10 p-3">
            <div className="h-4 w-28 bg-white/20 rounded animate-pulse mb-2" />
            <div className="h-6 w-32 bg-white/20 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </main>
  );
}