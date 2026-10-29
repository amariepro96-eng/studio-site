// Appli Devis & Factures : invitation, création du compte, connexion (e-mail + mot de passe +
// code à 6 chiffres), mot de passe oublié, déconnexion.
import { route, fail, readBody, memeOrigine, origine, enHttps } from '../../../../src/server/http.js';
import { getDevisEspace, updateDevisEspace, updateClient, getClient, widValide } from '../../../../src/server/store.js';
import { oublierAppareilsCompte, cookieEfface } from '../../../../src/server/espace.js';
import { rateLimited, clientIp } from '../../../../src/server/config.js';
import { mailPret, envoyerMail } from '../../../../src/server/mail.js';
import {
  lireSession,
  lireEtape,
  cookieEtape,
  effacerEtape,
  cookieSession,
  effacerSession,
  etatInvitation,
  etatReinit,
  creerReinit,
  lienReinit,
  espaceDeLEmail,
  reserverEmail,
  hacherMdp,
  verifierMdp,
  problemeMdp,
  preparerTelephone,
  enregistrerTelephone,
  consommerCode,
  ajouterAppareil,
  ajouterEchec,
  bloque,
  bloqueMdp,
  reserverEssaiMdp,
  rendreEssaiMdp,
  MSG_BLOQUE,
  noterJournal,
  origineLiens,
} from '../../../../src/server/devisAcces.js';
import { emailOk } from '../../../../src/engine/devis.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reponse(data, { status = 200, cookies = [] } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  for (const c of cookies) if (c) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(data), { status, headers });
}
// Même message pour un e-mail inconnu, un mauvais mot de passe ou trop d'essais (rien ne trahit un compte)
const MSG_CONNEXION = 'E-mail ou mot de passe incorrect. Après plusieurs erreurs, attendez 15 minutes avant de réessayer.';
const MSG_ETAPE = 'Étape expirée : recommencez.';
const MSG_SUSPENDU = 'L’accès à cette appli est suspendu. Contactez votre prestataire.';
const lienValide = (w, j) => widValide(w) && typeof j === 'string';

async function ouvrirSession(w, ua, extra = {}, etapeAEffacer = true) {
  let appareil = null;
  const esp = await updateDevisEspace(w, (e) => {
    appareil = ajouterAppareil(e, ua);
    return e;
  });
  const cookies = [await cookieSession(w, appareil.id, esp.sv)];
  if (etapeAEffacer) cookies.push(effacerEtape());
  return reponse({ ok: true, ...extra }, { cookies });
}

export const GET = route(async (req) => {
  const s = await lireSession(req);
  return reponse({ connecte: Boolean(s), mail: mailPret() });
});

