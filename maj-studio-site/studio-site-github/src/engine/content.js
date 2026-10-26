// Contenus : version « démo » sans IA, normalisation des réponses de l'IA,
// et choix des 10 directions artistiques les plus adaptées.
import { ARCHETYPES, ARCHETYPE_MAP } from './archetypes.js';
import { ICON_NAMES, hasIcon } from './icons.js';
import { lines, rng, clampText, priceNumber, uid } from './util.js';

const SECTOR_KIT = {
  restaurant: {
    activity: 'Restaurant',
    promises: ['Une cuisine de saison, faite maison', 'Le goût du fait maison, midi et soir', 'Des assiettes généreuses à partager'],
    icons: ['utensils', 'leaf', 'heart', 'clock'],
    services: [['Menu du midi', 'Entrée, plat, dessert : une formule qui change avec les saisons.'], ['Carte du soir', 'Des plats à partager et des assiettes plus travaillées.'], ['Vente à emporter', 'Commandez par téléphone et récupérez votre repas sur place.'], ['Privatisation', 'Pour vos repas de groupe, anniversaires et événements.']],
  },
  boulangerie: {
    activity: 'Boulangerie',
    promises: ['Le bon pain, chaque matin', 'Du fournil à votre table, sans détour', 'Des recettes simples et des produits sincères'],
    icons: ['sun', 'leaf', 'heart', 'clock'],
    services: [['Pains', 'Des pains façonnés à la main et cuits chaque jour.'], ['Viennoiseries', 'Croissants et pains au chocolat pur beurre.'], ['Pâtisseries', 'Des gâteaux qui suivent les saisons.'], ['Commandes sur mesure', 'Gâteaux d’anniversaire et grandes occasions.']],
  },
  commerce: {
    activity: 'Boutique',
    promises: ['Des produits choisis avec soin', 'Le bon conseil, en plus du bon produit', 'Une sélection qui vous ressemble'],
    icons: ['bag', 'heart', 'gift', 'truck'],
    services: [['Conseil personnalisé', 'Nous vous aidons à trouver le bon produit.'], ['Emballage cadeau', 'Vos achats prêts à offrir.'], ['Commande et retrait', 'Réservez en ligne, retirez en boutique.']],
  },
  beaute: {
    activity: 'Institut de beauté',
    promises: ['Prendre soin de vous, vraiment', 'Un moment pour vous, sans compter', 'La beauté en toute simplicité'],
    icons: ['sparkle', 'heart', 'leaf', 'calendar'],
    services: [['Soins du visage', 'Des soins adaptés à votre peau et à vos envies.'], ['Coiffure', 'Coupe, couleur et mise en forme.'], ['Mise en beauté', 'Pour une occasion ou simplement pour vous.'], ['Épilation', 'Douce et soignée, sur rendez-vous.']],
  },
  sante: {
    activity: 'Cabinet',
    promises: ['Retrouver équilibre et sérénité', 'Prendre soin de votre corps et de votre esprit', 'Un accompagnement à votre écoute'],
    icons: ['leaf', 'heart', 'shield', 'calendar'],
    services: [['Première consultation', 'Un temps d’échange pour comprendre vos besoins.'], ['Séances de suivi', 'Un accompagnement régulier, à votre rythme.'], ['Ateliers', 'Des séances collectives en petit groupe.']],
  },
  sport: {
    activity: 'Coaching sportif',
    promises: ['Progressez à votre rythme', 'Dépassez-vous, bien accompagné', 'Votre forme, notre priorité'],
    icons: ['dumbbell', 'bolt', 'users', 'calendar'],
    services: [['Coaching individuel', 'Un programme construit pour vos objectifs.'], ['Cours collectifs', 'L’énergie du groupe, l’attention d’un coach.'], ['Bilan forme', 'Faire le point avant de démarrer.'], ['Suivi à distance', 'Des séances guidées où que vous soyez.']],
  },
  artisan: {
    activity: 'Rénovation',
    promises: ['Des travaux bien faits, dans les temps', 'Un seul interlocuteur, du devis à la fin du chantier', 'Votre projet entre de bonnes mains'],
    icons: ['tool', 'shield', 'clock', 'home'],
    services: [['Rénovation intérieure', 'Remise à neuf de vos pièces, du sol au plafond.'], ['Salle de bain', 'Création et rénovation complète.'], ['Peinture', 'Intérieure et extérieure, finitions soignées.'], ['Dépannage', 'Interventions rapides pour les petits travaux.']],
  },
  conseil: {
    activity: 'Cabinet de conseil',
    promises: ['Des décisions plus claires', 'Un regard extérieur pour avancer plus vite', 'Votre projet, structuré et piloté'],
    icons: ['chart', 'users', 'shield', 'chat'],
    services: [['Diagnostic', 'Un état des lieux clair de votre situation.'], ['Accompagnement', 'Un suivi régulier pour mettre en œuvre les actions.'], ['Formation', 'Transmettre les bonnes méthodes à vos équipes.']],
  },
  immobilier: {
    activity: 'Agence immobilière',
    promises: ['Trouvez le bien qui vous ressemble', 'Vendre au juste prix, sereinement', 'Votre projet immobilier, accompagné de bout en bout'],
    icons: ['home', 'key', 'pin', 'shield'],
    services: [['Estimation', 'Une estimation argumentée de votre bien.'], ['Vente', 'De la mise en valeur à la signature.'], ['Location', 'Recherche de locataires et gestion.'], ['Recherche personnalisée', 'Nous cherchons pour vous.']],
  },
  juridique: {
    activity: 'Cabinet',
    promises: ['Des conseils clairs pour avancer', 'Sécuriser vos décisions', 'Un accompagnement rigoureux et accessible'],
    icons: ['shield', 'book', 'chat', 'chart'],
    services: [['Conseil', 'Des réponses claires à vos questions.'], ['Accompagnement des entreprises', 'De la création au quotidien.'], ['Rédaction d’actes', 'Des documents fiables et adaptés.']],
  },
  photo: {
    activity: 'Studio',
    promises: ['Des images qui vous ressemblent', 'Raconter votre histoire en images', 'Des photos naturelles et lumineuses'],
    icons: ['camera', 'sparkle', 'heart', 'calendar'],
    services: [['Portraits', 'Des séances naturelles, en studio ou en extérieur.'], ['Mariages', 'Le récit de votre journée.'], ['Entreprises', 'Photos d’équipe, de produits et de locaux.']],
  },
  mode: {
    activity: 'Créations',
    promises: ['Des pièces faites pour durer', 'Le fait main, dans les moindres détails', 'L’élégance au quotidien'],
    icons: ['sparkle', 'heart', 'gift', 'truck'],
    services: [['Créations sur mesure', 'Une pièce unique, imaginée avec vous.'], ['Retouches', 'Pour un ajustement parfait.'], ['Emballage cadeau', 'Prêt à offrir.']],
  },
  tech: {
    activity: 'Solutions numériques',
    promises: ['Des outils qui simplifient votre travail', 'Le numérique, sans la complexité', 'Gagnez du temps chaque jour'],
    icons: ['bolt', 'chart', 'shield', 'users'],
    services: [['Développement', 'Des applications pensées pour vos usages.'], ['Intégration', 'Vos outils connectés entre eux.'], ['Support', 'Une équipe disponible quand vous en avez besoin.']],
  },
  education: {
    activity: 'Formation',
    promises: ['Apprendre avec plaisir', 'Progresser pas à pas, bien accompagné', 'Des cours qui donnent confiance'],
    icons: ['book', 'users', 'smile', 'calendar'],
    services: [['Cours particuliers', 'Un accompagnement individuel adapté.'], ['Stages', 'Des sessions intensives pendant les vacances.'], ['Ateliers en groupe', 'Apprendre ensemble, en petit comité.']],
  },
  evenementiel: {
    activity: 'Événementiel',
    promises: ['Des moments qu’on n’oublie pas', 'Votre événement, sans stress', 'Chaque détail, pensé pour vous'],
    icons: ['sparkle', 'calendar', 'users', 'gift'],
    services: [['Organisation complète', 'De la première idée au dernier invité.'], ['Coordination le jour J', 'Pour profiter pleinement.'], ['Décoration', 'Une ambiance sur mesure.']],
  },
  tourisme: {
    activity: 'Hébergement',
    promises: ['Un séjour qui fait du bien', 'Posez vos valises, on s’occupe du reste', 'Le calme, à deux pas de tout'],
    icons: ['sun', 'home', 'leaf', 'calendar'],
    services: [['Chambres', 'Des chambres calmes et confortables.'], ['Petit-déjeuner', 'Des produits locaux pour bien commencer la journée.'], ['Conseils de visite', 'Nos bonnes adresses aux alentours.']],
  },
  auto: {
    activity: 'Garage',
    promises: ['Votre voiture entre de bonnes mains', 'Un entretien clair, sans mauvaise surprise', 'Réparé vite, réparé bien'],
    icons: ['car', 'tool', 'shield', 'clock'],
    services: [['Entretien et révision', 'Vidange, filtres et contrôles.'], ['Diagnostic', 'Identifier rapidement l’origine d’une panne.'], ['Pneumatiques', 'Montage, équilibrage et géométrie.'], ['Préparation au contrôle technique', 'Pour passer sereinement.']],
  },
  association: {
    activity: 'Association',
    promises: ['Agir ensemble, près de chez vous', 'Chacun a sa place ici', 'Donner du temps, partager des projets'],
    icons: ['users', 'heart', 'calendar', 'globe'],
    services: [['Activités', 'Des rendez-vous réguliers ouverts à tous.'], ['Événements', 'Des temps forts tout au long de l’année.'], ['Devenir bénévole', 'Rejoignez l’équipe.']],
  },
  autre: {
    activity: '',
    promises: ['Un savoir-faire à votre service', 'Le travail bien fait, tout simplement', 'Une relation de confiance'],
    icons: ['sparkle', 'heart', 'shield', 'clock'],
    services: [['Conseil', 'Nous prenons le temps de comprendre votre besoin.'], ['Réalisation', 'Un travail soigné, dans les délais annoncés.'], ['Suivi', 'Nous restons disponibles après la prestation.']],
  },
};

