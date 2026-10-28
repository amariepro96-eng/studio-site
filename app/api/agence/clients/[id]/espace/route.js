// Espace client, côté agence : invitation, envoi du message de livraison, réponses aux demandes,
// coupure des accès. Réservé à l'agence (mot de passe de l'espace agence).
import { route, ok, fail, readBody, memeOrigine, origine } from '../../../../../../src/server/http.js';
import { getClient, updateClient, getSettings } from '../../../../../../src/server/store.js';
import { rateLimited, clientIp } from '../../../../../../src/server/config.js';
import { mailPret, mailStatus, emailValide, envoyerMail } from '../../../../../../src/server/mail.js';
import { espaceDe, siteChoisi, preparer, creerLien, lienEspace, noter, notifier, DUREE } from '../../../../../../src/server/espace.js';
import { gestionValide, GESTIONS } from '../../../../../../src/engine/espace.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const maintenant = () => new Date().toISOString();

// Réglages de départ choisis avec le client (il peut les changer ensuite depuis son espace)
function appliquerReglages(r, body, owner) {
  const e = espaceDe(r);
  if (typeof body.email === 'string') {
    const email = body.email.trim().slice(0, 120);
    if (email && !emailValide(email)) return 'Adresse e-mail du client invalide.';
    if (email !== e.email) noter(e, email ? `Adresse de connexion du client : ${email}` : 'Adresse de connexion du client retirée');
    e.email = email;
  }
  if (typeof body.gestion === 'string' && gestionValide(body.gestion) && !e.ouvertLe) {
    // Avant la première connexion seulement : ensuite, c'est le client qui choisit
    if (e.gestion !== body.gestion) noter(e, `Réglage de départ : « ${GESTIONS[body.gestion].titre} » (${owner})`);
    e.gestion = body.gestion;
    if (body.gestion === 'client') e.validation = false;
  }
  r.espace = e;
  return '';
}

