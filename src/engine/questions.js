// Questionnaire partagé (mode client et mode agence)
import { MOODS } from './archetypes.js';

export const SECTORS = [
  { id: 'restaurant', label: 'Restaurant / café / traiteur' },
  { id: 'boulangerie', label: 'Boulangerie / pâtisserie / épicerie fine' },
  { id: 'commerce', label: 'Commerce / boutique' },
  { id: 'beaute', label: 'Beauté / coiffure / esthétique' },
  { id: 'sante', label: 'Santé / bien-être / thérapie' },
  { id: 'sport', label: 'Sport / coaching' },
  { id: 'artisan', label: 'Artisan / bâtiment / dépannage' },
  { id: 'conseil', label: 'Conseil / services aux entreprises' },
  { id: 'immobilier', label: 'Immobilier' },
  { id: 'juridique', label: 'Juridique / comptabilité / finance' },
  { id: 'photo', label: 'Photographie / vidéo / création' },
  { id: 'mode', label: 'Mode / bijoux / accessoires' },
  { id: 'tech', label: 'Tech / logiciel / startup' },
  { id: 'education', label: 'Éducation / formation / cours' },
  { id: 'evenementiel', label: 'Événementiel / mariage' },
  { id: 'tourisme', label: 'Tourisme / hôtellerie / gîte' },
  { id: 'auto', label: 'Automobile / garage' },
  { id: 'association', label: 'Association / collectivité' },
  { id: 'autre', label: 'Autre' },
];

export const PAGES = [
  { id: 'apropos', label: 'À propos' },
  { id: 'services', label: 'Services / prestations' },
  { id: 'faq', label: 'Questions fréquentes' },
];

export const FEATURES = [
  { id: 'reservation', label: 'Prise de rendez-vous / réservation' },
  { id: 'devis', label: 'Demande de devis' },
  { id: 'newsletter', label: 'Inscription à la newsletter' },
  { id: 'reseaux', label: 'Liens vers les réseaux sociaux' },
];

export const GOALS = [
  { id: 'contact', label: 'Être contacté' },
  { id: 'appel', label: 'Recevoir des appels' },
  { id: 'reservation', label: 'Recevoir des réservations' },
  { id: 'vente', label: 'Vendre en ligne' },
  { id: 'vitrine', label: 'Présenter mon savoir-faire' },
];

export function emptyBrief() {
  return {
    businessName: '',
    sector: '',
    sectorOther: '',
    city: '',
    description: '',
    siteType: 'vitrine',
    pages: ['apropos', 'services', 'faq'],
    features: [],
    goal: 'contact',
    optionDevis: '',
    services: '',
    products: '',
    strengths: '',
    moods: [],
    color: '',
    audience: '',
    inspirations: '',
    phone: '',
    email: '',
    address: '',
    hours: '',
    instagram: '',
    facebook: '',
    reviews: '',
    aiImages: true,
    // Questionnaire envoyé au client : photos téléversées, logo, infos légales et domaine
    photos: [],
    logo: null,
    logoInHeader: true,
    legalName: '',
    legalForm: '',
    capital: '',
    siret: '',
    rcs: '',
    publisher: '',
    siege: '',
    domainOwned: '',
    domain: '',
  };
}

export const LEGAL_FORMS = [
  { id: 'EI ou micro-entreprise', label: 'EI ou micro-entreprise' },
  { id: 'EURL', label: 'EURL' },
  { id: 'SARL', label: 'SARL' },
  { id: 'SAS ou SASU', label: 'SAS ou SASU' },
  { id: 'Association', label: 'Association' },
  { id: 'Autre', label: 'Autre' },
];

export const hasCapital = (b) => ['EURL', 'SARL', 'SAS ou SASU'].includes(b.legalForm);