const PRODUCT_KIT = {
  mode: [['Bague fine', 34, 'Argent 925', 'Bagues'], ['Collier perle', 49, 'Chaîne fine et perle d’eau douce', 'Colliers'], ['Créoles dorées', 39, 'Plaqué or', 'Boucles'], ['Bracelet jonc', 42, 'Finition martelée', 'Bracelets'], ['Boucles pendantes', 36, 'Pierre naturelle', 'Boucles'], ['Collier médaille', 45, 'Gravure possible', 'Colliers']],
  boulangerie: [['Pain au levain', 4.2, 'Long levain naturel', 'Pains'], ['Brioche feuilletée', 9.5, 'Pur beurre', 'Viennoiseries'], ['Coffret biscuits', 14, 'Assortiment maison', 'Épicerie'], ['Confiture de saison', 6.5, 'Faite maison', 'Épicerie'], ['Tarte aux fruits', 22, '6 parts', 'Pâtisseries'], ['Granola maison', 8.9, '400 g', 'Épicerie']],
  beaute: [['Sérum visage', 29, 'Peaux sensibles', 'Soins'], ['Crème hydratante', 24, '50 ml', 'Soins'], ['Huile corps', 19, 'Senteur fleur d’oranger', 'Corps'], ['Shampooing doux', 14, 'Usage fréquent', 'Cheveux'], ['Baume lèvres', 7, 'Cire d’abeille', 'Soins'], ['Coffret découverte', 45, 'Quatre essentiels', 'Coffrets']],
  default: [['Coffret découverte', 39, 'Une sélection de nos essentiels', 'Coffrets'], ['Produit signature', 24, 'Notre best-seller', 'Essentiels'], ['Édition limitée', 32, 'En petite quantité', 'Essentiels'], ['Accessoire', 15, 'Le complément idéal', 'Accessoires'], ['Recharge', 12, 'Pour durer plus longtemps', 'Accessoires'], ['Carte cadeau', 50, 'Valable un an', 'Cadeaux']],
};

