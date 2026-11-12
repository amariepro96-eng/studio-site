// Éditeur visuel (onglet « Mise en page et textes » de l'espace du site) :
// sections de la page d'accueil (ordre, masquées, style), textes du site, photos imposées.
// Ce qui est modifié est rangé dans content.edition (et dans les champs de texte du contenu) :
// un site sans content.edition s'affiche exactement comme avant.
import { hashString } from './util.js';
import { HEROS_MISE } from './trames.js';

// ---------- Les modules de la page d'accueil ----------
// textes : champs modifiables (voir TEXTES) ; photos(v) : nombre de photos qu'on peut imposer
const V = (...l) => l.map(([v, label]) => ({ v, label }));
const GALERIE_N = { masonry: 6, grid: 6, strip: 8, polaroid: 5, bento: 4, asym: 5, eventail: 6 };

export const MODULES = {
  hero: { label: 'Haut de page', aide: 'Toujours en premier.', textes: ['heroTitre', 'heroSous', 'heroBouton'], photos: (v) => (v === 'mosaic' || v === 'collage' ? 3 : v === 'diptyque' ? 2 : 1) },
  marquee: { label: 'Bandeau défilant', aide: 'Reprend le nom et les titres des points forts.', textes: [], liste: 'points' },
  stripes: { label: 'Rayures', aide: 'Simple décor du style.', textes: [] },
  statement: { label: 'Phrase forte', variantes: V(['left', 'À gauche'], ['center', 'Centrée'], ['paragraphe', 'Grand paragraphe']), textes: ['statement'] },
  highlights: { label: 'Points forts', variantes: V(['cards', 'Cartes'], ['lined', 'Lignes'], ['icons', 'Icônes centrées'], ['tiles', 'Tuiles'], ['bento', 'Mosaïque']), textes: ['highlightsTitle', 'highlightsIntro'], liste: 'points' },
  offer: { label: 'L’offre', variantes: V(['cards', 'Cartes'], ['menu', 'Menu'], ['grid', 'Grille'], ['alternate', 'Alternée avec photos'], ['index', 'Liste numérotée']), textes: ['servicesTitle', 'servicesIntro'], lien: 'offre' },
  offer2: { label: 'Les services', boutique: true, textes: ['servicesTitle', 'servicesIntro'], lien: 'offre' },
  motsimages: { label: 'Phrase et photos', aide: 'La phrase forte, avec deux petites photos glissées entre les mots.', textes: ['statement'], photos: () => 2 },
  portes: { label: 'Deux portes', aide: 'Deux grandes entrées en photo : l’offre et l’histoire (ou la visite).', textes: [], photos: () => 2 },
  manifeste: { label: 'Bande manifeste', textes: ['aboutTitle', 'aboutQuote', 'aboutIntro'] },
  grandmot: { label: 'Nom géant', aide: 'Le nom en très grand, avec l’accroche dessous.', textes: ['accroche'] },
  gallery: { label: 'Galerie photos', variantes: V(['grid', 'Grille'], ['asym', 'Asymétrique'], ['eventail', 'En éventail'], ['masonry', 'Mur de photos'], ['polaroid', 'Polaroïds'], ['strip', 'Bandeau'], ['bento', 'Mosaïque']), textes: ['galleryTitle', 'galleryIntro'], photos: (v) => GALERIE_N[v] || 6 },
  band: { label: 'Grande photo', variantes: V(['plain', 'Une photo'], ['quote', 'Photo et citation'], ['duo', 'Deux photos']), textes: ['aboutQuote'], photos: (v) => (v === 'duo' ? 2 : 1) },
  process: { label: 'Étapes', variantes: V(['line', 'En ligne'], ['cards', 'Cartes'], ['image', 'Avec une photo']), textes: ['processTitle', 'processIntro'], liste: 'etapes', photos: (v) => (v === 'image' ? 1 : 0) },
  about: { label: 'Présentation', variantes: V(['split', 'Photo et texte'], ['quote', 'Citation']), textes: ['aboutTitle', 'aboutIntro', 'aboutQuote'], photos: (v) => (v === 'quote' ? 0 : 1) },
  reviews: { label: 'Avis clients', textes: ['reviewsTitle', 'avis'] },
  cta: { label: 'Appel à l’action', variantes: V(['band', 'Bande de couleur'], ['boxed', 'Encadré'], ['split', 'Avec les coordonnées'], ['image', 'Sur une photo']), textes: ['ctaTitre', 'ctaTexte', 'heroBouton'], photos: (v) => (v === 'image' ? 1 : 0) },
  info: { label: 'Infos pratiques', aide: 'Adresse, horaires, téléphone : ils se changent dans « Horaires et contact ».', textes: [], lien: 'horaires' },
  duo: {
    label: 'Deux blocs côte à côte',
    variantes: V(['about+visual', 'Présentation + photo'], ['highlights+visual', 'Points forts + photo'], ['process+visual', 'Étapes + photo'], ['highlights+about', 'Points forts + présentation'], ['statement+about', 'Phrase forte + présentation'], ['highlights+reviews', 'Points forts + avis'], ['reviews+info', 'Avis + infos pratiques']),
    textes: [],
    photos: (v) => (String(v).includes('visual') ? 1 : 0),
  },
  sommaire: { label: 'Sommaire du site', aide: 'De grandes tuiles vers les autres pages.', textes: [] },
};
// Textes des moitiés d'un duo
const DEMI = { about: ['aboutTitle', 'aboutIntro'], highlights: ['highlightsTitle'], statement: ['statement'], process: ['processTitle'], reviews: ['reviewsTitle', 'avis'], info: [], visual: [] };
const LISTE_DEMI = { highlights: 'points', process: 'etapes' };

