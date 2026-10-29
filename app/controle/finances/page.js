import AgencyLogin from '../../../src/ui/AgencyLogin.jsx';
import Finances from '../../../src/ui/pilotage/Finances.jsx';
import { agencyAccess } from '../../../src/server/pageAuth.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suivi financier', robots: { index: false } };

export default async function FinancesPage({ searchParams }) {
  const { allowed, studioName } = await agencyAccess();
  if (!allowed) return <AgencyLogin />;
  const sp = (await searchParams) || {};
  return <Finances studioName={studioName} clientInitial={typeof sp.client === 'string' ? sp.client : ''} />;
}
