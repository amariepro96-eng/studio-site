// Comptes Devis & Factures de tous les clients, pour l'agence : état de chaque accès (jamais de
// mot de passe, de devis, de facture ni de prix) et suppression d'un espace.
import { route, ok, fail, readBody, memeOrigine } from '../../../../src/server/http.js';
import { listClients, listerDevisEspaces, getDevisEspace, getSettings, widValide } from '../../../../src/server/store.js';
import { rateLimited, clientIp } from '../../../../src/server/config.js';
import { resumeEspace, etatEspace, supprimerAppli } from '../../../../src/server/devisAgence.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(
  async () => {
    const [wids, clients] = await Promise.all([listerDevisEspaces(), listClients()]);
    const parId = new Map(clients.map((c) => [c.id, c]));
    const espaces = await Promise.all(wids.map((w) => getDevisEspace(w).catch(() => null)));
    const comptes = espaces
      .map((esp, i) => {
        if (!esp) return null;
        const rec = parId.get(esp.clientId);
        const r = resumeEspace(esp);
        return {
          wid: wids[i],
          clientId: rec && rec.appliDevis?.wid === wids[i] ? rec.id : null,
          nom: rec?.brief?.businessName || rec?.name || 'Dossier supprimé',
          etat: etatEspace(r),
          appli: r,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    return ok({ comptes });
  },
  { agency: true }
);

export const POST = route(
  async (req) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    if (rateLimited('devis-comptes:' + clientIp(req), 120)) return fail(429, 'Trop d’appels : réessaie dans une heure.', 'rate');
    const body = await readBody(req);
    if (body?.action !== 'supprimer') return fail(400, 'Action inconnue.', 'bad_request');
    if (!widValide(body.wid)) return fail(404, 'Compte introuvable.', 'not_found');
    if (body.confirme !== true) return fail(400, 'Confirme la suppression.', 'confirmation');
    const settings = await getSettings();
    const fait = await supprimerAppli(body.wid, { qui: settings.ownerName || 'Alexandre' });
    if (!fait) return fail(404, 'Compte introuvable (déjà supprimé ?).', 'not_found');
    return ok({ supprime: true });
  },
  { agency: true }
);
