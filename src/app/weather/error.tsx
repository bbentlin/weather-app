"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen px-6 py-8">
      <h1 className="text-3xl font-bold mb-2">Something went wrong</h1>
      <p className="opacity-90 mb-4">{error.message || "Unable to load weather."}</p>
      <button
        onClick={reset}
        className="rounded-xl px-4 py-2 bg-gray-900 text-white font-semibold hover:bg-gray-800 transition"
      >
        Try again
      </button>
      <p className="mt-4"><a className="underline" href="/">← Back</a></p>
    </main>
  );
}