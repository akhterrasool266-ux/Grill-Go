export const dynamic = 'force-static';
export default function Offline() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm space-y-3">
        <p className="text-4xl">📡</p>
        <h1 className="text-xl font-semibold">You are offline</h1>
        <p className="text-sm text-muted">Check your internet connection and try again. If you kept a class or marks sheet available offline, you can still use it. Anything you save is sent automatically when you are back online.</p>
        <a href="/offline-work" className="inline-block rounded-[10px] border border-line px-4 py-2 text-sm font-medium">Open offline work</a>
        <a href="/" className="inline-block rounded-[10px] bg-brand px-4 py-2 text-sm font-medium text-brand-fg">Retry</a>
      </div>
    </div>
  );
}
