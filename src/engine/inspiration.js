// Inspiration : vocabulaire commun à l'agent (serveur), à la génération et à l'écran agence.
// Rien ici ne touche au réseau : utilisable partout.
import { ARCHETYPES } from './archetypes.js';
import { TRAMES_INSPIRATION } from './trames.js';

// Fonctionnalités repérées sur les sites visités (et proposées au client si elles lui servent)
export const FONCTIONNALITES = [
  { id: 'reservation_en_ligne', label: 'Réservation ou rendez-vous en ligne' },
  { id: 'commande_en_ligne', label: 'Commande en ligne (à emporter, click & collect)' },
  { id: 'livraison', label: 'Livraison' },
  { id: 'boutique', label: 'Boutique en ligne' },
  { id: 'carte_menu', label: 'Carte, menu ou prestations détaillées' },
  { id: 'prix_affiches', label: 'Prix affichés' },
  { id: 'devis', label: 'Demande de devis' },
  { id: 'carte_cadeau', label: 'Cartes ou bons cadeaux' },
  { id: 'avis_clients', label: 'Avis clients' },
  { id: 'galerie', label: 'Galerie photo ou réalisations' },
  { id: 'avant_apres', label: 'Avant / après' },
  { id: 'video', label: 'Vidéo' },
  { id: 'equipe', label: 'Présentation de l’équipe' },
  { id: 'histoire', label: 'Histoire et savoir-faire' },
  { id: 'engagements', label: 'Engagements, labels, valeurs' },
  { id: 'horaires', label: 'Horaires bien visibles' },
  { id: 'plan_acces', label: 'Plan d’accès' },
  { id: 'telephone_clic', label: 'Appel en un clic' },
  { id: 'messagerie', label: 'WhatsApp ou messagerie instantanée' },
  { id: 'formulaire_contact', label: 'Formulaire de contact' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'reseaux_sociaux', label: 'Réseaux sociaux, fil Instagram' },
  { id: 'faq', label: 'Questions fréquentes' },
  { id: 'blog', label: 'Actualités ou blog' },
  { id: 'evenements', label: 'Événements, agenda, ateliers' },
  { id: 'fidelite', label: 'Programme de fidélité' },
  { id: 'multilingue', label: 'Plusieurs langues' },
  { id: 'allergenes', label: 'Allergènes, composition des produits' },
  { id: 'zone_intervention', label: 'Zone d’intervention' },
  { id: 'urgence', label: 'Dépannage ou urgence' },
  { id: 'pdf', label: 'Menu, tarifs ou catalogue en PDF' },
  { id: 'references', label: 'Références, partenaires, presse' },
];
export const IDS_FONCTIONNALITES = FONCTIONNALITES.map((f) => f.id);
export const labelFonctionnalite = (id) => FONCTIONNALITES.find((f) => f.id === id)?.label || id;

// Fonctionnalités que Studio Site sait déjà mettre sur un site (case du questionnaire correspondante)
export const DANS_LE_BRIEF = {
  reservation_en_ligne: (b) => (b.features || []).includes('reservation') || b.goal === 'reservation',
  devis: (b) => (b.features || []).includes('devis'),
  newsletter: (b) => (b.features || []).includes('newsletter'),
  reseaux_sociaux: (b) => (b.features || []).includes('reseaux') || Boolean(b.instagram || b.facebook),
  boutique: (b) => b.siteType === 'boutique',
  faq: (b) => (b.pages || []).includes('faq'),
  histoire: (b) => (b.pages || []).includes('apropos'),
  horaires: (b) => Boolean(String(b.hours || '').trim()),
  avis_clients: (b) => Boolean(String(b.reviews || '').trim()),
  telephone_clic: (b) => Boolean(String(b.phone || '').trim()),
  plan_acces: (b) => Boolean(String(b.address || '').trim()),
  formulaire_contact: () => true,
  galerie: (b) => (b.photos || []).length > 0,
};
export const dejaDansLeBrief = (id, brief) => Boolean(DANS_LE_BRIEF[id]?.(brief || {}));

export const ARCHETYPE_IDS = ARCHETYPES.map((a) => a.id);
export const nomArchetype = (id) => ARCHETYPES.find((a) => a.id === id)?.name || id;

