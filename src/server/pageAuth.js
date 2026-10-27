// Contrôle d'accès des pages de l'espace agence
import { cookies } from 'next/headers';
import { config, agencyToken } from './config.js';
import { getSettings } from './store.js';
import { safeEqual } from './http.js';

export async function agencyAccess() {
  const { agencyPassword } = config();
  // En ligne sans mot de passe : fermé (la page de connexion explique quoi faire)
  let allowed = !process.env.VERCEL;
  if (agencyPassword) {
    const store = await cookies();
    allowed = safeEqual(store.get('agence')?.value, agencyToken(agencyPassword));
  }
  let studioName = process.env.NEXT_PUBLIC_APP_NAME || 'Studio Site';
  if (allowed) {
    try {
      studioName = (await getSettings()).studioName || studioName;
    } catch {}
  }
  return { allowed, open: !agencyPassword, noPassword: !agencyPassword, studioName };
}
