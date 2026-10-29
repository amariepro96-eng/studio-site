// Appli Devis & Factures (option vendue avec le site) : calculs et contrôles partagés par le
// navigateur et le serveur.
//   Montants : centimes (entiers). Quantités : 3 décimales au plus.
//   Taux de TVA : centièmes de pour cent (2000 = 20 %).
import { euros, lireEuros, versSaisie, aujourdhuiParis, jourValide, dateCourte } from './finances.js';

export { euros, lireEuros, versSaisie, aujourdhuiParis, jourValide, dateCourte };

export const TAUX_TVA = [
  { v: 2000, label: '20 %' },
  { v: 1000, label: '10 %' },
  { v: 550, label: '5,5 %' },
  { v: 210, label: '2,1 %' },
  { v: 0, label: '0 %' },
];
const TAUX_OK = new Set(TAUX_TVA.map((t) => t.v));
export const tauxLabel = (v) => TAUX_TVA.find((t) => t.v === v)?.label || `${(v / 100).toLocaleString('fr-FR')} %`;

export const UNITES = ['u', 'h', 'jour', 'forfait', 'm²', 'm', 'ml', 'm³', 'kg', 'lot'];

export const LIMITES = { produits: 1000, lignes: 100, documents: 3000, texte: 1500 };

export const STATUTS_DEVIS = {
  brouillon: { label: 'Brouillon', ton: 'neutre' },
  envoye: { label: 'Envoyé', ton: 'info' },
  vu: { label: 'Consulté', ton: 'info' },
  modification: { label: 'Modification demandée', ton: 'attention' },
  accepte: { label: 'Accepté', ton: 'ok' },
  refuse: { label: 'Refusé', ton: 'ko' },
  annule: { label: 'Annulé', ton: 'neutre' },
  expire: { label: 'Expiré', ton: 'neutre' },
};
export const STATUTS_FACTURE = {
  a_emettre: { label: 'À émettre', ton: 'attention' },
  emise: { label: 'À encaisser', ton: 'info' },
  retard: { label: 'En retard', ton: 'ko' },
  payee: { label: 'Payée', ton: 'ok' },
};

// Statuts dans lesquels le client final peut encore répondre au devis
export const EN_ATTENTE_CLIENT = ['envoye', 'vu', 'modification'];

