// Mise en ligne automatique d'un dossier (espace agence uniquement).
// Une étape par appel : l'écran du dossier les enchaîne après ton clic sur « Mettre en ligne ».
import { route, ok, fail, readBody } from '../../../../../../src/server/http.js';
import { getClient, updateClient } from '../../../../../../src/server/store.js';
import { rateLimited, clientIp } from '../../../../../../src/server/config.js';
import { verifier, etapeDepot, etapeVercel, etapeFichiers, etapeEtat, etapeDomaine, etapeVerifierDomaine, vuePublication } from '../../../../../../src/server/publish.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Refuse les appels venus d'un autre site (le cookie agence ne doit servir qu'ici)
function memeOrigine(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get('x-forwarded-host') || req.headers.get('host'));
  } catch {
    return false;
  }
}

// Enregistre l'avancement dans le dossier, avec une ligne d'historique
async function enregistrer(id, patch, { log, extra } = {}) {
  return updateClient(id, (r) => {
    r.publication = { ...(r.publication || {}), ...patch };
    if (extra) extra(r);
    if (log) r.log = [...(r.log || []), { at: new Date().toISOString(), what: log.slice(0, 200) }];
    return r;
  });
}

export const POST = route(
  async (req, { id }) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    if (rateLimited('publication:' + clientIp(req), 240)) return fail(429, 'Trop d’appels : réessaie dans une heure.', 'rate');
    const body = await readBody(req);
    const etape = String(body?.etape || '');
    const rec = await getClient(id);
    if (!rec) return fail(404, 'Dossier introuvable.', 'not_found');

    switch (etape) {
      case 'verifier':
        return ok({ verif: await verifier(rec, { identifiant: typeof body.identifiant === 'string' ? body.identifiant : '' }) });

      case 'depot': {
        const patch = await etapeDepot(rec, typeof body.identifiant === 'string' ? body.identifiant : '');
        const client = Object.keys(patch).length ? await enregistrer(id, patch, { log: `Dépôt GitHub créé : ${patch.repo}` }) : rec;
        return ok({ client, publication: vuePublication(client.publication) });
      }

      case 'vercel': {
        const patch = await etapeVercel(rec);
        const nouveau = patch.projectId && patch.projectId !== rec.publication?.projectId;
        const client = await enregistrer(id, patch, { log: nouveau ? `Projet Vercel créé : ${patch.projectName}` : '' });
        return ok({ client, publication: vuePublication(client.publication) });
      }

      case 'fichiers': {
        const { patch, inchange } = await etapeFichiers(rec, { remplacer: body.remplacer === true });
        if (inchange) return ok({ client: rec, inchange: true, publication: vuePublication(rec.publication) });
        const client = await enregistrer(id, patch, {
          log: patch.version === 1 ? 'Site v1 déposé sur GitHub, mise en ligne lancée' : `Nouvelle version v${patch.version} déposée sur GitHub`,
          // Les mentions légales ont été contrôlées : plus aucun crochet
          extra: (r) => {
            r.checks = { ...(r.checks || {}), legal: true };
          },
        });
        return ok({ client, publication: vuePublication(client.publication) });
      }

      case 'etat': {
        const res = await etapeEtat(rec);
        const avant = rec.publication?.deployState;
        const fini = res.state !== avant && ['READY', 'ERROR', 'CANCELED', 'BLOCKED'].includes(res.state);
        const log = !fini ? '' : res.state === 'READY' ? `En ligne (v${rec.publication?.version}) : ${String(res.url || '').replace(/^https:\/\//, '')}` : `Mise en ligne v${rec.publication?.version} en échec (${res.state})`;
        const client = Object.keys(res.patch).length ? await enregistrer(id, res.patch, { log }) : rec;
        return ok({ client, state: res.state, message: res.message || '', publication: vuePublication(client.publication) });
      }

      case 'domaine': {
        const patch = await etapeDomaine(rec, String(body.domaine || ''));
        const client = await enregistrer(id, patch, { log: `Domaine ajouté dans Vercel : ${patch.domain}`, extra: (r) => patch.domainOk && !r.liveUrl && (r.liveUrl = 'https://' + patch.domain) });
        return ok({ client, publication: vuePublication(client.publication) });
      }

      case 'verifierDomaine': {
        const patch = await etapeVerifierDomaine(rec);
        const devientOk = patch.domainOk && !rec.publication?.domainOk;
        const client = await enregistrer(id, patch, {
          log: devientOk ? `Domaine valide : ${rec.publication.domain}` : '',
          extra: (r) => {
            if (!patch.domainOk) return;
            if (!r.liveUrl) r.liveUrl = 'https://' + r.publication.domain;
            r.checks = { ...(r.checks || {}), publish: true };
          },
        });
        return ok({ client, publication: vuePublication(client.publication) });
      }

      default:
        return fail(400, 'Étape inconnue.', 'bad_request');
    }
  },
  { agency: true }
);
