// Suivi financier : abonnements, factures et charges (code partagé navigateur / serveur).
// Tous les montants sont en centimes (entiers) pour éviter les erreurs d'arrondi.
//
// Dans un dossier client :
//   facturation = {
//     abonnement: { montant, debut: 'AAAA-MM', fin: 'AAAA-MM' | '', payes: [{ mois: 'AAAA-MM', le: 'AAAA-MM-JJ' }] },
//     factures:   [{ id, libelle, montant, echeance: 'AAAA-MM-JJ', payeeLe: 'AAAA-MM-JJ' | '' }],
//   }
// Dans les réglages : charges = [{ id, libelle, montant }] (montant par mois)

const MOIS_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const JOUR_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const moisValide = (m) => MOIS_RE.test(String(m || ''));
export const jourValide = (j) => JOUR_RE.test(String(j || '')) && !Number.isNaN(new Date(j + 'T12:00:00Z').getTime());

const MAX_CENTIMES = 100_000_000; // 1 000 000 €
const centimes = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_CENTIMES, n)) : 0;
};

// Date du jour à Paris (le serveur Vercel tourne à l'heure UTC)
export function aujourdhuiParis(maintenant = new Date()) {
  const p = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(maintenant);
  const v = (t) => p.find((x) => x.type === t)?.value;
  return `${v('year')}-${v('month')}-${v('day')}`;
}
export const moisDe = (jour) => String(jour).slice(0, 7);

export function moisSuivant(m) {
  let [a, n] = m.split('-').map(Number);
  n += 1;
  if (n > 12) {
    n = 1;
    a += 1;
  }
  return `${a}-${String(n).padStart(2, '0')}`;
}
export function moisPrecedent(m) {
  let [a, n] = m.split('-').map(Number);
  n -= 1;
  if (n < 1) {
    n = 12;
    a -= 1;
  }
  return `${a}-${String(n).padStart(2, '0')}`;
}

// Mois de `debut` à `fin` inclus (au plus 240)
export function moisEntre(debut, fin) {
  const out = [];
  if (!moisValide(debut) || !moisValide(fin) || debut > fin) return out;
  for (let m = debut; m <= fin && out.length < 240; m = moisSuivant(m)) out.push(m);
  return out;
}

const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const nomMois = (m, court = false) => {
  if (!moisValide(m)) return '';
  const [a, n] = m.split('-').map(Number);
  return `${(court ? COURTS : NOMS_MOIS)[n - 1]} ${a}`;
};
export const dateCourte = (j) => {
  if (!jourValide(j)) return '';
  const [a, n, d] = j.split('-').map(Number);
  return `${d} ${COURTS[n - 1]} ${a}`;
};

// 1234 → « 12,34 € » ; 1200 → « 12 € »
export function euros(c, { signe = false } = {}) {
  const v = (Number(c) || 0) / 100;
  const s = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(Math.abs(v));
  return (v < 0 ? '−' : signe && v > 0 ? '+' : '') + s;
}

// Saisie « 39 », « 39,90 », « 1 290 € » → centimes (null si illisible)
export function lireEuros(texte) {
  const t = String(texte ?? '')
    .replace(/[\s  €]/g, '')
    .replace(',', '.');
  if (!t) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return centimes(Math.round(parseFloat(t) * 100));
}
export const versSaisie = (c) => (c ? (c / 100).toFixed(2).replace(/\.00$/, '').replace('.', ',') : '');

const texte = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const idValide = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{4,24}$/.test(v);
export const nouvelId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------- Nettoyage de ce qui arrive du navigateur ----------
export function nettoyerFacturation(raw) {
  const a = raw?.abonnement || {};
  const payes = [];
  const vus = new Set();
  for (const p of Array.isArray(a.payes) ? a.payes : []) {
    if (!moisValide(p?.mois) || vus.has(p.mois)) continue;
    vus.add(p.mois);
    payes.push({ mois: p.mois, le: jourValide(p.le) ? p.le : `${p.mois}-01` });
    if (payes.length >= 240) break;
  }
  payes.sort((x, y) => x.mois.localeCompare(y.mois));
  const debut = moisValide(a.debut) ? a.debut : '';
  const fin = moisValide(a.fin) && (!debut || a.fin >= debut) ? a.fin : '';
  const factures = [];
  const ids = new Set();
  for (const f of Array.isArray(raw?.factures) ? raw.factures : []) {
    if (!f || typeof f !== 'object') continue;
    const id = idValide(f.id) && !ids.has(f.id) ? f.id : nouvelId();
    ids.add(id);
    factures.push({
      id,
      libelle: texte(f.libelle, 120) || 'Facture',
      montant: centimes(f.montant),
      echeance: jourValide(f.echeance) ? f.echeance : '',
      payeeLe: jourValide(f.payeeLe) ? f.payeeLe : '',
    });
    if (factures.length >= 200) break;
  }
  return { abonnement: { montant: centimes(a.montant), debut, fin, payes }, factures, note: texte(raw?.note, 1000) };
}