export function nomModule(t, { boutique = false, offre = '' } = {}) {
  if (t === 'offer') return boutique ? 'Les produits' : offre || 'L’offre';
  return MODULES[t]?.label || t;
}
export const textesDuModule = (t, v) => (t === 'duo' ? String(v || '').split('+').flatMap((k) => DEMI[k] || []) : MODULES[t]?.textes || []);
export const listeDuModule = (t, v) => (t === 'duo' ? String(v || '').split('+').map((k) => LISTE_DEMI[k]).find(Boolean) || null : MODULES[t]?.liste || null);
export const photosDuModule = (t, v) => MODULES[t]?.photos?.(v) || 0;
// Modules qu'on peut ajouter (un site vitrine n'a pas de « services en plus »)
export const modulesAjoutables = (boutique) => Object.keys(MODULES).filter((t) => t !== 'hero' && t !== 'stripes' && (!MODULES[t].boutique || boutique));

// ---------- Les textes modifiables ----------
// chemin : dans le contenu ; « brief.x » : dans le brief ; « edition.hero.x » : texte du haut de page propre au site
export const TEXTES = {
  heroTitre: { nom: 'Titre du haut de page', chemin: 'edition.hero.titre', label: 'Titre', max: 160, lignes: 2 },
  heroSous: { nom: 'Texte du haut de page', chemin: 'edition.hero.sous', label: 'Texte sous le titre', max: 400, lignes: 3 },
  heroBouton: { nom: 'Bouton principal', chemin: 'edition.hero.bouton', label: 'Texte du bouton principal', aide: 'Le même partout sur le site. Vide : texte automatique (Réserver, Nous contacter…).', max: 40, lignes: 1 },
  statement: { chemin: 'statement', label: 'Phrase forte', max: 600, lignes: 3 },
  highlightsTitle: { chemin: 'highlightsTitle', label: 'Titre des points forts', max: 120, lignes: 1 },
  highlightsIntro: { nom: 'Introduction des points forts', chemin: 'highlightsIntro', label: 'Introduction', max: 300, lignes: 2 },
  servicesTitle: { chemin: 'servicesTitle', label: 'Titre de l’offre', max: 120, lignes: 1 },
  servicesIntro: { chemin: 'servicesIntro', label: 'Introduction de l’offre', max: 400, lignes: 2 },
  productsTitle: { chemin: 'productsTitle', label: 'Titre de la boutique', max: 120, lignes: 1, boutique: true },
  productsIntro: { chemin: 'productsIntro', label: 'Introduction de la boutique', max: 400, lignes: 2, boutique: true },
  aboutTitle: { chemin: 'about.title', label: 'Titre de la présentation', max: 120, lignes: 1 },
  aboutIntro: { chemin: 'about.intro', label: 'Présentation', max: 600, lignes: 4 },
  aboutQuote: { chemin: 'about.quote', label: 'Citation', max: 300, lignes: 2 },
  aboutStory: { chemin: 'about.story', label: 'Notre histoire', aide: 'Une ligne vide entre deux paragraphes.', max: 3000, lignes: 8, paragraphes: true },
  valuesTitle: { chemin: 'about.valuesTitle', label: 'Titre des valeurs', max: 120, lignes: 1 },
  processTitle: { chemin: 'process.title', label: 'Titre des étapes', max: 120, lignes: 1 },
  processIntro: { nom: 'Introduction des étapes', chemin: 'process.intro', label: 'Introduction', max: 300, lignes: 2 },
  galleryTitle: { chemin: 'galleryTitle', label: 'Titre de la galerie', max: 120, lignes: 1 },
  galleryIntro: { nom: 'Introduction de la galerie', chemin: 'galleryIntro', label: 'Introduction', max: 300, lignes: 2 },
  reviewsTitle: { chemin: 'reviewsTitle', label: 'Titre des avis', aide: 'Vide : « Ils nous font confiance ».', max: 120, lignes: 1 },
  avis: { nom: 'Avis clients', chemin: 'brief.reviews', label: 'Avis', aide: 'Un avis par ligne. Pour le signer : texte — prénom.', max: 3000, lignes: 6 },
  ctaTitre: { chemin: 'ctaBand.title', label: 'Titre de l’appel à l’action', max: 120, lignes: 1 },
  ctaTexte: { nom: 'Texte de l’appel à l’action', chemin: 'ctaBand.text', label: 'Texte', max: 300, lignes: 2 },
  faqIntro: { chemin: 'faqIntro', label: 'Introduction de la FAQ', max: 300, lignes: 2 },
  contactTitle: { nom: 'Titre de la page Contact', chemin: 'contact.title', label: 'Titre de la page', max: 120, lignes: 1 },
  contactIntro: { nom: 'Introduction de la page Contact', chemin: 'contact.intro', label: 'Introduction', max: 400, lignes: 2 },
  contactFormTitle: { nom: 'Titre du formulaire de contact', chemin: 'contact.formTitle', label: 'Titre du formulaire', max: 80, lignes: 1 },
  accroche: { chemin: 'brand.tagline', label: 'Accroche', aide: 'Reprise dans le pied de page et le titre de l’onglet.', max: 160, lignes: 1 },
  seoTitle: { chemin: 'seo.title', label: 'Titre dans Google', aide: '60 caractères environ.', max: 70, lignes: 1 },
  seoDescription: { chemin: 'seo.description', label: 'Description dans Google', aide: '150 caractères environ.', max: 170, lignes: 2 },
};
// Listes de petits blocs (titre + texte) : on modifie, ajoute ou retire des lignes
export const LISTES = {
  points: { chemin: 'highlights', label: 'Points forts', resume: 'Points forts modifiés', max: 6, ajout: 'Ajouter un point fort', icone: true },
  valeurs: { chemin: 'about.values', label: 'Valeurs', resume: 'Valeurs modifiées', max: 6, ajout: 'Ajouter une valeur', icone: true },
  etapes: { chemin: 'process.steps', label: 'Étapes', resume: 'Étapes modifiées', max: 4, ajout: 'Ajouter une étape' },
};

