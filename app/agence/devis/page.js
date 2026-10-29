import AgencyLogin from '../../../src/ui/AgencyLogin.jsx';
import ComptesDevis from '../../../src/ui/agency/ComptesDevis.jsx';
import { agencyAccess } from '../../../src/server/pageAuth.js';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Comptes Devis & Factures', robots: { index: false } };

// Tous les comptes de l'appli Devis & Factures des clients (sans mot de passe ni données)
export default async function ComptesDevisPage() {
  const { allowed, studioName } = await agencyAccess();
  if (!allowed) return <AgencyLogin />;
  return <ComptesDevis studioName={studioName} />;
}