// Statuts d'un dossier : où en est l'agent
export const STATUTS_INSPIRATION = {
  attente: 'En attente',
  recherche: 'Recherche des sites',
  visite: 'Visite des sites',
  synthese: 'Synthèse',
  pret: 'Prête',
  erreur: 'En échec',
};
export const enCoursInspiration = (insp) => Boolean(insp && ['attente', 'recherche', 'visite', 'synthese'].includes(insp.statut));

// ---------- Adresses ----------
// Une adresse web propre : https par défaut, sans suivi (#, utm_…), sans « www. » dans le domaine affiché
export function normaliserUrl(brut) {
  let s = String(brut || '').trim().replace(/[),.;:!?»"']+$/, '');
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  let u;
  try {
    u = new URL(s);
  } catch {
    return '';
  }
  if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.') || u.username || u.password) return '';
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_)/i.test(k)) u.searchParams.delete(k);
  u.hostname = u.hostname.toLowerCase();
  const out = u.toString();
  return out.length > 300 ? '' : out;
}

export const domaineDe = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

// Les adresses écrites par le client dans « Des sites ou marques que vous aimez »
export function adressesDansTexte(texte) {
  const out = [];
  const re = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:\/[^\s,;)»"']*)?)/gi;
  for (const m of String(texte || '').matchAll(re)) {
    const brut = m[1];
    // « Merci.fr » oui, « M.Dupont » ou « 3.5 » non : il faut une extension de domaine plausible
    if (!/\.(fr|com|net|org|eu|be|ch|ca|io|co|shop|store|paris|bzh|art|design|studio|cafe|restaurant|bio|info|biz|me|app|site|online|uk|de|it|es|nl|lu|ma|tn|dz|re|pf|nc|travel|beauty|fashion|coffee)(\/|$)/i.test(brut)) continue;
    const url = normaliserUrl(brut);
    if (url && !out.includes(url)) out.push(url);
  }
  return out.slice(0, 6);
}

// Sites qui ne sont pas « le site d'une entreprise » : annuaires, réseaux sociaux, places de marché
const PAS_UN_SITE = [
  'facebook.com', 'instagram.com', 'tiktok.com', 'linkedin.com', 'twitter.com', 'x.com', 'youtube.com', 'pinterest.com', 'pinterest.fr',
  'google.com', 'google.fr', 'goo.gl', 'maps.app.goo.gl', 'wikipedia.org', 'tripadvisor.fr', 'tripadvisor.com', 'yelp.fr', 'yelp.com',
  'pagesjaunes.fr', 'justacote.com', 'societe.com', 'pappers.fr', 'mappy.com', 'planity.com', 'treatwell.fr', 'thefork.fr', 'lafourchette.com',
  'thefork.com', 'ubereats.com', 'deliveroo.fr', 'doctolib.fr', 'booking.com', 'airbnb.fr', 'airbnb.com', 'leboncoin.fr', 'amazon.fr', 'amazon.com',
  'etsy.com', 'houzz.fr', 'habitatpresto.com', 'starofservice.com', 'malt.fr', 'behance.net', 'dribbble.com', 'canva.com', 'wix.com', 'squarespace.com',
  // Galeries de design : elles présentent des sites, ce ne sont pas des sites d'entreprise
  'awwwards.com', 'siteinspire.com', 'land-book.com', 'godly.website', 'onepagelove.com', 'lapa.ninja', 'minimal.gallery', 'httpster.net',
  'cssdesignawards.com', 'cssda.com', 'webdesign-inspiration.com', 'themeforest.net', 'envato.com', 'templatemonster.com',
];
export function estUnSiteEntreprise(url) {
  const d = domaineDe(url);
  if (!d) return false;
  return !PAS_UN_SITE.some((x) => d === x || d.endsWith('.' + x));
}