export const POST = route(async (req) => {
  if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
  const ip = clientIp(req);
  if (rateLimited('devis-acces:' + ip, 150)) return fail(429, 'Trop d’essais depuis cette connexion : réessayez dans une heure.', 'rate');
  const body = await readBody(req);
  const action = String(body?.action || '');
  const ua = req.headers.get('user-agent') || '';

  switch (action) {
    // Lien d'invitation : affiché sans être consommé (un analyseur de liens ne le grille pas)
    case 'apercu': {
      if (!lienValide(body.w, body.jeton)) return reponse({ etat: 'invalide' });
      const esp = await getDevisEspace(body.w);
      const etat = etatInvitation(esp, body.jeton);
      return reponse({ etat, nom: etat === 'ok' || etat === 'expiree' ? esp.entreprise?.nom || '' : '' });
    }

    case 'invitation': {
      if (!lienValide(body.w, body.jeton)) return fail(400, 'Lien invalide.', 'invalide');
      let etat = 'invalide';
      let esp = null;
      await updateDevisEspace(body.w, (e) => {
        etat = etatInvitation(e, body.jeton);
        if (etat !== 'ok') return null;
        e.invitation = { ...e.invitation, utiliseeLe: new Date().toISOString() };
        noterJournal(e, 'Lien d’invitation ouvert');
        esp = e;
        return e;
      });
      if (etat !== 'ok') return fail(410, etat === 'expiree' ? 'Ce lien a expiré : demandez-en un nouveau à votre prestataire.' : 'Ce lien ne fonctionne plus : il a déjà servi, ou un nouveau lien l’a remplacé. Demandez-en un nouveau à votre prestataire.', etat);
      return reponse({ ok: true, nom: esp.entreprise?.nom || '', email: esp.emailPropose || '' }, { cookies: [await cookieEtape({ t: 'inv', w: body.w, ih: esp.invitation.h })] });
    }

    case 'creer': {
      const et = await lireEtape(req, ['inv']);
      if (!et) return fail(401, MSG_ETAPE, 'etape');
      const email = String(body.email || '').trim().toLowerCase();
      if (!emailOk(email)) return fail(400, 'Adresse e-mail invalide.', 'email');
      const pb = problemeMdp(body.mdp, email);
      if (pb) return fail(400, pb, 'mdp');
      // L'étape n'est valable que pour l'invitation en cours (pas après un nouveau lien ou une réinitialisation)
      const invOk = (e) => Boolean(e?.actif && et.ih && e.invitation?.h === et.ih && !e.compte?.totp);
      const esp0 = await getDevisEspace(et.w);
      if (!esp0?.actif) return fail(403, MSG_SUSPENDU, 'suspendu');
      if (esp0.compte?.totp) return fail(409, 'Le compte existe déjà : connectez-vous.', 'deja');
      if (!invOk(esp0)) return fail(401, 'Ce lien a été remplacé : ouvrez le dernier lien reçu.', 'etape');
      if (!(await reserverEmail(email, et.w, esp0.compte?.email || ''))) return fail(409, 'Cette adresse e-mail sert déjà à un autre compte Devis & Factures. Utilisez-en une autre.', 'email_pris');
      const mdp = await hacherMdp(body.mdp);
      let cree = false;
      const esp = await updateDevisEspace(et.w, (e) => {
        if (!invOk(e)) return null;
        e.compte = { email, mdp, totp: null, secours: [], creeLe: new Date().toISOString() };
        noterJournal(e, 'Compte créé');
        cree = true;
        return e;
      });
      if (!cree) return fail(401, 'Ce lien a été remplacé : ouvrez le dernier lien reçu.', 'etape');
      const tel = await preparerTelephone(esp);
      return reponse({ ok: true, telephone: { qr: tel.qr, lien: tel.lien, secret: tel.secretLisible } }, { cookies: [await cookieEtape({ t: 'enrol', w: et.w, enrol: tel.secret, premier: true })] });
    }

    case 'connexion': {
      if (rateLimited('devis-connexion:' + ip, 40)) return fail(429, 'Trop d’essais depuis cette connexion : réessayez dans une heure.', 'rate');
      const email = String(body.email || '').trim();
      const w = await espaceDeLEmail(email);
      // L'essai est compté AVANT le contrôle, dans une écriture protégée : au plus 10 essais par
      // adresse IP (50 en tout) toutes les 15 minutes, même avec des essais lancés en parallèle
      let esp = null;
      if (w) {
        try {
          await updateDevisEspace(w, (e) => {
            if (bloqueMdp(e, ip)) return null;
            reserverEssaiMdp(e, ip);
            esp = e;
            return e;
          });
        } catch {
          esp = null;
        }
      }
      const bon = await verifierMdp(body.mdp, esp?.compte?.email?.toLowerCase() === email.toLowerCase() ? esp.compte.mdp : null);
      if (!esp || !bon) return fail(401, MSG_CONNEXION, 'identifiants');
      await updateDevisEspace(w, (e) => {
        rendreEssaiMdp(e, ip);
        return e;
      }).catch(() => null);
      if (!esp.actif) return fail(403, MSG_SUSPENDU, 'suspendu');
      if (!esp.compte.totp) {
        const tel = await preparerTelephone(esp);
        return reponse({ ok: false, suite: 'telephone', telephone: { qr: tel.qr, lien: tel.lien, secret: tel.secretLisible } }, { cookies: [await cookieEtape({ t: 'enrol', w, enrol: tel.secret, premier: true })] });
      }
      return reponse({ ok: false, suite: 'code' }, { cookies: [await cookieEtape({ t: 'mdp', w, sv: esp.sv || 1 })] });
    }

    case 'code': {
      const et = await lireEtape(req, ['mdp']);
      if (!et) return fail(401, MSG_ETAPE, 'etape');
      let res = { ok: false };
      let deja = false;
      let perime = false;
      // Contrôle du code et enregistrement de l'erreur dans la même écriture
      await updateDevisEspace(et.w, (e) => {
        res = { ok: false };
        deja = false;
        perime = false;
        if ((e.sv || 1) !== et.sv) {
          perime = true;
          return null;
        }
        if (!e.actif || bloque(e)) {
          deja = true;
          return null;
        }
        res = consommerCode(e, body.code);
        if (res.ok && res.secours) noterJournal(e, `Connexion avec un code de secours (reste ${res.restants})`);
        if (!res.ok) ajouterEchec(e);
        return e;
      });
      if (perime) return fail(401, MSG_ETAPE, 'etape');
      if (deja) return fail(429, MSG_BLOQUE, 'bloque');
      if (!res.ok) {
        return fail(401, 'Code incorrect. Saisissez le code affiché maintenant dans Google Authenticator (il change toutes les 30 secondes).', 'code');
      }
      return ouvrirSession(et.w, ua, { secours: Boolean(res.secours), restants: res.restants });
    }

    case 'activer': {
      const et = await lireEtape(req, ['enrol']);
      if (!et?.enrol) return fail(401, MSG_ETAPE, 'etape');
      let res = { ok: false };
      await updateDevisEspace(et.w, (e) => {
        if (!e.actif || !e.compte || (et.premier && e.compte.totp)) return null;
        res = enregistrerTelephone(e, et.enrol, body.code, { premier: true });
        if (res.ok) {
          noterJournal(e, 'Téléphone relié (double authentification active)');
          // Adresse du propriétaire : les liens de secours ne partiront plus qu'à elle
          e.emailProprietaire = e.compte.email;
        }
        return res.ok ? e : null;
      });
      if (!res.ok) return fail(401, 'Code incorrect. Saisissez le code affiché maintenant dans l’appli (il change toutes les 30 secondes).', 'code');
      return ouvrirSession(et.w, ua, { codesSecours: res.codes || [] });
    }

    // Mot de passe oublié : même réponse, que le compte existe ou non
    case 'oubli': {
      if (rateLimited('devis-oubli:' + ip, 8)) return fail(429, 'Trop de demandes : réessayez dans une heure.', 'rate');
      if (!mailPret()) return reponse({ ok: true, sansEmail: true });
      const email = String(body.email || '').trim();
      const w = await espaceDeLEmail(email);
      if (w) {
        let jeton = '';
        const esp = await updateDevisEspace(w, (e) => {
          if (!e.actif || !e.compte?.totp || e.compte.email.toLowerCase() !== email.toLowerCase()) return null;
          jeton = creerReinit(e);
          noterJournal(e, 'Lien « mot de passe oublié » envoyé');
          return e;
        });
        if (jeton) {
          try {
            await envoyerMail({
              to: esp.compte.email,
              subject: 'Devis & Factures : nouveau mot de passe',
              text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien dans les 30 minutes :\n${lienReinit(origineLiens(origine(req)), w, jeton)}\n\nVous aurez besoin du code de Google Authenticator (ou d’un code de secours).\n\nVous n’avez rien demandé ? Ignorez cet e-mail : votre mot de passe ne change pas.\n\nDevis & Factures`,
              fromName: 'Devis & Factures',
            });
          } catch (e) {
            console.warn('[devis] oubli', e?.code || e?.message);
          }
        }
      }
      return reponse({ ok: true });
    }

    case 'reinit.apercu': {
      if (!lienValide(body.w, body.jeton)) return reponse({ etat: 'invalide' });
      const esp = await getDevisEspace(body.w);
      return reponse({ etat: etatReinit(esp, body.jeton) });
    }

    case 'reinitialiser': {
      if (!lienValide(body.w, body.jeton)) return fail(400, 'Lien invalide.', 'invalide');
      const esp0 = await getDevisEspace(body.w);
      const etat = etatReinit(esp0, body.jeton);
      if (etat !== 'ok') return fail(410, etat === 'expiree' ? 'Ce lien a expiré (30 minutes) : refaites « Mot de passe oublié ».' : 'Ce lien ne fonctionne plus : refaites « Mot de passe oublié ».', etat);
      if (bloque(esp0)) return fail(429, MSG_BLOQUE, 'bloque');
      const pb = problemeMdp(body.mdp, esp0.compte?.email);
      if (pb) return fail(400, pb, 'mdp');
      const mdp = await hacherMdp(body.mdp);
      let res = { ok: false };
      await updateDevisEspace(body.w, (e) => {
        res = { ok: false };
        if (etatReinit(e, body.jeton) !== 'ok' || bloque(e)) return null;
        res = consommerCode(e, body.code);
        if (!res.ok) {
          ajouterEchec(e);
          return e;
        }
        e.compte.mdp = mdp;
        e.compte.mdpChangeLe = new Date().toISOString();
        e.reinit = null;
        e.sv = (e.sv || 1) + 1;
        e.appareils = [];
        e.echecs = [];
        noterJournal(e, 'Mot de passe changé (lien « mot de passe oublié ») : tous les appareils déconnectés');
        return e;
      });
      if (!res.ok) {
        if (bloque(await getDevisEspace(body.w))) return fail(429, MSG_BLOQUE, 'bloque');
        return fail(401, 'Code incorrect. Saisissez le code affiché maintenant dans Google Authenticator, ou un code de secours.', 'code');
      }
      return ouvrirSession(body.w, ua, { secours: Boolean(res.secours), restants: res.restants });
    }

    case 'deconnexion': {
      const s = await lireSession(req);
      const cookies = [effacerSession(), effacerEtape()];
      if (s) {
        await updateDevisEspace(s.w, (e) => {
          e.appareils = (e.appareils || []).filter((a) => a.id !== s.appareil.id);
          noterJournal(e, `Déconnexion : ${s.appareil.nom}`);
          return e;
        });
        // Couper aussi l'accès « Mon site » ouvert depuis ce compte
        const cid = s.esp?.clientId;
        if (cid) {
          try {
            if (await getClient(cid)) await updateClient(cid, (rec) => (oublierAppareilsCompte(rec) ? rec : null));
            cookies.push(cookieEfface(cid, enHttps(req)));
          } catch {}
        }
      }
      return reponse({ ok: true }, { cookies });
    }

    default:
      return fail(400, 'Action inconnue.', 'bad_request');
  }
});
