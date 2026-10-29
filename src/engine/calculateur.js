// Calculateur d'estimation de l'appli Devis & Factures (option activée par l'agence).
// Un même moteur réglable : matière (quantité × prix selon le choix), temps (heures × taux,
// forfaits, marge), coefficients (qualité, remplissage…), options, délai, livraison.
// Modèles prêts à l'emploi : impression 3D, menuiserie, traiteur, libre. Montants en centimes.
import { euros, TAUX_TVA, nouvelId } from './devis.js';

const TAUX_OK = new Set(TAUX_TVA.map((t) => t.v));
const MAX_CHOIX = 20;
const txt = (v, max = 80) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
const ent = (v, min, max, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const prix = (v) => ent(v, 0, 10_000_000, 0); // 100 000 € au plus
const ch = (nom, valeur) => ({ id: nouvelId(), nom, v: valeur });

export const MODELES = {
  impression3d: {
    nom: 'Impression 3D',
    titre: 'Estimation impression 3D',
    tva: 2000,
    matiere: {
      actif: true,
      titre: 'Matière',
      champ: 'Matière nécessaire',
      unite: 'g',
      uniteAchat: 'kg',
      facteur: 1000,
      aide: 'Quantité de matière approximative, par pièce.',
      choixTitre: 'Matériau',
      description: 'Le poids réel dépendra de la géométrie et de la densité du modèle 3D.',
      choix: [ch('PLA', 2200), ch('PETG', 2500), ch('ABS', 2400), ch('ASA', 3000), ch('TPU flexible', 3500)],
    },
    coefMatiere: { actif: true, titre: 'Remplissage', choix: [ch('Léger (10 %)', 90), ch('Standard (15 %)', 100), ch('Renforcé (30 %)', 120), ch('Plein (100 %)', 180)] },
    temps: {
      actif: true,
      titre: 'Fabrication sur mesure',
      champ: 'Temps machine estimé',
      unite: 'h',
      aide: 'Par pièce. Chaque heure réserve une machine.',
      taux: 200,
      forfaitCommande: 400,
      forfaitPiece: 150,
      marge: 30,
      description: 'Temps machine, forfaits commande et pièce, marge d’atelier incluse.',
    },
    coefTemps: { actif: true, titre: 'Qualité d’impression', choix: [ch('Brouillon (0,28 mm)', 80), ch('Standard (0,20 mm)', 100), ch('Fine (0,12 mm)', 160)] },
    pieces: { actif: true, champ: 'Nombre de pièces' },
    options: { actif: true, titre: 'Finition atelier', description: 'Plus de précision, moins de traces visibles.', choix: [ch('Assemblage', 600), ch('Ponçage', 800), ch('Peinture', 1500)] },
    delais: { actif: true, titre: 'Priorité atelier', description: 'Délai court = planification dédiée.', choix: [ch('5 à 7 jours ouvrés', 0), ch('2 à 3 jours ouvrés', 1000), ch('Express 24 h', 2500)] },
    livraison: { actif: true, titre: 'Expédition suivie', description: 'Emballage renforcé, suivi partagé.', choix: [ch('Retrait à l’atelier', 0), ch('Lettre suivie', 450), ch('Colissimo 2 jours', 690), ch('Chronopost 24 h', 1490)] },
  },
  menuiserie: {
    nom: 'Menuiserie, pose au m²',
    titre: 'Estimation menuiserie',
    tva: 2000,
    matiere: {
      actif: true,
      titre: 'Bois et fournitures',
      champ: 'Surface',
      unite: 'm²',
      uniteAchat: 'm²',
      facteur: 1,
      aide: 'Surface totale à fabriquer ou poser.',
      choixTitre: 'Essence ou panneau',
      description: 'Fournitures selon la surface, chutes comprises.',
      choix: [ch('Pin', 4500), ch('Chêne', 9500), ch('Contreplaqué', 3500), ch('MDF', 2500)],
    },
    coefMatiere: { actif: true, titre: 'Pertes et chutes', choix: [ch('Standard (+10 %)', 110), ch('Découpes complexes (+20 %)', 120)] },
    temps: { actif: true, titre: 'Main-d’œuvre', champ: 'Temps de travail', unite: 'h', aide: 'Fabrication et pose, en heures.', taux: 4500, forfaitCommande: 0, forfaitPiece: 0, marge: 0, description: 'Fabrication et pose.' },
    coefTemps: { actif: true, titre: 'Difficulté', choix: [ch('Simple', 100), ch('Complexe', 130)] },
    pieces: { actif: false, champ: 'Nombre d’ouvrages' },
    options: { actif: true, titre: 'Finitions', description: 'Selon les finitions choisies.', choix: [ch('Vernis', 3000), ch('Peinture', 4500), ch('Quincaillerie haut de gamme', 6000)] },
    delais: { actif: false, titre: 'Délai', description: '', choix: [ch('Normal', 0)] },
    livraison: { actif: true, titre: 'Déplacement', description: 'Selon la distance du chantier.', choix: [ch('Retrait à l’atelier', 0), ch('Moins de 20 km', 3000), ch('Moins de 50 km', 6000)] },
  },
  traiteur: {
    nom: 'Traiteur, par personne',
    titre: 'Estimation traiteur',
    tva: 1000,
    matiere: {
      actif: true,
      titre: 'Repas',
      champ: 'Nombre de personnes',
      unite: 'pers.',
      uniteAchat: 'personne',
      facteur: 1,
      aide: 'Nombre de convives.',
      choixTitre: 'Menu',
      description: 'Prix par personne selon le menu.',
      choix: [ch('Buffet froid', 1800), ch('Menu classique', 2800), ch('Menu prestige', 4200)],
    },
    coefMatiere: { actif: false, titre: 'Ajustement', choix: [ch('Standard', 100)] },
    temps: { actif: true, titre: 'Service', champ: 'Heures de service', unite: 'h', aide: 'Total des heures du personnel sur place.', taux: 3000, forfaitCommande: 0, forfaitPiece: 0, marge: 0, description: 'Personnel de service sur place.' },
    coefTemps: { actif: false, titre: 'Ajustement', choix: [ch('Standard', 100)] },
    pieces: { actif: false, champ: 'Nombre' },
    options: { actif: true, titre: 'Options', description: '', choix: [ch('Vaisselle et nappage', 15000), ch('Gâteau', 9000), ch('Boissons', 12000)] },
    delais: { actif: false, titre: 'Délai', description: '', choix: [ch('Normal', 0)] },
    livraison: { actif: true, titre: 'Livraison', description: 'Selon la distance.', choix: [ch('Retrait sur place', 0), ch('Moins de 20 km', 4000), ch('Moins de 50 km', 8000)] },
  },
  libre: {
    nom: 'Libre (à régler)',
    titre: 'Estimation',
    tva: 2000,
    matiere: { actif: true, titre: 'Fournitures', champ: 'Quantité', unite: 'u', uniteAchat: 'unité', facteur: 1, aide: '', choixTitre: 'Type', description: '', choix: [ch('Standard', 1000)] },
    coefMatiere: { actif: false, titre: 'Ajustement', choix: [ch('Standard', 100)] },
    temps: { actif: true, titre: 'Main-d’œuvre', champ: 'Temps de travail', unite: 'h', aide: '', taux: 4000, forfaitCommande: 0, forfaitPiece: 0, marge: 0, description: '' },
    coefTemps: { actif: false, titre: 'Difficulté', choix: [ch('Standard', 100)] },
    pieces: { actif: false, champ: 'Nombre' },
    options: { actif: true, titre: 'Options', description: '', choix: [ch('Option', 1000)] },
    delais: { actif: false, titre: 'Délai', description: '', choix: [ch('Normal', 0)] },
    livraison: { actif: true, titre: 'Livraison / déplacement', description: '', choix: [ch('Sans', 0), ch('Avec', 2000)] },
  },
};
export const LISTE_MODELES = Object.entries(MODELES).map(([id, m]) => ({ id, nom: m.nom }));

// Copie neuve d'un modèle (nouveaux identifiants de choix)
export function modeleCalc(id, actif = true) {
  const m = MODELES[id] ? id : 'impression3d';
  const copie = JSON.parse(JSON.stringify(MODELES[m]));
  for (const k of ['matiere', 'coefMatiere', 'coefTemps', 'options', 'delais', 'livraison']) copie[k].choix = copie[k].choix.map((c) => ({ ...c, id: nouvelId() }));
  delete copie.nom;
  return nettoyerCalculateur({ ...copie, actif, modele: m });
}

const listeChoix = (l, { coef = false } = {}) =>
  (Array.isArray(l) ? l : [])
    .map((c) => ({ id: typeof c?.id === 'string' && /^[A-Za-z0-9_-]{4,24}$/.test(c.id) ? c.id : nouvelId(), nom: txt(c?.nom), v: coef ? ent(c?.v, 10, 1000, 100) : prix(c?.v) }))
    .filter((c) => c.nom)
    .slice(0, MAX_CHOIX);
// Les libellés vides reprennent ceux du modèle ; les textes d'aide peuvent rester vides
const OBLIGATOIRES = new Set(['titre', 'champ', 'unite', 'uniteAchat', 'choixTitre']);
const bloc = (b, base, champs) => {
  const out = { actif: b?.actif === true };
  for (const [k, max] of champs) {
    const v = b?.[k];
    out[k] = txt(v === undefined || v === null || (OBLIGATOIRES.has(k) && !String(v).trim()) ? base[k] : v, max);
  }
  return out;
};

// Nettoie la configuration (enregistrée par le client ; l'activation reste celle de l'agence)
export function nettoyerCalculateur(c) {
  if (!c || typeof c !== 'object') return null;
  const base = MODELES[c.modele] || MODELES.libre;
  const m = c.matiere || {};
  const t = c.temps || {};
  const out = {
    actif: c.actif === true,
    modele: MODELES[c.modele] ? c.modele : 'libre',
    titre: txt(c.titre ?? base.titre, 80) || 'Estimation',
    tva: TAUX_OK.has(Number(c.tva)) ? Number(c.tva) : 2000,
    matiere: { ...bloc(m, base.matiere, [['titre', 60], ['champ', 60], ['unite', 12], ['uniteAchat', 20], ['aide', 160], ['choixTitre', 60], ['description', 200]]), facteur: ent(m.facteur, 1, 1_000_000, 1), choix: listeChoix(m.choix) },
    coefMatiere: { ...bloc(c.coefMatiere, base.coefMatiere, [['titre', 60]]), choix: listeChoix(c.coefMatiere?.choix, { coef: true }) },
    temps: { ...bloc(t, base.temps, [['titre', 60], ['champ', 60], ['unite', 12], ['aide', 160], ['description', 200]]), taux: prix(t.taux), forfaitCommande: prix(t.forfaitCommande), forfaitPiece: prix(t.forfaitPiece), marge: ent(t.marge, 0, 500, 0) },
    coefTemps: { ...bloc(c.coefTemps, base.coefTemps, [['titre', 60]]), choix: listeChoix(c.coefTemps?.choix, { coef: true }) },
    pieces: bloc(c.pieces, base.pieces, [['champ', 60]]),
    options: { ...bloc(c.options, base.options, [['titre', 60], ['description', 200]]), choix: listeChoix(c.options?.choix) },
    delais: { ...bloc(c.delais, base.delais, [['titre', 60], ['description', 200]]), choix: listeChoix(c.delais?.choix) },
    livraison: { ...bloc(c.livraison, base.livraison, [['titre', 60], ['description', 200]]), choix: listeChoix(c.livraison?.choix) },
  };
  // Une liste vide désactive sa partie (rien à choisir)
  for (const k of ['matiere', 'coefMatiere', 'coefTemps', 'options', 'delais', 'livraison']) if (!out[k].choix.length && k !== 'options') out[k].actif = false;
  if (!out.options.choix.length) out.options.actif = false;
  return out;
}

// Saisie vide (premiers choix sélectionnés ; « Standard » si un coefficient vaut 100 %)
export function saisieVide(c) {
  const cent = (l) => (l.find((x) => x.v === 100) || l[0])?.id || '';
  return {
    qte: '',
    heures: '',
    pieces: '1',
    matiereId: c?.matiere?.choix[0]?.id || '',
    coefMatiereId: cent(c?.coefMatiere?.choix || []),
    coefTempsId: cent(c?.coefTemps?.choix || []),
    options: [],
    delaiId: c?.delais?.choix[0]?.id || '',
    livraisonId: c?.livraison?.choix[0]?.id || '',
  };
}

const nombre = (s) => {
  const n = Number(String(s ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? n : 0;
};
const fmtN = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const trouve = (l, id) => l.find((x) => x.id === id) || l[0];

// Calcule l'estimation : postes (libellé, détail, description, montant) et total HT
export function calculer(c, s) {
  if (!c) return { postes: [], total: 0 };
  const pieces = c.pieces.actif ? Math.max(1, Math.min(10_000, Math.round(nombre(s.pieces)) || 1)) : 1;
  const postes = [];
  if (c.matiere.actif && c.matiere.choix.length) {
    const q = nombre(s.qte);
    const choix = trouve(c.matiere.choix, s.matiereId);
    const coef = c.coefMatiere.actif && c.coefMatiere.choix.length ? trouve(c.coefMatiere.choix, s.coefMatiereId) : null;
    const montant = Math.round(((q * pieces * (coef ? coef.v : 100)) / 100 / c.matiere.facteur) * choix.v);
    const detail = [`${fmtN(q)} ${c.matiere.unite}${pieces > 1 ? ` × ${pieces} pièces` : ''}`, coef ? `${c.coefMatiere.titre.toLowerCase()} : ${coef.nom}` : '', `${euros(choix.v)} / ${c.matiere.uniteAchat}`].filter(Boolean).join(' · ');
    postes.push({ id: 'matiere', libelle: `${c.matiere.titre} (${choix.nom})`, detail, description: c.matiere.description, montant });
  }
  if (c.temps.actif) {
    const h = nombre(s.heures);
    const coef = c.coefTemps.actif && c.coefTemps.choix.length ? trouve(c.coefTemps.choix, s.coefTempsId) : null;
    const base = (h * pieces * (coef ? coef.v : 100) * c.temps.taux) / 100 + c.temps.forfaitCommande + c.temps.forfaitPiece * pieces;
    const montant = Math.round(base * (1 + c.temps.marge / 100));
    const detail = [`${fmtN(h)} ${c.temps.unite}${pieces > 1 ? ` × ${pieces} pièces` : ''}`, coef ? `${c.coefTemps.titre.toLowerCase()} : ${coef.nom}` : ''].filter(Boolean).join(' · ');
    postes.push({ id: 'temps', libelle: c.temps.titre, detail, description: c.temps.description, montant });
  }
  if (c.options.actif) {
    const choisies = c.options.choix.filter((o) => (s.options || []).includes(o.id));
    postes.push({ id: 'options', libelle: c.options.titre, detail: choisies.map((o) => o.nom).join(', ') || 'Aucune', description: c.options.description, montant: choisies.reduce((t, o) => t + o.v, 0) });
  }
  for (const [k, cle] of [
    ['delais', 'delaiId'],
    ['livraison', 'livraisonId'],
  ]) {
    if (!c[k].actif || !c[k].choix.length) continue;
    const choix = trouve(c[k].choix, s[cle]);
    postes.push({ id: k, libelle: c[k].titre, detail: choix.nom, description: c[k].description, montant: choix.v });
  }
  return { postes, total: postes.reduce((t, p) => t + p.montant, 0), pieces };
}

// Lignes du devis (les postes à 0 € sont laissés de côté)
export function versLignes(c, resultat) {
  return resultat.postes
    .filter((p) => p.montant > 0)
    .map((p) => ({
      designation: p.libelle.slice(0, 200),
      description: [p.detail, p.description].filter(Boolean).join('\n').slice(0, 600),
      quantite: 1,
      unite: 'forfait',
      prixHT: p.montant,
      tva: c.tva,
    }));
}
