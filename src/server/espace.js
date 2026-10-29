// Espace client d'un site en ligne : accès sécurisé, modifications, publication.
//
// Accès
//  - Lien personnel à usage unique : 32 octets aléatoires placés après le « # » de l'adresse.
//    Le navigateur n'envoie jamais cette partie au serveur : elle n'apparaît dans aucun journal.
//    Seule son empreinte (SHA-256) est enregistrée dans le dossier.
//  - Le client clique « Ouvrir mon espace » (un logiciel qui analyse les liens d'un e-mail ne le
//    consomme donc pas) : le lien est détruit et l'appareil reçoit sa propre clé de session,
//    dans un cookie HttpOnly, Secure, SameSite=Strict, limité aux adresses de son espace.
//  - Invitation valable 7 jours ; lien pour un autre appareil ou reçu par e-mail : 15 minutes.
//  - Chaque appareil se retire séparément ; l'agence peut tout couper d'un clic.
// Modifications
//  - Le client ne change que des valeurs (horaires, prix, statuts, annonces, photos) : le site
//    est reconstruit par le moteur avec les blocs de son modèle, jamais avec du HTML reçu.
//  - Le serveur refait tous les contrôles, fusionne avec les changements faits entre-temps,
//    garde chaque version (retour en arrière possible) et limite les publications par jour.
import crypto from 'node:crypto';
import { readCookie, safeEqual, isAgency } from './http.js';
import { mailPret, envoyerMail, emailValide } from './mail.js';
import { editable, nettoyer, appliquer, fusion3, resume, assurerIds, aujourdhui, peutModifier, gestionValide, LIMITE_JOUR, memeEtat, RAISONS_ATTENTE } from '../engine/espace.js';
import { servicesLabel } from '../engine/render.js';
import { PAGES } from '../engine/questions.js';

export const DUREE = { invitation: 7 * 86400e3, appareil: 15 * 60e3, email: 15 * 60e3, session: 180 * 86400e3 };
const MAX_APPAREILS = 8;

export const nomCookie = (id) => `esp_${id}`;
export const cheminCookie = (id) => `/api/espace/${id}`;
const aleatoire = (n = 32) => crypto.randomBytes(n).toString('base64url');
const empreinte = (t) => crypto.createHash('sha256').update('studio-site-espace:' + t).digest('hex');
const maintenant = () => new Date().toISOString();

// ---------- Données de l'espace dans le dossier ----------
export function espaceDe(r) {
  const e = r?.espace || {};
  return {
    creeLe: e.creeLe || null,
    ouvertLe: e.ouvertLe || null,
    email: typeof e.email === 'string' ? e.email : '',
    gestion: gestionValide(e.gestion) ? e.gestion : 'client',
    validation: e.validation === true,
    liens: Array.isArray(e.liens) ? e.liens : [],
    appareils: Array.isArray(e.appareils) ? e.appareils : [],
    versions: Array.isArray(e.versions) ? e.versions : [],
    aPublier: e.aPublier || null,
    proposition: e.proposition || null,
    demandes: Array.isArray(e.demandes) ? e.demandes : [],
    journal: Array.isArray(e.journal) ? e.journal : [],
    pubs: Array.isArray(e.pubs) ? e.pubs : [],
    images: Array.isArray(e.images) ? e.images : [],
    invitation: e.invitation || null,
  };
}

export function noter(e, txt) {
  e.journal = [...e.journal, { at: maintenant(), txt: String(txt).slice(0, 220) }].slice(-80);
}

export const espaceActif = (r) => Boolean(r?.espace?.creeLe);
export const siteChoisi = (r) => Boolean(r?.result?.content && r?.result?.models?.some((m) => m.id === r?.choice?.modelId));

