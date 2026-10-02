import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm space-y-3">
        <p className="text-5xl font-semibold text-muted">404</p>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted">The page you are looking for does not exist, or you do not have access to it.</p>
        <Link href="/" className="inline-block rounded-[10px] bg-brand px-4 py-2 text-sm font-medium text-brand-fg">Go home</Link>
      </div>
    </div>
  );
}