const HIGHLIGHT_POOL = {
  utensils: 'Des produits frais, cuisinés sur place.',
  leaf: 'Des matières premières choisies avec exigence.',
  heart: 'Un accueil attentif et chaleureux.',
  clock: 'Des horaires pensés pour votre quotidien.',
  sun: 'Préparé chaque jour, au plus près de vous.',
  bag: 'Une sélection resserrée et de qualité.',
  gift: 'Des idées pour faire plaisir.',
  truck: 'Une livraison soignée.',
  sparkle: 'Un résultat soigné, dans le détail.',
  calendar: 'Un rendez-vous facile à prendre.',
  shield: 'Un travail fiable et transparent.',
  dumbbell: 'Des séances adaptées à votre niveau.',
  bolt: 'Des résultats concrets, rapidement.',
  users: 'Une relation humaine et de proximité.',
  tool: 'Le savoir-faire d’un vrai professionnel.',
  home: 'Votre intérieur respecté pendant le chantier.',
  chart: 'Des objectifs clairs et mesurables.',
  chat: 'Une réponse rapide à chaque question.',
  key: 'Un accompagnement jusqu’à la remise des clés.',
  pin: 'Une connaissance fine du secteur.',
  book: 'Une méthode claire et éprouvée.',
  camera: 'Des images naturelles, sans pose forcée.',
  smile: 'Une ambiance bienveillante.',
  globe: 'Une action ouverte sur le monde.',
  car: 'Un diagnostic honnête et expliqué.',
};