// Identifiants durables des services et produits, et première version (le site tel que livré)
export function preparer(r, { par = 'agence' } = {}) {
  const e = espaceDe(r);
  let change = false;
  if (r.result?.content) {
    const { content, change: c } = assurerIds(r.result.content);
    if (c) {
      r.result = { ...r.result, content };
      change = true;
    }
  }
  if (!e.creeLe) {
    e.creeLe = maintenant();
    change = true;
  }
  if (!e.versions.length && r.result?.content) {
    e.versions = [{ v: 1, at: r.publication?.publishedAt || r.liveAt || maintenant(), par, resume: ['Site livré'], etat: etatActuel(r) }];
    change = true;
  }
  if (!e.email) {
    const contact = String(r.contact || '').trim();
    e.email = emailValide(contact) ? contact : emailValide(r.brief?.email) ? r.brief.email.trim() : '';
    if (e.email) change = true;
  }
  r.espace = e;
  return change;
}

export const dossierDe = (r) => ({ brief: r.brief || {}, content: r.result?.content || {}, aiImages: r.aiImages || [] });

// ---------- Liens à usage unique ----------
export function creerLien(e, type, par) {
  const jeton = aleatoire(32);
  const now = Date.now();
  // Un seul lien d'invitation valable à la fois : en créer un nouveau annule le précédent
  e.liens = e.liens.filter((l) => l.exp > now && !(type === 'invitation' && l.type === 'invitation'));
  e.liens.push({ h: empreinte(jeton), type, par, creeLe: new Date(now).toISOString(), exp: now + DUREE[type] });
  e.liens = e.liens.slice(-12);
  if (type === 'invitation') e.invitation = { creeLe: new Date(now).toISOString(), exp: new Date(now + DUREE[type]).toISOString(), utiliseeLe: null };
  return { jeton, exp: new Date(now + DUREE[type]).toISOString() };
}

function trouverLien(e, jeton) {
  if (typeof jeton !== 'string' || jeton.length < 40 || jeton.length > 64) return null;
  const h = empreinte(jeton);
  let trouve = null;
  for (const l of e.liens) if (safeEqual(l.h, h)) trouve = l;
  return trouve;
}

export const lienEspace = (origin, id, jeton) => `${origin}/espace/${id}#a=${jeton}`;

// Nom lisible d'un appareil, d'après son navigateur
export function nomAppareil(ua) {
  const s = String(ua || '');
  const os = /iPhone/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad' : /Android/.test(s) ? (/Mobile/.test(s) ? 'Téléphone Android' : 'Tablette Android') : /Macintosh|Mac OS X/.test(s) ? 'Mac' : /Windows/.test(s) ? 'PC Windows' : /CrOS/.test(s) ? 'Chromebook' : /Linux/.test(s) ? 'Ordinateur Linux' : 'Appareil';
  const nav = /Edg\//.test(s) ? 'Edge' : /SamsungBrowser/.test(s) ? 'Samsung Internet' : /Firefox\//.test(s) ? 'Firefox' : /OPR\//.test(s) ? 'Opera' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : '';
  return nav ? `${os} · ${nav}` : os;
}

// Consomme un lien et crée la clé de l'appareil (dans une mise à jour du dossier)
export function ouvrir(r, jeton, ua) {
  const e = espaceDe(r);
  const l = trouverLien(e, jeton);
  if (!l) return { erreur: 'invalide' };
  e.liens = e.liens.filter((x) => x !== l); // usage unique, même expiré
  r.espace = e;
  if (l.exp < Date.now()) return { erreur: 'expire', enregistrer: true };
  const secret = aleatoire(32);
  const at = maintenant();
  const app = { id: aleatoire(9), h: empreinte(secret), nom: nomAppareil(ua), creeLe: at, vuLe: at, via: l.type };
  e.appareils = [...e.appareils, app].sort((a, b) => String(a.vuLe).localeCompare(String(b.vuLe))).slice(-MAX_APPAREILS);
  const premiere = !e.ouvertLe;
  if (premiere) e.ouvertLe = at;
  if (l.type === 'invitation' && e.invitation) e.invitation = { ...e.invitation, utiliseeLe: at };
  noter(e, `Connexion : ${app.nom} (${l.type === 'invitation' ? 'lien d’invitation' : l.type === 'email' ? 'lien reçu par e-mail' : 'ajout depuis un autre appareil'})`);
  if (premiere) r.log = [...(r.log || []), { at, what: 'Espace client ouvert par le client' }];
  return { appareil: app, cookie: `${app.id}.${secret}`, premiere };
}

