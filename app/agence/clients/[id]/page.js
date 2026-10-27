import AgencyLogin from '../../../../src/ui/AgencyLogin.jsx';
import ClientFile from '../../../../src/ui/agency/ClientFile.jsx';
import { agencyAccess } from '../../../../src/server/pageAuth.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dossier client', robots: { index: false } };

export default async function ClientPage({ params }) {
  const { id } = await params;
  const { allowed, studioName } = await agencyAccess();
  if (!allowed) return <AgencyLogin />;
  return <ClientFile id={id} studioName={studioName} />;
}