const HIGHLIGHT_TITLES = {
  utensils: 'Fait maison', leaf: 'Des produits choisis', heart: 'Un accueil attentif', clock: 'Toujours disponible',
  sun: 'Frais chaque jour', bag: 'Une sélection soignée', gift: 'Prêt à offrir', truck: 'Livraison soignée',
  sparkle: 'Le souci du détail', calendar: 'Simple à réserver', shield: 'Travail garanti', dumbbell: 'À votre niveau',
  bolt: 'Des résultats', users: 'Proximité', tool: 'Savoir-faire', home: 'Respect des lieux', chart: 'Des objectifs clairs',
  chat: 'Réactivité', key: 'Accompagnement', pin: 'Ancrage local', book: 'Méthode', camera: 'Naturel', smile: 'Bienveillance',
  globe: 'Ouverture', car: 'Transparence',
};

const SECTOR_EN = {
  restaurant: 'restaurant', boulangerie: 'artisan bakery', commerce: 'independent shop', beaute: 'beauty salon', sante: 'wellness practice',
  sport: 'personal training studio', artisan: 'home renovation company', conseil: 'consulting firm', immobilier: 'real estate agency',
  juridique: 'law and accounting office', photo: 'photography studio', mode: 'jewelry and fashion workshop', tech: 'software company',
  education: 'tutoring and training center', evenementiel: 'event planning company', tourisme: 'guesthouse', auto: 'car repair garage',
  association: 'community association', autre: 'small local business',
};

// Formats des 8 images, dans l'ordre des rôles demandés à l'IA
export const IMAGE_RATIOS = ['16:9', '4:3', '1:1', '16:9', '3:4', '4:3', '3:4', '4:5'];

export function demoImagePrompts(brief) {
  const base = SECTOR_EN[brief.sector] || SECTOR_EN.autre;
  const what = (/^[aeiou]/i.test(base) ? 'an ' : 'a ') + base;
  const list = [
    [`Wide, bright view of ${what}, natural daylight, clean and well kept, professional photography`, 'Vue d’ensemble du lieu'],
    [`Close-up of hands at work in ${what}, focus on craftsmanship and detail, soft natural light, shallow depth of field`, 'Le geste, en gros plan'],
    [`Top-down still life of the products or results typical of ${what}, arranged on a natural surface, soft daylight`, 'Produits et réalisations'],
    [`Friendly scene with customers in ${what}, people seen from behind or at a distance, warm and candid atmosphere`, 'Une ambiance conviviale'],
    [`Macro detail of a material or texture typical of ${what}, vertical framing, soft side light`, 'Matières et textures'],
    [`Medium shot of the work in progress in ${what}, natural light, documentary style`, 'Au travail'],
    [`Decorative detail of the setting of ${what}, plants or objects, vertical framing, calm mood`, 'Un détail du décor'],
    [`Hero shot of the signature product or service of ${what}, carefully lit, clean background`, 'Notre spécialité'],
  ];
  return list.map(([prompt, alt], i) => ({ prompt, alt, ratio: IMAGE_RATIOS[i] }));
}

const PROCESS_KIT = {
  food: [['Vous choisissez', 'Sur place, par téléphone ou via le formulaire.'], ['Nous préparons', 'Tout est fait sur place, avec soin.'], ['Vous savourez', 'À emporter ou sur place, selon vos envies.']],
  rdv: [['Prise de rendez-vous', 'Par téléphone ou via le formulaire de contact.'], ['Premier échange', 'Nous faisons le point sur vos attentes.'], ['La séance', 'Un moment pensé pour vous, à votre rythme.'], ['Le suivi', 'Nous restons disponibles pour la suite.']],
  projet: [['Premier contact', 'Vous nous expliquez votre besoin, par téléphone ou via le formulaire.'], ['Proposition', 'Nous vous adressons une proposition claire et détaillée.'], ['Réalisation', 'Nous réalisons la prestation dans les conditions convenues.'], ['Suivi', 'Nous restons disponibles une fois le travail terminé.']],
  shop: [['Vous choisissez', 'Parcourez la boutique et ajoutez vos articles au panier.'], ['Vous commandez', 'Votre commande nous parvient par e-mail.'], ['Nous vous recontactons', 'Pour confirmer le paiement et la livraison.']],
  autre: [['Vous nous contactez', 'Par téléphone, par e-mail ou via le formulaire.'], ['Nous échangeons', 'Nous prenons le temps de comprendre votre demande.'], ['Nous vous accompagnons', 'Du premier échange jusqu’au bout.']],
};

