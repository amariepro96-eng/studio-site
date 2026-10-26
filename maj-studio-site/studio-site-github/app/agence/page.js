import { cookies } from 'next/headers';
import NextShell from '../../src/ui/NextShell.jsx';
import AgencyLogin from '../../src/ui/AgencyLogin.jsx';
import { config, agencyToken } from '../../src/server/config.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mode agence', robots: { index: false } };

// Mode agence : protégé par le mot de passe AGENCY_PASSWORD (si défini)
export default async function AgencyPage() {
  const { agencyPassword } = config();
  if (agencyPassword) {
    const store = await cookies();
    if (store.get('agence')?.value !== agencyToken(agencyPassword)) return <AgencyLogin />;
  }
  return <NextShell mode="agence" />;
}
