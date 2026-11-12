// Mise en page de la page d'accueil, indépendante du style : chaque modèle d'une même génération
// reçoit une combinaison différente, pour que les 10 propositions ne se ressemblent pas.
//   trame  : l'ordre des modules, les modules côte à côte (duo), le sommaire
//   tetes  : la place des titres de section (au-dessus, en colonne, en ligne, numérotés, centrés)
//   rythme : la séparation des sections (bandes alternées, filets, panneaux)
//   hero   : le haut de page, pris dans ceux du style, sans doublon dans la génération
// Un modèle sans « mise » (sites générés avant) garde exactement son ancienne mise en page.
import { rng } from './util.js';

// Jetons : 'module' ou 'module:variante' ; 'duo:a+b' = deux modules côte à côte (a, b parmi
// about, highlights, reviews, info, process, statement, visual) ; 'sommaire' = les pages du site.
// La variante d'un module sans variante imposée est celle du style (ses recettes).
export const TRAMES = [
  { id: 'style', label: 'Signature du style', tokens: null }, // la recette propre au style
  { id: 'photos', label: 'Photos d’abord', tokens: ['hero', 'gallery', 'statement', 'offer', 'offer2', 'about:split', 'reviews', 'cta:image', 'info'] },
  { id: 'offre', label: 'Offre d’abord', tokens: ['hero', 'offer', 'offer2', 'reviews', 'duo:highlights+about', 'gallery', 'cta:split', 'info'] },
  { id: 'recit', label: 'Récit', tokens: ['hero', 'statement', 'about:split', 'process:image', 'gallery', 'offer', 'offer2', 'band:quote', 'cta', 'info'] },
  { id: 'pratique', label: 'Pratique', tokens: ['hero', 'info', 'offer', 'offer2', 'duo:highlights+reviews', 'gallery', 'cta:boxed'] },
  { id: 'magazine', label: 'Magazine', tokens: ['hero', 'duo:statement+about', 'gallery', 'offer', 'offer2', 'band:quote', 'duo:reviews+info', 'cta'] },
  { id: 'sommaire', label: 'Sommaire', tokens: ['hero', 'sommaire', 'highlights', 'offer', 'offer2', 'gallery', 'cta:split', 'info'] },
  { id: 'confiance', label: 'Avis d’abord', tokens: ['hero', 'reviews', 'offer', 'offer2', 'process', 'about:quote', 'gallery', 'cta', 'info'] },
  { id: 'immersif', label: 'Immersif', tokens: ['hero', 'band:duo', 'statement', 'offer', 'offer2', 'gallery', 'band:quote', 'cta:image', 'info'] },
  { id: 'etapes', label: 'Pas à pas', tokens: ['hero', 'process', 'offer', 'offer2', 'duo:about+visual', 'reviews', 'cta:band', 'info'] },
  { id: 'colonnes', label: 'En colonnes', tokens: ['hero', 'duo:highlights+visual', 'offer', 'offer2', 'duo:process+visual', 'gallery', 'cta:split', 'info'] },
  { id: 'essentiel', label: 'Essentiel', tokens: ['hero', 'statement', 'offer', 'offer2', 'gallery', 'duo:reviews+info', 'cta:boxed'] },
  // Inspirées de sites tendance (novembre 2026) : grandes lettres, phrases illustrées, listes index…
  { id: 'affiche', label: 'Affiche', tokens: ['hero', 'manifeste', 'offer:index', 'offer2', 'gallery:eventail', 'grandmot', 'cta', 'info'] },
  { id: 'motsimages', label: 'Mots et images', tokens: ['hero', 'motsimages', 'portes', 'offer', 'offer2', 'gallery:asym', 'cta:split', 'info'] },
  { id: 'carnet', label: 'Carnet', tokens: ['hero', 'statement:paragraphe', 'gallery:asym', 'offer:index', 'offer2', 'duo:about+visual', 'reviews', 'cta'] },
  { id: 'portes', label: 'Deux portes', tokens: ['hero', 'portes', 'statement', 'offer', 'offer2', 'gallery:eventail', 'reviews', 'cta:image', 'info'] },
  { id: 'manifeste', label: 'Manifeste', tokens: ['hero', 'statement:paragraphe', 'manifeste', 'offer', 'offer2', 'gallery', 'duo:reviews+info', 'cta:boxed'] },
  { id: 'liste', label: 'Liste', tokens: ['hero', 'offer:index', 'offer2', 'motsimages', 'gallery:asym', 'grandmot', 'cta:split', 'info'] },
];