function processKit(brief) {
  if (brief.siteType === 'boutique') return PROCESS_KIT.shop;
  if (['restaurant', 'boulangerie'].includes(brief.sector)) return PROCESS_KIT.food;
  if (['beaute', 'sante', 'sport', 'education', 'photo', 'evenementiel'].includes(brief.sector)) return PROCESS_KIT.rdv;
  if (['artisan', 'auto', 'immobilier', 'conseil', 'juridique', 'tech'].includes(brief.sector)) return PROCESS_KIT.projet;
  return PROCESS_KIT.autre;
}

export function kit(brief) {
  return SECTOR_KIT[brief.sector] || SECTOR_KIT.autre;
}

function lowerFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function firstSentence(text, max = 170) {
  const t = String(text || '').trim();
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  return clampText(m ? m[1] : t, max);
}

// « Nom - 12 € - description » → { name, price, description }
export function parseOfferLines(text) {
  return lines(text)
    .map((l) => {
      const parts = l.split(/\s+[-–—|]\s+|\s*[;|]\s*/).map((p) => p.trim()).filter(Boolean);
      let name = parts.shift() || '';
      let price = null;
      const rest = [];
      for (const p of parts) {
        if (price === null && /\d/.test(p) && /(€|eur|^\d+([.,]\d+)?\s*$)/i.test(p)) price = p.replace(/\s*(eur(os)?)$/i, ' €');
        else rest.push(p);
      }
      const inline = name.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*€\s*$/);
      if (inline && price === null) {
        name = inline[1];
        price = inline[2] + ' €';
      }
      return { name, price, description: rest.join(' — ') };
    })
    .filter((x) => x.name);
}

function cityPart(brief) {
  const c = String(brief.city || '').trim();
  if (!c) return '';
  return /^(à|a |en |dans|sur|autour)/i.test(c) ? ' ' + c : ' à ' + c.replace(/\s+et\s+.*$/i, '').replace(/\s*\(.*\)$/, '');
}

// ---------- Contenus de démonstration (sans IA) ----------