// ---------- Les autres pages (blocs fixes, textes et photos modifiables) ----------
export function blocsDePage(slug, { boutique = false, offre = 'L’offre' } = {}) {
  const cta = { id: 'cta', label: 'Appel à l’action', textes: ['ctaTitre', 'ctaTexte', 'heroBouton'] };
  switch (slug) {
    case 'a-propos':
      return [
        { id: 'tete', label: 'En-tête de la page', textes: ['aboutTitle', 'aboutIntro'] },
        { id: 'histoire', label: 'Notre histoire', textes: ['aboutStory'], photos: { cle: 'p-a-propos', n: 1 } },
        { id: 'valeurs', label: 'Nos valeurs', textes: ['valuesTitle'], liste: 'valeurs' },
        { id: 'galerie', label: 'Galerie photos', textes: ['galleryTitle'], photos: { cle: 'p-a-propos-galerie', n: 6 } },
        cta,
      ];
    case 'services':
      return [
        { id: 'tete', label: 'En-tête de la page', textes: ['servicesTitle', 'servicesIntro'] },
        { id: 'photo', label: 'Photo', photos: { cle: 'p-services', n: 1 } },
        { id: 'liste', label: offre, aide: 'Les lignes, prix et descriptions se changent dans la rubrique de l’offre.', lien: 'offre' },
        cta,
      ];
    case 'boutique':
      return [
        { id: 'tete', label: 'En-tête de la page', textes: ['productsTitle', 'productsIntro'] },
        { id: 'liste', label: 'Les produits', aide: 'Les produits se changent dans la rubrique « Boutique ».', lien: 'boutique' },
      ];
    case 'faq':
      return [
        { id: 'tete', label: 'En-tête de la page', textes: ['faqIntro'] },
        { id: 'faq', label: 'Questions et réponses', faq: true },
        cta,
      ];
    case 'contact':
      return [
        { id: 'tete', label: 'En-tête de la page', textes: ['contactTitle', 'contactIntro'] },
        { id: 'contact', label: 'Coordonnées et formulaire', textes: ['contactFormTitle'], aide: 'Adresse, horaires, téléphone : rubrique « Horaires et contact ».', lien: 'horaires' },
      ];
    default:
      return [];
  }
}
// Réglages communs à tout le site (bas du panneau)
export const BLOC_SITE = { id: 'site', label: 'Accroche et référencement Google', textes: ['accroche', 'seoTitle', 'seoDescription'] };

