// Espace client : ce que le client peut modifier sur son site en ligne, et comment ça s'applique.
// Code partagé navigateur / serveur. Le serveur refait toujours les contrôles (nettoyer).
//
// L'« état modifiable » d'un site est tiré du dossier (brief + contenu + images), champ par champ :
//   horaires, téléphone, e-mail, adresse, Instagram, Facebook
//   services (prix, description, indisponible, offre datée)
//   produits de la boutique (prix, étiquette, rupture de stock, offre datée)
//   réponses de la FAQ
//   annonces datées (fermeture exceptionnelle, fête, information)
//   photos (remplacer, ajouter, retirer)
// Le client ne touche jamais au HTML : le site est entièrement reconstruit par le moteur,
// avec les mêmes blocs que le modèle qu'il a choisi.
import { formatPrice, priceNumber } from './util.js';

// ---------- Dates (jour seul, heure de Paris) ----------
const pad = (n) => String(n).padStart(2, '0');
export function aujourdhui(d = new Date()) {
  try {
    const p = {};
    for (const x of new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)) p[x.type] = x.value;
    if (p.year && p.month && p.day) return `${p.year}-${p.month}-${p.day}`;
  } catch {}
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const JOUR_RE = /^\d{4}-\d{2}-\d{2}$/;
export function jourValide(s) {
  if (!JOUR_RE.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && y <= 2100 && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const utc = (jour) => {
  const [y, m, d] = jour.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export function decaler(jour, n) {
  return new Date(utc(jour) + n * 86400000).toISOString().slice(0, 10);
}
export const ecart = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export function jourTexte(jour, { semaine = false, annee = false } = {}) {
  if (!jourValide(jour)) return '';
  const [y, m, d] = jour.split('-').map(Number);
  const wd = new Date(utc(jour)).getUTCDay();
  return `${semaine ? JOURS[wd] + ' ' : ''}${d === 1 ? '1er' : d} ${MOIS[m - 1]}${annee ? ' ' + y : ''}`;
}

// ---------- Dessins des annonces ----------
const DESSINS = {
  neige: '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.6 4.2 12 6.4l2.4-2.2M9.6 19.8 12 17.6l2.4 2.2"/></g>',
  etoile: '<path fill="currentColor" d="m12 2.8 2.7 5.9 6.4.7-4.8 4.3 1.4 6.3L12 16.8 6.3 20l1.4-6.3-4.8-4.3 6.4-.7z"/>',
  couronne: '<path fill="currentColor" d="M3.5 18.5 5 8l4.5 4.2L12 5.5l2.5 6.7L19 8l1.5 10.5z"/>',
  coeur: '<path fill="currentColor" d="M12 20.5s-7.5-4.6-7.5-10.4A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.5c0 5.8-7.5 10.4-7.5 10.4z"/>',
  oeuf: '<ellipse fill="currentColor" cx="12" cy="13" rx="6.2" ry="8.2"/>',
  fleur: '<g fill="currentColor"><circle cx="12" cy="6.8" r="3.3"/><circle cx="17" cy="10.6" r="3.3"/><circle cx="15.1" cy="16.6" r="3.3"/><circle cx="8.9" cy="16.6" r="3.3"/><circle cx="7" cy="10.6" r="3.3"/></g>',
  cadeau: '<g fill="currentColor"><rect x="3.5" y="9" width="17" height="4" rx="1"/><rect x="5" y="13" width="14" height="8" rx="1"/></g><path d="M12 9v12M12 9c-1.5-3-5-4-5-1.5S10 9 12 9c2 0 5 .1 5-1.5S13.5 6 12 9z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  soleil: '<circle fill="currentColor" cx="12" cy="12" r="4.4"/><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v2.8M12 19.2V22M2 12h2.8M19.2 12H22M4.9 4.9l2 2M17.1 17.1l2 2M4.9 19.1l2-2M17.1 6.9l2-2"/></g>',
  feuille: '<path fill="currentColor" d="M20 4C10 4 4 9 4 16c0 1.4.3 2.7.8 4C7 14 11 11 16 9.5 12 12 9 15 7.4 20.3 8.8 20.8 10.3 21 12 21c5 0 8-5 8-17z"/>',
  citrouille: '<path fill="currentColor" d="M12 7.5c-5 0-8.5 3-8.5 6.8S7 21 12 21s8.5-2.9 8.5-6.7S17 7.5 12 7.5z"/><path d="M12 7.6c0-2.2 1-3.8 3.2-4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  etiquette: '<path fill="currentColor" fill-rule="evenodd" d="M3 12.2V3.5h8.7L21 12.8 12.6 21.2zM7.4 9.6a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z"/>',
  info: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 10.5v6M12 7.3v.1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  ferme: '<rect x="3.5" y="5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 10h17M8 3v4M16 3v4M9.5 13.5l5 4M14.5 13.5l-5 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
};
export const iconeSvg = (nom, size = 20) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${DESSINS[nom] || DESSINS.info}</svg>`;

// Motif répété dans le bandeau d'une fête (image SVG, couleur fixe)
export function motifUrl(f) {
  const d = (DESSINS[f.icone] || DESSINS.etoile).replace(/currentColor/g, f.c.motif);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><g transform="translate(3 3)">${d}</g><g transform="translate(31 31) scale(.75)">${d}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ---------- Fêtes et temps forts ----------
// Fêtes à date fixe : du / au en mois-jour. Fêtes mobiles : recalculées chaque année.
// c : couleurs du bandeau (fond, texte, motif), choisies pour rester lisibles sur tous les modèles.
export const FETES = [
  { id: 'galette', nom: 'Galette des rois', icone: 'couronne', du: '01-02', au: '01-31', message: 'La galette des rois est arrivée !', c: { band: '#4a3208', fg: '#ffe39a', motif: '#e0b13a' } },
  { id: 'soldes-hiver', nom: 'Soldes d’hiver', icone: 'etiquette', du: '01-07', au: '02-03', message: 'C’est les soldes : profitez-en !', c: { band: '#24324f', fg: '#f2f5ff', motif: '#8fb0ff' } },
  { id: 'valentin', nom: 'Saint-Valentin', icone: 'coeur', du: '02-07', au: '02-14', message: 'Pour la Saint-Valentin, faites plaisir à ceux que vous aimez.', c: { band: '#6e1230', fg: '#ffe0e8', motif: '#ef6f92' } },
  { id: 'paques', nom: 'Pâques', icone: 'oeuf', mobile: 'paques', avant: 12, apres: 1, message: 'Joyeuses Pâques !', c: { band: '#e3eecf', fg: '#2c4419', motif: '#d9a21b' } },
  { id: 'meres', nom: 'Fête des mères', icone: 'fleur', mobile: 'meres', avant: 10, apres: 0, message: 'Fête des mères : pensez-y dès maintenant.', c: { band: '#f6dce2', fg: '#62243a', motif: '#e48aa3' } },
  { id: 'peres', nom: 'Fête des pères', icone: 'cadeau', mobile: 'peres', avant: 10, apres: 0, message: 'Fête des pères : nos idées cadeaux vous attendent.', c: { band: '#17324d', fg: '#e8f1fb', motif: '#7fb2e5' } },
  { id: 'ete', nom: 'Été', icone: 'soleil', du: '07-01', au: '08-31', message: 'Bel été à tous !', c: { band: '#0b5560', fg: '#fff1cf', motif: '#ffcb57' } },
  { id: 'rentree', nom: 'Rentrée', icone: 'feuille', du: '08-25', au: '09-15', message: 'C’est la rentrée : nous sommes là pour vous.', c: { band: '#5a3a12', fg: '#fbe9cf', motif: '#e0a44a' } },
  { id: 'halloween', nom: 'Halloween', icone: 'citrouille', du: '10-20', au: '10-31', message: 'Joyeux Halloween !', c: { band: '#2a1636', fg: '#ffd6a3', motif: '#ec7b2c' } },
  { id: 'black-friday', nom: 'Black Friday', icone: 'etiquette', du: '11-23', au: '11-30', message: 'Black Friday : nos offres de la semaine.', c: { band: '#141414', fg: '#ffe14d', motif: '#ffe14d' } },
  { id: 'noel', nom: 'Noël', icone: 'neige', du: '12-01', au: '12-26', message: 'Joyeuses fêtes de fin d’année !', c: { band: '#123b2b', fg: '#f6efe0', motif: '#ffffff' } },
  { id: 'nouvel-an', nom: 'Nouvel An', icone: 'etoile', du: '12-27', au: '01-05', message: 'Bonne année ! Merci pour votre fidélité.', c: { band: '#1b1f3b', fg: '#f7e7b4', motif: '#e6c35c' } },
];
export const feteParId = (id) => FETES.find((f) => f.id === id) || null;

// Jour de la fête mobile pour une année (Pâques : calcul de Meeus ; fêtes des mères et des pères : règle française)
function datePaques(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
  const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${pad(mois)}-${pad(jour)}`;
}
const jourDeSemaine = (jour) => new Date(utc(jour)).getUTCDay();
export function jourDeLaFete(mobile, y) {
  if (mobile === 'paques') return datePaques(y);
  if (mobile === 'meres') {
    let j = `${y}-05-31`;
    while (jourDeSemaine(j) !== 0) j = decaler(j, -1);
    // Si le dernier dimanche de mai est la Pentecôte, la fête a lieu le premier dimanche de juin
    if (j === decaler(datePaques(y), 49)) j = decaler(j, 7);
    return j;
  }
  if (mobile === 'peres') {
    let j = `${y}-06-01`;
    while (jourDeSemaine(j) !== 0) j = decaler(j, 1);
    return decaler(j, 14);
  }
  return '';
}

// Prochaine période d'une fête (la première qui n'est pas finie à cette date)
export function prochaineFete(f, jour = aujourdhui()) {
  const y = Number(jour.slice(0, 4));
  for (const an of [y - 1, y, y + 1]) {
    let du;
    let au;
    if (f.mobile) {
      const j = jourDeLaFete(f.mobile, an);
      du = decaler(j, -f.avant);
      au = decaler(j, f.apres);
    } else {
      du = `${an}-${f.du}`;
      au = f.au < f.du ? `${an + 1}-${f.au}` : `${an}-${f.au}`;
    }
    if (au >= jour) return { du, au };
  }
  return null;
}

// ---------- Annonces ----------
export const PREAVIS_FERMETURE = 21; // une fermeture s'annonce 3 semaines avant
export const annonceRepetee = (a) => a?.type === 'fete' && a.annuel !== false;

// Périodes d'une fête mobile répétée chaque année : mêmes écarts avec le jour de la fête que la première fois
export function plagesMobiles(a, depuis, n = 10) {
  const f = feteParId(a.fete);
  if (!f?.mobile || !jourValide(a.du) || !jourValide(a.au)) return [];
  const ref = jourDeLaFete(f.mobile, Number(a.au.slice(0, 4)));
  const avant = ecart(ref, a.du);
  const apres = ecart(ref, a.au);
  const out = [];
  for (let y = Number(depuis.slice(0, 4)) - 1; out.length < n && y < 2101; y++) {
    const j = jourDeLaFete(f.mobile, y);
    const p = [decaler(j, avant), decaler(j, apres)];
    if (p[1] >= depuis) out.push(p);
  }
  return out;
}

export function fenetreAnnonce(a, depuis = aujourdhui()) {
  if (a.type === 'fermeture') return { du: decaler(a.du, -PREAVIS_FERMETURE), au: a.au };
  if (annonceRepetee(a)) {
    if (feteParId(a.fete)?.mobile) return { plages: plagesMobiles(a, depuis) };
    return { du: a.du, au: a.au, annuel: true };
  }
  return { du: a.du, au: a.au };
}

export function dansFenetre(f, jour) {
  if (f.plages) return f.plages.some(([du, au]) => jour >= du && jour <= au);
  if (!f.annuel) return jour >= f.du && jour <= f.au;
  const md = jour.slice(5);
  const a = f.du.slice(5);
  const b = f.au.slice(5);
  return a <= b ? md >= a && md <= b : md >= a || md <= b;
}
export const annonceVisible = (a, jour = aujourdhui()) => dansFenetre(fenetreAnnonce(a, jour), jour);
export const annonceTerminee = (a, jour = aujourdhui()) => !annonceRepetee(a) && String(a?.au || '') < jour;

// Prochaine date d'affichage d'une annonce (pour l'écran du client)
export function prochainAffichage(a, jour = aujourdhui()) {
  const f = fenetreAnnonce(a, jour);
  if (dansFenetre(f, jour)) return { maintenant: true };
  if (f.plages) return f.plages.length ? { du: f.plages[0][0], au: f.plages[0][1] } : null;
  if (!f.annuel) return f.du > jour ? { du: f.du, au: f.au } : null;
  const y = Number(jour.slice(0, 4));
  const du = `${y}-${f.du.slice(5)}` >= jour ? `${y}-${f.du.slice(5)}` : `${y + 1}-${f.du.slice(5)}`;
  return { du, au: decaler(du, ecart(f.du, f.au)) };
}

export function texteAnnonce(a) {
  const msg = String(a.message || '').trim();
  if (a.type === 'fermeture') {
    const periode = a.du === a.au ? `le ${jourTexte(a.du, { semaine: true })}` : `du ${jourTexte(a.du, { semaine: true })} au ${jourTexte(a.au, { semaine: true })}`;
    return `Fermeture exceptionnelle ${periode}${msg ? ` · ${msg}` : ''}`;
  }
  return msg;
}

export function iconeDe(a) {
  if (a.type === 'fermeture') return 'ferme';
  if (a.type === 'fete') return feteParId(a.fete)?.icone || 'etoile';
  return 'info';
}

export function nomAnnonce(a) {
  if (a.type === 'fermeture') return 'Fermeture exceptionnelle';
  if (a.type === 'fete') return feteParId(a.fete)?.nom || 'Fête';
  return 'Annonce';
}

// Offre encore valable à cette date
export const offreActive = (it, jour = aujourdhui()) => it?.statut === 'offre' && jourValide(it.offreFin) && it.offreFin >= jour && priceNumber(it.offrePrix) > 0;

// ---------- Identifiants stables ----------
const ID_LIGNE = /^[a-z0-9]{3,16}$/i;
export const nouvelId = (prefixe = 's') => prefixe + Math.random().toString(36).slice(2, 10);

// Donne un identifiant durable aux services et produits (les fusions et l'historique s'appuient dessus)
export function assurerIds(content) {
  if (!content) return { content, change: false };
  let change = false;
  const fix = (list, prefixe) => {
    if (!Array.isArray(list)) return list;
    const vus = new Set();
    return list.map((x) => {
      if (x && ID_LIGNE.test(x.sid || '') && !vus.has(x.sid)) {
        vus.add(x.sid);
        return x;
      }
      change = true;
      let sid = nouvelId(prefixe);
      while (vus.has(sid)) sid = nouvelId(prefixe);
      vus.add(sid);
      return { ...x, sid };
    });
  };
  const out = { ...content, services: fix(content.services, 's') };
  if (Array.isArray(content.products)) out.products = fix(content.products, 'p');
  return { content: change ? out : content, change };
}

// ---------- État modifiable ----------
const offreEnCours = (it, jour) => jourValide(it.offreFin) && it.offreFin >= jour;
const S = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
const prixTexte = (p) => (p === null || p === undefined ? '' : typeof p === 'number' ? (Number.isInteger(p) ? String(p) : p.toFixed(2).replace('.', ',')) : String(p));

export function editable({ brief, content, aiImages }, jour = aujourdhui()) {
  const b = brief || {};
  const c = content || {};
  return {
    horaires: S(b.hours, 600),
    telephone: S(b.phone, 40),
    email: S(b.email, 120),
    adresse: S(b.address, 200),
    instagram: S(b.instagram, 200),
    facebook: S(b.facebook, 200),
    services: (c.services || []).map((s, i) => {
      const offre = s.statut === 'offre' && offreEnCours(s, jour);
      return {
        id: ID_LIGNE.test(s.sid || '') ? s.sid : 'xs' + i,
        nom: S(s.name, 80),
        description: S(s.description, 500),
        prix: prixTexte(s.price).slice(0, 40),
        // Une offre terminée est déjà repassée au prix habituel sur le site
        statut: s.statut === 'indispo' ? 'indispo' : offre ? 'offre' : '',
        offrePrix: offre ? prixTexte(s.offrePrix).slice(0, 40) : '',
        offreFin: offre ? s.offreFin : '',
      };
    }),
    produits: Array.isArray(c.products)
      ? c.products.map((p, i) => {
          const offre = p.statut === 'offre' && offreEnCours(p, jour);
          return {
            id: ID_LIGNE.test(p.sid || '') ? p.sid : 'xp' + i,
            nom: S(p.name, 80),
            description: S(p.description, 500),
            prix: prixTexte(p.price).slice(0, 20),
            categorie: S(p.category, 40),
            etiquette: S(p.badge, 24),
            statut: p.statut === 'rupture' ? 'rupture' : offre ? 'offre' : '',
            offrePrix: offre ? prixTexte(p.offrePrix).slice(0, 20) : '',
            offreFin: offre ? p.offreFin : '',
          };
        })
      : null,
    faq: (c.faq || []).slice(0, 30).map((f, i) => ({ id: 'f' + i, q: S(f.q, 200), a: S(f.a, 800) })),
    // Les annonces passées ne sont plus affichées : elles disparaissent de l'espace
    annonces: (c.annonces || []).filter((a) => a && !annonceTerminee(a, jour)).map((a) => ({ ...a })),
    photos: (b.photos || []).map((p) => ({ id: p.id, ext: p.ext, alt: S(p.alt, 160) })),
    ia: (aiImages || []).map((p) => ({ id: p.id, ext: p.ext, alt: S(p.alt, 160), ...(p.reel ? { reel: true } : {}) })),
  };
}

// Coordonnées citées dans les textes du site : remplacées quand le client les change
function motifTelephone(ancien) {
  const chiffres = ancien.replace(/\D/g, '');
  if (chiffres.length < 8) return null;
  return new RegExp(chiffres.split('').join('[\\s.\\-]?'), 'g');
}
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function remplacements(briefAvant, e) {
  const out = [];
  const tel = String(briefAvant?.phone || '').trim();
  if (tel && e.telephone && tel !== e.telephone) {
    const re = motifTelephone(tel);
    if (re) out.push([re, e.telephone]);
  }
  const mail = String(briefAvant?.email || '').trim();
  if (mail.length >= 5 && e.email && mail.toLowerCase() !== e.email.toLowerCase()) out.push([new RegExp(echapper(mail), 'gi'), e.email]);
  const adr = String(briefAvant?.address || '').trim();
  if (adr.length >= 8 && e.adresse && adr !== e.adresse) out.push([new RegExp(echapper(adr), 'g'), e.adresse]);
  return out;
}

function remplacerPartout(v, paires) {
  if (typeof v === 'string') return paires.reduce((s, [re, par]) => s.replace(re, () => par), v);
  if (Array.isArray(v)) return v.map((x) => remplacerPartout(x, paires));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'imagePrompts' || k === 'imageKeywords' ? x : remplacerPartout(x, paires)]));
  return v;
}

