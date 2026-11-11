// Placement des images dans les sites (code partagé navigateur / serveur).
// Chaque image porte un rôle (ce qu'elle montre) : photos du client analysées par l'IA,
// images créées par l'IA d'après leur description. Chaque emplacement du site (haut de page,
// services, à propos, galerie, bandeaux…) prend l'image dont le rôle, le cadrage et la qualité
// lui conviennent le mieux, en préférant les vraies photos du client et sans répéter une image
// tant qu'il en reste d'autres.
import { hashString } from './util.js';

// Ce que montre une image
export const ROLES = ['lieu', 'geste', 'produit', 'ambiance', 'detail', 'equipe'];
// Ce qui ne va pas dans un site (le logo a son propre emplacement)
export const ROLES_ECARTES = ['logo', 'document'];
export const ROLE_LABELS = {
  lieu: 'Le lieu',
  geste: 'Savoir-faire',
  produit: 'Produit / réalisation',
  ambiance: 'Ambiance',
  detail: 'Détail',
  equipe: 'Équipe / portrait',
  logo: 'Logo',
  document: 'Document / capture',
};

// Rôle des 8 descriptions d'images demandées à l'IA, dans leur ordre (voir prompts.js)
export const IMAGE_ROLES = ['lieu', 'geste', 'produit', 'ambiance', 'detail', 'geste', 'detail', 'produit'];

// Convenance de chaque rôle pour chaque type d'emplacement (sur 10)
const FIT = {
  hero: { lieu: 10, produit: 8, ambiance: 8, geste: 7, equipe: 5, detail: 4 },
  mosaic: { produit: 10, detail: 9, geste: 9, ambiance: 7, lieu: 7, equipe: 5 },
  bento: { produit: 10, detail: 9, geste: 8, ambiance: 6, lieu: 6, equipe: 4 },
  service: { produit: 10, geste: 9, detail: 6, lieu: 5, ambiance: 5, equipe: 4 },
  about: { equipe: 10, lieu: 9, geste: 8, ambiance: 7, produit: 5, detail: 4 },
  gallery: { produit: 10, geste: 9, lieu: 8, ambiance: 8, detail: 8, equipe: 7 },
  band: { ambiance: 10, lieu: 10, detail: 7, produit: 6, geste: 6, equipe: 3 },
  duo: { ambiance: 9, detail: 9, produit: 9, geste: 8, lieu: 8, equipe: 5 },
  process: { geste: 10, lieu: 7, equipe: 6, produit: 6, detail: 6, ambiance: 5 },
  page: { lieu: 9, ambiance: 9, produit: 8, geste: 8, detail: 6, equipe: 6 },
};
// Emplacements affichés en grand, sur toute la largeur : une photo en hauteur y serait très recadrée
const LARGES = new Set(['hero-bg', 'band']);
const GRANDS = new Set(['hero', 'hero-bg', 'band', 'page']);

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function orientation(img) {
  const w = Number(img?.w) || 0;
  const h = Number(img?.h) || 0;
  if (!w || !h) return '';
  const r = w / h;
  return r > 1.15 ? 'paysage' : r < 0.87 ? 'portrait' : 'carre';
}

// Une image reste-t-elle dans le site ? (photos écartées par l'IA ou par l'agence)
export function imageUtilisable(img) {
  if (!img) return false;
  if (img.choix === 'oui') return true;
  if (img.choix === 'non') return false;
  if (ROLES_ECARTES.includes(img.role)) return false;
  return img.utilisable !== false;
}

// Une photo liée à un service va de préférence à côté de ce service
export function memeService(img, service) {
  if (!img?.service || !service) return false;
  const a = norm(img.service);
  const b = norm(typeof service === 'string' ? service : service.name);
  return Boolean(a && b && (a === b || (a.length > 4 && b.includes(a)) || (b.length > 4 && a.includes(b))));
}

