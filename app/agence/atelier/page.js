import AgencyLogin from '../../../src/ui/AgencyLogin.jsx';
import NextShell from '../../../src/ui/NextShell.jsx';
import { agencyAccess } from '../../../src/server/pageAuth.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Atelier libre', robots: { index: false } };

// Génération libre, sans dossier client (démonstration, essais)
export default async function AtelierPage() {
  const { allowed, studioName } = await agencyAccess();
  if (!allowed) return <AgencyLogin />;
  return <NextShell mode="agence" studioName={studioName} />;
}