// Étapes du questionnaire. Chaque champ : id, type, label, aide, options, condition d'affichage.
export const STEPS = [
  {
    id: 'activite',
    title: 'Votre activité',
    intro: 'Quelques mots pour comprendre ce que vous faites.',
    fields: [
      { id: 'businessName', type: 'text', label: 'Nom de votre entreprise', required: true, placeholder: 'Ex. Atelier Lumière' },
      { id: 'sector', type: 'select', label: 'Secteur d’activité', required: true, options: SECTORS },
      { id: 'sectorOther', type: 'text', label: 'Précisez votre secteur', showIf: (b) => b.sector === 'autre', placeholder: 'Ex. Fleuriste' },
      { id: 'city', type: 'text', label: 'Ville ou zone d’intervention', placeholder: 'Ex. Lyon et alentours' },
      { id: 'description', type: 'textarea', label: 'Décrivez votre activité en quelques phrases', required: true, rows: 4, placeholder: 'Ce que vous proposez, pour qui, et comment vous travaillez.' },
    ],
  },
  {
    id: 'site',
    title: 'Votre site',
    intro: 'Le type de site et ce qu’il doit vous apporter.',
    fields: [
      { id: 'siteType', type: 'radio', label: 'Type de site', options: [
        { id: 'vitrine', label: 'Site vitrine', hint: 'Présenter votre activité et être contacté' },
        { id: 'boutique', label: 'Boutique en ligne', hint: 'Présenter et vendre vos produits' },
      ] },
      { id: 'goal', type: 'radio', label: 'Objectif principal du site', options: GOALS },
      { id: 'pages', type: 'checks', label: 'Pages à inclure', hint: 'L’accueil et le contact sont toujours inclus.', options: PAGES },
      { id: 'features', type: 'checks', label: 'Fonctionnalités utiles', options: FEATURES },
      { id: 'optionDevis', type: 'radio', label: 'En option : l’appli Devis & Factures', hint: 'Une application à part, installable sur votre téléphone (iPhone ou Android) : vous créez vos devis à partir de vos produits et de vos prix, vos clients les acceptent en ligne, et chaque devis accepté devient une facture.', options: [
        { id: 'oui', label: 'Oui, ça m’intéresse', hint: 'Nous vous en parlons à la livraison du site' },
        { id: 'non', label: 'Non merci', hint: 'Vous pourrez la demander plus tard' },
      ] },
    ],
  },
  {
    id: 'offre',
    title: 'Votre offre',
    intro: 'Listez ce que vous proposez. Laissez vide si vous préférez que l’IA propose.',
    fields: [
      { id: 'services', type: 'textarea', label: 'Vos services ou prestations', hint: 'Un par ligne. Prix facultatif : « Coupe femme - 45 € ».', rows: 5, placeholder: 'Coupe femme - 45 €\nColoration\nSoin profond - 30 €' },
      { id: 'products', type: 'textarea', label: 'Vos produits', hint: 'Un par ligne : « Nom - prix - courte description ».', rows: 5, showIf: (b) => b.siteType === 'boutique', placeholder: 'Bougie Figuier - 24 € - Cire végétale, 40 h\nDiffuseur Bois flotté - 32 €' },
      { id: 'strengths', type: 'textarea', label: 'Ce qui vous différencie', rows: 3, placeholder: 'Ex. Produits locaux, intervention en 24 h, accueil sans rendez-vous…' },
    ],
  },
  {
    id: 'style',
    title: 'Votre style',
    intro: 'L’ambiance que vous voulez dégager. Nous en tirerons 10 propositions différentes.',
    fields: [
      { id: 'moods', type: 'chips', label: 'Ambiance recherchée', hint: 'Choisissez jusqu’à 3 ambiances.', max: 3, options: MOODS },
      { id: 'color', type: 'color', label: 'Couleur de votre marque', hint: 'Facultatif : sinon chaque modèle propose sa palette.' },
      { id: 'audience', type: 'text', label: 'À qui s’adresse votre site ?', placeholder: 'Ex. Familles du quartier, professionnels pressés…' },
      { id: 'inspirations', type: 'textarea', label: 'Des sites ou marques que vous aimez', rows: 2, placeholder: 'Facultatif' },
    ],
  },
  {
    id: 'photos',
    title: 'Vos photos',
    intro: 'Vos propres photos rendent le site plus vivant et plus crédible. Elles sont facultatives.',
    fields: [
      { id: 'photos', type: 'photos', label: 'Photos de votre activité', hint: 'Jusqu’à 10 photos : votre lieu, votre équipe au travail, vos réalisations, vos produits. Elles restent sur votre appareil et ne sont envoyées à aucun serveur.' },
      { id: 'aiImages', type: 'toggle', label: 'Compléter avec des images réalistes créées par l’IA', hint: 'L’IA complète vos photos avec jusqu’à 8 images d’ambiance adaptées à votre activité (lieu, gestes, matières, ambiance).' },
    ],
  },
  {
    id: 'contact',
    title: 'Vos coordonnées',
    intro: 'Elles apparaîtront sur le site. Rien n’est inventé : laissez vide ce que vous ne voulez pas afficher.',
    fields: [
      { id: 'phone', type: 'text', label: 'Téléphone', placeholder: '01 23 45 67 89', half: true },
      { id: 'email', type: 'email', label: 'E-mail', placeholder: 'contact@exemple.fr', half: true },
      { id: 'address', type: 'text', label: 'Adresse', placeholder: '12 rue des Lilas, 69003 Lyon' },
      { id: 'hours', type: 'textarea', label: 'Horaires', rows: 3, placeholder: 'Mardi – samedi : 9 h – 19 h\nDimanche : 9 h – 13 h' },
      { id: 'instagram', type: 'text', label: 'Instagram (lien)', half: true, showIf: (b) => b.features.includes('reseaux') },
      { id: 'facebook', type: 'text', label: 'Facebook (lien)', half: true, showIf: (b) => b.features.includes('reseaux') },
      { id: 'reviews', type: 'textarea', label: 'Avis clients réels', hint: 'Facultatif. Un par ligne avec le prénom : « Super accueil ! — Julie ». Aucun avis ne sera inventé.', rows: 3 },
    ],
  },
];

