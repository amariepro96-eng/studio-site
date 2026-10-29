import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Ancienne adresse du suivi financier
export default async function AncienSuiviFinancier({ searchParams }) {
  const sp = (await searchParams) || {};
  const client = typeof sp.client === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(sp.client) ? sp.client : '';
  redirect(client ? `/controle/finances?client=${client}` : '/controle/finances');
}
