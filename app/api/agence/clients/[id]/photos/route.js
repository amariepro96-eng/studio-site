// Photos du client : analyse par l'IA (ce qu'elles montrent, où les placer) et choix de l'agence
import { route, ok, fail, readBody, memeOrigine } from '../../../../../../src/server/http.js';
import { getClient, updateClient, validId } from '../../../../../../src/server/store.js';
import { rateLimited, clientIp } from '../../../../../../src/server/config.js';
import { analyserPhotos, enregistrerAnalyse, choixPhoto, AnalyseError } from '../../../../../../src/server/photosIa.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Claude regarde jusqu'à 10 photos
export const maxDuration = 120;

const journal = (r, what) => (r.log = [...(r.log || []), { at: new Date().toISOString(), what: what.slice(0, 200) }]);

export const POST = route(
  async (req, { id }) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    const body = await readBody(req);
    const action = String(body?.action || '');
    const rec = await getClient(id);
    if (!rec) return fail(404, 'Dossier introuvable.', 'not_found');

    if (action === 'analyser') {
      if (rateLimited('photos:' + clientIp(req), 40)) return fail(429, 'Trop d’analyses : réessaie dans une heure.', 'rate');
      try {
        const res = await analyserPhotos(rec, { force: body?.force === true });
        if (!res.analysees) return ok({ client: rec, analysees: 0 });
        const vals = Object.values(res.infos);
        const ecartees = vals.filter((x) => !x.utilisable).length;
        const client = await updateClient(id, (r) => {
          enregistrerAnalyse(r, res);
          journal(r, `Photos du client analysées par l’IA : ${vals.length}${ecartees ? `, dont ${ecartees} écartée${ecartees > 1 ? 's' : ''}` : ''}`);
          return r;
        });
        return ok({ client, analysees: res.analysees });
      } catch (e) {
        if (e instanceof AnalyseError) return fail(e.status, e.message, e.code);
        throw e;
      }
    }

    // L'agence garde ou écarte une photo, contre l'avis de l'IA (choix '' : revenir à l'avis de l'IA)
    if (action === 'choix') {
      const photo = String(body?.photo || '');
      const choix = ['oui', 'non'].includes(body?.choix) ? body.choix : '';
      if (!validId(photo) || !(rec.brief?.photos || []).some((p) => p.id === photo)) return fail(404, 'Photo introuvable.', 'not_found');
      const client = await updateClient(id, (r) => {
        choixPhoto(r, photo, choix);
        return r;
      });
      return ok({ client });
    }

    return fail(400, 'Action inconnue.', 'bad_request');
  },
  { agency: true }
);
