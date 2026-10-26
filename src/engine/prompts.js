// Consignes envoyées à l'IA. Utilisées par le serveur (API Claude) et par la démo.
import { ARCHETYPES, MOODS } from './archetypes.js';
import { ICON_NAMES } from './icons.js';
import { sectorLabel, GOALS, FEATURES, PAGES } from './questions.js';

export const SYSTEM = `Tu es directeur artistique et rédacteur web senior dans une agence française qui crée des sites pour des TPE et des indépendants.
Tu écris en français, en vouvoyant le visiteur, avec des phrases courtes, concrètes et naturelles. Pas de jargon marketing creux (« leader », « excellence », « incontournable », « n°1 »), pas d'emojis.
Règle absolue : n'invente aucun fait vérifiable sur l'entreprise. Pas d'années d'expérience, de chiffres, de récompenses, de labels, de certifications, de noms de personnes, d'avis clients, d'adresses, de numéros, de délais ou de prix qui ne figurent pas dans le brief. Les informations présentes dans le brief (prix, délais, zone, horaires, engagements) peuvent être reprises telles quelles. Quand une information manque, reste général plutôt que d'inventer.
Écris au nom de l'entreprise avec « nous », sauf si la description est rédigée à la première personne du singulier (« je », « mon atelier ») : écris alors avec « je ».
Tu réponds toujours avec un seul objet JSON valide, sans texte autour.`;

const label = (list, id) => list.find((x) => x.id === id)?.label || id;

export function briefText(brief) {
  const L = [];
  const add = (k, v) => {
    if (v && String(v).trim()) L.push(`${k} : ${String(v).trim()}`);
  };
  add('Nom', brief.businessName);
  add('Secteur', sectorLabel(brief));
  add('Ville / zone', brief.city);
  add('Description', brief.description);
  add('Type de site', brief.siteType === 'boutique' ? 'Boutique en ligne' : 'Site vitrine');
  add('Objectif principal', label(GOALS, brief.goal));
  add('Pages', ['Accueil', ...(brief.pages || []).map((p) => label(PAGES, p)), 'Contact'].join(', '));
  add('Fonctionnalités', (brief.features || []).map((f) => label(FEATURES, f)).join(', '));
  add('Services listés par le client', brief.services ? '\n' + brief.services : '');
  if (brief.siteType === 'boutique') add('Produits listés par le client', brief.products ? '\n' + brief.products : '(aucun)');
  add('Points forts', brief.strengths);
  add('Ambiance souhaitée', (brief.moods || []).map((m) => label(MOODS, m)).join(', '));
  add('Couleur de marque', brief.color);
  add('Public visé', brief.audience);
  add('Inspirations', brief.inspirations);
  add('Téléphone', brief.phone);
  add('E-mail', brief.email);
  add('Adresse', brief.address);
  add('Horaires', brief.hours ? '\n' + brief.hours : '');
  return L.join('\n');
}

function conceptsPrompt(brief) {
  const catalog = ARCHETYPES.map((a) => `- ${a.id} : ${a.name} — ${a.pitch}`).join('\n');
  return `Voici le brief d'un client qui veut un site internet :
<brief>
${briefText(brief)}
</brief>

Voici les 12 directions artistiques disponibles (identifiant : description) :
${catalog}

Tâche : choisis les 10 directions les plus adaptées à ce client, classées de la plus pertinente à la moins pertinente, en tenant compte de son secteur, de son public et de l'ambiance demandée. Pour chacune, écris l'accroche de la page d'accueil, pensée pour cette direction.

Contraintes :
- 10 identifiants différents, pris uniquement dans la liste.
- headline : 3 à 9 mots. Chaque accroche prend un angle différent (bénéfice client, savoir-faire, émotion, proximité, rapidité, qualité, plaisir…). Aucune répétition d'une accroche à l'autre. Point d'exclamation seulement pour « ludique ».
- subheadline : une phrase de 12 à 25 mots, concrète, qui précise l'offre.
- cta : 1 à 4 mots, un verbe d'action cohérent avec l'objectif principal (ex. « Réserver une table », « Demander un devis », « Voir la boutique », « Nous appeler »).
- why : une phrase de 20 mots maximum qui explique au client pourquoi cette direction lui correspond.

Réponds uniquement avec ce JSON :
{"models":[{"archetype":"epure","headline":"…","subheadline":"…","cta":"…","why":"…"}]}`;
}

