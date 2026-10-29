// Appli Devis & Factures d'un client, côté agence : activation de l'option, lien d'invitation,
// coupure de l'accès, réinitialisation du compte. L'agence ne voit jamais les devis, factures ni
// prix du client : seulement l'état de son accès et le nombre de documents.
import { route, ok, fail, readBody, memeOrigine, origine } from '../../../../../../src/server/http.js';
import { getClient, updateClient, getSettings, getDevisEspace, updateDevisEspace, creerDevisEspace, newId, widValide } from '../../../../../../src/server/store.js';
import { rateLimited, clientIp } from '../../../../../../src/server/config.js';
import { mailPret, envoyerMail } from '../../../../../../src/server/mail.js';
import { creerInvitation, lienInvitation, libererEmail, masquerEmail, noterJournal, origineLiens, DUREE } from '../../../../../../src/server/devisAcces.js';
import { entrepriseVide, nettoyerEntreprise, emailOk, FORMES, messageInvitation } from '../../../../../../src/engine/devis.js';
import { resumeEspace, supprimerAppli } from '../../../../../../src/server/devisAgence.js';
import { activerCalculateur } from '../../../../../../src/server/devisMetier.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const maintenant = () => new Date().toISOString();

// Informations déjà connues par le questionnaire : l'entreprise n'a plus qu'à vérifier
function entrepriseDepuisBrief(rec) {
  const b = rec.brief || {};
  const e = entrepriseVide();
  const rcs = String(b.rcs || '').trim();
  return nettoyerEntreprise({
    ...e,
    nom: b.legalName || b.businessName || rec.name || '',
    forme: FORMES.includes(b.legalForm) ? b.legalForm : '',
    capital: b.capital || '',
    adresse: b.siege || b.address || '',
    siret: b.siret || '',
    rcs: rcs ? (/^(RCS|RM)\b/i.test(rcs) ? rcs : `RCS ${rcs}`) : '',
    email: emailOk(b.email) ? b.email : emailOk(rec.contact) ? rec.contact : '',
    telephone: b.phone || '',
    site: rec.publication?.domain ? `https://${rec.publication.domain}` : rec.liveUrl || '',
  });
}

// Après une réinitialisation : le lien part seulement à l'adresse du propriétaire du compte,
// jamais affiché à l'agence (elle ne peut pas ouvrir à sa place l'espace et ses données)
function messageReinit({ nom, url, owner }) {
  return `Bonjour,

Votre accès à l’appli Devis & Factures${nom ? ` de ${nom}` : ''} a été réinitialisé à la demande de ${owner} (mot de passe et téléphone perdus). Vos devis, factures et produits sont conservés.

Pour recréer votre accès (e-mail, mot de passe, code du téléphone), ouvrez ce lien dans les 7 jours, sur votre téléphone :
${url}

Vous n’avez rien demandé ? N’ouvrez pas ce lien et contactez ${owner} tout de suite.

${owner}`;
}
async function envoyerAuProprietaire(esp, { url, nom, owner, settings }) {
  await envoyerMail({ to: esp.emailProprietaire, subject: `Devis & Factures : réinitialisation de votre accès${nom ? ` (${nom})` : ''}`, text: messageReinit({ nom, url, owner }), replyTo: settings.email, fromName: settings.studioName });
}

