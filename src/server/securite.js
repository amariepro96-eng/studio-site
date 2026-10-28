// Accès à l'espace agence : mot de passe (AGENCY_PASSWORD) + code à 6 chiffres d'une appli
// d'authentification (Google Authenticator…). Le secret de l'appli et les codes de secours sont
// rangés dans le stockage privé (securite.json), jamais affichés après l'activation.
//
// Cookies (HttpOnly, signés avec une clé tirée du mot de passe agence) :
//   agence         session complète, 30 jours, révocable (numéro de session « sv »)
//   agence_etape   étape intermédiaire de 10 minutes : mot de passe vérifié, code attendu
//
// Téléphone perdu sans codes de secours : variable Vercel AGENCY_2FA_RESET (une valeur nouvelle,
// par exemple la date du jour), puis Redeploy. À la connexion suivante, le mot de passe suffit pour
// relier un nouveau téléphone ; la variable peut ensuite rester ou être supprimée.
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { config } from './config.js';
import { getSecurite, updateSecurite, storageMode, getSettings } from './store.js';
import { nouveauSecret, verifierCode, lienAppli, codeSecours, empreinteSecours, ressembleSecours, pasActuel } from './totp.js';
import { mailPret, envoyerMail, emailValide } from './mail.js';

export const DUREE_SESSION = 30 * 24 * 3600; // secondes
const DUREE_ETAPE = 10 * 60;
const FENETRE_ECHECS = 15 * 60_000;
export const MAX_ECHECS = 10;
export const NB_SECOURS = 8;

const resetDemande = () => (process.env.AGENCY_2FA_RESET || '').trim();

// ---------- Jetons signés ----------
function cle() {
  const { agencyPassword } = config();
  return crypto.createHash('sha256').update('studio-site-session:v2:' + agencyPassword).digest();
}
const b64 = (buf) => Buffer.from(buf).toString('base64url');

export function signer(payload) {
  const corps = b64(JSON.stringify(payload));
  const sig = b64(crypto.createHmac('sha256', cle()).update(corps).digest());
  return `${corps}.${sig}`;
}