function corePrompt(brief) {
  return `Rédige les contenus principaux du site de ce client :
<brief>
${briefText(brief)}
</brief>

Règles :
- Si le client a listé des services, reprends exactement leurs noms, dans le même ordre, avec leur prix s'il est indiqué (sinon "price": null), et ajoute seulement une description. Sinon, propose 3 à 6 services typiques de son activité avec "price": null.
- L'histoire (about.story) reformule et développe le brief, sans inventer de date, de lieu, de personne ni de chiffre.
- Les atouts (highlights) s'appuient sur les points forts et la description du brief.
- "icon" : choisis parmi ${ICON_NAMES.join(', ')}.
- imageKeywords : 4 courtes expressions de recherche EN ANGLAIS pour trouver des photos d'illustration réalistes (ex. "artisan bakery bread").

Réponds uniquement avec ce JSON :
{
  "brand": {"tagline": "phrase de marque de 4 à 8 mots", "short": "présentation de l'activité en une phrase"},
  "highlightsTitle": "titre de la section des atouts, 3 à 6 mots",
  "highlightsIntro": "une phrase, ou chaîne vide",
  "highlights": [{"title": "2 à 4 mots", "text": "une phrase", "icon": "…"}],
  "servicesTitle": "titre de la section services, 2 à 5 mots",
  "servicesIntro": "une phrase",
  "services": [{"name": "…", "description": "une ou deux phrases", "price": null, "icon": "…"}],
  "about": {"title": "…", "intro": "deux phrases", "quote": "une phrase forte qui résume l'état d'esprit", "story": ["paragraphe", "paragraphe", "paragraphe"], "valuesTitle": "…", "values": [{"title": "…", "text": "…", "icon": "…"}]},
  "statement": "un court manifeste de 20 à 35 mots qui dit ce qui compte pour l'entreprise, sans reprendre la présentation",
  "process": {"title": "3 à 6 mots", "intro": "une phrase ou chaîne vide", "steps": [{"title": "2 à 4 mots", "text": "une phrase"}]},
  "galleryTitle": "titre de la galerie photo, 2 à 5 mots",
  "ctaBand": {"title": "5 à 8 mots", "text": "une phrase"},
  "seo": {"title": "60 caractères maximum", "description": "155 caractères maximum"},
  "imageKeywords": ["…", "…", "…", "…"],
  "imagePrompts": [{"prompt": "…", "alt": "…"}]
}
Mets 3 ou 4 atouts et 3 valeurs.
process : 3 ou 4 étapes qui décrivent comment se passe concrètement une prestation ou une commande avec ce client, dans l'ordre chronologique, sans délai ni prix inventés.
imagePrompts : 8 descriptions EN ANGLAIS de photos réalistes pour illustrer ce site, dans cet ordre précis :
1. vue d'ensemble large et lumineuse du lieu ou de l'univers de l'activité ;
2. gros plan sur les mains et le geste du savoir-faire ;
3. nature morte des produits ou du résultat du travail, vue de dessus ;
4. scène d'ambiance avec des clients vus de dos ou de loin ;
5. détail de matière ou de texture, cadrage vertical ;
6. l'activité en action, plan moyen ;
7. un détail du décor ou de l'environnement, cadrage vertical ;
8. le produit ou le service phare mis en valeur.
40 mots maximum chacune, très concrètes et visuelles, avec une lumière et une palette cohérentes entre elles. Pas de texte, d'enseigne, de logo ni de visage reconnaissable en gros plan. "alt" : une courte description en français de l'image, utilisée aussi comme légende.`;
}

function pagesPrompt(brief) {
  const shop = brief.siteType === 'boutique';
  return `Rédige les pages secondaires du site de ce client :
<brief>
${briefText(brief)}
</brief>

À rédiger :
- faq : 5 questions que ses clients se posent vraiment, avec des réponses de 1 à 3 phrases. Appuie-toi sur le brief (horaires, adresse, contact, fonctionnement). Si une information manque, réponds de façon générale et invite le visiteur à prendre contact : n'invente ni tarif, ni délai, ni condition.
- contact : un titre, une phrase d'introduction et un titre de formulaire (2 à 4 mots).${
    shop
      ? `
- products : si le client a listé des produits, reprends-les tous exactement (nom, et prix en nombre, ou null s'il manque) et ajoute une description de 12 mots maximum, une catégorie (1 ou 2 mots, 2 à 4 catégories au total) et "badge": null. S'il n'en a listé aucun, propose 6 produits d'exemple plausibles avec un prix indicatif (nombre).
- productsTitle et productsIntro pour la page boutique.`
      : ''
  }

Réponds uniquement avec ce JSON :
{
  "faqIntro": "une phrase",
  "faq": [{"q": "…", "a": "…"}],
  "contact": {"title": "…", "intro": "…", "formTitle": "…"}${shop ? ',\n  "productsTitle": "…",\n  "productsIntro": "…",\n  "products": [{"name": "…", "description": "…", "price": 24, "category": "…", "badge": null}]' : ''}
}`;
}

export const PARTS = ['concepts', 'core', 'pages'];

export function buildPrompt(part, brief) {
  switch (part) {
    case 'concepts':
      return { system: SYSTEM, user: conceptsPrompt(brief), maxTokens: 3000 };
    case 'core':
      return { system: SYSTEM, user: corePrompt(brief), maxTokens: 5000 };
    case 'pages':
      return { system: SYSTEM, user: pagesPrompt(brief), maxTokens: 3000 };
    default:
      throw new Error('Partie inconnue : ' + part);
  }
}

// Version en un seul texte (pour les environnements sans « system prompt »)
export function buildSinglePrompt(part, brief) {
  const p = buildPrompt(part, brief);
  return `${p.system}\n\n${p.user}`;
}
