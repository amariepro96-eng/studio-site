// Bac à sable de l'atelier : un client de démo complet (site + espace prêts), pour tester les
// fonctionnalités directement, comme sur un vrai dossier. L'appli Devis, le calculateur, la
// variante « site seul »… s'activent ensuite depuis le dossier de démo, comme pour un vrai client.
// Ses images (le café, le geste du barista, le brunch, les pâtisseries…) sont créées par l'IA
// depuis l'écran de l'atelier, puis gardées quand on remet la démo à neuf.
import crypto from 'node:crypto';
import { createClient, updateClient, deleteClient, listClients, getClient, readImage, saveImage } from './store.js';
import { preparer, etatActuel } from './espace.js';
import { IMAGE_RATIOS } from '../engine/content.js';
import { IMAGE_ROLES } from '../engine/placement.js';
import { supprimerAppli } from './devisAgence.js';
import { supprimerPublicationEssai } from './publish.js';

const DEMO_BRIEF = {
  businessName: 'Café Lumière',
  sector: 'restauration',
  sectorOther: '',
  city: 'Argenteuil',
  description: 'Un café de quartier chaleureux : cafés de spécialité, brunchs et pâtisseries maison.',
  siteType: 'vitrine',
  pages: ['apropos', 'services', 'faq'],
  features: [],
  goal: 'venir',
  services: 'Café de spécialité\nBrunch du week-end\nPâtisseries maison',
  products: '',
  strengths: 'Torréfaction artisanale, produits frais, accueil convivial.',
  moods: [],
  color: '',
  audience: '',
  inspirations: '',
  phone: '01 39 00 00 00',
  email: 'bonjour@cafe-lumiere.fr',
  address: '12 rue des Lampions, 95100 Argenteuil',
  hours: 'Mardi – samedi : 8 h – 18 h\nDimanche : 9 h – 13 h\nFermé le lundi',
  instagram: '',
  facebook: '',
  reviews: '',
  aiImages: true,
  photos: [],
  logo: null,
  logoInHeader: false,
  legalName: 'Café Lumière',
  legalForm: 'SARL',
  capital: '',
  siret: '000 000 000 00000',
  rcs: '',
  publisher: '',
  siege: '12 rue des Lampions, 95100 Argenteuil',
  domainOwned: false,
  domain: '',
};
// Les 8 images du café, dans l'ordre des rôles demandés à l'IA pour un vrai client
// (vue d'ensemble, geste, produits vus de dessus, ambiance, matière, activité, décor, produit phare)
export const DEMO_IMAGE_PROMPTS = [
  ['Wide, bright view of a cozy neighborhood specialty coffee shop in the morning: wooden tables, green plants, a long counter with a chrome espresso machine, soft daylight through large windows, warm tones', 'La salle du café, le matin'],
  ['Close-up of a barista’s hands pouring steamed milk into a cappuccino to draw a latte art heart, ceramic cup on a wooden counter, soft natural light, shallow depth of field', 'Le latte art, versé à la main'],
  ['Top-down still life of a weekend brunch on a light wooden table: poached eggs on sourdough toast, avocado, a bowl of fresh seasonal fruit, a cappuccino and a glass of orange juice, soft daylight', 'Le brunch du week-end'],
  ['Friendly scene in a sunny neighborhood café, customers seen from behind chatting at small tables with coffee cups and pastries, warm candid atmosphere, softly blurred background', 'Une ambiance conviviale'],
  ['Macro detail of freshly roasted coffee beans with a satin sheen, spilling from a burlap sack, vertical framing, soft side light, rich brown tones', 'Grains torréfiés sur place'],
  ['Medium shot of a small artisan coffee roaster in a café workshop, freshly roasted beans pouring into the round cooling tray, light wisps of steam, natural light, documentary style, no face visible', 'La torréfaction artisanale'],
  ['Decorative detail of a café corner: stacked ceramic cups on an open wooden shelf, a hanging plant, a paper bag of coffee beans, morning sunlight, vertical framing, calm mood', 'Un coin du café'],
  ['Hero shot of homemade French pastries on a marble counter: golden croissants, pain au chocolat and a glazed fruit tart, next to a freshly pulled espresso, carefully lit, clean light background', 'Pâtisseries maison et espresso'],
].map(([prompt, alt], i) => ({ prompt, alt, ratio: IMAGE_RATIOS[i], role: IMAGE_ROLES[i] }));

const DEMO_CONTENT = {
  services: [
    { sid: 'd1', name: 'Café de spécialité', description: 'Torréfaction artisanale, extraction au choix.', price: '3,50 €' },
    { sid: 'd2', name: 'Brunch du week-end', description: 'Œufs, pain au levain, fruits de saison.', price: '19 €' },
    { sid: 'd3', name: 'Pâtisseries maison', description: 'Préparées chaque matin.', price: 'à partir de 4 €' },
  ],
  faq: [
    { q: 'Peut-on réserver ?', a: 'Oui, par téléphone pour les groupes à partir de 6 personnes.' },
    { q: 'Y a-t-il des options sans gluten ?', a: 'Plusieurs pâtisseries et plats sont sans gluten.' },
  ],
  annonces: [],
  imagePrompts: DEMO_IMAGE_PROMPTS,
};
const DEMO_RESULT = { content: DEMO_CONTENT, models: [{ id: 'm1', name: 'Clarté' }] };

export async function trouverDemo() {
  const list = await listClients();
  return list.find((c) => c.demo)?.id || null;
}

// Images du café déjà présentes dans la démo, dans l'ordre des descriptions
const rang = (alt) => DEMO_IMAGE_PROMPTS.findIndex((p) => p.alt === alt);
const imagesDemo = (rec) => (rec?.aiImages || []).filter((p) => !p.reel && rang(p.alt) >= 0);
const manquantes = (rec) => {
  const faites = new Set(imagesDemo(rec).map((p) => p.alt));
  return DEMO_IMAGE_PROMPTS.filter((p) => !faites.has(p.alt));
};

