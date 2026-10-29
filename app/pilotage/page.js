import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// « Pilotage » s'appelle désormais « Contrôle » : l'ancienne adresse y mène
export default function AnciennePilotage() {
  redirect('/controle');
}
