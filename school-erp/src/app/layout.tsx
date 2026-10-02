import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { getT } from '@/lib/i18n';
import { ServiceWorker } from '@/components/shell/service-worker';

export const metadata: Metadata = {
  title: { default: 'School ERP', template: '%s · School ERP' },
  description: 'Multi-campus school management: admissions, attendance, fees, exams, payroll and parent portal.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'School ERP', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/apple-touch-icon.png' },
};
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#0b6b5f' }, { media: '(prefers-color-scheme: dark)', color: '#0c1413' }],
};

// Runs before first paint so there is no light→dark flash.
const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )erp_theme=(light|dark|system)/);var p=m?m[1]:'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.dataset.pref=p;}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, dir } = await getT();
  const pref = (await cookies()).get('erp_theme')?.value ?? 'system';
  return (
    <html lang={lang} dir={dir} data-pref={pref} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;600&display=swap" />
      </head>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
