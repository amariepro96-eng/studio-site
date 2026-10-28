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
      { source: '/api/espace/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
    ];
  },
};
export default nextConfig;
