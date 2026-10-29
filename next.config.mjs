/** @type {import('next').NextConfig} */

// Pages privées (espace agence, espace client) : jamais affichées dans le cadre d'un autre site,
// et l'adresse de la page n'est jamais transmise aux sites appelés (polices, liens sortants).
const PRIVE = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

// Appli Devis & Factures et page des clients finaux : en plus, une politique de contenu stricte
// (scripts et connexions limités au site lui-même, polices Google, images locales)
const DEVIS = [
  ...PRIVE,
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
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
      { source: '/controle/:path*', headers: PRIVE },
      { source: '/controle', headers: PRIVE },
      { source: '/accueil', headers: PRIVE },
      { source: '/devis/:path*', headers: DEVIS },
      { source: '/devis', headers: DEVIS },
      { source: '/d/:path*', headers: DEVIS },
      { source: '/api/devis/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/api/devis', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/api/d', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/devis.webmanifest', headers: [{ key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' }] },
      { source: '/api/agence/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/api/agence-login', headers: [{ key: 'Cache-Control', value: 'no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
      { source: '/pilotage.webmanifest', headers: [{ key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' }] },
      { source: '/api/espace/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
    ];
  },
};
export default nextConfig;
