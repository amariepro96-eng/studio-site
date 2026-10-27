import AgencyLogin from '../../../src/ui/AgencyLogin.jsx';
import Settings from '../../../src/ui/agency/Settings.jsx';
import { agencyAccess } from '../../../src/server/pageAuth.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Réglages', robots: { index: false } };

export default async function SettingsPage() {
  const { allowed, studioName } = await agencyAccess();
  if (!allowed) return <AgencyLogin />;
  return <Settings studioName={studioName} />;
}
