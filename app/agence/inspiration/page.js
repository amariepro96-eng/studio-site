import AgencyLogin from '../../../src/ui/AgencyLogin.jsx';
import Inspiration from '../../../src/ui/agency/Inspiration.jsx';
import { agencyAccess } from '../../../src/server/pageAuth.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inspiration', robots: { index: false } };

const ID = /^[a-z0-9-]{1,64}$/i;

// Inspiration : la bibliothèque des sites visités par l'agent (?dossier= pour un client, ?site= pour une fiche)
export default async function InspirationPage({ searchParams }) {
  const { allowed, studioName } = await agencyAccess();
  if (!allowed) return <AgencyLogin />;
  const sp = (await searchParams) || {};
  const val = (v) => (typeof v === 'string' && ID.test(v) ? v : '');
  return <Inspiration studioName={studioName} dossierId={val(sp.dossier)} siteInitial={val(sp.site)} />;
}