// Ouvre une session de site SANS lien, après que le compte unifié (e-mail + mot de passe + code)
// a déjà prouvé l'identité. Réservé à l'accès « Mon site » depuis le compte Devis & Factures du
// même dossier. L'appareil est marqué via:'compte' pour pouvoir être révoqué avec le compte.
export function ouvrirCompte(r, ua) {
  const e = espaceDe(r);
  const secret = aleatoire(32);
  const at = maintenant();
  const app = { id: aleatoire(9), h: empreinte(secret), nom: nomAppareil(ua), creeLe: at, vuLe: at, via: 'compte' };
  e.appareils = [...e.appareils, app].sort((a, b) => String(a.vuLe).localeCompare(String(b.vuLe))).slice(-MAX_APPAREILS);
  const premiere = !e.ouvertLe;
  if (premiere) e.ouvertLe = at;
  noter(e, `Accès « Mon site » depuis le compte : ${app.nom}`);
  if (premiere) r.log = [...(r.log || []), { at, what: 'Espace client ouvert depuis le compte Devis & Factures' }];
  r.espace = e;
  return { appareil: app, cookie: `${app.id}.${secret}` };
}

// Retire les appareils ouverts depuis le compte (déconnexion, suspension ou suppression du compte).
// Renvoie true si au moins un appareil a été retiré.
export function oublierAppareilsCompte(r) {
  const e = espaceDe(r);
  const avant = e.appareils.length;
  e.appareils = e.appareils.filter((a) => a.via !== 'compte');
  if (e.appareils.length === avant) return false;
  r.espace = e;
  return true;
}

// Appareil reconnu par son cookie, ou null
export function lireSession(req, rec) {
  const raw = readCookie(req, nomCookie(rec.id));
  if (!raw || raw.length > 120) return null;
  const [aid, secret] = raw.split('.');
  if (!aid || !secret) return null;
  const a = espaceDe(rec).appareils.find((x) => x.id === aid);
  if (!a || !safeEqual(a.h, empreinte(secret))) return null;
  if (Date.now() - new Date(a.vuLe || a.creeLe).getTime() > DUREE.session) return null;
  return a;
}

// Qui appelle : le client (appareil reconnu) ou l'agence (vue agence demandée explicitement)
export async function quiAppelle(req, rec) {
  const vueAgence = new URL(req.url).searchParams.get('vue') === 'agence';
  if (vueAgence) return (await isAgency(req)) ? { role: 'agence', appareil: null } : null;
  const appareil = lireSession(req, rec);
  return appareil ? { role: 'client', appareil } : null;
}

// Type réel d'une image, lu dans ses premiers octets (le type annoncé par le navigateur ne compte pas)
export function typeImage(buf) {
  if (!buf || buf.length < 12) return '';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return '';
}