// Applique un état modifiable au dossier (le reste du dossier ne change pas)
export function appliquer({ brief, content, aiImages }, e) {
  const b = { ...(brief || {}) };
  b.hours = e.horaires;
  b.phone = e.telephone;
  b.email = e.email;
  b.address = e.adresse;
  b.instagram = e.instagram;
  b.facebook = e.facebook;
  b.photos = e.photos.map((p) => ({ id: p.id, ext: p.ext, alt: p.alt || '' }));
  let c = { ...(content || {}) };
  const ancien = (list, prefixe) => {
    const m = new Map();
    (list || []).forEach((x, i) => m.set(ID_LIGNE.test(x?.sid || '') ? x.sid : prefixe + i, x));
    return m;
  };
  const oldS = ancien(content?.services, 'xs');
  c.services = e.services.map((s) => {
    const old = oldS.get(s.id) || {};
    const out = { ...old, sid: s.id, name: s.nom, description: s.description, price: s.prix.trim() ? s.prix.trim() : null, icon: old.icon || 'check' };
    delete out.statut;
    delete out.offrePrix;
    delete out.offreFin;
    if (s.statut) out.statut = s.statut;
    if (s.statut === 'offre') Object.assign(out, { offrePrix: s.offrePrix.trim(), offreFin: s.offreFin });
    return out;
  });
  if (e.produits && Array.isArray(content?.products)) {
    const oldP = ancien(content.products, 'xp');
    c.products = e.produits.map((p) => {
      const old = oldP.get(p.id) || {};
      const out = { ...old, sid: p.id, name: p.nom, description: p.description, price: priceNumber(p.prix), category: p.categorie, badge: p.etiquette.trim() ? p.etiquette.trim() : null };
      delete out.statut;
      delete out.offrePrix;
      delete out.offreFin;
      if (p.statut) out.statut = p.statut;
      if (p.statut === 'offre') Object.assign(out, { offrePrix: priceNumber(p.offrePrix), offreFin: p.offreFin });
      return out;
    });
  }
  if (Array.isArray(content?.faq) && Array.isArray(e.faq)) {
    const rep = new Map(e.faq.map((f) => [f.id, f.a]));
    c.faq = content.faq.map((f, i) => (rep.has('f' + i) && rep.get('f' + i).trim() ? { ...f, a: rep.get('f' + i) } : f));
  }
  c.annonces = e.annonces.map((a) => ({ id: a.id, type: a.type, ...(a.type === 'fete' ? { fete: a.fete, annuel: a.annuel !== false } : {}), message: a.message, du: a.du, au: a.au }));
  const paires = remplacements(brief, e);
  if (paires.length) c = remplacerPartout(c, paires);
  const ia = e.ia.map((p) => ({ id: p.id, ext: p.ext, alt: p.alt || '', ...(p.reel ? { reel: true } : {}) }));
  return { brief: b, content: c, aiImages: ia };
}

