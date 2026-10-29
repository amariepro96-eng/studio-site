import DocPublic from '../../../src/ui/devis/DocPublic.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Votre document', robots: { index: false, follow: false } };

// Devis ou facture reçu par le client final (le jeton secret est après le « # » de l'adresse)
export default async function DocPublicPage({ params }) {
  const { w } = await params;
  return <DocPublic w={String(w || '').slice(0, 40)} />;
}
