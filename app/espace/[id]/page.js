import EspaceApp from '../../../src/ui/client/EspaceApp.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Votre espace', robots: { index: false, follow: false } };

export default async function EspacePage({ params, searchParams }) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  return <EspaceApp id={id} vueAgence={sp.vue === 'agence'} />;
}
