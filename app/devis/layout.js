// Appli Devis & Factures : installable sur l'écran d'accueil (iPhone et Android), séparée de
// l'espace client du site et de l'espace agence.
export const metadata = {
  title: { default: 'Devis & Factures', template: '%s — Devis & Factures' },
  manifest: '/devis.webmanifest',
  appleWebApp: { capable: true, title: 'Devis', statusBarStyle: 'default' },
  icons: { apple: '/icons/devis-180.png', icon: '/icons/devis-192.png' },
  robots: { index: false, follow: false },
};

// viewport-fit=cover : la barre d'onglets du bas respecte la zone du geste d'accueil (iPhone)
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#F3F4F1' };

export default function DevisLayout({ children }) {
  return children;
}