// ---------- Textes ----------
export function texte(v, max = 200, { lignes = false } = {}) {
  if (typeof v !== 'string') return '';
  let s = v.replace(/\r\n?/g, '\n');
  // Caractères de contrôle retirés (sauf retours à la ligne si autorisés)
  s = s.replace(lignes ? /[\u0000-\u0009\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g, lignes ? '' : ' ');
  if (lignes) s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim().slice(0, max);
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const emailOk = (s) => EMAIL_RE.test(String(s || '').trim()) && String(s).length <= 120;
const idOk = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{6,24}$/.test(v);
export const nouvelId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const entier = (v, min, max, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const MAX_MONTANT = 100_000_000; // 1 000 000 €
const montant = (v, { negatif = false } = {}) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(negatif ? -MAX_MONTANT : 0, Math.min(MAX_MONTANT, n));
};

// ---------- Quantités ----------
export function lireQuantite(s) {
  const t = String(s ?? '')
    .replace(/[\s  ]/g, '')
    .replace(',', '.');
  if (!t) return null;
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return null;
  const n = Math.round(parseFloat(t) * 1000) / 1000;
  return n > 0 && n <= 1_000_000 ? n : null;
}
export const quantiteValide = (q) => typeof q === 'number' && Number.isFinite(q) && q > 0 && q <= 1_000_000 && Math.abs(Math.round(q * 1000) - q * 1000) < 1e-6;
export const formatQuantite = (q) => (Number(q) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 });

// ---------- Produits ----------
export function nettoyerProduit(p) {
  if (!p || typeof p !== 'object') return null;
  const nom = texte(p.nom, 160);
  if (!nom) return null;
  return {
    id: idOk(p.id) ? p.id : nouvelId(),
    ref: texte(p.ref, 40),
    nom,
    description: texte(p.description, 600, { lignes: true }),
    unite: UNITES.includes(p.unite) ? p.unite : 'u',
    prixHT: montant(p.prixHT),
    tva: TAUX_OK.has(Number(p.tva)) ? Number(p.tva) : 2000,
    categorie: texte(p.categorie, 60),
  };
}
export function nettoyerProduits(list) {
  const out = [];
  const ids = new Set();
  for (const p of Array.isArray(list) ? list : []) {
    const q = nettoyerProduit(p);
    if (!q) continue;
    if (ids.has(q.id)) q.id = nouvelId();
    ids.add(q.id);
    out.push(q);
    if (out.length >= LIMITES.produits) break;
  }
  return out;
}

// Liste collée depuis un tableur : une ligne par produit « Nom ; prix HT ; unité ; TVA ; référence »
// (séparateur « ; », tabulation ou « | »). Renvoie les produits lus et les lignes ignorées.
export function lireListeProduits(textebrut) {
  const produits = [];
  const ignorees = [];
  const lignes = String(textebrut || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, LIMITES.produits);
  for (const l of lignes) {
    const cols = l.split(/\t|;|\|/).map((c) => c.trim());
    const nom = cols[0];
    const prix = cols[1] ? lireEuros(cols[1]) : null;
    if (!nom || prix === null || /^nom$/i.test(nom)) {
      if (!/^nom$/i.test(nom || '')) ignorees.push(l);
      continue;
    }
    const unite = UNITES.find((u) => u.toLowerCase() === String(cols[2] || '').toLowerCase()) || 'u';
    const tvaTxt = String(cols[3] || '').replace(',', '.').replace('%', '').trim();
    const tva = tvaTxt === '' ? 2000 : Math.round(parseFloat(tvaTxt) * 100);
    const p = nettoyerProduit({ nom, prixHT: prix, unite, tva: TAUX_OK.has(tva) ? tva : 2000, ref: cols[4] || '' });
    if (p) produits.push(p);
  }
  return { produits, ignorees };
}

// ---------- Entreprise (celle du client de l'agence) ----------
// Nature des opérations (mention des factures entre professionnels avec la facturation électronique)
export const NATURES = { services: 'Prestations de services', biens: 'Livraisons de biens', mixte: 'Livraisons de biens et prestations de services' };
export const FORMES = ['EI ou micro-entreprise', 'EURL', 'SARL', 'SAS ou SASU', 'SA', 'Association', 'Autre'];
export const PENALITES_DEFAUT =
  'En cas de retard de paiement, des pénalités sont dues au taux de trois fois le taux d’intérêt légal, ainsi qu’une indemnité forfaitaire de 40 € pour frais de recouvrement (clients professionnels). Pas d’escompte pour paiement anticipé.';

export function entrepriseVide() {
  return {
    nom: '',
    forme: '',
    capital: '',
    adresse: '',
    siret: '',
    rcs: '',
    tva: '',
    franchise: false,
    tvaDebits: false,
    nature: '',
    email: '',
    telephone: '',
    site: '',
    iban: '',
    bic: '',
    validiteJours: 30,
    delaiPaiementJours: 30,
    acomptePct: 0,
    conditions: 'Paiement par virement ou par chèque.',
    penalites: PENALITES_DEFAUT,
    mentions: '',
  };
}

export function nettoyerEntreprise(e) {
  const v = entrepriseVide();
  if (!e || typeof e !== 'object') return v;
  return {
    nom: texte(e.nom, 120),
    forme: FORMES.includes(e.forme) ? e.forme : '',
    capital: texte(e.capital, 40),
    adresse: texte(e.adresse, 240, { lignes: true }),
    siret: texte(e.siret, 20).replace(/[^\d ]/g, ''),
    rcs: texte(e.rcs, 80),
    tva: texte(e.tva, 20).toUpperCase(),
    franchise: e.franchise === true,
    tvaDebits: e.tvaDebits === true && e.franchise !== true,
    nature: Object.hasOwn(NATURES, e.nature) ? e.nature : '',
    email: emailOk(e.email) ? String(e.email).trim() : '',
    telephone: texte(e.telephone, 30),
    site: texte(e.site, 120),
    iban: texte(e.iban, 42).toUpperCase(),
    bic: texte(e.bic, 15).toUpperCase(),
    validiteJours: entier(e.validiteJours, 1, 365, v.validiteJours),
    delaiPaiementJours: entier(e.delaiPaiementJours, 0, 120, v.delaiPaiementJours),
    acomptePct: entier(e.acomptePct, 0, 100, 0),
    conditions: texte(e.conditions, LIMITES.texte, { lignes: true }),
    penalites: texte(e.penalites, LIMITES.texte, { lignes: true }),
    mentions: texte(e.mentions, LIMITES.texte, { lignes: true }),
  };
}

// Ce qui manque pour des devis et factures en règle (affiché dans Réglages et à l'envoi)
export function manquesEntreprise(e) {
  const m = [];
  if (!e?.nom) m.push('le nom de l’entreprise');
  if (!e?.adresse) m.push('l’adresse');
  if (!e?.siret) m.push('le numéro SIRET');
  if (!e?.franchise && !e?.tva) m.push('le numéro de TVA (ou cocher « TVA non applicable »)');
  if (!emailOk(e?.email)) m.push('l’e-mail de contact');
  return m;
}

// ---------- Client final ----------
export function nettoyerClient(c) {
  if (!c || typeof c !== 'object') c = {};
  return {
    nom: texte(c.nom, 120),
    contact: texte(c.contact, 120),
    email: emailOk(c.email) ? String(c.email).trim() : '',
    telephone: texte(c.telephone, 30),
    adresse: texte(c.adresse, 240, { lignes: true }),
    pro: c.pro === true,
    siret: texte(c.siret, 20).replace(/[^\d ]/g, ''),
  };
}

// ---------- Lignes et totaux ----------
export function nettoyerLigne(l) {
  if (!l || typeof l !== 'object') return null;
  const designation = texte(l.designation, 200);
  if (!designation) return null;
  const q = typeof l.quantite === 'number' ? l.quantite : lireQuantite(l.quantite);
  return {
    id: idOk(l.id) ? l.id : nouvelId(),
    produitId: idOk(l.produitId) ? l.produitId : '',
    designation,
    description: texte(l.description, 600, { lignes: true }),
    quantite: quantiteValide(q) ? Math.round(q * 1000) / 1000 : 1,
    unite: UNITES.includes(l.unite) ? l.unite : 'u',
    // Prix négatif possible : ligne de remise
    prixHT: montant(l.prixHT, { negatif: true }),
    tva: TAUX_OK.has(Number(l.tva)) ? Number(l.tva) : 2000,
  };
}
export const nettoyerLignes = (list) => (Array.isArray(list) ? list : []).map(nettoyerLigne).filter(Boolean).slice(0, LIMITES.lignes);

export const ligneHT = (l) => Math.round((Number(l.quantite) || 0) * (Number(l.prixHT) || 0));

export function totaux(lignes, { franchise = false, acomptePct = 0 } = {}) {
  const parTaux = new Map();
  let ht = 0;
  for (const l of lignes || []) {
    const m = ligneHT(l);
    ht += m;
    const t = franchise ? 0 : Number(l.tva) || 0;
    parTaux.set(t, (parTaux.get(t) || 0) + m);
  }
  const tvas = [...parTaux.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([taux, base]) => ({ taux, base, tva: Math.round((base * taux) / 10000) }));
  const tva = tvas.reduce((s, x) => s + x.tva, 0);
  const ttc = ht + tva;
  const pct = Math.min(100, Math.max(0, Number(acomptePct) || 0));
  return { ht, tvas: franchise ? [] : tvas.filter((x) => x.taux > 0 || x.base !== 0), tva, ttc, acompte: pct ? Math.round((ttc * pct) / 100) : 0, acomptePct: pct, franchise };
}

// ---------- Dates ----------
export function ajouterJours(jour, n) {
  const d = new Date(jour + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
}
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function dateLongue(jour) {
  if (!jourValide(jour)) return '';
  const [a, m, d] = jour.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MOIS[m - 1]} ${a}`;
}

// ---------- Numéros ----------
export const numero = (type, annee, n) => `${type === 'facture' ? 'F' : 'D'}-${annee}-${String(n).padStart(4, '0')}`;

// ---------- Statuts affichés ----------
export function statutDevis(d, jour = aujourdhuiParis()) {
  if (EN_ATTENTE_CLIENT.includes(d?.statut) && d?.envoi?.validite && d.envoi.validite < jour) return 'expire';
  return d?.statut || 'brouillon';
}
export function statutFacture(f, jour = aujourdhuiParis()) {
  if (f?.statut === 'emise' && f.echeance && f.echeance < jour) return 'retard';
  return f?.statut || 'a_emettre';
}

// ---------- Saisie d'un devis par l'entreprise ----------
export function nettoyerSaisieDevis(d, entreprise) {
  const e = entreprise || entrepriseVide();
  return {
    client: nettoyerClient(d?.client),
    objet: texte(d?.objet, 200),
    lignes: nettoyerLignes(d?.lignes),
    validiteJours: entier(d?.validiteJours, 1, 365, e.validiteJours || 30),
    acomptePct: entier(d?.acomptePct, 0, 100, e.acomptePct || 0),
    notes: texte(d?.notes, LIMITES.texte, { lignes: true }),
  };
}

// Ce qui empêche l'envoi d'un devis
export function manquesDevis(d) {
  const m = [];
  if (!d?.client?.nom) m.push('le nom du client');
  if (!d?.lignes?.length) m.push('au moins une ligne');
  if (d?.lignes?.length && totaux(d.lignes).ttc <= 0) m.push('un montant total positif');
  return m;
}

// Mentions légales en bas d'un devis ou d'une facture
export function mentionsDocument(vendeur, { facture = false, clientPro = false } = {}) {
  const v = vendeur || {};
  const l = [];
  const id = [v.nom, v.forme && v.forme !== 'EI ou micro-entreprise' ? v.forme : '', v.capital ? `au capital de ${v.capital}` : ''].filter(Boolean).join(' ');
  if (id) l.push(id);
  const reg = [v.siret ? `SIRET ${v.siret}` : '', v.rcs || '', v.tva && !v.franchise ? `TVA intracommunautaire ${v.tva}` : ''].filter(Boolean).join(' · ');
  if (reg) l.push(reg);
  if (v.franchise) l.push('TVA non applicable, article 293 B du CGI');
  if (facture && v.nature) l.push(`Nature des opérations : ${NATURES[v.nature].toLowerCase()}`);
  if (facture && v.tvaDebits && !v.franchise) l.push('Option pour le paiement de la taxe d’après les débits');
  if (facture && clientPro && v.penalites) l.push(v.penalites);
  else if (facture && !clientPro && v.penalites) l.push(v.penalites.replace(/,? ainsi qu’une indemnité forfaitaire de 40 € pour frais de recouvrement \(clients professionnels\)/, ''));
  if (v.mentions) l.push(v.mentions);
  return l;
}

// Message d'invitation envoyé par l'agence au client (le lien remplace {lien})
export function messageInvitation({ nom, lien, owner }) {
  return `Bonjour,

Voici votre application Devis & Factures${nom ? ` pour ${nom}` : ''} :
${lien}

Avec elle, vous créez vos devis à partir de vos produits et de vos prix, vous les envoyez par e-mail, vos clients les acceptent en ligne d’un clic, et chaque devis accepté devient une facture.

Ce lien personnel sert une seule fois et reste valable 7 jours : ne le transférez pas. Il vous permet de créer votre compte : votre adresse e-mail, un mot de passe, puis un code de sécurité affiché par l’appli Google Authenticator (à installer sur votre téléphone). Pensez à noter vos codes de secours.

Pour l’installer sur votre téléphone comme une appli :
- iPhone (Safari) : bouton ⋯ ou Partager › « Sur l’écran d’accueil » › Ajouter ;
- Android (Chrome) : menu ⋮ › « Installer l’application » ou « Ajouter à l’écran d’accueil ».

Je reste disponible pour vous aider à la prendre en main.
${owner}`;
}