// ---------- Ce que la génération reçoit ----------
// Texte court ajouté aux consignes : des idées, jamais un modèle à copier
export function pistesTexte(pistes) {
  if (!pistes || typeof pistes !== 'object') return '';
  const L = [];
  const styles = (pistes.stylesConseilles || []).filter((s) => ARCHETYPE_IDS.includes(s?.archetype)).slice(0, 5);
  if (styles.length) L.push('Directions artistiques qui conviennent le mieux : ' + styles.map((s) => `${s.archetype} (${String(s.pourquoi || '').slice(0, 120)})`).join(' ; '));
  const idees = (pistes.idees || []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8);
  if (idees.length) L.push('Idées de contenus et de sections à reprendre si le brief le permet :\n' + idees.map((x) => '- ' + x.slice(0, 200)).join('\n'));
  const ton = String(pistes.ton || '').trim();
  if (ton) L.push('Ton et vocabulaire qui marchent dans ce métier : ' + ton.slice(0, 300));
  const trouvailles = (pistes.trouvailles || []).filter((t) => t?.titre).slice(0, 4);
  if (trouvailles.length)
    L.push(
      "Idées de présentation ou d'interaction originales vues sur ces sites, à adapter si elles servent ce client :\n" +
        trouvailles.map((t) => `- ${String(t.titre).slice(0, 80)}${t.idee ? ' : ' + String(t.idee).slice(0, 180) : ''}`).join('\n')
    );
  // Les atouts des sites analysés, réunis : chaque proposition en reprend le meilleur, à sa façon
  const atouts = (pistes.atouts || []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8);
  if (atouts.length) L.push('Les atouts des meilleurs sites de son métier, à réunir dans ses propositions (chacune à sa façon) :\n' + atouts.map((x) => '- ' + x.slice(0, 200)).join('\n'));
  if (pistes.siteActuel) L.push('Site actuel du client (son identité à respecter) : ' + String(pistes.siteActuel).slice(0, 300));
  if (!L.length) return '';
  return `<inspiration>
Pistes tirées de la bibliothèque d'inspiration de l'agence : les avantages de sites remarquables du même métier (et du site actuel du client s'il en a un), réunis :
${L.join('\n')}
</inspiration>
Réunis ces avantages dans tes propositions : ce sont des idées, jamais un modèle à copier. Ne reprends aucun texte, slogan, nom, prix ou élément propre à ces sites. Le brief reste la seule source des faits : n'annonce aucun service, aucune fonctionnalité (réservation, livraison, carte cadeau…) et aucun engagement que le brief ne mentionne pas.`;
}

// Agencements de page d'accueil conseillés par les pistes (donnés aux premiers modèles générés)
export function tramesDesPistes(pistes) {
  return [...new Set((pistes?.trames || []).map((t) => (typeof t === 'string' ? t : t?.trame)).filter((t) => TRAMES_INSPIRATION.includes(t)))].slice(0, 4);
}

// ---------- Collecte en amont (bibliothèque remplie à l'avance, sans client) ----------
// À chaque actualisation, chaque métier est cherché sous un autre angle (spécialité + zone ou
// source) : des actualisations successives trouvent de nouveaux sites au lieu des mêmes.
export const SPECIALITES = {
  restaurant: ['bistrot', 'restaurant gastronomique', 'pizzeria', 'café ou coffee shop', 'traiteur', 'bar à vin', 'cuisine du monde', 'brunch', 'food truck', 'crêperie'],
  boulangerie: ['boulangerie artisanale', 'pâtisserie', 'chocolatier', 'épicerie fine', 'fromagerie', 'torréfacteur', 'caviste', 'glacier'],
  commerce: ['fleuriste', 'librairie', 'concept store', 'boutique de décoration', 'magasin de vélos', 'boutique de jouets', 'papeterie', 'herboristerie'],
  beaute: ['salon de coiffure', 'barbier', 'institut de beauté', 'onglerie', 'spa urbain', 'salon de tatouage', 'maquilleuse', 'coiffure à domicile'],
  sante: ['ostéopathe', 'kinésithérapeute', 'psychologue', 'naturopathe', 'sophrologue', 'cabinet dentaire', 'diététicienne', 'maison de santé'],
  sport: ['salle de sport indépendante', 'coach sportif', 'studio de yoga', 'studio de pilates', 'club de boxe', 'salle d’escalade', 'école de danse', 'club de tennis'],
  artisan: ['plombier chauffagiste', 'électricien', 'menuisier ébéniste', 'paysagiste', 'couvreur', 'peintre en bâtiment', 'architecte d’intérieur', 'serrurier', 'maçon'],
  conseil: ['cabinet de conseil', 'consultant indépendant', 'agence de communication', 'coach professionnel', 'cabinet de recrutement', 'traducteur'],
  immobilier: ['agence immobilière indépendante', 'chasseur immobilier', 'gestion locative', 'promoteur', 'home staging', 'immobilier de prestige'],
  juridique: ['avocat', 'notaire', 'expert-comptable', 'conseiller en patrimoine', 'courtier', 'commissaire de justice'],
  photo: ['photographe de mariage', 'studio photo', 'vidéaste', 'illustrateur', 'graphiste', 'studio de design'],
  mode: ['créatrice de bijoux', 'marque de vêtements', 'maroquinerie', 'opticien lunetier', 'friperie', 'couturière retoucheuse'],
  tech: ['logiciel SaaS', 'application mobile', 'agence de développement', 'startup', 'éditeur de logiciel', 'outil en ligne'],
  education: ['école de langues', 'cours particuliers', 'école de musique', 'auto-école', 'centre de formation', 'atelier créatif'],
  evenementiel: ['wedding planner', 'lieu de réception', 'traiteur événementiel', 'DJ', 'décoratrice événementielle', 'location de matériel'],
  tourisme: ['chambre d’hôtes', 'gîte', 'hôtel boutique', 'camping', 'guide touristique', 'location de vélos'],
  auto: ['garage indépendant', 'carrosserie', 'préparation esthétique automobile', 'véhicules d’occasion', 'atelier moto', 'contrôle technique'],
  association: ['association culturelle', 'club sportif amateur', 'mairie', 'office de tourisme', 'association solidaire', 'festival'],
};
export const METIERS_COLLECTE = Object.keys(SPECIALITES);