// Note d'une image pour un emplacement : plus elle est haute, mieux elle convient
function note(img, i, slot, st) {
  const kind = FIT[slot.kind] ? slot.kind : slot.kind === 'hero-bg' ? 'hero' : 'page';
  const role = ROLES.includes(img.role) ? img.role : '';
  const client = img.source === 'client';
  // Photo du client pas encore analysée : elle passe d'abord, comme avant
  let s = role ? FIT[kind][role] : client ? 10 : 7;
  if (client) s += 3;
  // L'ordre choisi par le client départage ses photos (la première en haut de page)
  if (client && !role) s -= 0.4 * st.rangClient.get(i);
  const o = orientation(img);
  if (LARGES.has(slot.kind)) s += o === 'paysage' ? 2 : o === 'portrait' ? -8 : o === 'carre' ? -2 : 0;
  else if (slot.kind === 'hero' && o === 'portrait') s -= 1;
  if (img.qualite === 'moyenne') s -= GRANDS.has(slot.kind) ? 4 : 1;
  const long = Math.max(Number(img.w) || 0, Number(img.h) || 0);
  if (long && long < 900 && GRANDS.has(slot.kind)) s -= 4;
  if (slot.service) {
    if (memeService(img, slot.service)) s += 20;
    else if (img.service) s -= 10;
  } else if (img.service && st.avecServices && slot.kind !== 'gallery') {
    // Gardée pour son service, plus bas dans la page : les autres images passent avant
    // (mais elle reste préférée à une image déjà montrée)
    s -= 30;
  }
  // Variété entre les styles : chacun départage autrement les images qui conviennent autant
  s += ((hashString(st.graine + ':' + (img.id || i)) % 1000) / 1000) * 2.5;
  // Une image déjà placée ne revient que s'il ne reste rien d'autre
  s -= 100 * (st.uses[i] || 0);
  if (i === st.last) s -= 50;
  return s;
}

// Crée le « distributeur » d'images d'une page : choisir(type, { service }) renvoie l'indice de
// l'image retenue dans la liste (ou un numéro d'illustration quand il n'y a aucune image).
export function distributeur(imgs, { graine = '', avecServices = false } = {}) {
  const n = imgs.length;
  const st = { uses: new Array(n).fill(0), last: -1, graine, avecServices, rangClient: new Map() };
  let r = 0;
  imgs.forEach((img, i) => img.source === 'client' && st.rangClient.set(i, r++));
  let illustration = 0;
  return function choisir(kind = 'page', opts = {}) {
    if (!n) return illustration++;
    const slot = { kind, service: opts.service || null };
    // Images d'un même groupe (mosaïque, galerie, duo) : toutes différentes quand c'est possible
    const eviter = opts.eviter && opts.eviter.size < n ? opts.eviter : null;
    let best = 0;
    let bestNote = -Infinity;
    for (let i = 0; i < n; i++) {
      if (eviter?.has(i)) continue;
      const s = note(imgs[i], i, slot, st);
      if (s > bestNote) {
        bestNote = s;
        best = i;
      }
    }
    st.uses[best]++;
    st.last = best;
    return best;
  };
}

// Descriptions d'images à faire créer par l'IA, d'après les photos utilisables du client :
// chaque photo couvre une description du même rôle ; s'il n'y a pas de belle photo pour le
// haut de page, la vue d'ensemble est créée quand même.
export function imagesAFaire(prompts, photos, { cible = 10, max = 8 } = {}) {
  const list = (prompts || []).slice(0, max).map((p, i) => ({ ...p, role: p.role || IMAGE_ROLES[i] || 'detail' }));
  const bonnes = (photos || []).filter(imageUtilisable);
  const analysees = bonnes.filter((p) => p.role);
  // Photos jamais analysées (pas de clé Claude) : on complète simplement jusqu'à la cible
  if (!analysees.length) return list.slice(0, Math.max(0, Math.min(max, cible - bonnes.length)));
  const pool = analysees.filter((p) => p.qualite !== 'faible');
  const manquent = [];
  for (const p of list) {
    const j = pool.findIndex((x) => x.role === p.role);
    if (j >= 0) pool.splice(j, 1);
    else manquent.push(p);
  }
  let res = manquent.slice(0, Math.max(0, cible - bonnes.length));
  const hautOk = bonnes.some((p) => ['lieu', 'ambiance', 'produit'].includes(p.role) && orientation(p) !== 'portrait' && p.qualite !== 'moyenne' && p.qualite !== 'faible');
  const vue = list.find((p) => p.role === 'lieu');
  if (!hautOk && vue && !res.includes(vue)) res = [vue, ...res];
  return res;
}