// Hauts de page inspirés de sites tendance, ajoutés à ceux de chaque style (modèles avec mise en page)
export const HEROS_MISE = ['masthead', 'scinde', 'capsule', 'diptyque', 'pied', 'objet', 'arche', 'affiche'];
const HEROS_PAR_STYLE = {
  epure: ['masthead', 'objet', 'scinde'],
  editorial: ['masthead', 'scinde', 'pied'],
  luxe: ['diptyque', 'objet', 'pied'],
  artisan: ['capsule', 'arche', 'diptyque'],
  tech: ['objet', 'arche', 'scinde'],
  ludique: ['affiche', 'arche', 'capsule'],
  brutal: ['affiche', 'masthead', 'pied'],
  nature: ['diptyque', 'capsule', 'arche'],
  corporate: ['diptyque', 'objet', 'masthead'],
  retro: ['capsule', 'masthead', 'affiche'],
  audacieux: ['affiche', 'pied', 'scinde'],
  doux: ['arche', 'capsule', 'objet'],
};
// Les nouveaux en alternance avec ceux du style : la génération en montre beaucoup de différents
export function herosDuStyle(archId, heroes = []) {
  const plus = HEROS_PAR_STYLE[archId] || [];
  const out = [];
  for (let i = 0; i < Math.max(plus.length, heroes.length); i++) {
    if (plus[i]) out.push(plus[i]);
    if (heroes[i]) out.push(heroes[i]);
  }
  return [...new Set(out)];
}

// Accents de page : badge rond qui tourne (action principale), cadre de couleur, étiquettes inclinées
export const DECOS = ['badge', 'cadre', 'etiquettes'];
export const TRAME_MAP = Object.fromEntries(TRAMES.map((t) => [t.id, t]));

// Description de chaque agencement, pour que l'IA reconnaisse celui d'un site analysé
export const DESCRIPTIONS_TRAMES = {
  photos: 'grandes photos juste après le haut de page, puis le texte',
  offre: 'les produits ou prestations tout de suite, puis les avis et la présentation',
  recit: 'une histoire racontée : présentation, savoir-faire étape par étape, puis l’offre',
  pratique: 'infos pratiques (adresse, horaires, téléphone) dès le haut de la page',
  magazine: 'mise en page de magazine : blocs côte à côte, citations, grandes images',
  sommaire: 'page d’accueil en sommaire : de grandes tuiles vers les pages du site',
  confiance: 'les avis clients et les garanties en premier',
  immersif: 'très visuel : photos pleine largeur, citations sur image, peu de texte',
  etapes: 'le déroulement (comment ça se passe) mis en avant',
  colonnes: 'sections en deux colonnes, texte d’un côté et photo de l’autre, en alternance',
  essentiel: 'page courte et épurée, quelques sections seulement',
  affiche: 'couleurs franches et très grandes lettres, liste en gros caractères, cartes inclinées',
  motsimages: 'phrases en grand avec de petites photos glissées entre les mots, collage de photos',
  carnet: 'grand paragraphe d’introduction, collage de photos, offre en liste de grandes lignes',
  portes: 'deux grandes images côte à côte qui mènent aux deux offres principales',
  manifeste: 'un manifeste en grand sur une bande de couleur, puis l’offre',
  liste: 'l’offre en liste de très grandes lignes, le nom en très grand',
};
export const TRAMES_INSPIRATION = Object.keys(DESCRIPTIONS_TRAMES);

export const TETES = [
  { id: 'haut', label: 'Titres au-dessus' },
  { id: 'cote', label: 'Titres en colonne' },
  { id: 'ligne', label: 'Titre et texte en ligne' },
  { id: 'numero', label: 'Sections numérotées' },
  { id: 'centre', label: 'Titres centrés' },
];
export const RYTHMES = [
  { id: 'bandes', label: 'Bandes alternées' },
  { id: 'filets', label: 'Filets' },
  { id: 'cartes', label: 'Panneaux' },
];
const IDS = (l) => l.map((x) => x.id);
export const miseValide = (mise) => Boolean(mise && TRAME_MAP[mise.trame] && IDS(TETES).includes(mise.tetes) && IDS(RYTHMES).includes(mise.rythme) && (!mise.deco || DECOS.includes(mise.deco)));
// Noms affichés à l'agence sous chaque modèle
const NOMS_HEROS = { masthead: 'nom en bandeau', scinde: 'nom coupé en deux', capsule: 'photo en capsule', diptyque: 'diptyque', pied: 'nom en pied de photo', objet: 'photo seule au centre', arche: 'photo en arche', affiche: 'titre affiche' };
const NOMS_DECOS = { badge: 'badge tournant', cadre: 'cadre de page', etiquettes: 'titres étiquettes' };
export const nomMise = (mise) =>
  miseValide(mise) ? [TRAME_MAP[mise.trame].label, NOMS_HEROS[mise.hero], NOMS_DECOS[mise.deco]].filter(Boolean).join(' · ') : '';