// ---------- Sections de la page d'accueil ----------
// La liste éditée est liée au modèle : si on change de modèle ou de mise en page, l'accueil reprend la nouvelle
export function signatureModele(model) {
  if (!model) return '';
  return String(hashString([model.archetype || '', model.flavor || '', Number(model.seed) || 0, model.mise?.trame || '', model.mise?.hero || ''].join('|')) >>> 0);
}

// Sections telles que le modèle les affiche (jetons du rendu) : identifiants stables par position
export const sectionsDeJetons = (tokens) => (tokens || []).map((x, i) => ({ id: `${x.name}${i}`, t: x.name, v: x.v || '' }));

const ID_SECTION = /^[a-z0-9]{2,16}$/i;
const ID_PHOTO = /^[A-Za-z0-9_.-]{4,80}$/;
const CLE_PHOTOS = /^[a-z0-9-]{2,30}$/i;

export function variantesHero(heroes = []) {
  return [...new Set(heroes)];
}
export const NOMS_HEROS = {
  split: 'Texte et photo',
  overlay: 'Photo en fond',
  cover: 'Photo plein écran',
  panel: 'Encadré sur photo',
  bigtype: 'Grand titre',
  centered: 'Centré',
  framed: 'Photo encadrée',
  mosaic: 'Trois photos',
  collage: 'Collage',
  masthead: 'Nom en bandeau',
  scinde: 'Nom coupé en deux',
  capsule: 'Photo en capsule',
  diptyque: 'Diptyque',
  pied: 'Nom en pied de photo',
  objet: 'Photo seule au centre',
  arche: 'Photo en arche',
  affiche: 'Titre affiche',
};
const HEROS_CONNUS = new Set(Object.keys(NOMS_HEROS));