// Étape ajoutée au questionnaire envoyé au client
export const LEGAL_STEP = {
  id: 'legal',
  title: 'Infos légales et domaine',
  intro: 'Ces informations sont obligatoires sur un site professionnel. Si vous ne les avez pas sous la main, laissez vide : nous vous les redemanderons.',
  fields: [
    { id: 'legalName', type: 'text', label: 'Raison sociale', placeholder: 'Ex. SARL Atelier Lumière', half: true },
    { id: 'legalForm', type: 'select', label: 'Forme juridique', options: LEGAL_FORMS, half: true },
    { id: 'capital', type: 'text', label: 'Capital social', placeholder: 'Ex. 5 000 €', half: true, showIf: hasCapital },
    { id: 'siret', type: 'text', label: 'Numéro SIRET', placeholder: '14 chiffres', half: true, inputMode: 'numeric' },
    { id: 'rcs', type: 'text', label: 'Ville du RCS (ou RM pour un artisan)', placeholder: 'Ex. Pontoise', half: true },
    { id: 'publisher', type: 'text', label: 'Directeur de la publication', hint: 'En général le dirigeant.', placeholder: 'Prénom et nom', half: true },
    { id: 'siege', type: 'text', label: 'Adresse du siège', placeholder: 'Si elle est différente de l’adresse affichée sur le site' },
    {
      id: 'domainOwned',
      type: 'radio',
      label: 'Votre nom de domaine',
      options: [
        { id: 'non', label: 'Je n’en ai pas encore', hint: 'Nous vous accompagnons pour l’acheter à votre nom' },
        { id: 'oui', label: 'J’en ai déjà un', hint: 'Nous le relierons à votre nouveau site' },
      ],
    },
    { id: 'domain', type: 'text', label: 'Adresse souhaitée ou actuelle', placeholder: 'Ex. atelier-lumiere.fr' },
  ],
};

const LOGO_FIELD = { id: 'logo', type: 'logo', label: 'Votre logo', hint: 'Facultatif. Idéalement sur fond transparent ou blanc (PNG ou JPEG).' };

// Questionnaire complet envoyé au client : 7 étapes, photos transmises à l'agence.
// strict : le client doit laisser au moins un téléphone ou un e-mail (pas l'agence, qui complète plus tard)
export function remoteSteps({ strict = true } = {}) {
  return [
    ...STEPS.map((s) => {
      if (s.id === 'photos') {
        return {
          ...s,
          intro: 'Votre logo et vos propres photos rendent le site plus vivant et plus crédible. Ils sont facultatifs.',
          fields: [
            LOGO_FIELD,
            ...s.fields.map((f) => {
              if (f.id === 'photos') return { ...f, hint: 'Jusqu’à 10 photos : votre lieu, votre équipe au travail, vos réalisations, vos produits. Elles sont transmises uniquement à l’agence qui crée votre site.' };
              if (f.id === 'aiImages') return { ...f, label: 'Compléter avec des images d’ambiance', hint: 'Si vous avez moins de 10 photos, nous ajoutons des images réalistes créées par l’IA (lieu, matières, gestes). Elles ne représentent jamais vos vrais produits ni votre équipe.' };
              return f;
            }),
          ],
        };
      }
      if (s.id === 'contact' && strict) return { ...s, validate: contactRequired };
      return s;
    }),
    LEGAL_STEP,
  ];
}

function contactRequired(brief) {
  if (!String(brief.phone || '').trim() && !String(brief.email || '').trim()) return { phone: 'Indiquez au moins un téléphone ou un e-mail.' };
  return {};
}

// Infos légales encore manquantes (pour l'agence)
export function missingLegal(brief) {
  const b = brief || {};
  return LEGAL_STEP.fields.filter((f) => !['siege', 'domain', 'domainOwned'].includes(f.id) && (!f.showIf || f.showIf(b)) && !String(b[f.id] || '').trim()).map((f) => f.label);
}

