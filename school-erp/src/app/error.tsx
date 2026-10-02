'use client';
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted">We could not load this page. Please try again{error.digest ? ` (ref ${error.digest})` : ''}.</p>
        <button onClick={reset} className="rounded-[10px] bg-brand px-4 py-2 text-sm font-medium text-brand-fg">Try again</button>
      </div>
    </div>
  );
}
