import type { NextConfig } from 'next';
import pkg from './package.json' with { type: 'json' };

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const config: NextConfig = {
  poweredByHeader: false,
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};
export default config;
