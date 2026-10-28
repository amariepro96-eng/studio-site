import AgencyLogin from '../../src/ui/AgencyLogin.jsx';
import Pilotage from '../../src/ui/pilotage/Pilotage.jsx';
import { agencyAccess } from '../../src/server/pageAuth.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pilotage', robots: { index: false } };

// Panneau de pilotage : état en direct des sites clients (protégé : mot de passe + code)
export default async function PilotagePage() {
  const { allowed, studioName } = await agencyAccess();
  if (!allowed) return <AgencyLogin />;
  return <Pilotage studioName={studioName} />;
}