function melanger(liste, graine) {
  const r = rng(graine);
  const out = [...liste];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Mises en page des modèles d'une génération : toutes les trames différentes (12 pour 10 modèles),
 * titres et rythmes qui tournent pour que deux modèles ne partagent jamais la même combinaison,
 * hauts de page sans doublon tant que les styles le permettent.
 * heroes(i) : les hauts de page possibles pour le i-ème modèle (ceux de son style).
 */
export function repartirMises(n, { graine = 1, heroes = () => [], preferees = [] } = {}) {
  let trames = melanger(IDS(TRAMES), graine);
  // La signature du style reste parmi les premières propositions
  const iStyle = trames.indexOf('style');
  if (iStyle > 3) [trames[iStyle], trames[graine % 3]] = [trames[graine % 3], trames[iStyle]];
  // Bibliothèque d'inspiration : les agencements des meilleurs sites du métier vont aux premiers modèles
  const conseillees = [...new Set((Array.isArray(preferees) ? preferees : []).filter((t) => TRAMES_INSPIRATION.includes(t)))].slice(0, 4);
  if (conseillees.length) trames = [...conseillees, ...trames.filter((t) => !conseillees.includes(t))];
  const tetes = melanger(IDS(TETES), graine * 7 + 1);
  const rythmes = melanger(IDS(RYTHMES), graine * 13 + 5);
  const decos = melanger(['', ...DECOS, '', ...DECOS], graine * 3 + 2);
  const out = Array.from({ length: n }, (_, i) => ({
    trame: trames[i % trames.length],
    ...(conseillees.includes(trames[i % trames.length]) ? { bibliotheque: true } : {}),
    ...(decos[i % decos.length] ? { deco: decos[i % decos.length] } : {}),
    tetes: tetes[i % tetes.length],
    // 3 rythmes et 5 placements de titres : 15 combinaisons différentes, décalées d'un modèle à l'autre
    rythme: rythmes[(i + 2 * Math.floor(i / tetes.length)) % rythmes.length],
  }));
  // Hauts de page : les styles qui ont le moins de choix servent d'abord
  const pris = new Map();
  const ordre = [...out.keys()].sort((a, b) => heroes(a).length - heroes(b).length || a - b);
  for (const i of ordre) {
    // Le point de départ dans la liste du style change d'un client à l'autre : pas toujours le même haut de page
    const brut = heroes(i);
    if (!brut.length) continue;
    const pool = brut.map((_, k) => brut[(k + graine + i) % brut.length]);
    const libre = pool.find((h) => !pris.has(h));
    const h = libre || [...pool].sort((x, y) => (pris.get(x) || 0) - (pris.get(y) || 0))[0];
    pris.set(h, (pris.get(h) || 0) + 1);
    out[i].hero = h;
  }
  return out;
}

// Les versions 2 à 4 d'un style : chacune une autre trame, d'autres titres, un autre rythme
export function miseDeVersion(mise, k) {
  if (!miseValide(mise)) return undefined;
  const decale = (liste, id, pas) => {
    const ids = IDS(liste);
    return ids[(ids.indexOf(id) + pas) % ids.length];
  };
  const deco = ['', ...DECOS][(DECOS.indexOf(mise.deco) + 1 + k) % (DECOS.length + 1)];
  return {
    trame: decale(TRAMES, mise.trame, 3 * k + 1),
    tetes: decale(TETES, mise.tetes, k),
    rythme: decale(RYTHMES, mise.rythme, k),
    ...(deco ? { deco } : {}),
  };
}

// « Varier » : la mise en page suivante (autre trame, et titres ou rythme qui changent aussi)
export function varierMise(mise, pas = 1) {
  if (!miseValide(mise)) return undefined;
  const t = IDS(TRAMES);
  const h = IDS(TETES);
  const r = IDS(RYTHMES);
  return {
    trame: t[(t.indexOf(mise.trame) + 5 * pas) % t.length],
    tetes: h[(h.indexOf(mise.tetes) + 2 * pas) % h.length],
    rythme: r[(r.indexOf(mise.rythme) + pas) % r.length],
    ...(mise.deco ? { deco: mise.deco } : {}),
    // Le haut de page est tiré à nouveau parmi ceux du style (graine suivante)
  };
}

/**
 * Les modules de la page d'accueil pour une trame, avec les variantes du style.
 * comp : la composition du style (ses recettes) ; choose : tirage d'une variante dans une liste.
 */
export function modulesDeTrame(trameId, comp, choose) {
  const recettes = comp?.recipes || [];
  const trame = TRAME_MAP[trameId];
  const versJeton = (tok) => {
    const [name, pool] = tok.split(':');
    return { name, v: pool ? choose(pool.split('|')) : '' };
  };
  if (!trame?.tokens) return (recettes[0] || ['hero', 'offer', 'offer2', 'cta', 'info']).map(versJeton);
  // Variante que le style donne à ce module (dans sa 1re recette, sinon la 2e)
  const duStyle = (name) => {
    for (const r of recettes)
      for (const tok of r) {
        const [n, pool] = tok.split(':');
        if (n === name && pool) return pool;
      }
    return '';
  };
  // Signature du style (bandeau défilant, rayures) gardée juste après le haut de page
  const signature = (recettes[0] || []).find((t) => t === 'marquee' || t === 'stripes');
  const out = [];
  for (const tok of trame.tokens) {
    const [name, impose] = tok.split(':');
    if (name === 'duo' || name === 'sommaire') out.push({ name, v: impose || '' });
    else {
      const pool = impose || duStyle(name);
      out.push({ name, v: pool ? choose(pool.split('|')) : '' });
    }
    if (name === 'hero' && signature) out.push({ name: signature, v: '' });
  }
  return out;
}
