// Appli Devis & Factures : comptes et connexion sécurisée.
//
// 1. L'agence active l'appli dans le dossier du client : un lien d'invitation à usage unique
//    (7 jours, placé après le « # » de l'adresse : jamais envoyé au serveur ni dans un journal).
// 2. Le client ouvre le lien, crée son compte (e-mail + mot de passe) et relie son téléphone
//    (Google Authenticator), puis note 8 codes de secours.
// 3. Ensuite, sur chaque nouvel appareil : e-mail + mot de passe + code à 6 chiffres. L'appareil
//    reste reconnu 30 jours.
//
// Mots de passe : scrypt salé. Codes de secours : empreintes. Sessions : jeton signé (clé tirée
// du stockage privé) dans un cookie HttpOnly, Secure, SameSite=Strict limité à /api/devis,
// révocable (numéro de session « sv » et liste des appareils). 10 erreurs en 15 minutes :
// compte bloqué 15 minutes.
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { getDevisEspace, updateDevisEspace, getComptesDevis, updateComptesDevis, cleDevis, StoreError, widValide } from './store.js';
import { nouveauSecret, verifierCode, lienAppli, codeSecours, empreinteSecours, ressembleSecours } from './totp.js';
import { readCookie, safeEqual } from './http.js';
import { nomAppareil } from './espace.js';
import { emailOk } from '../engine/devis.js';

export const DUREE = { invitation: 7 * 86400e3, reinit: 30 * 60e3, session: 30 * 86400e3, etape: 15 * 60e3 };
const FENETRE_ECHECS = 15 * 60e3;
export const MAX_ECHECS = 10;
const NB_SECOURS = 8;
const MAX_APPAREILS = 10;
export const MDP_MIN = 10;

const maintenant = () => new Date().toISOString();
const aleatoire = (n = 32) => crypto.randomBytes(n).toString('base64url');
export const empreinte = (t) => crypto.createHash('sha256').update('studio-site-devis:' + t).digest('hex');
const empreinteEmail = (e) => crypto.createHash('sha256').update('studio-site-devis-email:' + String(e).trim().toLowerCase()).digest('hex');
const b64 = (x) => Buffer.from(x).toString('base64url');
const secure = () => (process.env.NODE_ENV === 'production' ? '; Secure' : '');

export function noterJournal(esp, txt) {
  esp.journal = [...(esp.journal || []), { at: maintenant(), txt: String(txt).slice(0, 200) }].slice(-300);
}

// ---------- Mots de passe ----------
const COUT = 32768; // scrypt N (2^15)
function scrypt(mdp, sel, N = COUT) {
  return new Promise((ok, ko) => crypto.scrypt(String(mdp).normalize('NFKC'), sel, 32, { N, r: 8, p: 1, maxmem: 96 * 1024 * 1024 }, (e, k) => (e ? ko(e) : ok(k))));
}
export async function hacherMdp(mdp) {
  const sel = crypto.randomBytes(16);
  const h = await scrypt(mdp, sel);
  return { s: b64(sel), h: b64(h), algo: `scrypt-${COUT}-8-1` };
}
const coutDe = (algo) => {
  const n = Number(/^scrypt-(\d+)-8-1$/.exec(String(algo || ''))?.[1]);
  return [16384, 32768, 65536].includes(n) ? n : COUT;
};
export async function verifierMdp(mdp, stocke) {
  if (!stocke?.s || !stocke?.h) {
    await scrypt(String(mdp || ''), crypto.randomBytes(16)); // même durée qu'un vrai contrôle
    return false;
  }
  const h = await scrypt(String(mdp || ''), Buffer.from(stocke.s, 'base64url'), coutDe(stocke.algo));
  const attendu = Buffer.from(stocke.h, 'base64url');
  return h.length === attendu.length && crypto.timingSafeEqual(h, attendu);
}
// Règles du mot de passe (affichées aussi dans l'appli)
export function problemeMdp(mdp, email = '') {
  const m = String(mdp || '');
  if (m.length < MDP_MIN) return `Le mot de passe doit faire au moins ${MDP_MIN} caractères.`;
  if (m.length > 200) return 'Mot de passe trop long (200 caractères au plus).';
  if (email && m.toLowerCase().includes(String(email).split('@')[0].toLowerCase()) && String(email).split('@')[0].length >= 4) return 'Le mot de passe ne doit pas contenir votre adresse e-mail.';
  if (/^(.)\1+$/.test(m) || /^(0123456789|1234567890|azertyuiop|qwertyuiop|motdepasse|password)/i.test(m)) return 'Ce mot de passe est trop facile à deviner.';
  return '';
}

