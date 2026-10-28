import { route, ok, fail, readBody, memeOrigine } from '../../../../../../src/server/http.js';
import { updateClient } from '../../../../../../src/server/store.js';
import { nettoyerFacturation } from '../../../../../../src/engine/finances.js';
import { FORMULES } from '../../../../../../src/engine/records.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Facturation d'un client : { facturation, formule? } (remplace tout le bloc, déjà nettoyé)
export const PUT = route(
  async (req, { id }) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    const body = await readBody(req);
    if (!body?.facturation || typeof body.facturation !== 'object') return fail(400, 'Facturation manquante.', 'bad_request');
    const facturation = nettoyerFacturation(body.facturation);
    const rec = await updateClient(id, (r) => {
      r.facturation = facturation;
      if (typeof body.formule === 'string' && (body.formule === '' || FORMULES.includes(body.formule) || body.formule === r.formula)) r.formula = body.formule;
      return r;
    });
    if (!rec) return fail(404, 'Dossier introuvable.', 'not_found');
    return ok({ facturation: rec.facturation, formule: rec.formula || '' });
  },
  { agency: true }
);