export const POST = route(
  async (req, { id }) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    if (rateLimited('espace-agence:' + clientIp(req), 300)) return fail(429, 'Trop d’appels : réessaie dans une heure.', 'rate');
    const body = await readBody(req);
    const action = String(body?.action || '');
    const rec = await getClient(id);
    if (!rec) return fail(404, 'Dossier introuvable.', 'not_found');
    const settings = await getSettings();
    const owner = settings.ownerName || 'Alexandre';
    const origin = origine(req);
    const nom = rec.brief?.businessName || rec.name || 'votre site';

    switch (action) {
      case 'statut':
        return ok({ mail: mailStatus(), dureeInvitation: DUREE.invitation });

      case 'reglages': {
        let erreur = '';
        const client = await updateClient(id, (r) => {
          erreur = appliquerReglages(r, body, owner);
          return erreur ? null : r;
        });
        if (erreur) return fail(400, erreur, 'bad_request');
        return ok({ client });
      }

      // Nouveau lien d'invitation (le précédent ne marche plus). Le lien n'est montré qu'une fois.
      case 'inviter':
      case 'envoyer': {
        if (!siteChoisi(rec)) return fail(409, 'Le client doit d’abord avoir choisi son modèle.', 'not_ready');
        const envoi = action === 'envoyer';
        if (envoi && !mailPret()) return fail(503, 'Envoi d’e-mails pas branché : ajoute BREVO_API_KEY et EMAIL_FROM dans Vercel, ou copie le message.', 'mail_off');
        const texte = String(body.message || '');
        if (envoi && !texte.includes('{lien}')) return fail(400, 'Le message doit contenir {lien} : c’est là que le lien personnel du client sera placé.', 'bad_request');
        let erreur = '';
        let lien = null;
        const client = await updateClient(id, (r) => {
          erreur = appliquerReglages(r, body, owner);
          if (erreur) return null;
          preparer(r);
          const e = espaceDe(r);
          if (envoi && !emailValide(e.email)) {
            erreur = 'Indique l’adresse e-mail du client avant l’envoi.';
            return null;
          }
          lien = creerLien(e, 'invitation', 'agence');
          noter(e, envoi ? `Invitation envoyée par e-mail à ${e.email} (valable 7 jours)` : 'Lien d’invitation créé par l’agence (valable 7 jours)');
          r.espace = e;
          r.log = [...(r.log || []), { at: maintenant(), what: envoi ? 'Espace client : invitation envoyée par e-mail' : 'Espace client : lien d’invitation créé' }];
          return r;
        });
        if (erreur) return fail(400, erreur, 'bad_request');
        const url = lienEspace(origin, id, lien.jeton);
        if (!envoi) return ok({ client, lien: url, exp: lien.exp });
        const e = espaceDe(client);
        await envoyerMail({
          to: e.email,
          subject: String(body.sujet || `Votre site ${nom} est en ligne`).slice(0, 200),
          text: texte.replace(/\{lien\}/g, url).slice(0, 6000),
          replyTo: settings.email,
          fromName: settings.studioName,
        });
        const client2 = await updateClient(id, (r) => {
          r.checks = { ...(r.checks || {}), access: true };
          return r;
        });
        return ok({ client: client2, envoye: true, exp: lien.exp });
      }

      case 'couper': {
        const client = await updateClient(id, (r) => {
          const e = espaceDe(r);
          const n = e.appareils.length;
          e.appareils = [];
          e.liens = [];
          noter(e, `Accès coupé par ${owner} : ${n} appareil${n > 1 ? 's' : ''} déconnecté${n > 1 ? 's' : ''}, liens annulés`);
          r.espace = e;
          r.log = [...(r.log || []), { at: maintenant(), what: 'Espace client : tous les accès coupés' }];
          return r;
        });
        return ok({ client });
      }

      // Réponse à une demande : devis, ou incluse dans l'entretien
      case 'devis': {
        const inclus = body.inclus === true;
        const montant = Math.round(Number(String(body.montant || '').replace(',', '.').replace(/[^\d.]/g, '')) * 100) / 100;
        if (!inclus && !(montant > 0 && montant < 100000)) return fail(400, 'Indique un montant, par exemple 180,00.', 'bad_request');
        const note = String(body.note || '').trim().slice(0, 600);
        let d0 = null;
        const client = await updateClient(id, (r) => {
          const e = espaceDe(r);
          const d = e.demandes.find((x) => x.id === body.demande && x.statut === 'envoyee');
          if (!d) return null;
          Object.assign(d, inclus ? { statut: 'acceptee', inclus: true, accepteeLe: maintenant(), note } : { statut: 'devis', montant, devisLe: maintenant(), note });
          d0 = { ...d };
          noter(e, inclus ? `Demande incluse dans l’entretien : ${d.titre}` : `Devis envoyé : ${d.titre}`);
          r.espace = e;
          return r;
        });
        if (!d0) return fail(409, 'Cette demande a déjà reçu une réponse.', 'rien');
        const eur = montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        await notifier(
          { rec: client, settings },
          'client',
          inclus ? `Votre demande est prise en charge` : `Votre devis : ${d0.titre}`,
          inclus
            ? `Bonjour,\n\nVotre demande « ${d0.titre} » est incluse dans l’entretien de votre site, sans supplément. Je m’en occupe.${note ? `\n\n${note}` : ''}\n\n${owner}`
            : `Bonjour,\n\nVoici mon devis pour « ${d0.titre} » : ${eur} € HT.${note ? `\n\n${note}` : ''}\n\nVous pouvez l’accepter ou le refuser depuis votre espace, rubrique Demandes :\n${origin}/espace/${id}\n\n${owner}`
        );
        return ok({ client });
      }

      case 'terminer': {
        const note = String(body.note || '').trim().slice(0, 600);
        let d0 = null;
        const client = await updateClient(id, (r) => {
          const e = espaceDe(r);
          const d = e.demandes.find((x) => x.id === body.demande && ['acceptee', 'envoyee'].includes(x.statut));
          if (!d) return null;
          Object.assign(d, { statut: 'livree', livreeLe: maintenant(), reponse: note });
          d0 = { ...d };
          noter(e, `Demande terminée : ${d.titre}`);
          r.espace = e;
          return r;
        });
        if (!d0) return fail(409, 'Cette demande n’est plus en cours.', 'rien');
        await notifier({ rec: client, settings }, 'client', `C’est fait : ${d0.titre}`, `Bonjour,\n\nVotre demande « ${d0.titre} » est terminée.${note ? `\n\n${note}` : ''}\n\nVotre espace : ${origin}/espace/${id}\n\n${owner}`);
        return ok({ client });
      }

      default:
        return fail(400, 'Action inconnue.', 'bad_request');
    }
  },
  { agency: true }
);
