// Page du client final (devis ou facture reçus par e-mail) : consultation, et pour un devis :
// accepter, demander une modification ou refuser. Pas de compte : le lien contient un jeton
// secret (après le « # »), seule son empreinte est enregistrée.
import { route, fail, readBody, memeOrigine, origine } from '../../../src/server/http.js';
import { getDevisEspace, updateDevisEspace, widValide } from '../../../src/server/store.js';
import { rateLimited, clientIp } from '../../../src/server/config.js';
import { mailPret, envoyerMail } from '../../../src/server/mail.js';
import * as M from '../../../src/server/devisMetier.js';
import { origineLiens } from '../../../src/server/devisAcces.js';
import { euros, totaux, dateLongue } from '../../../src/engine/devis.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' } });
const INTROUVABLE = 'Ce lien ne fonctionne plus : un lien plus récent vous a peut-être été envoyé. Sinon, contactez l’entreprise qui vous l’a adressé.';

export const POST = route(async (req) => {
  if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
  const ip = clientIp(req);
  if (rateLimited('devis-public:' + ip, 120)) return fail(429, 'Trop d’essais : réessayez dans une heure.', 'rate');
  const body = await readBody(req);
  const { w, type, jeton } = body || {};
  const action = String(body?.action || 'voir');
  if (!widValide(w) || !['d', 'f'].includes(type)) return fail(404, INTROUVABLE, 'introuvable');
  const esp0 = await getDevisEspace(w);
  if (!esp0?.actif) return fail(404, INTROUVABLE, 'introuvable');
  M.normaliser(esp0);
  const doc0 = M.trouverParLien(esp0, type, jeton);
  if (!doc0) return fail(404, INTROUVABLE, 'introuvable');

  if (action === 'voir') {
    if (type === 'd' && doc0.statut === 'envoye') {
      const esp = await updateDevisEspace(w, (e) => {
        M.normaliser(e);
        const d = M.trouverParLien(e, 'd', jeton);
        return d && M.marquerVu(d) ? e : null;
      });
      return json({ doc: M.vuePublique(M.trouverParLien(M.normaliser(esp), 'd', jeton) || doc0, type) });
    }
    return json({ doc: M.vuePublique(doc0, type) });
  }

  if (type !== 'd' || !['accepter', 'modifier', 'refuser'].includes(action)) return fail(400, 'Action inconnue.', 'bad_request');
  if (rateLimited('devis-reponse:' + ip, 20)) return fail(429, 'Trop d’essais : réessayez dans une heure.', 'rate');
  let res = null;
  const esp = await updateDevisEspace(w, (e) => {
    M.normaliser(e);
    const d = M.trouverParLien(e, 'd', jeton);
    if (!d) return null;
    res = M.repondre(e, d, { action, nom: body.nom, message: body.message });
    return res.quoi === 'deja' ? null : e;
  });
  if (!res) return fail(404, INTROUVABLE, 'introuvable');
  const d = M.trouverParLien(M.normaliser(esp), 'd', jeton) || res.d;
  const vue = M.vuePublique(d, 'd');
  if (res.quoi === 'deja') return json({ doc: vue, deja: true });

  // E-mails : l'entreprise est prévenue ; le client reçoit la confirmation de son accord
  const origin = origineLiens(origine(req));
  const s = d.envoi;
  const t = totaux(s.lignes, { franchise: s.vendeur?.franchise });
  const client = s.client.nom || 'Le client';
  if (res.quoi === 'accepte') {
    await M.prevenirEntreprise(esp, origin, `Devis ${d.numero} accepté par ${client}`, `Bonne nouvelle : ${d.reponse.nom} (${client}) a accepté en ligne le devis ${d.numero}${s.objet ? ` « ${s.objet} »` : ''}, d’un montant de ${euros(t.ttc)}${s.vendeur?.franchise ? '' : ' TTC'}.${d.reponse.message ? `\n\nSon message :\n${d.reponse.message}` : ''}\n\nLa facture est prête à émettre dans l’onglet Factures.`, s.client.email);
    if (mailPret() && s.client.email) {
      try {
        await envoyerMail({
          to: s.client.email,
          subject: `Votre accord pour le devis ${d.numero} (${s.vendeur.nom})`,
          text: `Bonjour,\n\nNous avons bien reçu votre accord pour le devis ${d.numero}${s.objet ? ` « ${s.objet} »` : ''}, d’un montant de ${euros(t.ttc)}${s.vendeur?.franchise ? '' : ' TTC'}, donné le ${dateLongue(d.reponse.at.slice(0, 10))} au nom de ${d.reponse.nom}.\n\nMerci pour votre confiance.\n\n${[s.vendeur.nom, s.vendeur.telephone, s.vendeur.email].filter(Boolean).join('\n')}`,
          replyTo: s.vendeur.email,
          fromName: s.vendeur.nom,
        });
      } catch (e) {
        console.warn('[devis] confirmation client', e?.code || e?.message);
      }
    }
  } else if (res.quoi === 'modification') {
    await M.prevenirEntreprise(esp, origin, `Devis ${d.numero} : modification demandée par ${client}`, `${client} demande une modification du devis ${d.numero}${s.objet ? ` « ${s.objet} »` : ''} :\n\n${d.reponse.message}\n\nModifiez le devis dans l’appli, puis renvoyez-le.`, s.client.email);
  } else if (res.quoi === 'refuse') {
    await M.prevenirEntreprise(esp, origin, `Devis ${d.numero} refusé par ${client}`, `${client} a refusé le devis ${d.numero}${s.objet ? ` « ${s.objet} »` : ''}.${d.reponse.message ? `\n\nSon message :\n${d.reponse.message}` : ''}`, s.client.email);
  }
  return json({ doc: vue, fait: res.quoi });
});
