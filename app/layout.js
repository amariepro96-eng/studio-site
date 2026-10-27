import '../src/ui/styles.css';

export const metadata = {
  title: { default: process.env.NEXT_PUBLIC_APP_NAME || 'Studio Site', template: `%s — ${process.env.NEXT_PUBLIC_APP_NAME || 'Studio Site'}` },
  description: 'Création de sites internet pour les commerces, artisans et indépendants.',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#F3F4F1' };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