export function nettoyerCharges(raw) {
  const out = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    const libelle = texte(c?.libelle, 80);
    if (!libelle) continue;
    out.push({ id: idValide(c.id) ? c.id : nouvelId(), libelle, montant: centimes(c.montant) });
    if (out.length >= 30) break;
  }
  return out;
}

export const facturationVide = () => ({ abonnement: { montant: 0, debut: '', fin: '', payes: [] }, factures: [], note: '' });

// ---------- Calculs pour un client ----------
// Abonnement actif ce mois-ci ?
export function abonnementActif(ab, mois) {
  return Boolean(ab?.montant > 0 && moisValide(ab.debut) && ab.debut <= mois && (!ab.fin || ab.fin >= mois));
}

export function etatClient(fact, jour) {
  const f = fact || facturationVide();
  const ab = f.abonnement || {};
  const mois = moisDe(jour);
  const lignesRetard = [];
  const lignesAttente = [];
  const encaisse = [];
  // Abonnement : chaque mois depuis le début est dû ; le mois en cours est « à encaisser »
  if (ab.montant > 0 && moisValide(ab.debut)) {
    const dernier = ab.fin && ab.fin < mois ? ab.fin : mois;
    const payes = new Map((ab.payes || []).map((p) => [p.mois, p.le]));
    for (const m of moisEntre(ab.debut, dernier)) {
      if (payes.has(m)) continue;
      const ligne = { type: 'abonnement', mois: m, libelle: `Abonnement ${nomMois(m)}`, montant: ab.montant };
      if (m < mois) lignesRetard.push(ligne);
      else lignesAttente.push(ligne);
    }
    for (const p of ab.payes || []) encaisse.push({ date: p.le, montant: ab.montant, libelle: `Abonnement ${nomMois(p.mois)}` });
  }
  for (const fa of f.factures || []) {
    if (fa.payeeLe) {
      encaisse.push({ date: fa.payeeLe, montant: fa.montant, libelle: fa.libelle });
      continue;
    }
    const ligne = { type: 'facture', id: fa.id, libelle: fa.libelle, montant: fa.montant, echeance: fa.echeance };
    if (fa.echeance && fa.echeance < jour) lignesRetard.push(ligne);
    else lignesAttente.push(ligne);
  }
  const somme = (l) => l.reduce((s, x) => s + (x.montant || 0), 0);
  return {
    mensuel: abonnementActif(ab, mois) ? ab.montant : 0,
    retard: { total: somme(lignesRetard), lignes: lignesRetard },
    attente: { total: somme(lignesAttente), lignes: lignesAttente },
    encaisse,
  };
}

// ---------- Synthèse de l'agence ----------
// clients : [{ id, nom, formule, facturation }]
export function resumeFinances(clients, charges, jour) {
  const mois = moisDe(jour);
  const annee = jour.slice(0, 4);
  const derniers = [];
  for (let m = mois, i = 0; i < 12; i++, m = moisPrecedent(m)) derniers.unshift(m);
  const parMois = new Map(derniers.map((m) => [m, 0]));
  let mrr = 0;
  let encaisseMois = 0;
  let encaisseAnnee = 0;
  const retard = [];
  const attente = [];
  const lignesClients = [];
  for (const c of clients) {
    const e = etatClient(c.facturation, jour);
    mrr += e.mensuel;
    for (const x of e.encaisse) {
      const m = moisDe(x.date);
      if (parMois.has(m)) parMois.set(m, parMois.get(m) + x.montant);
      if (m === mois) encaisseMois += x.montant;
      if (x.date.slice(0, 4) === annee) encaisseAnnee += x.montant;
    }
    for (const l of e.retard.lignes) retard.push({ ...l, clientId: c.id, nom: c.nom });
    for (const l of e.attente.lignes) attente.push({ ...l, clientId: c.id, nom: c.nom });
    const ab = c.facturation?.abonnement || {};
    if (c.facturation && (ab.montant > 0 || (c.facturation.factures || []).length))
      lignesClients.push({ id: c.id, nom: c.nom, formule: c.formule || '', mensuel: e.mensuel, abonnement: ab.montant || 0, depuis: ab.debut || '', fin: ab.fin || '', retard: e.retard.total, attente: e.attente.total });
  }
  const chargesMensuelles = (charges || []).reduce((s, x) => s + (x.montant || 0), 0);
  const tri = (a, b) => String(a.mois || a.echeance || '').localeCompare(String(b.mois || b.echeance || ''));
  lignesClients.sort((a, b) => b.retard - a.retard || b.mensuel - a.mensuel || a.nom.localeCompare(b.nom));
  return {
    jour,
    mois,
    mrr,
    chargesMensuelles,
    marge: mrr - chargesMensuelles,
    encaisseMois,
    encaisseAnnee,
    retard: { total: retard.reduce((s, x) => s + x.montant, 0), lignes: retard.sort(tri), clients: new Set(retard.map((x) => x.clientId)).size },
    attente: { total: attente.reduce((s, x) => s + x.montant, 0), lignes: attente.sort(tri) },
    parMois: derniers.map((m) => ({ mois: m, montant: parMois.get(m) })),
    clients: lignesClients,
    abonnes: lignesClients.filter((c) => c.mensuel > 0).length,
  };
}
