import AgencyLogin from '../../src/ui/AgencyLogin.jsx';
import Pilotage from '../../src/ui/pilotage/Pilotage.jsx';
import { agencyAccess } from '../../src/server/pageAuth.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contrôle', robots: { index: false } };

// Contrôle : état en direct des sites clients (protégé : mot de passe + code)
export default async function ControlePage({ searchParams }) {
  const { allowed, studioName } = await agencyAccess();
  if (!allowed) return <AgencyLogin />;
  const sp = (await searchParams) || {};
  return <Pilotage studioName={studioName} siteInitial={typeof sp.site === 'string' ? sp.site.slice(0, 40) : ''} />;
}