export const ANGLES_COLLECTE = [
  { id: 'france', label: 'France', france: true, consigne: 'Des entreprises indépendantes en France, dans des villes et régions variées (pas seulement Paris).' },
  { id: 'galeries', label: 'Galeries de design', consigne: 'Les sites de ce métier mis en avant par les galeries de sites remarquables (Awwwards, Siteinspire, Land-book, Godly, One Page Love, Lapa Ninja, Minimal Gallery, Httpster…). Donne l’adresse du site de l’entreprise, pas celle de la galerie.' },
  { id: 'francophonie', label: 'Belgique, Suisse, Québec', consigne: 'Des entreprises indépendantes de Belgique, de Suisse, du Luxembourg et du Québec.' },
  { id: 'europe', label: 'Europe', consigne: 'Des entreprises indépendantes d’autres pays d’Europe : Royaume-Uni, Scandinavie, Pays-Bas, Allemagne, Italie, Espagne, Portugal.' },
  { id: 'local', label: 'Petites adresses soignées', france: true, consigne: 'De très petites entreprises françaises (village, quartier, une ou deux personnes) dont le site est particulièrement soigné ou original.' },
  { id: 'monde', label: 'Monde', consigne: 'Des entreprises indépendantes d’Amérique du Nord, d’Australie, du Japon ou de Corée.' },
  { id: 'primes', label: 'Sites primés', consigne: 'Des sites de ce métier récompensés ou remarqués ces deux dernières années (prix de design web, presse spécialisée, blogs de design).' },
];
export const angleCollecte = (id) => ANGLES_COLLECTE.find((a) => a.id === id) || null;
export const PAR_METIER_CHOIX = [3, 5, 10];

// Ce que cherche la n-ième collecte d'un métier : spécialité et angle tournent (2 cycles de longueurs différentes)
export function planCollecte(metier, rang = 0, { angle = '', specialite = '' } = {}) {
  const specs = SPECIALITES[metier] || [];
  const r = Math.max(0, Math.floor(Number(rang) || 0));
  return {
    specialite: String(specialite || '').trim().slice(0, 60) || specs[r % (specs.length || 1)] || '',
    angle: angleCollecte(angle)?.id || ANGLES_COLLECTE[r % ANGLES_COLLECTE.length].id,
  };
}

// Ordre de grandeur affiché avant de lancer : ~1 minute et ~0,05 € par site, ~0,15 € par recherche
export function estimationCollecte(nbMetiers, parMetier, ouvriers = 3) {
  const sites = Math.max(0, nbMetiers) * Math.max(0, parMetier);
  const minutes = Math.ceil((sites * 1.1 + nbMetiers * 1.5) / Math.max(1, ouvriers));
  const euros = sites * 0.05 + nbMetiers * 0.15;
  return { sites, minutes: Math.max(sites ? 3 : 0, minutes), euros: Math.round(euros * 10) / 10 };
}
