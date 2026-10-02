export const dynamic = 'force-static';
export default function Offline() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm space-y-3">
        <p className="text-4xl">📡</p>
        <h1 className="text-xl font-semibold">You are offline</h1>
        <p className="text-sm text-muted">Check your internet connection and try again. Attendance you mark while offline is kept on this device and sent automatically when you are back online.</p>
        <a href="/" className="inline-block rounded-[10px] bg-brand px-4 py-2 text-sm font-medium text-brand-fg">Retry</a>
      </div>
    </div>
  );
}
