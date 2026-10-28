/** @type {import('next').NextConfig} */

// Pages privées (espace agence, espace client) : jamais affichées dans le cadre d'un autre site,
// et l'adresse de la page n'est jamais transmise aux sites appelés (polices, liens sortants).
const PRIVE = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: '/espace/:path*', headers: PRIVE },
      { source: '/agence/:path*', headers: PRIVE },
      { source: '/agence', headers: PRIVE },
      { source: '/pilotage/:path*', headers: PRIVE },
      { source: '/pilotage', headers: PRIVE },
      { source: '/api/agence/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/api/agence-login', headers: [{ key: 'Cache-Control', value: 'no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
      { source: '/pilotage.webmanifest', headers: [{ key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' }] },
      { source: '/api/espace/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
    ];
  },
};
export default nextConfig;
