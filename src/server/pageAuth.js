// Contrôle d'accès des pages de l'espace agence
import { cookies } from 'next/headers';
import { config } from './config.js';
import { getSettings } from './store.js';
import { sessionValide } from './securite.js';

export async function agencyAccess() {
  const { agencyPassword } = config();
  // En ligne sans mot de passe : fermé (la page de connexion explique quoi faire)
  const store = await cookies();
  const allowed = await sessionValide(store.get('agence')?.value);
  let studioName = process.env.NEXT_PUBLIC_APP_NAME || 'Studio Site';
  if (allowed) {
    try {
      studioName = (await getSettings()).studioName || studioName;
    } catch {}
  }
  return { allowed, open: !agencyPassword, noPassword: !agencyPassword, studioName };
}