export function cookieSession(id, valeur, secure) {
  return `${nomCookie(id)}=${valeur}; Path=${cheminCookie(id)}; HttpOnly; SameSite=Strict; Max-Age=${Math.round(DUREE.session / 1000)}${secure ? '; Secure' : ''}`;
}
export function cookieEfface(id, secure) {
  return `${nomCookie(id)}=; Path=${cheminCookie(id)}; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function masquerEmail(s) {
  const [u, d] = String(s || '').split('@');
  if (!u || !d) return '';
  return `${u.slice(0, Math.min(2, u.length))}${'•'.repeat(Math.max(2, Math.min(6, u.length - 2)))}@${d}`;
}

// ---------- Ce que voit l'écran de l'espace ----------
const auJour = (iso) => aujourdhui(new Date(iso));
export const publicationsDuJour = (e) => e.pubs.filter((at) => auJour(at) === aujourdhui()).length;

export function vueEspace(rec, { role, appareil = null, settings }) {
  const e = espaceDe(rec);
  const model = rec.result?.models?.find((m) => m.id === rec.choice?.modelId) || null;
  const d = dossierDe(rec);
  const owner = settings?.ownerName || 'Votre interlocuteur';
  const pagesSite = new Set(rec.brief?.pages || []);
  return {
    id: rec.id,
    role,
    jour: aujourdhui(),
    nom: rec.brief?.businessName || rec.name || '',
    gestion: e.gestion,
    validation: e.validation,
    peutModifier: peutModifier(e.gestion, role),
    site: {
      url: rec.liveUrl || rec.publication?.url || '',
      version: rec.publication?.version || 0,
      etat: rec.publication?.deployState || '',
      publieLe: rec.publication?.publishedAt || '',
      auto: Boolean(rec.publication?.repo && rec.publication?.projectId),
    },
    dossier: { id: rec.id, brief: d.brief, content: d.content, model, aiImages: d.aiImages, stockImages: rec.stockImages || [], hosting: settings?.hosting || '' },
    etat: etatActuel(rec),
    boutique: rec.brief?.siteType === 'boutique',
    servicesLabel: servicesLabel(rec.brief || {}),
    aPublier: e.aPublier ? { at: e.aPublier.at, par: e.aPublier.par, raison: e.aPublier.raison || '' } : null,
    proposition: e.proposition ? { at: e.proposition.at, resume: e.proposition.resume, etat: e.proposition.etat, base: e.proposition.base } : null,
    versions: e.versions.map(({ etat, ...v }) => v).reverse(),
    demandes: [...e.demandes].reverse(),
    appareils: e.appareils.map(({ h, ...a }) => ({ ...a, actuel: Boolean(appareil && a.id === appareil.id) })).reverse(),
    journal: [...e.journal].reverse().slice(0, 40),
    email: e.email,
    aDevis: role === 'client' && Boolean(rec.appliDevis?.wid) && rec.appliDevis?.facturation !== false, // lien retour « Devis & Factures »
    aCompte: role === 'client' && Boolean(rec.appliDevis?.wid) && rec.appliDevis?.facturation === false, // compte « site seul » : lien « Mon compte »
    invitation: role === 'agence' ? e.invitation : null,
    publicationsDuJour: publicationsDuJour(e),
    limite: LIMITE_JOUR,
    pagesPossibles: [...PAGES.filter((p) => !pagesSite.has(p.id)).map((p) => ({ id: p.id, label: p.label })), { id: 'galerie', label: 'Galerie photos' }, { id: 'reservation', label: 'Prise de rendez-vous' }, { id: 'autre', label: 'Une autre page' }],
    studio: { studioName: settings?.studioName || 'Studio Site', ownerName: owner, email: settings?.email || '', phone: settings?.phone || '' },
    mail: mailPret(),
  };
}

// ---------- Publication d'un état ----------
// Images connues du dossier : une photo inconnue ne peut pas entrer dans le site
export function imagesConnues(rec) {
  const e = espaceDe(rec);
  const ids = new Set([...(rec.brief?.photos || []).map((p) => p.id), ...(rec.aiImages || []).map((p) => p.id), ...e.images]);
  for (const v of e.versions) for (const p of [...(v.etat?.photos || []), ...(v.etat?.ia || [])]) ids.add(p.id);
  for (const p of [...(e.proposition?.etat?.photos || []), ...(e.proposition?.etat?.ia || [])]) ids.add(p.id);
  return ids;
}

// État modifiable du dossier, mis en forme comme après un contrôle (espaces superflus retirés…)
export const etatActuel = (rec) => nettoyer(editable(dossierDe(rec)), { boutique: rec.brief?.siteType === 'boutique', jour: '2000-01-01' }).etat;

// Fusionne les changements reçus avec l'état actuel du dossier, puis contrôle le résultat
export function preparerEtat(rec, { etat, base }) {
  const opts = { idsImages: imagesConnues(rec), boutique: rec.brief?.siteType === 'boutique' };
  const norm = (x) => nettoyer(x, { boutique: opts.boutique, jour: '2000-01-01' }).etat;
  const actuel = etatActuel(rec);
  const propreBase = base && typeof base === 'object' ? norm(base) : actuel;
  const fusion = fusion3(propreBase, norm(etat), actuel);
  const { etat: propre, erreurs } = nettoyer(fusion, opts);
  return { actuel, propre, erreurs, changements: resume(actuel, propre) };
}

// Écrit l'état dans le dossier et note la version (dans une mise à jour du dossier)
export function enregistrerEtat(r, { etat, changements, par, validePar = null, annulation = false }) {
  const e = espaceDe(r);
  const appli = appliquer(dossierDe(r), etat);
  const b = { ...(r.brief || {}) };
  for (const k of ['hours', 'phone', 'email', 'address', 'instagram', 'facebook', 'photos']) b[k] = appli.brief[k];
  r.brief = b;
  r.briefRev = (r.briefRev || 0) + 1;
  r.result = { ...r.result, content: appli.content };
  r.aiImages = appli.aiImages;
  const at = maintenant();
  let v;
  if (annulation) {
    const vivantes = e.versions.filter((x) => !x.annulee);
    const cur = vivantes[vivantes.length - 1];
    v = vivantes[vivantes.length - 2]?.v || 1;
    e.versions = e.versions.map((x) => (x === cur ? { ...x, annulee: true, annuleeLe: at, annuleePar: par } : x));
  } else {
    v = Math.max(0, ...e.versions.map((x) => x.v)) + 1;
    e.versions = [...e.versions, { v, at, par, validePar, resume: changements.slice(0, 40), etat: etatActuel(r) }].slice(-25);
  }
  e.pubs = [...e.pubs, at].slice(-40);
  e.aPublier = { at, par, v };
  r.espace = e;
  const qui = par === 'client' ? 'le client' : 'l’agence';
  r.log = [...(r.log || []), { at, what: annulation ? `Espace client : retour à la version v${v} par ${qui}` : `Espace client : v${v} enregistrée par ${qui}${validePar ? ', validée par le client' : ''}` }];
  return v;
}

// Mise en ligne réussie (ou inutile) : plus rien en attente
export function marquerPublie(r, patch) {
  if (patch && Object.keys(patch).length) r.publication = { ...(r.publication || {}), ...patch };
  const e = espaceDe(r);
  const v = e.aPublier?.v;
  e.aPublier = null;
  if (v && patch?.commit) e.versions = e.versions.map((x) => (x.v === v && !x.commit ? { ...x, commit: patch.commit.slice(0, 12) } : x));
  r.espace = e;
}

export function marquerEnAttente(r, raison) {
  const e = espaceDe(r);
  if (e.aPublier) e.aPublier = { ...e.aPublier, raison: String(raison || 'failed').slice(0, 40) };
  r.espace = e;
}

export { RAISONS_ATTENTE };

// ---------- E-mails (seulement si Brevo est branché) ----------
export async function notifier({ rec, settings }, dest, sujet, texte) {
  if (!mailPret()) return false;
  const e = espaceDe(rec);
  const to = dest === 'agence' ? settings?.email : e.email;
  if (!emailValide(to)) return false;
  try {
    await envoyerMail({ to, subject: sujet, text: texte, replyTo: dest === 'client' ? settings?.email : e.email, fromName: settings?.studioName });
    return true;
  } catch (err) {
    console.error('[mail]', err?.code || err?.message);
    return false;
  }
}

export const lignes = (list, max = 12) => {
  const l = (list || []).slice(0, max).map((x) => `- ${x}`);
  if ((list || []).length > max) l.push(`- et ${list.length - max} autre${list.length - max > 1 ? 's' : ''} changement${list.length - max > 1 ? 's' : ''}`);
  return l.join('\n');
};

export { memeEtat };