export function demoContent(brief) {
  const k = kit(brief);
  const name = brief.businessName || 'Votre entreprise';
  const strengths = lines(String(brief.strengths || '').replace(/,\s*/g, '\n')).slice(0, 4);
  const icons = k.icons;
  let highlights;
  if (strengths.length >= 2) {
    highlights = strengths.slice(0, 4).map((s, i) => ({
      title: clampText(s.charAt(0).toUpperCase() + s.slice(1), 48),
      text: HIGHLIGHT_POOL[icons[i % icons.length]] || 'Un engagement que nous tenons chaque jour.',
      icon: icons[i % icons.length],
    }));
  } else {
    highlights = icons.slice(0, 3).map((ic) => ({ title: HIGHLIGHT_TITLES[ic] || 'Notre engagement', text: HIGHLIGHT_POOL[ic], icon: ic }));
  }

  const given = parseOfferLines(brief.services);
  const services = (given.length ? given : k.services.map(([n, d]) => ({ name: n, description: d, price: null }))).map((s, i) => ({
    name: s.name,
    description: s.description || (given.length ? '' : ''),
    price: s.price,
    icon: icons[i % icons.length],
  }));

  let products = [];
  let productsAreExamples = false;
  if (brief.siteType === 'boutique') {
    const givenP = parseOfferLines(brief.products);
    if (givenP.length) {
      products = givenP.map((p) => ({ name: p.name, description: p.description, price: priceNumber(p.price), category: '', badge: null }));
    } else {
      productsAreExamples = true;
      const list = PRODUCT_KIT[brief.sector] || PRODUCT_KIT.default;
      products = list.map(([n, p, d, c]) => ({ name: n, price: p, description: d, category: c, badge: null }));
    }
    if (products[0]) products[0].badge = 'Nouveau';
  }

  const desc = String(brief.description || '').trim();
  const where = cityPart(brief);
  const faq = [];
  if ((brief.features || []).includes('reservation') || brief.goal === 'reservation') faq.push({ q: 'Comment réserver ?', a: `Par le formulaire de la page Contact${brief.phone ? ` ou par téléphone au ${brief.phone}` : ''}. Nous vous confirmons rapidement.` });
  if ((brief.features || []).includes('devis')) faq.push({ q: 'Le devis est-il gratuit ?', a: 'Décrivez votre besoin via le formulaire de contact : nous revenons vers vous avec une proposition détaillée.' });
  if (brief.siteType === 'boutique') {
    faq.push({ q: 'Comment passer commande ?', a: 'Ajoutez vos articles au panier puis envoyez votre commande : nous vous recontactons pour le paiement et la livraison.' });
    faq.push({ q: 'Puis-je faire un cadeau ?', a: 'Oui, précisez-le dans votre commande et nous préparons un emballage adapté.' });
  }
  if (brief.address || brief.city) faq.push({ q: 'Où vous trouver ?', a: brief.address ? `Nous sommes au ${brief.address}.` : `Nous intervenons${where}.` });
  if (brief.hours) faq.push({ q: 'Quels sont vos horaires ?', a: String(brief.hours).replace(/\n/g, ' · ') });
  faq.push({ q: 'Comment vous contacter ?', a: [brief.phone && `Par téléphone au ${brief.phone}`, brief.email && `par e-mail à ${brief.email}`, 'ou via le formulaire de contact'].filter(Boolean).join(', ') + '.' });

  return {
    brand: { name, tagline: k.promises[0], short: firstSentence(desc) || k.promises[1] },
    hero: { headline: k.promises[0], subheadline: firstSentence(desc) },
    highlightsTitle: 'Ce qui fait la différence',
    highlights,
    servicesTitle: '',
    servicesIntro: '',
    services,
    about: {
      title: `L’histoire de ${name}`,
      intro: firstSentence(desc, 220),
      quote: k.promises[1] + '.',
      story: [desc || `${name} vous accueille${where}.`, strengths.length ? `Ce qui compte pour nous : ${strengths.map(lowerFirst).join(', ')}.` : `Chez ${name}, chaque demande reçoit la même attention.`, `Une question, un projet ? Écrivez-nous : nous vous répondons avec plaisir.`],
      values: highlights.slice(0, 3).map((h) => ({ title: h.title, text: h.text, icon: h.icon })),
    },
    ctaBand: {
      title: brief.siteType === 'boutique' ? 'Envie de vous faire plaisir ?' : brief.goal === 'reservation' || (brief.features || []).includes('reservation') ? 'Envie de passer nous voir ?' : (brief.features || []).includes('devis') ? 'Parlons de votre projet' : brief.goal === 'appel' ? 'Une question ? Appelez-nous' : 'Écrivez-nous',
      text: 'Un message suffit : nous vous répondons rapidement.',
    },
    faq,
    faqIntro: '',
    products,
    productsAreExamples,
    productsTitle: 'Nos produits',
    productsIntro: '',
    contact: { title: 'Contact', intro: 'Une question, une demande ? Nous vous répondons rapidement.' },
    statement: strengths.length ? `Chez ${name}, ce qui compte : ${strengths.map(lowerFirst).join(', ')}.` : `${k.promises[1]}. ${k.promises[2]}.`,
    process: { title: 'Comment ça se passe', intro: '', steps: processKit(brief).map(([title, text]) => ({ title, text })) },
    galleryTitle: 'En images',
    seo: { title: `${name}${k.activity ? ' — ' + k.activity : ''}${where}`, description: firstSentence(desc, 155) },
    imageKeywords: [],
    imagePrompts: demoImagePrompts(brief),
  };
}

const DEMO_HEADLINES = {
  epure: (p, n, w) => `${p}.`,
  editorial: (p, n) => `${n}, ${lowerFirst(p)}`,
  luxe: (p) => p,
  artisan: (p, n, w) => `${p}${w}`,
  tech: (p) => p,
  ludique: (p) => `${p} !`,
  brutal: (p) => p,
  nature: (p) => p,
  corporate: (p, n, w) => `${p}${w}`,
  retro: (p) => p,
  audacieux: (p) => p,
  doux: (p) => p,
};

