import { config, agencyToken, rateLimited, clientIp } from '../../../src/server/config.js';
import { safeEqual } from '../../../src/server/http.js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { agencyPassword } = config();
  if (!agencyPassword) {
    if (!process.env.VERCEL) return Response.json({ ok: true });
    return Response.json({ ok: false, error: 'Aucun mot de passe agence n’est défini : ajoutez la variable AGENCY_PASSWORD dans Vercel, puis redéployez.' }, { status: 503 });
  }
  if (rateLimited('login:' + clientIp(req), 10)) {
    return Response.json({ ok: false, error: 'Trop d’essais. Réessayez dans une heure.' }, { status: 429 });
  }
  let password = '';
  try {
    password = String((await req.json())?.password || '');
  } catch {}
  if (!safeEqual(password, agencyPassword)) {
    return Response.json({ ok: false, error: 'Mot de passe incorrect.' }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.append(
    'Set-Cookie',
    `agence=${agencyToken(agencyPassword)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
  return res;
}

// Déconnexion : efface le cookie de session
export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.append('Set-Cookie', `agence=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  return res;
}
