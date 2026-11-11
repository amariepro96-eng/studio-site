// Collecte en amont (espace agence) : où en est la collecte, la lancer, l'arrêter
import { after } from 'next/server';
import { route, ok, fail, memeOrigine, origine, readBody } from '../../../../../src/server/http.js';
import { rateLimited, clientIp } from '../../../../../src/server/config.js';
import { getCollecte, getInspirationIndex } from '../../../../../src/server/store.js';
import { lancerCollecte, arreterCollecte, relancerCollecte, vueCollecte, collecteDisponible, CollecteError } from '../../../../../src/server/collecte.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function vue() {
  const [etat, index] = await Promise.all([getCollecte(), getInspirationIndex()]);
  return { disponible: collecteDisponible(), ...vueCollecte(etat, index) };
}

export const GET = route(async () => ok(await vue()), { agency: true });

export const POST = route(
  async (req) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    const body = await readBody(req);
    if (body?.action === 'arreter') {
      await arreterCollecte();
      return ok(await vue());
    }
    if (body?.action !== 'lancer') return fail(400, 'Action inconnue.', 'bad_request');
    if (rateLimited('collecte:' + clientIp(req), 12)) return fail(429, 'Trop de collectes lancées : réessaie dans une heure.', 'rate');
    let res;
    try {
      res = await lancerCollecte({ metiers: body.metiers, parMetier: body.parMetier, angle: body.angle || '', specialite: body.specialite || '' });
    } catch (e) {
      if (e instanceof CollecteError) return fail(e.status, e.message, e.code);
      throw e;
    }
    // Chaque ouvrier part dans sa propre fonction (5 minutes de travail chacune, puis il se relance)
    const base = origine(req);
    after(async () => {
      for (const w of res.ouvriers) await relancerCollecte(base, w, res.run.id);
    });
    return ok(await vue());
  },
  { agency: true }
);