// ---------- Contrôles (les mêmes côté navigateur et côté serveur) ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TEL_RE = /^[+\d(][\d\s().-]{5,}$/;
const ID_IMG = /^[A-Za-z0-9_-]{8,40}$/;
const ID_ANN = /^[a-z0-9]{4,20}$/;
export const MAX_PHOTOS = 10;

export function nettoyer(brut, { jour = aujourdhui(), idsImages = null, boutique = false } = {}) {
  const e = brut && typeof brut === 'object' ? brut : {};
  const erreurs = {};
  const t = (v, max) => S(v, max).trim();
  const out = {
    horaires: S(e.horaires, 600).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
    telephone: t(e.telephone, 40),
    email: t(e.email, 120),
    adresse: t(e.adresse, 200),
    instagram: t(e.instagram, 200),
    facebook: t(e.facebook, 200),
  };
  if (out.telephone && !TEL_RE.test(out.telephone)) erreurs.telephone = 'Numéro de téléphone invalide. Exemple : 01 23 45 67 89';
  if (out.email && !EMAIL_RE.test(out.email)) erreurs.email = 'Adresse e-mail invalide. Exemple : contact@exemple.fr';
  for (const k of ['instagram', 'facebook']) {
    const v = out[k];
    if (v && (/\s/.test(v) || (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^https?:\/\//i.test(v)))) erreurs[k] = 'Lien invalide : collez l’adresse de la page, par exemple https://www.instagram.com/votrepage';
  }

  const ids = new Set();
  const idLigne = (x, prefixe) => {
    let id = ID_LIGNE.test(x?.id || '') ? x.id : nouvelId(prefixe);
    while (ids.has(id)) id = nouvelId(prefixe);
    ids.add(id);
    return id;
  };
  const offre = (it, k, unNombre) => {
    if (it.statut !== 'offre') {
      it.offrePrix = '';
      it.offreFin = '';
      return;
    }
    const prixOffre = priceNumber(it.offrePrix);
    const base = priceNumber(it.prix);
    if (!(prixOffre > 0)) erreurs[`${k}.offrePrix`] = 'Indiquez le prix de l’offre. Exemple : 9,90';
    else if (unNombre && !(base > 0)) erreurs[`${k}.offrePrix`] = 'Indiquez d’abord le prix habituel.';
    else if (base > 0 && prixOffre >= base) erreurs[`${k}.offrePrix`] = 'Le prix de l’offre doit être plus bas que le prix habituel.';
    if (!jourValide(it.offreFin)) erreurs[`${k}.offreFin`] = 'Indiquez jusqu’à quand dure l’offre.';
    else if (it.offreFin < jour) erreurs[`${k}.offreFin`] = 'Cette date est passée.';
  };

  out.services = (Array.isArray(e.services) ? e.services : []).slice(0, 40).map((s, i) => {
    const it = {
      id: idLigne(s, 's'),
      nom: t(s?.nom, 80),
      description: S(s?.description, 500).trim(),
      prix: t(s?.prix, 40),
      statut: ['indispo', 'offre'].includes(s?.statut) ? s.statut : '',
      offrePrix: t(s?.offrePrix, 40),
      offreFin: t(s?.offreFin, 10),
    };
    if (!it.nom) erreurs[`services.${i}.nom`] = 'Indiquez le nom.';
    offre(it, `services.${i}`, false);
    return it;
  });

  out.produits = boutique
    ? (Array.isArray(e.produits) ? e.produits : []).slice(0, 80).map((p, i) => {
        const it = {
          id: idLigne(p, 'p'),
          nom: t(p?.nom, 80),
          description: S(p?.description, 500).trim(),
          prix: t(p?.prix, 20),
          categorie: t(p?.categorie, 40),
          etiquette: t(p?.etiquette, 24),
          statut: ['rupture', 'offre'].includes(p?.statut) ? p.statut : '',
          offrePrix: t(p?.offrePrix, 20),
          offreFin: t(p?.offreFin, 10),
        };
        if (!it.nom) erreurs[`produits.${i}.nom`] = 'Indiquez le nom.';
        const n = priceNumber(it.prix);
        if (it.prix && !(n > 0 && n < 100000)) erreurs[`produits.${i}.prix`] = 'Prix invalide. Exemple : 12,50';
        offre(it, `produits.${i}`, true);
        return it;
      })
    : null;

  out.faq = (Array.isArray(e.faq) ? e.faq : [])
    .slice(0, 30)
    .filter((f) => /^f\d{1,2}$/.test(f?.id || ''))
    .map((f) => ({ id: f.id, q: t(f.q, 200), a: S(f.a, 800).trim() }));
  out.faq.forEach((f, i) => {
    if (!f.a) erreurs[`faq.${i}.a`] = 'La réponse ne peut pas rester vide.';
  });

  const annIds = new Set();
  out.annonces = (Array.isArray(e.annonces) ? e.annonces : []).slice(0, 16).map((a, i) => {
    const type = ['fermeture', 'fete', 'info'].includes(a?.type) ? a.type : 'info';
    let id = ID_ANN.test(a?.id || '') ? a.id : 'a' + Math.random().toString(36).slice(2, 10);
    while (annIds.has(id)) id = 'a' + Math.random().toString(36).slice(2, 10);
    annIds.add(id);
    const it = { id, type, message: t(a?.message, type === 'fermeture' ? 60 : 120), du: t(a?.du, 10), au: t(a?.au, 10) };
    if (type === 'fete') {
      it.fete = feteParId(a?.fete) ? a.fete : 'noel';
      it.annuel = a?.annuel !== false;
    }
    const k = `annonces.${i}`;
    if (type !== 'fermeture' && !it.message) erreurs[`${k}.message`] = 'Écrivez le message du bandeau.';
    if (!jourValide(it.du) || !jourValide(it.au)) erreurs[`${k}.dates`] = 'Indiquez les deux dates.';
    else if (it.au < it.du) erreurs[`${k}.dates`] = 'La date de fin doit être après la date de début.';
    else if (ecart(it.du, it.au) > 366) erreurs[`${k}.dates`] = 'Une annonce dure un an au plus.';
    else if (!annonceRepetee(it) && it.au < jour) erreurs[`${k}.dates`] = 'Cette période est passée : changez les dates ou retirez l’annonce.';
    return it;
  });

  const img = (p, reel) => {
    if (!p || !ID_IMG.test(p.id || '')) return null;
    if (idsImages && !idsImages.has(p.id)) {
      erreurs.photos = 'Une photo n’a pas été reçue. Envoyez-la de nouveau.';
      return null;
    }
    return { id: p.id, ext: ['jpg', 'png', 'webp'].includes(p.ext) ? p.ext : 'jpg', alt: t(p.alt, 160), ...(reel && p.reel ? { reel: true } : {}) };
  };
  out.photos = (Array.isArray(e.photos) ? e.photos : []).map((p) => img(p, false)).filter(Boolean);
  if (out.photos.length > MAX_PHOTOS) erreurs.photos = `${MAX_PHOTOS} photos au maximum : retirez-en une avant d’en ajouter.`;
  out.ia = (Array.isArray(e.ia) ? e.ia : []).map((p) => img(p, true)).filter(Boolean).slice(0, 20);
  return { etat: out, erreurs };
}

// ---------- Comparaison et fusion ----------
const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const memeEtat = egal;
const estObjet = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const avecIds = (l) => Array.isArray(l) && l.every((x) => estObjet(x) && typeof x.id === 'string' && x.id);

// Fusion à trois : ce que l'un a changé depuis son point de départ s'applique sur l'état actuel.
// Les listes (services, produits, annonces, photos) se fusionnent élément par élément.
export function fusion3(base, mien, actuel) {
  if (egal(mien, base)) return actuel;
  if (egal(actuel, base) || egal(actuel, mien)) return mien;
  if (estObjet(base) && estObjet(mien) && estObjet(actuel)) {
    const out = {};
    for (const k of new Set([...Object.keys(mien), ...Object.keys(actuel)])) {
      const v = fusion3(base[k], mien[k], actuel[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (avecIds(base) && avecIds(mien) && avecIds(actuel)) {
    const B = new Map(base.map((x) => [x.id, x]));
    const A = new Map(actuel.map((x) => [x.id, x]));
    const out = [];
    const vus = new Set();
    for (const m of mien) {
      vus.add(m.id);
      const b = B.get(m.id);
      const a = A.get(m.id);
      if (!b) out.push(m); // ajouté de mon côté
      else if (!a) {
        if (!egal(m, b)) out.push(m); // retiré de l'autre côté : gardé seulement si je l'ai modifié
      } else out.push(fusion3(b, m, a));
    }
    for (const a of actuel) if (!vus.has(a.id) && !B.has(a.id)) out.push(a); // ajouté de l'autre côté
    return out;
  }
  if (Array.isArray(base) && Array.isArray(mien) && Array.isArray(actuel) && base.length === mien.length && mien.length === actuel.length) {
    return mien.map((m, i) => fusion3(base[i], m, actuel[i]));
  }
  return mien;
}

const prixAff = (p) => formatPrice(p) || 'sans prix';
const court = (s, n = 70) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

// Liste lisible des changements, pour l'historique, les validations et les messages
export function resume(avant, apres) {
  const out = [];
  if (avant.horaires !== apres.horaires) out.push(`Horaires : ${court(apres.horaires.replace(/\n+/g, ' · ') || 'retirés')}`);
  const champs = [
    ['telephone', 'Téléphone'],
    ['email', 'E-mail'],
    ['adresse', 'Adresse'],
    ['instagram', 'Instagram'],
    ['facebook', 'Facebook'],
  ];
  for (const [k, label] of champs) if (avant[k] !== apres[k]) out.push(`${label} : ${apres[k] ? court(apres[k]) : 'retiré'}`);

  const liste = (av, ap, mots) => {
    const parId = new Map((av || []).map((x) => [x.id, x]));
    const gardes = new Set();
    for (const it of ap || []) {
      const old = parId.get(it.id);
      if (!old) {
        out.push(`${mots.ajout} : ${it.nom}${it.prix ? ` (${prixAff(it.prix)})` : ''}`);
        continue;
      }
      gardes.add(it.id);
      if (old.nom !== it.nom) out.push(`« ${old.nom} » renommé « ${it.nom} »`);
      if (old.prix !== it.prix) out.push(`${it.nom} : ${prixAff(old.prix)} → ${prixAff(it.prix)}`);
      if (old.description !== it.description) out.push(`${it.nom} : description modifiée`);
      if (it.etiquette !== undefined && old.etiquette !== it.etiquette) out.push(`${it.nom} : étiquette ${it.etiquette ? `« ${it.etiquette} »` : 'retirée'}`);
      if (it.categorie !== undefined && old.categorie !== it.categorie) out.push(`${it.nom} : rayon « ${it.categorie || 'aucun'} »`);
      if (old.statut !== it.statut || (it.statut === 'offre' && (old.offrePrix !== it.offrePrix || old.offreFin !== it.offreFin))) {
        if (it.statut === 'offre') out.push(`${it.nom} : offre à ${prixAff(it.offrePrix)} jusqu’au ${jourTexte(it.offreFin)}`);
        else if (it.statut) out.push(`${it.nom} : ${mots.stop}`);
        else out.push(`${it.nom} : ${old.statut === 'offre' ? 'fin de l’offre' : mots.retour}`);
      }
    }
    for (const old of av || []) if (!gardes.has(old.id)) out.push(`${mots.retrait} : ${old.nom}`);
    const avant2 = (av || []).filter((x) => gardes.has(x.id)).map((x) => x.id);
    const apres2 = (ap || []).filter((x) => gardes.has(x.id)).map((x) => x.id);
    if (!egal(avant2, apres2)) out.push(mots.ordre);
  };
  liste(avant.services, apres.services, { ajout: 'Ajouté', retrait: 'Retiré', stop: 'indisponible', retour: 'de nouveau disponible', ordre: 'Ordre de la liste modifié' });
  if (apres.produits) liste(avant.produits, apres.produits, { ajout: 'Nouveau produit', retrait: 'Produit retiré', stop: 'rupture de stock', retour: 'de nouveau en stock', ordre: 'Ordre des produits modifié' });

  const faqAv = new Map((avant.faq || []).map((f) => [f.id, f]));
  for (const f of apres.faq || []) if (faqAv.get(f.id) && faqAv.get(f.id).a !== f.a) out.push(`FAQ : réponse à « ${court(f.q, 50)} » modifiée`);

  const parId = new Map((avant.annonces || []).map((a) => [a.id, a]));
  const vus = new Set();
  for (const a of apres.annonces || []) {
    const old = parId.get(a.id);
    vus.add(a.id);
    const periode = annonceRepetee(a) ? 'chaque année' : a.du === a.au ? `le ${jourTexte(a.du)}` : `du ${jourTexte(a.du)} au ${jourTexte(a.au)}`;
    if (!old) out.push(`${nomAnnonce(a)} ajoutée (${periode})`);
    else if (!egal(old, a)) out.push(old.du !== a.du || old.au !== a.au ? `${nomAnnonce(a)} : nouvelles dates (${periode})` : `${nomAnnonce(a)} : message modifié`);
  }
  for (const a of avant.annonces || []) if (!vus.has(a.id)) out.push(`${nomAnnonce(a)} retirée`);

  const idsAv = (avant.photos || []).map((p) => p.id);
  const idsAp = (apres.photos || []).map((p) => p.id);
  const nouvelles = idsAp.filter((id) => !idsAv.includes(id)).length;
  const parties = idsAv.filter((id) => !idsAp.includes(id)).length;
  const remplacees = Math.min(nouvelles, parties);
  if (remplacees) out.push(remplacees > 1 ? `${remplacees} photos remplacées` : 'Une photo remplacée');
  if (nouvelles > remplacees) out.push(nouvelles - remplacees > 1 ? `${nouvelles - remplacees} photos ajoutées` : 'Une photo ajoutée');
  if (parties > remplacees) out.push(parties - remplacees > 1 ? `${parties - remplacees} photos retirées` : 'Une photo retirée');
  if (!nouvelles && !parties && !egal(idsAv, idsAp)) out.push('Ordre des photos modifié');
  const iaAv = (avant.ia || []).map((p) => p.id);
  const iaRemplacees = (apres.ia || []).filter((p) => !iaAv.includes(p.id)).length;
  if (iaRemplacees) out.push(iaRemplacees > 1 ? `${iaRemplacees} images d’illustration remplacées par vos photos` : 'Une image d’illustration remplacée par votre photo');
  const anciennes = [...(avant.photos || []), ...(avant.ia || [])];
  const legendes = [...(apres.photos || []), ...(apres.ia || [])].filter((p) => {
    const old = anciennes.find((x) => x.id === p.id);
    return old && old.alt !== p.alt;
  }).length;
  if (legendes) out.push(legendes > 1 ? `${legendes} descriptions de photos modifiées` : 'Description d’une photo modifiée');
  return out;
}

// Réponses de la FAQ qui parlent des horaires, ou qui citent une coordonnée que le client a retirée
const MOTS_HORAIRES = /horaire|ouvert|ouverture|ferm[ée]|heure/i;
export function faqLiees(etat, briefAvant = {}) {
  const retires = [];
  if (briefAvant.phone && !etat.telephone) retires.push(briefAvant.phone);
  if (briefAvant.email && !etat.email) retires.push(briefAvant.email);
  if (briefAvant.address && !etat.adresse) retires.push(briefAvant.address);
  return (etat.faq || []).filter((f) => MOTS_HORAIRES.test(f.q) || retires.some((r) => r && f.a.includes(r)));
}

// ---------- Qui fait les mises à jour ----------
export const GESTIONS = {
  client: { titre: 'Je m’en occupe', texte: (owner) => `Vous modifiez et publiez vous-même. ${owner} n’a pas accès à vos rubriques.`, court: 'le client gère seul' },
  deux: { titre: 'À deux', texte: (owner) => `Vous et ${owner} pouvez modifier et publier.`, court: 'gestion à deux' },
  prestataire: { titre: 'Mon prestataire s’en occupe', texte: (owner) => `${owner} fait les mises à jour. Vous faites vos demandes et suivez l’historique.`, court: 'l’agence fait les mises à jour' },
};
export const gestionValide = (g) => Object.prototype.hasOwnProperty.call(GESTIONS, g);
export const peutModifier = (gestion, role) => (role === 'client' ? gestion !== 'prestataire' : gestion !== 'client');

export const LIMITE_JOUR = 20; // publications par jour et par site

// Pourquoi des changements enregistrés ne sont pas encore en ligne (texte pour le client)
export const RAISONS_ATTENTE = {
  publish_off: 'La mise en ligne automatique est en pause : vos changements partent dès qu’elle reprend.',
  not_ready: 'Ce site est mis en ligne à la main : vos changements sont prêts et partent à la prochaine mise à jour.',
  github_changed: 'Le site a reçu une modification technique entre-temps : vos changements partent après une vérification.',
  legal_missing: 'Les mentions légales doivent être complétées avant la prochaine mise en ligne.',
};
