import { safeEqual, origine } from '../../../../src/server/http.js';
import { verificationAutomatique } from '../../../../src/server/alertes.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Appelé par Vercel toutes les 5 minutes (vercel.json). Ne renvoie aucune information.
// Avec la variable CRON_SECRET (facultative), seuls les appels de Vercel sont acceptés ;
// sans elle, les passages restent limités à un toutes les 3 minutes.
export async function GET(req) {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (secret && !safeEqual(req.headers.get('authorization') || '', `Bearer ${secret}`)) return new Response(null, { status: 401 });
  try {
    const r = await verificationAutomatique({ origine: origine(req) });
    if (r?.erreurs?.length) console.warn('[surveillance] e-mail en échec :', r.erreurs[0]);
  } catch (e) {
    console.error('[surveillance]', e?.name, String(e?.message || '').slice(0, 200));
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
