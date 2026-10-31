import AgencyLogin from '../../../src/ui/AgencyLogin.jsx';
import Atelier from '../../../src/ui/agency/Atelier.jsx';
import { agencyAccess } from '../../../src/server/pageAuth.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Atelier libre', robots: { index: false } };

// Atelier libre : le bac à sable. Chaque essai est un vrai dossier (même parcours qu'un client),
// sans Google Drive ni Suivi clients, jusqu'à la mise en ligne sur un domaine de test.
export default async function AtelierPage() {
  const { allowed, studioName } = await agencyAccess();
  if (!allowed) return <AgencyLogin />;
  return <Atelier studioName={studioName} />;
}