const DEMO_WHY = {
  epure: 'Une mise en page sobre qui met le contenu au premier plan.',
  editorial: 'Une allure de magazine qui valorise le récit et le savoir-faire.',
  luxe: 'Une présentation haut de gamme qui inspire l’exigence.',
  artisan: 'Une ambiance chaleureuse et proche, qui donne envie de pousser la porte.',
  tech: 'Un style moderne et dynamique qui rassure sur le sérieux et l’efficacité.',
  ludique: 'Un ton joyeux et accessible, qui se démarque immédiatement.',
  brutal: 'Un style brut et affirmé pour une marque qui ose.',
  nature: 'Des tons naturels qui évoquent le calme et l’authenticité.',
  corporate: 'Une structure claire qui inspire confiance dès le premier regard.',
  retro: 'Un clin d’œil vintage, sympathique et mémorable.',
  audacieux: 'Un parti pris graphique fort pour marquer les esprits.',
  doux: 'Une atmosphère douce et apaisante, tout en rondeur.',
};

export function demoConcepts(brief) {
  const k = kit(brief);
  const ids = rankArchetypes(brief).slice(0, 10);
  const name = brief.businessName || 'Votre entreprise';
  const where = cityPart(brief);
  const sub = firstSentence(brief.description, 160);
  return ids.map((id, i) => ({
    archetype: id,
    headline: DEMO_HEADLINES[id](k.promises[i % k.promises.length], name, where),
    subheadline: sub,
    cta: '',
    why: DEMO_WHY[id],
  }));
}

// ---------- Choix des directions artistiques ----------

export function rankArchetypes(brief) {
  const moods = brief.moods || [];
  const rand = rng(String(brief.businessName || '') + brief.sector);
  return ARCHETYPES.map((a) => {
    let score = rand() * 0.6;
    for (const md of moods) score += (a.moods[md] || 0) * 1.4;
    if (a.sectors.includes(brief.sector)) score += 2;
    return { id: a.id, score };
  })
    .sort((x, y) => y.score - x.score)
    .map((x) => x.id);
}

// ---------- Normalisation des réponses de l'IA ----------

const str = (v, max) => (typeof v === 'string' && v.trim() ? clampText(v.replace(/\s+/g, ' '), max) : '');
const arr = (v) => (Array.isArray(v) ? v : []);
const ic = (v, fallback) => (typeof v === 'string' && hasIcon(v) && ICON_NAMES.includes(v) ? v : fallback);

export function normalizeConcepts(raw, brief) {
  const list = arr(raw?.models || raw?.concepts || raw);
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const id = String(item?.archetype || '').trim().toLowerCase();
    if (!ARCHETYPE_MAP[id] || seen.has(id)) continue;
    seen.add(id);
    out.push({ archetype: id, headline: str(item.headline, 90), subheadline: str(item.subheadline, 200), cta: str(item.cta, 28), why: str(item.why, 180) });
  }
  // Compléter jusqu'à 10 directions différentes si l'IA en a donné moins
  const fallback = demoConcepts(brief);
  for (const f of fallback) {
    if (out.length >= 10) break;
    if (!seen.has(f.archetype)) {
      seen.add(f.archetype);
      out.push(f);
    }
  }
  return out.slice(0, 10);
}

