// Bibliothèque d'inspiration (espace agence) : tous les sites analysés, ou ceux d'un dossier
import { route, ok, fail } from '../../../../src/server/http.js';
import { getClient, getInspirationIndex, getSettings, validId } from '../../../../src/server/store.js';
import { inspirationDisponible, vueInspiration } from '../../../../src/server/inspiration.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(
  async (req) => {
    const dossier = new URL(req.url).searchParams.get('dossier');
    const idx = await getInspirationIndex();
    const disponible = inspirationDisponible();
    if (dossier) {
      if (!validId(dossier)) return fail(400, 'Dossier invalide.', 'bad_id');
      const rec = await getClient(dossier);
      if (!rec) return fail(404, 'Dossier introuvable.', 'not_found');
      return ok({ disponible, auto: (await getSettings()).inspirationAuto !== false, inspiration: vueInspiration(rec, idx), nom: rec.brief?.businessName || rec.name, metier: rec.brief?.sector || '' });
    }
    const sites = Object.values(idx.sites).sort((a, b) => String(b.visiteLe).localeCompare(String(a.visiteLe)));
    return ok({ disponible, sites });
  },
  { agency: true }
);
