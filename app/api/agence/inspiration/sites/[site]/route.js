// Fiche complète d'un site de la bibliothèque d'inspiration ; retrait de la bibliothèque
import { route, ok, fail, memeOrigine } from '../../../../../../src/server/http.js';
import { getFicheSite, siteIdValide, supprimerFicheSite, updateInspirationIndex } from '../../../../../../src/server/store.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(
  async (req, { site }) => {
    if (!siteIdValide(site)) return fail(400, 'Site invalide.', 'bad_id');
    const fiche = await getFicheSite(site);
    if (!fiche) return fail(404, 'Ce site n’est plus dans la bibliothèque.', 'not_found');
    return ok({ fiche });
  },
  { agency: true }
);

export const DELETE = route(
  async (req, { site }) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    if (!siteIdValide(site)) return fail(400, 'Site invalide.', 'bad_id');
    const fiche = await getFicheSite(site);
    await updateInspirationIndex((idx) => {
      if (!idx.sites[site]) return null;
      delete idx.sites[site];
      return idx;
    });
    await supprimerFicheSite(site, (fiche?.captures || []).map((c) => c.id));
    return ok({ supprime: true });
  },
  { agency: true }
);
