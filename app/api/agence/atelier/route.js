// Bac à sable de l'atelier : créer / ouvrir / supprimer le client de démo.
import { route, ok, fail, readBody, memeOrigine } from '../../../../src/server/http.js';
import { rateLimited, clientIp } from '../../../../src/server/config.js';
import { creerDemo, supprimerDemo, trouverDemo } from '../../../../src/server/demo.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => ok({ demo: await trouverDemo() }), { agency: true });

export const POST = route(
  async (req) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    if (rateLimited('atelier-demo:' + clientIp(req), 60)) return fail(429, 'Trop d’appels : réessaie dans une heure.', 'rate');
    const body = await readBody(req);
    const action = String(body?.action || '');
    if (action === 'creer') return ok({ demo: await creerDemo() });
    if (action === 'supprimer') {
      await supprimerDemo();
      return ok({ demo: null });
    }
    return fail(400, 'Action inconnue.', 'bad_request');
  },
  { agency: true }
);
