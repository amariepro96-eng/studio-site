// Collecte en amont : un passage de travail d'un ouvrier (5 minutes au plus).
// Appelé seulement par la collecte elle-même (lancement, relance, surveillance), avec un jeton signé.
import { after } from 'next/server';
import { fail, origine } from '../../../../../../src/server/http.js';
import { lireJeton } from '../../../../../../src/server/securite.js';
import { config } from '../../../../../../src/server/config.js';
import { avancerCollecte, relancerCollecte, collecteDisponible, OUVRIERS } from '../../../../../../src/server/collecte.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Navigateur sans écran + analyses Claude : chaque passage s'arrête de lui-même avant 5 minutes
export const maxDuration = 300;

const RUN = /^c[a-z0-9]{6,20}$/;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Requête illisible.', 'bad_request');
  }
  const w = Number(body?.w);
  const runId = String(body?.run || '');
  if (!Number.isInteger(w) || w < 0 || w >= OUVRIERS || !RUN.test(runId)) return fail(400, 'Requête invalide.', 'bad_request');
  // Jeton signé avec la clé tirée du mot de passe agence (jamais accepté en ligne sans mot de passe)
  const jeton = lireJeton(req.headers.get('x-studio-agent'), 'collecte');
  if (!jeton || !(config().agencyPassword || !process.env.VERCEL) || jeton.w !== w || jeton.run !== runId) return fail(401, 'Jeton refusé.', 'unauthorized');
  if (!collecteDisponible().configured) return fail(503, 'Collecte indisponible.', 'off');

  const base = origine(req);
  after(async () => {
    try {
      const r = await avancerCollecte({ w, runId, origine: base });
      if (r.continuer) await relancerCollecte(base, w, runId);
    } catch (e) {
      console.error('[collecte] passage', e?.name, String(e?.message || '').slice(0, 200));
    }
  });
  return Response.json({ ok: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
