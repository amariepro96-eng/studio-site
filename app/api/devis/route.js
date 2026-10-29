// Appli Devis & Factures : données de l'entreprise connectée et actions (devis, factures,
// produits, réglages). Session obligatoire (e-mail + mot de passe + code).
import { route, fail, readBody, memeOrigine, origine } from '../../../src/server/http.js';
import { updateDevisEspace, StoreError } from '../../../src/server/store.js';
import { rateLimited, clientIp } from '../../../src/server/config.js';
import { mailPret, envoyerMail } from '../../../src/server/mail.js';
import { lireSession, exigerSession, consommerCode, ajouterEchec, bloque, MSG_BLOQUE, noterJournal, origineLiens } from '../../../src/server/devisAcces.js';
import { nettoyerEntreprise } from '../../../src/engine/devis.js';
import * as M from '../../../src/server/devisMetier.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });

export const GET = route(async (req) => {
  const s = await lireSession(req);
  if (!s) return fail(401, 'Session expirée : reconnectez-vous.', 'unauthorized');
  return json(M.vueApp(M.normaliser(s.esp), s.appareil));
});

// Modifie l'espace dans une mise à jour protégée (deux appareils ne s'écrasent pas)
// Au-delà de 6 Mo, l'espace n'accepte plus d'ajouts (il reste lisible et utilisable)
const TAILLE_MAX = 6 * 1024 * 1024;
async function modifier(s, fn) {
  let res;
  const esp = await updateDevisEspace(s.w, (e) => {
    M.normaliser(e);
    const avant = JSON.stringify(e).length;
    res = fn(e);
    const apres = JSON.stringify(e).length;
    if (apres > TAILLE_MAX && apres > avant) throw new StoreError('Votre espace est plein : contactez votre prestataire pour archiver vos plus anciens documents.', 'plein', 413);
    return e;
  });
  return { esp, res };
}