// Ce que l'écran de l'atelier affiche : la démo et où en sont ses images
export async function etatDemo() {
  const list = await listClients();
  const rec = list.find((c) => c.demo);
  if (!rec) return { demo: null };
  return { demo: rec.id, images: { faites: DEMO_IMAGE_PROMPTS.length - manquantes(rec).length, total: DEMO_IMAGE_PROMPTS.length } };
}

async function lireOctets(clientId, imgId) {
  const res = await readImage(clientId, imgId).catch(() => null);
  if (!res) return null;
  const buffer = res.buffer || (res.stream ? Buffer.from(await new Response(res.stream).arrayBuffer()) : null);
  return buffer?.length ? { buffer, contentType: res.contentType || 'image/jpeg' } : null;
}

export async function supprimerDemo() {
  const list = await listClients();
  for (const c of list) {
    if (!c.demo) continue;
    if (c.appliDevis?.wid) await supprimerAppli(c.appliDevis.wid, { clientId: c.id }).catch(() => {});
    await supprimerPublicationEssai(c).catch(() => {});
    await deleteClient(c.id).catch(() => {});
  }
}

const nouveauLot = () => crypto.randomBytes(6).toString('hex');

// Crée (ou remet à neuf) la démo. Les images du café de l'ancienne démo sont reprises,
// pour ne pas les refaire payer à chaque remise à neuf ; celles qui manquent sont renvoyées
// à l'écran, qui les fait créer par l'IA (Gemini), comme pour un vrai dossier.
export async function creerDemo({ nouvellesImages = false } = {}) {
  const list = await listClients();
  const ancienne = list.find((c) => c.demo);
  const copies = [];
  if (ancienne && !nouvellesImages) {
    for (const p of imagesDemo(ancienne)) {
      const o = await lireOctets(ancienne.id, p.id);
      if (o) copies.push({ ...o, alt: p.alt });
    }
  }
  await supprimerDemo();
  const rec = await createClient({ name: 'Démo — Café Lumière', formula: 'demo', mode: 'self' });
  const aiImages = [];
  for (const c of copies) {
    try {
      const img = await saveImage(rec.id, c.buffer, c.contentType);
      aiImages.push({ id: img.id, ext: img.ext, alt: c.alt });
    } catch {}
  }
  aiImages.sort((a, b) => rang(a.alt) - rang(b.alt));
  const imageBatch = nouveauLot();
  const fini = await updateClient(rec.id, (r) => {
    r.demo = true;
    r.brief = { ...DEMO_BRIEF };
    r.result = JSON.parse(JSON.stringify(DEMO_RESULT));
    r.choice = { modelId: 'm1' };
    r.aiImages = aiImages;
    // Rôle de chaque image (vue d'ensemble, geste, produit…) : placée au bon endroit du site
    r.imageInfo = Object.fromEntries(aiImages.map((p) => [p.id, { role: IMAGE_ROLES[rang(p.alt)], ia: true }]));
    r.imageBatch = imageBatch;
    r.status = 'live';
    r.liveUrl = '';
    r.liveAt = new Date().toISOString();
    preparer(r, { par: 'agence' }); // espace « Modification du site » prêt
    r.log = [...(r.log || []), { at: new Date().toISOString(), what: 'Client de démo créé (bac à sable de l’atelier)' + (aiImages.length ? `, ${aiImages.length} images reprises` : '') }];
    return r;
  });
  return { id: rec.id, images: { manquantes: manquantes(fini), batch: imageBatch, faites: aiImages.length, total: DEMO_IMAGE_PROMPTS.length } };
}

// Images à (re)créer pour la démo existante : les manquantes, ou toutes avec « neuves »
export async function imagesACreer(id, { neuves = false } = {}) {
  const rec = await getClient(id);
  if (!rec?.demo) return null;
  const imageBatch = nouveauLot();
  const fini = await updateClient(id, (r) => {
    if (neuves) r.aiImages = (r.aiImages || []).filter((p) => p.reel || rang(p.alt) < 0);
    r.imageBatch = imageBatch;
    return r;
  });
  return { manquantes: manquantes(fini), batch: imageBatch, faites: DEMO_IMAGE_PROMPTS.length - manquantes(fini).length, total: DEMO_IMAGE_PROMPTS.length };
}

// Après la création des images : remises dans l'ordre (vue d'ensemble d'abord) et notées
// dans la version 1 de l'espace client, pour qu'un retour à la version livrée les garde
export async function finaliserImages(id) {
  const rec = await getClient(id);
  if (!rec?.demo) return null;
  const fini = await updateClient(id, (r) => {
    const autres = (r.aiImages || []).filter((p) => p.reel || rang(p.alt) < 0);
    // Une seule image par description (la plus récente), puis l'ordre des descriptions
    const parAlt = new Map();
    for (const p of imagesDemo(r)) parAlt.set(p.alt, p);
    r.aiImages = [...[...parAlt.values()].sort((a, b) => rang(a.alt) - rang(b.alt)), ...autres];
    const e = r.espace;
    if (e?.versions?.length === 1) e.versions = [{ ...e.versions[0], etat: etatActuel(r) }];
    r.log = [...(r.log || []), { at: new Date().toISOString(), what: `Images IA du café : ${parAlt.size}/${DEMO_IMAGE_PROMPTS.length}` }];
    return r;
  });
  return { faites: DEMO_IMAGE_PROMPTS.length - manquantes(fini).length, total: DEMO_IMAGE_PROMPTS.length };
}
