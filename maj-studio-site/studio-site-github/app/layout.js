import '../src/ui/styles.css';

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'Studio Site',
  description: 'Répondez à quelques questions et recevez 10 propositions de site internet rédigées pour votre activité.',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