export const POST = route(async (req) => {
  if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
  const s = exigerSession(await lireSession(req));
  if (rateLimited('devis-app:' + s.w + ':' + clientIp(req), 1200)) return fail(429, 'Trop d’actions : réessayez dans une heure.', 'rate');
  const body = await readBody(req);
  const action = String(body?.action || '');
  const origin = origineLiens(origine(req));
  const vue = (esp, extra = {}) => json({ ...M.vueApp(esp, s.appareil), ...extra });

  switch (action) {
    case 'entreprise': {
      // IBAN, BIC et e-mail de contact : le code du téléphone est demandé (une session volée ne
      // peut pas détourner les paiements ni les réponses des clients sans le téléphone)
      const avant = s.esp.entreprise || {};
      const apres = nettoyerEntreprise(body.entreprise);
      const sensible = ['iban', 'bic', 'email'].filter((k) => (apres[k] || '') !== (avant[k] || ''));
      if (!sensible.length) {
        const { esp } = await modifier(s, (e) => M.enregistrerEntreprise(e, body.entreprise));
        return vue(esp, { note: 'Informations de l’entreprise enregistrées.' });
      }
      if (!body.code) return fail(401, 'Pour modifier l’IBAN, le BIC ou l’e-mail, saisissez le code à 6 chiffres de Google Authenticator.', 'code_requis');
      let res = { ok: false };
      let bloq = false;
      const esp = await updateDevisEspace(s.w, (e) => {
        res = { ok: false };
        bloq = false;
        M.normaliser(e);
        if (bloque(e)) {
          bloq = true;
          return null;
        }
        res = consommerCode(e, body.code, { secoursPermis: false });
        if (!res.ok) {
          ajouterEchec(e);
          return e;
        }
        M.enregistrerEntreprise(e, body.entreprise);
        noterJournal(e, `Coordonnées modifiées : ${sensible.map((k) => (k === 'email' ? 'e-mail' : k.toUpperCase())).join(', ')}`);
        return e;
      });
      if (bloq) return fail(429, MSG_BLOQUE, 'bloque');
      if (!res.ok) return fail(401, 'Code incorrect. Saisissez le code affiché maintenant dans Google Authenticator.', 'code');
      // Alerte au propriétaire (et à l'ancienne adresse de contact si elle change)
      if (mailPret()) {
        const dest = [...new Set([esp.compte?.email, avant.email].filter(Boolean))];
        for (const to of dest) {
          try {
            await envoyerMail({ to, subject: 'Devis & Factures : coordonnées modifiées', text: `Bonjour,\n\nDans votre appli Devis & Factures, ces informations de l’entreprise viennent d’être modifiées : ${sensible.map((k) => (k === 'email' ? 'e-mail de contact' : k.toUpperCase())).join(', ')}.\n\nC’est vous ? Rien à faire.\nCe n’est pas vous ? Ouvrez l’appli, vérifiez Réglages › Entreprise, puis Réglages › Sécurité : changez votre mot de passe et déconnectez les autres appareils.\n\n${origin}/devis\n\nDevis & Factures`, fromName: 'Devis & Factures' });
          } catch (err) {
            console.warn('[devis] alerte coordonnées', err?.code || err?.message);
          }
        }
      }
      return vue(esp, { note: 'Informations de l’entreprise enregistrées.' });
    }
    case 'produits': {
      const { esp } = await modifier(s, (e) => M.enregistrerProduits(e, body.produits));
      return vue(esp, { note: `${esp.produits.length} produit${esp.produits.length > 1 ? 's' : ''} et prix enregistré${esp.produits.length > 1 ? 's' : ''}.` });
    }

    case 'devis.enregistrer': {
      const { esp, res } = await modifier(s, (e) => M.enregistrerDevis(e, body.devis));
      return vue(esp, { id: res.id, note: `Devis ${res.numero} enregistré.` });
    }
    case 'devis.dupliquer': {
      const { esp, res } = await modifier(s, (e) => M.dupliquerDevis(e, body.id));
      return vue(esp, { id: res.id, note: `Copie créée : ${res.numero}.` });
    }
    case 'devis.annuler': {
      const { esp, res } = await modifier(s, (e) => M.annulerDevis(e, body.id));
      return vue(esp, { id: res.id, note: `Devis ${res.numero} annulé.` });
    }
    case 'devis.supprimer': {
      const { esp } = await modifier(s, (e) => M.supprimerDevis(e, body.id));
      return vue(esp, { note: 'Brouillon supprimé.' });
    }
    case 'devis.accepter': {
      const { esp, res } = await modifier(s, (e) => M.accepterHorsLigne(e, body.id, { nom: body.nom }));
      return vue(esp, { id: body.id, factureId: res.id, note: 'Devis marqué accepté : la facture vous attend dans l’onglet Factures.' });
    }

    // Envoi : par e-mail (Brevo) ou lien à copier (SMS, WhatsApp, messagerie personnelle)
    case 'devis.envoyer':
    case 'devis.lien': {
      const parEmail = action === 'devis.envoyer';
      if (parEmail && !mailPret()) return fail(503, 'L’envoi d’e-mails n’est pas disponible : utilisez « Copier le lien ».', 'mail_off');
      const { esp, res } = await modifier(s, (e) => M.preparerEnvoiDevis(e, body.id, { email: body.email, mode: parEmail ? 'email' : 'lien' }));
      const url = M.lienPublic(origin, s.w, 'd', res.jeton);
      if (!parEmail) return vue(esp, { id: body.id, lien: url, note: 'Lien du devis créé : envoyez-le au client.' });
      const d = esp.devis.find((x) => x.id === body.id);
      const m = M.mailDevis(d, url, body.message);
      try {
        await envoyerMail({ to: d.client.email, toName: d.client.nom, subject: m.subject, text: m.text, replyTo: esp.entreprise.email || esp.compte.email, fromName: esp.entreprise.nom });
      } catch (err) {
        return vue(esp, { id: body.id, lien: url, erreurEnvoi: `${err.message} Le devis est prêt : copiez ce lien pour l’envoyer vous-même.` });
      }
      return vue(esp, { id: body.id, note: `Devis ${d.numero} envoyé à ${d.client.email}.` });
    }

    case 'facture.emettre': {
      const { esp, res } = await modifier(s, (e) => M.emettreFacture(e, body.id, { acompteVerse: body.acompteVerse, datePrestation: body.datePrestation }));
      return vue(esp, { id: res.id, note: `Facture ${res.numero} émise.` });
    }
    case 'facture.supprimer': {
      const { esp } = await modifier(s, (e) => M.supprimerFacture(e, body.id));
      return vue(esp, { note: 'Facture à émettre supprimée.' });
    }
    case 'facture.payer': {
      const { esp, res } = await modifier(s, (e) => M.marquerPayee(e, body.id, { le: body.le }));
      return vue(esp, { id: res.id, note: `Facture ${res.numero} marquée payée.` });
    }
    case 'facture.nonpayee': {
      const { esp, res } = await modifier(s, (e) => M.marquerNonPayee(e, body.id));
      return vue(esp, { id: res.id, note: `Facture ${res.numero} remise « à encaisser ».` });
    }
    case 'facture.envoyer':
    case 'facture.lien': {
      const parEmail = action === 'facture.envoyer';
      if (parEmail && !mailPret()) return fail(503, 'L’envoi d’e-mails n’est pas disponible : utilisez « Copier le lien ».', 'mail_off');
      const { esp, res } = await modifier(s, (e) => M.preparerEnvoiFacture(e, body.id, { email: body.email, mode: parEmail ? 'email' : 'lien' }));
      const url = M.lienPublic(origin, s.w, 'f', res.jeton);
      if (!parEmail) return vue(esp, { id: body.id, lien: url, note: 'Lien de la facture créé : envoyez-le au client.' });
      const f = esp.factures.find((x) => x.id === body.id);
      const m = M.mailFacture(f, url);
      try {
        await envoyerMail({ to: f.client.email, toName: f.client.nom, subject: m.subject, text: m.text, replyTo: esp.entreprise.email || esp.compte.email, fromName: esp.entreprise.nom });
      } catch (err) {
        return vue(esp, { id: body.id, lien: url, erreurEnvoi: `${err.message} Copiez ce lien pour l’envoyer vous-même.` });
      }
      return vue(esp, { id: body.id, note: `Facture ${f.numero} envoyée à ${f.client.email}.` });
    }

    default:
      return fail(400, 'Action inconnue.', 'bad_request');
  }
});