function nettoyerSection(s, ids, boutique) {
  if (!s || typeof s !== 'object' || !MODULES[s.t]) return null;
  if (MODULES[s.t].boutique && !boutique) return null;
  let id = ID_SECTION.test(s.id || '') ? s.id : '';
  if (!id || ids.has(id)) {
    let n = 0;
    do id = `${s.t.slice(0, 8)}x${(n++).toString(36)}`;
    while (ids.has(id));
  }
  ids.add(id);
  const vs = MODULES[s.t].variantes?.map((x) => x.v) || [];
  let v = typeof s.v === 'string' ? s.v : '';
  if (s.t === 'hero') v = HEROS_CONNUS.has(v) ? v : '';
  else if (!vs.includes(v)) v = '';
  return { id, t: s.t, v, ...(s.cache && s.t !== 'hero' ? { cache: true } : {}) };
}

// Contrôle de ce que l'éditeur envoie (navigateur et serveur)
export function nettoyerEdition(brut, { boutique = false } = {}) {
  const e = brut && typeof brut === 'object' ? brut : {};
  const out = { pour: typeof e.pour === 'string' ? e.pour.slice(0, 24) : '', accueil: null, photos: {} };
  if (Array.isArray(e.accueil) && e.accueil.length) {
    const ids = new Set();
    let liste = e.accueil.slice(0, 30).map((s) => nettoyerSection(s, ids, boutique)).filter(Boolean);
    // Un seul haut de page, toujours en premier
    const hero = liste.find((s) => s.t === 'hero');
    liste = liste.filter((s) => s.t !== 'hero');
    if (hero) liste.unshift(hero);
    out.accueil = hero ? liste : null;
  }
  if (e.photos && typeof e.photos === 'object') {
    for (const [k, l] of Object.entries(e.photos).slice(0, 40)) {
      if (!CLE_PHOTOS.test(k) || !Array.isArray(l)) continue;
      const ids = [...new Set(l.filter((x) => typeof x === 'string' && ID_PHOTO.test(x)))].slice(0, 8);
      if (ids.length) out.photos[k] = ids;
    }
  }
  if (!out.accueil) out.pour = '';
  return out;
}

// Sections du modèle, telles que l'éditeur les montre (sans celles qui n'affichent rien pour ce type de site)
export const sectionsUtiles = (sections, boutique) => (Array.isArray(sections) && sections.length ? nettoyerEdition({ accueil: sections }, { boutique }).accueil : null);

export const editionVide = (ed) => !ed || (!ed.accueil && !Object.keys(ed.photos || {}).length);

// Les réglages de l'accueil (ordre, photos des sections) valent pour le modèle qui les a reçus :
// après un changement de modèle ou de mise en page, l'accueil reprend celle du nouveau modèle
export function accueilLie(content, model) {
  const ed = content?.edition;
  return Boolean(ed) && (!ed.pour || !model || ed.pour === signatureModele(model));
}

// Sections de l'accueil à afficher pour ce modèle (null : celles du modèle)
export function accueilEdite(content, model) {
  const ed = content?.edition;
  if (!ed || !Array.isArray(ed.accueil) || !ed.accueil.length || !accueilLie(content, model)) return null;
  return ed.accueil.filter((s) => s && MODULES[s.t]);
}

// Photos imposées à un emplacement : section de l'accueil (son identifiant) ou bloc d'une page (« p-… »)
export function photosImposees(content, cle) {
  const l = content?.edition?.photos?.[cle];
  return Array.isArray(l) && l.length ? l : null;
}
export const clePage = (cle) => String(cle).startsWith('p-');

// Même liste que celle du modèle (ordre, styles, rien de masqué) ?
export const memesSections = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((s, i) => s.id === b[i].id && s.t === b[i].t && (s.v || '') === (b[i].v || '') && !s.cache);

export const heroValide = (v) => HEROS_CONNUS.has(v);
export { HEROS_MISE };
