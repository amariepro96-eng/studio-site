import AgencyLogin from '../../src/ui/AgencyLogin.jsx';
import Accueil from '../../src/ui/pilotage/Accueil.jsx';
import { agencyAccess } from '../../src/server/pageAuth.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accueil', robots: { index: false } };

// Accueil : statuts des clients et tableau financier (protégé : mot de passe + code)
export default async function AccueilPage() {
  const { allowed, studioName, ownerName } = await agencyAccess();
  if (!allowed) return <AgencyLogin />;
  return <Accueil studioName={studioName} ownerName={ownerName} />;
}