export function sectorLabel(brief) {
  if (brief.sector === 'autre') return brief.sectorOther || 'Activité';
  return SECTORS.find((s) => s.id === brief.sector)?.label || brief.sectorOther || '';
}

export function validateStep(step, brief) {
  const errors = {};
  for (const f of step.fields) {
    if (f.showIf && !f.showIf(brief)) continue;
    const v = brief[f.id];
    if (f.required && (!v || (typeof v === 'string' && !v.trim()))) errors[f.id] = 'Ce champ est nécessaire.';
    if (f.id === 'description' && v && v.trim().length < 15) errors[f.id] = 'Ajoutez une ou deux phrases de plus.';
    if (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) errors[f.id] = 'Cette adresse e-mail semble incomplète.';
    if (f.id === 'siret' && v && v.replace(/\s/g, '').length !== 14) errors[f.id] = 'Le numéro SIRET compte 14 chiffres.';
  }
  if (step.validate) Object.assign(errors, step.validate(brief));
  return errors;
}

export function validateBrief(brief, steps = STEPS) {
  return steps.reduce((acc, s) => ({ ...acc, ...validateStep(s, brief) }), {});
}

export const EXAMPLES = [
  {
    ...emptyBrief(),
    businessName: 'Fournil des Lilas',
    sector: 'boulangerie',
    city: 'Lyon 3e',
    description: 'Boulangerie artisanale de quartier : pains au levain, viennoiseries pur beurre et pâtisseries de saison. Farines bio d’un moulin de la Drôme, tout est fait sur place chaque matin.',
    siteType: 'vitrine',
    goal: 'vitrine',
    pages: ['apropos', 'services', 'faq'],
    features: ['reservation', 'reseaux'],
    services: 'Pain au levain - 4,20 €\nBaguette tradition - 1,30 €\nCroissant pur beurre - 1,40 €\nTarte de saison - 22 €\nCommande de gâteaux sur mesure',
    strengths: 'Levain naturel, farines bio locales, fournée l’après-midi',
    moods: ['chaleureux', 'retro'],
    audience: 'Familles et actifs du quartier',
    phone: '04 78 00 00 00',
    email: 'bonjour@fournil-des-lilas.fr',
    address: '12 rue des Lilas, 69003 Lyon',
    hours: 'Mardi – samedi : 7 h – 19 h 30\nDimanche : 7 h – 13 h',
    instagram: 'https://instagram.com/fournildeslilas',
  },
  {
    ...emptyBrief(),
    businessName: 'Maison Opaline',
    sector: 'mode',
    city: 'Bordeaux',
    description: 'Créatrice de bijoux en argent recyclé et pierres naturelles, fabriqués à la main dans mon atelier. Pièces fines et intemporelles, en petites séries.',
    siteType: 'boutique',
    goal: 'vente',
    pages: ['apropos', 'faq'],
    features: ['newsletter', 'reseaux'],
    products: 'Bague Aube - 68 € - Argent recyclé, pierre de lune\nCollier Marée - 89 € - Chaîne fine et perle d’eau douce\nCréoles Lin - 54 €\nBracelet Sillage - 62 € - Jonc martelé\nBoucles Brume - 48 € - Quartz rose\nBague Ondine - 72 €',
    strengths: 'Fait main en France, argent 100 % recyclé, emballage sans plastique',
    moods: ['luxe', 'minimaliste'],
    audience: 'Femmes de 25 à 45 ans qui aiment les bijoux discrets',
    email: 'atelier@maison-opaline.fr',
    instagram: 'https://instagram.com/maisonopaline',
  },
  {
    ...emptyBrief(),
    businessName: 'Martin Rénovation',
    sector: 'artisan',
    city: 'Nantes et 30 km autour',
    description: 'Entreprise de rénovation intérieure : salles de bain, cuisines, peinture et petite maçonnerie. Devis gratuit, un seul interlocuteur du début à la fin du chantier.',
    siteType: 'vitrine',
    goal: 'appel',
    pages: ['apropos', 'services', 'faq'],
    features: ['devis'],
    services: 'Rénovation de salle de bain\nPose de cuisine\nPeinture intérieure\nCarrelage et faïence\nPetite maçonnerie',
    strengths: 'Devis sous 48 h, chantier propre, un seul interlocuteur',
    moods: ['pro', 'moderne'],
    audience: 'Propriétaires de maisons et d’appartements',
    phone: '06 12 34 56 78',
    email: 'contact@martin-renovation.fr',
    address: 'Nantes (44)',
    hours: 'Lundi – vendredi : 8 h – 18 h',
  },
];
