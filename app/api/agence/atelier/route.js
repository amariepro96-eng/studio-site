// Bac à sable de l'atelier : créer / ouvrir / supprimer le client de démo, et préparer ses images IA.
import { route, ok, fail, readBody, memeOrigine } from '../../../../src/server/http.js';
import { rateLimited, clientIp } from '../../../../src/server/config.js';
import { creerDemo, supprimerDemo, etatDemo, imagesACreer, finaliserImages } from '../../../../src/server/demo.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// La remise à neuf recopie les images de l'ancienne démo
export const maxDuration = 60;

export const GET = route(async () => ok(await etatDemo()), { agency: true });

export const POST = route(
  async (req) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    if (rateLimited('atelier-demo:' + clientIp(req), 60)) return fail(429, 'Trop d’appels : réessaie dans une heure.', 'rate');
    const body = await readBody(req);
    const action = String(body?.action || '');
    if (action === 'creer') {
      const res = await creerDemo({ nouvellesImages: body?.nouvellesImages === true });
      return ok({ demo: res.id, images: res.images });
    }
    if (action === 'supprimer') {
      await supprimerDemo();
      return ok({ demo: null });
    }
    // Images de la démo existante : celles qui manquent, ou toutes (« Nouvelles images »)
    if (action === 'images' || action === 'finaliser') {
      const { demo } = await etatDemo();
      if (!demo || body?.id !== demo) return fail(404, 'Client de démo introuvable : recrée-le.', 'not_found');
      const images = action === 'images' ? await imagesACreer(demo, { neuves: body?.neuves === true }) : await finaliserImages(demo);
      return ok({ demo, images });
    }
    return fail(400, 'Action inconnue.', 'bad_request');
  },
  { agency: true }
);