export function normalizeContent(core, pages, brief) {
  const demo = demoContent(brief);
  const k = kit(brief);
  const c = core || {};
  const p = pages || {};
  const icons = k.icons;

  const highlights = arr(c.highlights)
    .map((h, i) => ({ title: str(h?.title, 60), text: str(h?.text, 200), icon: ic(h?.icon, icons[i % icons.length]) }))
    .filter((h) => h.title);

  const givenServices = parseOfferLines(brief.services);
  let services = arr(c.services)
    .map((s, i) => ({
      name: str(s?.name, 70),
      description: str(s?.description, 220),
      price: s?.price === null || s?.price === undefined || s?.price === '' ? null : typeof s.price === 'number' ? s.price : str(String(s.price), 40),
      icon: ic(s?.icon, icons[i % icons.length]),
    }))
    .filter((s) => s.name);
  // Les prix donnés par le client font foi
  if (givenServices.length) {
    services = givenServices.map((g, i) => {
      const match = services.find((s) => s.name.toLowerCase() === g.name.toLowerCase()) || services[i];
      return { name: g.name, price: g.price ?? null, description: g.description || match?.description || '', icon: match?.icon || icons[i % icons.length] };
    });
  }

  const about = c.about || {};
  const story = arr(about.story).map((s) => str(s, 700)).filter(Boolean);
  const values = arr(about.values)
    .map((v, i) => ({ title: str(v?.title, 60), text: str(v?.text, 200), icon: ic(v?.icon, icons[(i + 1) % icons.length]) }))
    .filter((v) => v.title);

  let products = [];
  let productsAreExamples = false;
  if (brief.siteType === 'boutique') {
    const givenP = parseOfferLines(brief.products);
    const aiP = arr(p.products)
      .map((x) => ({ name: str(x?.name, 70), description: str(x?.description, 160), price: priceNumber(x?.price), category: str(x?.category, 30), badge: str(x?.badge, 18) || null }))
      .filter((x) => x.name);
    if (givenP.length) {
      products = givenP.map((g, i) => {
        const match = aiP.find((x) => x.name.toLowerCase() === g.name.toLowerCase()) || aiP[i];
        return { name: g.name, price: priceNumber(g.price) ?? match?.price ?? null, description: g.description || match?.description || '', category: match?.category || '', badge: match?.badge || null };
      });
    } else if (aiP.length) {
      products = aiP;
      productsAreExamples = true;
    } else {
      products = demo.products;
      productsAreExamples = demo.productsAreExamples;
    }
  }

  const faq = arr(p.faq)
    .map((f) => ({ q: str(f?.q || f?.question, 140), a: str(f?.a || f?.answer, 420) }))
    .filter((f) => f.q && f.a);

  return {
    brand: { name: brief.businessName || demo.brand.name, tagline: str(c.brand?.tagline, 90) || demo.brand.tagline, short: str(c.brand?.short, 220) || demo.brand.short },
    hero: demo.hero,
    highlightsTitle: str(c.highlightsTitle, 60) || demo.highlightsTitle,
    highlightsIntro: str(c.highlightsIntro, 200),
    highlights: highlights.length >= 2 ? highlights.slice(0, 4) : demo.highlights,
    servicesTitle: str(c.servicesTitle, 60),
    servicesIntro: str(c.servicesIntro, 220),
    services: services.length ? services : demo.services,
    about: {
      title: str(about.title, 70) || demo.about.title,
      intro: str(about.intro, 280) || demo.about.intro,
      quote: str(about.quote, 200) || demo.about.quote,
      story: story.length ? story : demo.about.story,
      valuesTitle: str(about.valuesTitle, 60),
      values: values.length ? values : demo.about.values,
    },
    ctaBand: { title: str(c.ctaBand?.title, 80) || demo.ctaBand.title, text: str(c.ctaBand?.text, 200) || demo.ctaBand.text },
    statement: str(c.statement, 320) || demo.statement,
    process: (() => {
      const steps = arr(c.process?.steps)
        .map((x) => ({ title: str(x?.title, 60), text: str(x?.text, 220) }))
        .filter((x) => x.title)
        .slice(0, 4);
      return steps.length >= 2 ? { title: str(c.process?.title, 60) || 'Comment ça se passe', intro: str(c.process?.intro, 200), steps } : demo.process;
    })(),
    galleryTitle: str(c.galleryTitle, 50) || demo.galleryTitle,
    faq: faq.length ? faq : demo.faq,
    faqIntro: str(p.faqIntro, 200),
    products,
    productsAreExamples,
    productsTitle: str(p.productsTitle, 60) || demo.productsTitle,
    productsIntro: str(p.productsIntro, 220),
    contact: { title: str(p.contact?.title, 60) || 'Contact', intro: str(p.contact?.intro, 220) || demo.contact.intro, formTitle: str(p.contact?.formTitle, 60) },
    seo: { title: str(c.seo?.title, 70) || demo.seo.title, description: str(c.seo?.description, 160) || demo.seo.description },
    imageKeywords: arr(c.imageKeywords).map((x) => str(x, 40)).filter(Boolean).slice(0, 5),
    imagePrompts: (() => {
      const list = arr(c.imagePrompts)
        .map((x) => (typeof x === 'string' ? { prompt: str(x, 400), alt: '' } : { prompt: str(x?.prompt, 400), alt: str(x?.alt, 140) }))
        .filter((x) => x.prompt);
      return list.length >= 2 ? list.slice(0, 8).map((x, i) => ({ ...x, ratio: IMAGE_RATIOS[i] })) : demo.imagePrompts;
    })(),
  };
}

export function conceptsToModels(concepts) {
  return concepts.map((c) => ({ id: uid(), seed: 0, ...c }));
}
