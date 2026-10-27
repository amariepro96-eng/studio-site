import AgencyLogin from '../../src/ui/AgencyLogin.jsx';
import Dashboard from '../../src/ui/agency/Dashboard.jsx';
import { agencyAccess } from '../../src/server/pageAuth.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clients', robots: { index: false } };

// Espace agence : protégé par le mot de passe AGENCY_PASSWORD (si défini)
export default async function AgencyPage() {
  const { allowed, open, studioName } = await agencyAccess();
  if (!allowed) return <AgencyLogin />;
  return <Dashboard studioName={studioName} open={open} />;
}
