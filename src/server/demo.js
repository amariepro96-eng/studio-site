// Bac à sable de l'atelier : un client de démo complet (site + espace prêts), pour tester les
// fonctionnalités directement, comme sur un vrai dossier. L'appli Devis, le calculateur, la
// variante « site seul »… s'activent ensuite depuis le dossier de démo, comme pour un vrai client.
import { createClient, updateClient, deleteClient, listClients } from './store.js';
import { preparer } from './espace.js';
import { supprimerAppli } from './devisAgence.js';

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
  aiImages: [],
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
};
const DEMO_RESULT = { content: DEMO_CONTENT, models: [{ id: 'm1', name: 'Clarté' }] };

export async function trouverDemo() {
  const list = await listClients();
  return list.find((c) => c.demo)?.id || null;
}

export async function supprimerDemo() {
  const list = await listClients();
  for (const c of list) {
    if (!c.demo) continue;
    if (c.appliDevis?.wid) await supprimerAppli(c.appliDevis.wid, { clientId: c.id }).catch(() => {});
    await deleteClient(c.id).catch(() => {});
  }
}

export async function creerDemo() {
  await supprimerDemo();
  const rec = await createClient({ name: 'Démo — Café Lumière', formula: 'demo', mode: 'self' });
  await updateClient(rec.id, (r) => {
    r.demo = true;
    r.brief = { ...DEMO_BRIEF };
    r.result = JSON.parse(JSON.stringify(DEMO_RESULT));
    r.choice = { modelId: 'm1' };
    r.status = 'live';
    r.liveUrl = '';
    r.liveAt = new Date().toISOString();
    preparer(r, { par: 'agence' }); // espace « Modification du site » prêt
    r.log = [...(r.log || []), { at: new Date().toISOString(), what: 'Client de démo créé (bac à sable de l’atelier)' }];
    return r;
  });
  return rec.id;
}