// ---------- Jetons signés (cookies) ----------
async function signer(payload) {
  const k = await cleDevis();
  const corps = b64(JSON.stringify(payload));
  return `${corps}.${b64(crypto.createHmac('sha256', k).update(corps).digest())}`;
}
async function lireJeton(valeur, types) {
  const [corps, sig, reste] = String(valeur || '').split('.');
  if (!corps || !sig || reste !== undefined || valeur.length > 2000) return null;
  const k = await cleDevis();
  const attendu = crypto.createHmac('sha256', k).update(corps).digest();
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
  if (!p || !types.includes(p.t) || typeof p.exp !== 'number' || p.exp < Date.now() || !widValide(p.w)) return null;
  return p;
}

const COOKIE_S = 'devis_s';
const COOKIE_E = 'devis_e';
const CHEMIN = '/api/devis';
export async function cookieSession(w, a, sv) {
  const jeton = await signer({ t: 's', w, a, sv, exp: Date.now() + DUREE.session });
  return `${COOKIE_S}=${jeton}; Path=${CHEMIN}; HttpOnly; SameSite=Strict; Max-Age=${DUREE.session / 1000}${secure()}`;
}
export const effacerSession = () => `${COOKIE_S}=; Path=${CHEMIN}; HttpOnly; SameSite=Strict; Max-Age=0${secure()}`;
// Étape intermédiaire : t = inv (invitation acceptée), mdp (mot de passe vérifié, code attendu),
// enrol (téléphone à relier : secret en attente), reinit (lien « mot de passe oublié » ouvert),
// tel (changement de téléphone, session ouverte)
export async function cookieEtape(donnees) {
  const jeton = await signer({ ...donnees, exp: Date.now() + DUREE.etape });
  return `${COOKIE_E}=${jeton}; Path=${CHEMIN}; HttpOnly; SameSite=Strict; Max-Age=${DUREE.etape / 1000}${secure()}`;
}
export const effacerEtape = () => `${COOKIE_E}=; Path=${CHEMIN}; HttpOnly; SameSite=Strict; Max-Age=0${secure()}`;
export const lireEtape = (req, types) => lireJeton(readCookie(req, COOKIE_E), types);

// ---------- Invitation et réinitialisation ----------
export function creerInvitation(esp) {
  const jeton = aleatoire(32);
  const now = Date.now();
  esp.invitation = { h: empreinte(jeton), creeLe: new Date(now).toISOString(), exp: now + DUREE.invitation, utiliseeLe: null };
  return { jeton, exp: new Date(now + DUREE.invitation).toISOString() };
}
export const lienInvitation = (origin, w, jeton) => `${origin}/devis/bienvenue#${w}.${jeton}`;
export const lienReinit = (origin, w, jeton) => `${origin}/devis/reinitialiser#${w}.${jeton}`;

const jetonForme = (j) => typeof j === 'string' && j.length >= 40 && j.length <= 64 && /^[A-Za-z0-9_-]+$/.test(j);
export function etatInvitation(esp, jeton) {
  const inv = esp?.invitation;
  if (!esp?.actif || !inv || !jetonForme(jeton) || !safeEqual(inv.h, empreinte(jeton))) return 'invalide';
  if (inv.utiliseeLe) return 'utilisee';
  if (inv.exp < Date.now()) return 'expiree';
  if (esp.compte?.totp) return 'invalide';
  return 'ok';
}
export function etatReinit(esp, jeton) {
  const r = esp?.reinit;
  if (!esp?.actif || !r || !jetonForme(jeton) || !safeEqual(r.h, empreinte(jeton))) return 'invalide';
  if (r.exp < Date.now()) return 'expiree';
  return 'ok';
}
export function creerReinit(esp) {
  const jeton = aleatoire(32);
  esp.reinit = { h: empreinte(jeton), exp: Date.now() + DUREE.reinit };
  return jeton;
}