export function lireJeton(valeur, type) {
  const [corps, sig, reste] = String(valeur || '').split('.');
  if (!corps || !sig || reste !== undefined) return null;
  const attendu = crypto.createHmac('sha256', cle()).update(corps).digest();
  let recu;
  try {
    recu = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (recu.length !== attendu.length || !crypto.timingSafeEqual(recu, attendu)) return null;
  let p;
  try {
    p = JSON.parse(Buffer.from(corps, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!p || p.t !== type || typeof p.exp !== 'number' || p.exp * 1000 < Date.now()) return null;
  return p;
}

const secure = () => (process.env.NODE_ENV === 'production' ? '; Secure' : '');
export function cookieSession(sv) {
  const now = Math.floor(Date.now() / 1000);
  const jeton = signer({ t: 's', sv, iat: now, exp: now + DUREE_SESSION, n: b64(crypto.randomBytes(9)) });
  return `agence=${jeton}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DUREE_SESSION}${secure()}`;
}
export function cookieEtape(donnees = {}) {
  const now = Math.floor(Date.now() / 1000);
  const jeton = signer({ t: 'p', exp: now + DUREE_ETAPE, ...donnees });
  return `agence_etape=${jeton}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${DUREE_ETAPE}${secure()}`;
}
// Changement de téléphone (session déjà ouverte) : nouveau secret en attente de confirmation
export function cookieChangement(secret) {
  const now = Math.floor(Date.now() / 1000);
  const jeton = signer({ t: 'c', exp: now + DUREE_ETAPE, enrol: secret });
  return `agence_tel=${jeton}; Path=/api/agence/securite; HttpOnly; SameSite=Strict; Max-Age=${DUREE_ETAPE}${secure()}`;
}
export const effacerChangement = () => `agence_tel=; Path=/api/agence/securite; HttpOnly; SameSite=Strict; Max-Age=0${secure()}`;
export const effacerSession = () => `agence=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure()}`;
export const effacerEtape = () => `agence_etape=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure()}`;

// ---------- État de la double authentification ----------
// Mémoire courte : évite de relire le stockage à chaque appel (révocation visible en 15 s au plus)
let memo = { at: 0, sec: null };
export async function securite({ frais = false } = {}) {
  if (!frais && memo.sec && Date.now() - memo.at < 15_000) return memo.sec;
  const sec = await getSecurite();
  memo = { at: Date.now(), sec };
  return sec;
}
function retenir(sec) {
  memo = { at: Date.now(), sec };
  return sec;
}

// Double authentification exigée ? (pas de stockage = rien à protéger, et rien où ranger le secret)
export const doubleFacteurPossible = () => storageMode() !== 'none';

export function doubleFacteurActif(sec) {
  if (!sec?.totp?.secret) return false;
  const reset = resetDemande();
  return !(reset && sec.totp.reset !== reset);
}

// ---------- Contrôle d'une session ----------
export async function sessionValide(valeurCookie) {
  const { agencyPassword } = config();
  if (!agencyPassword) return !process.env.VERCEL;
  const p = lireJeton(valeurCookie, 's');
  if (!p) return false;
  // Sans stockage, aucune double authentification possible : accepté seulement en local (npm run dev)
  if (!doubleFacteurPossible()) return !process.env.VERCEL && p.sv === 0;
  try {
    // Mémoire courte d'abord ; en cas de refus, relecture fraîche (connexion ouverte à l'instant
    // par une autre fonction du serveur, dont cette copie n'a pas encore la trace)
    let sec = await securite();
    if (doubleFacteurActif(sec) && p.sv === sec.sv) return true;
    sec = await securite({ frais: true });
    return doubleFacteurActif(sec) && p.sv === sec.sv;
  } catch {
    return false; // stockage illisible : on refuse plutôt que d'ouvrir
  }
}

// ---------- Codes ----------
function echecsRecents(sec) {
  const limite = Date.now() - FENETRE_ECHECS;
  return (sec.echecs || []).filter((t) => new Date(t).getTime() > limite);
}
export function bloque(sec) {
  return echecsRecents(sec).length >= MAX_ECHECS;
}

export async function noterEchec() {
  const sec = await updateSecurite((s) => ({ ...s, echecs: [...echecsRecents(s), new Date().toISOString()].slice(-MAX_ECHECS * 2) }));
  return retenir(sec);
}

// Code de l'appli ou code de secours, pour la session en cours d'ouverture.
// Renvoie { ok, secours, restants } ; le code accepté ne pourra plus resservir.
export async function consommerCode(code) {
  let resultat = { ok: false };
  const sec = await updateSecurite((s) => {
    resultat = { ok: false };
    if (!doubleFacteurActif(s) || bloque(s)) return null;
    if (ressembleSecours(code)) {
      const h = empreinteSecours(code);
      const i = (s.secours || []).findIndex((x) => !x.utiliseLe && x.h.length === h.length && crypto.timingSafeEqual(Buffer.from(x.h), Buffer.from(h)));
      if (i < 0) return null;
      const secours = s.secours.map((x, k) => (k === i ? { ...x, utiliseLe: new Date().toISOString() } : x));
      resultat = { ok: true, secours: true, restants: secours.filter((x) => !x.utiliseLe).length };
      return { ...s, secours };
    }
    const pas = verifierCode(s.totp.secret, code, { dernierPas: s.totp.dernierPas || 0 });
    if (!pas) return null;
    resultat = { ok: true, secours: false };
    return { ...s, totp: { ...s.totp, dernierPas: pas } };
  });
  retenir(sec);
  return { ...resultat, sv: sec.sv, bloque: bloque(sec) };
}

// ---------- Activation (premier téléphone, ou nouveau téléphone) ----------
export async function preparerActivation() {
  const secret = nouveauSecret();
  let emetteur = 'Studio Site';
  try {
    emetteur = (await getSettings()).studioName || emetteur;
  } catch {}
  const lien = lienAppli(secret, { emetteur });
  const qr = await QRCode.toDataURL(lien, { margin: 1, width: 240, errorCorrectionLevel: 'M', color: { dark: '#16201c', light: '#ffffff' } });
  return { secret, lien, qr, secretLisible: secret.match(/.{1,4}/g).join(' ') };
}

function nouveauxSecours() {
  const codes = Array.from({ length: NB_SECOURS }, codeSecours);
  return { codes, stockes: codes.map((c) => ({ h: empreinteSecours(c), utiliseLe: null })) };
}

// premier = true : aucun téléphone relié (ou réinitialisation demandée). Sinon : changement de téléphone.
// Toutes les autres sessions sont fermées (nouveau numéro de session).
export async function activer(secret, code, { premier }) {
  const pas = verifierCode(secret, code, { dernierPas: 0 });
  if (!pas) return { ok: false, raison: 'code' };
  let resultat = { ok: false, raison: 'deja' };
  const { codes, stockes } = nouveauxSecours();
  const sec = await updateSecurite((s) => {
    if (premier && doubleFacteurActif(s)) {
      resultat = { ok: false, raison: 'deja' };
      return null;
    }
    if (!premier && !doubleFacteurActif(s)) {
      resultat = { ok: false, raison: 'inactif' };
      return null;
    }
    resultat = { ok: true, codes: premier ? codes : null };
    return {
      ...s,
      totp: { secret, activeLe: new Date().toISOString(), reset: resetDemande(), dernierPas: pas },
      secours: premier ? stockes : s.secours,
      sv: (s.sv || 1) + 1,
      echecs: [],
    };
  });
  retenir(sec);
  return { ...resultat, sv: sec.sv };
}

// Code de l'appli seul (actions sensibles dans les réglages, session déjà ouverte)
export async function verifierCodeAppli(code) {
  let ok = false;
  const sec = await updateSecurite((s) => {
    ok = false;
    if (!doubleFacteurActif(s) || bloque(s)) return null;
    const pas = verifierCode(s.totp.secret, code, { dernierPas: s.totp.dernierPas || 0 });
    if (!pas) return null;
    ok = true;
    return { ...s, totp: { ...s.totp, dernierPas: pas } };
  });
  retenir(sec);
  return ok;
}

export async function regenererSecours() {
  const { codes, stockes } = nouveauxSecours();
  const sec = await updateSecurite((s) => ({ ...s, secours: stockes }));
  retenir(sec);
  return codes;
}

export async function deconnecterTout() {
  const sec = await updateSecurite((s) => ({ ...s, sv: (s.sv || 1) + 1 }));
  retenir(sec);
  return sec.sv;
}

// Résumé pour les réglages (jamais le secret ni les empreintes)
export function vueSecurite(sec) {
  const actif = doubleFacteurActif(sec);
  const secours = sec?.secours || [];
  return {
    possible: doubleFacteurPossible(),
    actif,
    activeLe: actif ? sec.totp.activeLe : null,
    secoursRestants: secours.filter((x) => !x.utiliseLe).length,
    secoursTotal: secours.length,
    resetEnAttente: Boolean(sec?.totp?.secret && !actif),
    pasActuel: pasActuel(),
  };
}

// Alerte par e-mail (si Brevo est branché) quand un téléphone est relié : si ce n'est pas toi,
// tu le sais tout de suite. Ne bloque jamais la connexion.
export async function prevenirTelephoneRelie(quoi = 'relié') {
  try {
    if (!mailPret()) return;
    const s = await getSettings();
    if (!emailValide(s.email)) return;
    const quand = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' });
    await envoyerMail({
      to: s.email,
      subject: `${s.studioName || 'Studio Site'} : téléphone ${quoi} à la connexion sécurisée`,
      text: `Bonjour,\n\nUn téléphone vient d’être ${quoi} à la double authentification de ton espace agence, le ${quand}.\n\nC’est toi : rien à faire.\n\nCe n’est pas toi : quelqu’un connaît ton mot de passe agence. Dans Vercel, change tout de suite AGENCY_PASSWORD, ajoute ou modifie AGENCY_2FA_RESET avec une nouvelle valeur, puis Redeploy et relie ton téléphone (document 10, §J et §Q).\n\n${s.studioName || 'Studio Site'}`,
      fromName: s.studioName,
    });
  } catch (e) {
    console.warn('[securite] alerte e-mail', e?.message);
  }
}