export const POST = route(
  async (req, { id }) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    if (rateLimited('devis-agence:' + clientIp(req), 300)) return fail(429, 'Trop d’appels : réessaie dans une heure.', 'rate');
    const body = await readBody(req);
    const action = String(body?.action || '');
    const rec = await getClient(id);
    if (!rec) return fail(404, 'Dossier introuvable.', 'not_found');
    const settings = await getSettings();
    const owner = settings.ownerName || 'Alexandre';
    const nom = rec.brief?.businessName || rec.name || '';
    const w = widValide(rec.appliDevis?.wid) ? rec.appliDevis.wid : null;
    const esp = w ? await getDevisEspace(w) : null;

    switch (action) {
      case 'statut':
        return ok({ appli: resumeEspace(esp), mail: mailPret(), option: rec.brief?.optionDevis || '' });

      // Active l'option (première fois) ou crée un nouveau lien d'invitation
      case 'inviter':
      case 'envoyer': {
        const envoi = action === 'envoyer';
        const email = String(body.email || '').trim();
        if (email && !emailOk(email)) return fail(400, 'Adresse e-mail du client invalide.', 'email');
        if (envoi && !mailPret()) return fail(503, 'Envoi d’e-mails pas branché : ajoute BREVO_API_KEY et EMAIL_FROM dans Vercel, ou copie le message.', 'mail_off');
        if (esp?.compte?.totp) return fail(409, 'Le client a déjà créé son compte. S’il a perdu son mot de passe et son téléphone : « Réinitialiser son compte ».', 'deja');
        if (envoi && !email && !esp?.emailProprietaire) return fail(400, 'Indique l’adresse e-mail du client.', 'email');
        // Espace déjà utilisé par le client : le nouveau lien part seulement à l'adresse de son compte
        if (esp?.emailProprietaire) {
          if (!mailPret()) return fail(503, 'Envoi d’e-mails pas branché : le nouveau lien ne peut partir qu’à l’adresse du compte du client (Brevo, document 17).', 'mail_off');
          let j = null;
          await updateDevisEspace(w, (e) => {
            j = creerInvitation(e);
            noterJournal(e, `Nouveau lien envoyé à l’adresse du compte (${owner})`);
            return e;
          });
          await envoyerAuProprietaire(esp, { url: lienInvitation(origineLiens(origine(req)), w, j.jeton), nom, owner, settings });
          const client = await updateClient(id, (r) => {
            r.log = [...(r.log || []), { at: maintenant(), what: 'Appli Devis : nouveau lien envoyé à l’adresse du compte du client' }];
            return r;
          });
          return ok({ client, appli: resumeEspace(await getDevisEspace(w)), lien: null, envoye: true, proprietaire: true, exp: j.exp, dureeJours: DUREE.invitation / 86400e3 });
        }
        let wid = w;
        let jeton = null;
        if (!esp) {
          wid = newId(18);
          const nouveau = { v: 1, id: wid, clientId: id, creeLe: maintenant(), actif: true, emailPropose: email, invitation: null, compte: null, sv: 1, echecs: [], appareils: [], reinit: null, entreprise: entrepriseDepuisBrief(rec), produits: [], compteurs: { devis: {}, factures: {} }, devis: [], factures: [], journal: [] };
          jeton = creerInvitation(nouveau);
          noterJournal(nouveau, `Appli activée par ${owner}`);
          await creerDevisEspace(wid, nouveau);
          await updateClient(id, (r) => {
            r.appliDevis = { wid, activeLe: maintenant() };
            r.log = [...(r.log || []), { at: maintenant(), what: 'Appli Devis & Factures activée' }];
            return r;
          });
        } else {
          await updateDevisEspace(wid, (e) => {
            jeton = creerInvitation(e);
            if (email) e.emailPropose = email;
            noterJournal(e, `Nouveau lien d’invitation (${owner})`);
            return e;
          });
        }
        const url = lienInvitation(origineLiens(origine(req)), wid, jeton.jeton);
        let envoye = false;
        if (envoi) {
          const texte = String(body.message || messageInvitation({ nom, lien: '{lien}', owner }));
          if (!texte.includes('{lien}')) return fail(400, 'Le message doit contenir {lien}.', 'bad_request');
          await envoyerMail({ to: email, subject: `Votre appli Devis & Factures${nom ? ` (${nom})` : ''}`, text: texte.replace(/\{lien\}/g, url).slice(0, 6000), replyTo: settings.email, fromName: settings.studioName });
          envoye = true;
        }
        const client = await updateClient(id, (r) => {
          r.log = [...(r.log || []), { at: maintenant(), what: envoye ? `Appli Devis : invitation envoyée à ${email}` : 'Appli Devis : lien d’invitation créé' }];
          return r;
        });
        return ok({ client, appli: resumeEspace(await getDevisEspace(wid)), lien: envoye ? null : url, envoye, exp: jeton.exp, dureeJours: DUREE.invitation / 86400e3 });
      }

      case 'couper':
      case 'retablir': {
        if (!esp) return fail(404, 'L’appli n’est pas activée pour ce client.', 'not_found');
        const couper = action === 'couper';
        const e2 = await updateDevisEspace(w, (e) => {
          e.actif = !couper;
          if (couper) {
            e.sv = (e.sv || 1) + 1;
            e.appareils = [];
            e.reinit = null;
          }
          noterJournal(e, couper ? `Accès suspendu par ${owner}` : `Accès rétabli par ${owner}`);
          return e;
        });
        const client = await updateClient(id, (r) => {
          r.log = [...(r.log || []), { at: maintenant(), what: couper ? 'Appli Devis : accès suspendu' : 'Appli Devis : accès rétabli' }];
          return r;
        });
        return ok({ client, appli: resumeEspace(e2) });
      }

      // Mot de passe et téléphone perdus : le compte est recréé avec un nouveau lien, les données restent
      case 'reinitialiser': {
        if (!esp?.compte) return fail(409, 'Le client n’a pas encore de compte : envoie-lui simplement un nouveau lien.', 'pas_de_compte');
        if (!mailPret()) return fail(503, 'Envoi d’e-mails pas branché : le nouveau lien ne peut partir qu’à l’adresse du compte du client (Brevo, document 17).', 'mail_off');
        const ancien = esp.compte.email;
        let jeton = null;
        await updateDevisEspace(w, (e) => {
          e.compte = null;
          e.sv = (e.sv || 1) + 1;
          e.appareils = [];
          e.echecs = [];
          e.reinit = null;
          e.actif = true;
          e.emailPropose = ancien;
          e.emailProprietaire = e.emailProprietaire || ancien;
          jeton = creerInvitation(e);
          noterJournal(e, `Compte réinitialisé par ${owner} : nouveau lien d’invitation`);
          return e;
        });
        await libererEmail(ancien, w);
        const client = await updateClient(id, (r) => {
          r.log = [...(r.log || []), { at: maintenant(), what: 'Appli Devis : compte réinitialisé (nouvelle invitation)' }];
          return r;
        });
        const e2 = await getDevisEspace(w);
        await envoyerAuProprietaire(e2, { url: lienInvitation(origineLiens(origine(req)), w, jeton.jeton), nom, owner, settings });
        return ok({ client, appli: resumeEspace(e2), lien: null, envoye: true, proprietaire: true, exp: jeton.exp });
      }

      // Calculateur d'estimation : activé ou coupé par l'agence (le client règle ses tarifs)
      case 'calculateur': {
        if (!esp) return fail(404, 'L’appli n’est pas activée pour ce client.', 'not_found');
        const actif = body.actif === true;
        const e2 = await updateDevisEspace(w, (e) => {
          activerCalculateur(e, { actif, modele: String(body.modele || '') });
          noterJournal(e, actif ? `Calculateur d’estimation activé par ${owner}` : `Calculateur d’estimation désactivé par ${owner}`);
          return e;
        });
        const client = await updateClient(id, (r) => {
          r.log = [...(r.log || []), { at: maintenant(), what: actif ? 'Appli Devis : calculateur d’estimation activé' : 'Appli Devis : calculateur d’estimation désactivé' }];
          return r;
        });
        return ok({ client, appli: resumeEspace(e2) });
      }

      // Suppression complète (compte, devis, factures, produits) : confirmée par le nom du client
      case 'supprimer': {
        if (!esp) return fail(404, 'L’appli n’est pas activée pour ce client.', 'not_found');
        if (body.confirme !== true) return fail(400, 'Confirme la suppression.', 'confirmation');
        await supprimerAppli(w, { clientId: id, qui: owner });
        return ok({ client: await getClient(id), appli: null, supprime: true });
      }

      default:
        return fail(400, 'Action inconnue.', 'bad_request');
    }
  },
  { agency: true }
);