// ---------- Erreurs de connexion ----------
// Codes à 6 chiffres (après le mot de passe) : 10 erreurs en 15 minutes bloquent le compte.
// Mots de passe : 10 erreurs par adresse IP, 50 en tout, en 15 minutes (un inconnu ne peut pas
// bloquer à lui seul le propriétaire). Chaque erreur est enregistrée DANS la même écriture que
// le contrôle : des essais lancés en parallèle ne passent pas entre les mailles.
const MAX_ECHECS_MDP_TOTAL = 50;
const recents = (list) => (Array.isArray(list) ? list : []).filter((x) => new Date(typeof x === 'string' ? x : x?.t).getTime() > Date.now() - FENETRE_ECHECS);
const ipH = (ip) => empreinte('ip:' + String(ip || '')).slice(0, 16);
export const bloque = (esp) => recents(esp?.echecs).length >= MAX_ECHECS;
export function ajouterEchec(esp) {
  esp.echecs = [...recents(esp.echecs), maintenant()].slice(-MAX_ECHECS * 2);
}
export function bloqueMdp(esp, ip) {
  const r = recents(esp?.echecsMdp);
  return r.length >= MAX_ECHECS_MDP_TOTAL || r.filter((x) => x.ip === ipH(ip)).length >= MAX_ECHECS;
}
// Réserve un essai de mot de passe avant le contrôle (rendu si le mot de passe est bon)
export function reserverEssaiMdp(esp, ip) {
  esp.echecsMdp = [...recents(esp.echecsMdp), { t: maintenant(), ip: ipH(ip) }].slice(-MAX_ECHECS_MDP_TOTAL * 2);
}
export function rendreEssaiMdp(esp, ip) {
  esp.echecsMdp = recents(esp.echecsMdp).filter((x) => x.ip !== ipH(ip));
}
export function noterEchec(w) {
  return updateDevisEspace(w, (esp) => {
    ajouterEchec(esp);
    return esp;
  });
}
export const MSG_BLOQUE = 'Trop d’essais. Réessayez dans 15 minutes. Si ce n’est pas vous, changez votre mot de passe dès que possible.';

// Adresse des liens envoyés par e-mail : celle du site en production (fixée par Vercel), pas
// l'en-tête de la requête
export function origineLiens(origin) {
  const prod = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  return process.env.VERCEL_ENV === 'production' && /^[a-z0-9.-]+$/i.test(prod) ? `https://${prod}` : origin;
}

// ---------- E-mail de connexion (un seul compte par adresse) ----------
export async function espaceDeLEmail(email) {
  if (!emailOk(email)) return null;
  const idx = await getComptesDevis();
  const w = idx.emails[empreinteEmail(email)];
  return widValide(w) ? w : null;
}
export async function reserverEmail(email, w, ancien = '') {
  let pris = false;
  await updateComptesDevis((idx) => {
    const h = empreinteEmail(email);
    const deja = idx.emails[h];
    if (deja && deja !== w) {
      pris = true;
      return null;
    }
    const emails = { ...idx.emails, [h]: w };
    if (ancien && empreinteEmail(ancien) !== h && emails[empreinteEmail(ancien)] === w) delete emails[empreinteEmail(ancien)];
    return { ...idx, emails };
  });
  return !pris;
}
export async function libererEmail(email, w) {
  if (!email) return;
  await updateComptesDevis((idx) => {
    const h = empreinteEmail(email);
    if (idx.emails[h] !== w) return null;
    const emails = { ...idx.emails };
    delete emails[h];
    return { ...idx, emails };
  });
}

// ---------- Double authentification ----------
export async function preparerTelephone(esp) {
  const secret = nouveauSecret();
  const emetteur = (esp.entreprise?.nom || 'Devis & Factures').slice(0, 40);
  const lien = lienAppli(secret, { emetteur: `Devis ${emetteur}`.slice(0, 50), compte: esp.compte?.email || 'Devis & Factures' });
  const qr = await QRCode.toDataURL(lien, { margin: 1, width: 240, errorCorrectionLevel: 'M', color: { dark: '#16201c', light: '#ffffff' } });
  return { secret, lien, qr, secretLisible: secret.match(/.{1,4}/g).join(' ') };
}

