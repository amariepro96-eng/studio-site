// Mise en ligne automatique d'un dossier (espace agence uniquement).
// Une étape par appel : l'écran du dossier les enchaîne après ton clic sur « Mettre en ligne ».
import { after } from 'next/server';
import { route, ok, fail, readBody, memeOrigine } from '../../../../../../src/server/http.js';
import { getClient, updateClient } from '../../../../../../src/server/store.js';
import { rateLimited, clientIp } from '../../../../../../src/server/config.js';
import { verifier, etapeDepot, etapeVercel, etapeFichiers, etapeEtat, etapeDomaine, etapeVerifierDomaine, etapeDnsOvh, vuePublication } from '../../../../../../src/server/publish.js';
import { libelle } from '../../../../../../src/server/ovh.js';
import { driveStatus, envoyerVersDrive } from '../../../../../../src/server/drive.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Chaque étape tient en une minute ; l'archivage dans Drive qui suit une nouvelle version peut durer plus
export const maxDuration = 300;

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
        const { patch, inchange, manques = [] } = await etapeFichiers(rec, { remplacer: body.remplacer === true });
        if (inchange) return ok({ client: rec, inchange: true, publication: vuePublication(rec.publication) });
        const incomplet = manques.length ? ` (mentions légales incomplètes : ${manques.join(', ')})` : '';
        const client = await enregistrer(id, patch, {
          log: (patch.version === 1 ? 'Site v1 déposé sur GitHub, mise en ligne lancée' : `Nouvelle version v${patch.version} déposée sur GitHub`) + incomplet,
          extra: (r) => {
            // La case « mentions légales » de la mise en service ne se coche que si plus aucun crochet
            if (!manques.length) r.checks = { ...(r.checks || {}), legal: true };
            // Les changements de l'espace client en attente partent avec cette version
            if (r.espace?.aPublier) r.espace = { ...r.espace, aPublier: null };
          },
        });
        // Copie de la version dans « 3-Versions du site » (Google Drive), sans faire attendre l'écran
        if (driveStatus().configured) after(() => envoyerVersDrive(id, { site: true }).catch((e) => console.warn('[drive]', e?.message)));
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

      // Zone DNS chez OVHcloud : ce qu'il faudrait changer (aucune écriture)
      case 'dnsOvh': {
        const res = await etapeDnsOvh(rec);
        return ok({ zone: res.zone, actions: res.actions.map((a) => ({ ...a, texte: libelle(a) })) });
      }

      // Zone DNS chez OVHcloud : applique les changements, puis revérifie dans Vercel
      case 'dnsOvhAppliquer': {
        const res = await etapeDnsOvh(rec, { appliquer: true });
        let client = rec;
        if (res.applique) {
          client = await enregistrer(id, {}, { log: `Zone DNS réglée chez OVHcloud (${res.zone}) : ${res.actions.map(libelle).join(' ; ')}`.slice(0, 200) });
          // OVHcloud publie la zone en quelques secondes ; Vercel peut mettre un peu plus à le voir
          try {
            const patch = await etapeVerifierDomaine(client);
            client = await enregistrer(id, patch, {
              log: patch.domainOk && !client.publication?.domainOk ? `Domaine valide : ${res.zone}` : '',
              extra: (r) => {
                if (!patch.domainOk) return;
                if (!r.liveUrl) r.liveUrl = 'https://' + r.publication.domain;
                r.checks = { ...(r.checks || {}), publish: true };
              },
            });
          } catch {}
        }
        return ok({ client, publication: vuePublication(client.publication), zone: res.zone, actions: res.actions.map((a) => ({ ...a, texte: libelle(a) })), applique: res.applique });
      }

      default:
        return fail(400, 'Étape inconnue.', 'bad_request');
    }
  },
  { agency: true }
);