function nouveauxSecours() {
  const codes = Array.from({ length: NB_SECOURS }, codeSecours);
  return { codes, stockes: codes.map((c) => ({ h: empreinteSecours(c), utiliseLe: null })) };
}

// Code de l'appli ou code de secours (dans une mise à jour de l'espace). Renvoie le résultat.
export function consommerCode(esp, code, { secoursPermis = true } = {}) {
  const c = esp.compte;
  if (!c?.totp?.secret) return { ok: false };
  if (secoursPermis && ressembleSecours(code)) {
    const h = empreinteSecours(code);
    const i = (c.secours || []).findIndex((x) => !x.utiliseLe && safeEqual(x.h, h));
    if (i < 0) return { ok: false };
    c.secours = c.secours.map((x, k) => (k === i ? { ...x, utiliseLe: maintenant() } : x));
    return { ok: true, secours: true, restants: c.secours.filter((x) => !x.utiliseLe).length };
  }
  const pas = verifierCode(c.totp.secret, code, { dernierPas: c.totp.dernierPas || 0 });
  if (!pas) return { ok: false };
  c.totp = { ...c.totp, dernierPas: pas };
  return { ok: true, secours: false };
}

// Relie le téléphone (premier, ou nouveau). Renvoie les codes de secours au premier passage.
export function enregistrerTelephone(esp, secret, code, { premier }) {
  const pas = verifierCode(secret, code, { dernierPas: 0 });
  if (!pas) return { ok: false };
  const c = esp.compte;
  c.totp = { secret, activeLe: maintenant(), dernierPas: pas };
  let codes = null;
  if (premier || !(c.secours || []).length) {
    const s = nouveauxSecours();
    c.secours = s.stockes;
    codes = s.codes;
  }
  esp.sv = (esp.sv || 1) + 1;
  esp.appareils = [];
  esp.echecs = [];
  return { ok: true, codes };
}
export function regenererSecours(esp) {
  const s = nouveauxSecours();
  esp.compte.secours = s.stockes;
  return s.codes;
}

// ---------- Appareils et sessions ----------
export function ajouterAppareil(esp, ua) {
  const a = { id: aleatoire(9), nom: nomAppareil(ua), creeLe: maintenant(), vuLe: maintenant() };
  esp.appareils = [...(esp.appareils || []), a].sort((x, y) => String(x.vuLe).localeCompare(String(y.vuLe))).slice(-MAX_APPAREILS);
  noterJournal(esp, `Connexion : ${a.nom}`);
  return a;
}

// Session de l'appli : { w, esp, appareil } ou null
export async function lireSession(req) {
  const p = await lireJeton(readCookie(req, COOKIE_S), ['s']);
  if (!p) return null;
  const esp = await getDevisEspace(p.w);
  if (!esp?.actif || !esp.compte?.totp || p.sv !== esp.sv) return null;
  const appareil = (esp.appareils || []).find((a) => a.id === p.a);
  if (!appareil) return null;
  // Dernière visite notée de temps en temps (pas à chaque appel)
  if (Date.now() - new Date(appareil.vuLe).getTime() > 6 * 3600e3) {
    updateDevisEspace(p.w, (e) => {
      const a = (e.appareils || []).find((x) => x.id === p.a);
      if (!a) return null;
      a.vuLe = maintenant();
      return e;
    }).catch(() => {});
  }
  return { w: p.w, esp, appareil };
}

export function exigerSession(s) {
  if (!s) throw new StoreError('Session expirée : reconnectez-vous.', 'unauthorized', 401);
  return s;
}

export function masquerEmail(s) {
  const [u, d] = String(s || '').split('@');
  if (!u || !d) return '';
  return `${u.slice(0, Math.min(2, u.length))}${'•'.repeat(Math.max(2, Math.min(6, u.length - 2)))}@${d}`;
}
