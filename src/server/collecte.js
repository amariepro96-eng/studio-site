// Collecte en amont : l'agence remplit la bibliothèque d'inspiration à l'avance, métier par métier,
// sans attendre un client. À chaque actualisation, chaque métier choisi est cherché sous un autre
// angle (spécialité, pays, galeries de design…) : de nouveaux sites arrivent à chaque fois. Ils sont
// visités et analysés comme ceux d'un dossier, et rangés dans la même bibliothèque (page Inspiration).
//
// Le travail est découpé en unités (une recherche pour un métier, ou un site à visiter) que plusieurs
// « ouvriers » se partagent. Chaque ouvrier tourne dans sa propre fonction Vercel, travaille moins de
// 5 minutes, puis se relance lui-même. La surveillance (toutes les 5 minutes) reprend une collecte
// restée en plan. Une unité prise par un ouvrier qui a disparu est reprise après 7 minutes.
import crypto from 'node:crypto';
import { getCollecte, updateCollecte, getInspirationIndex, getFicheSite } from './store.js';
import { signer } from './securite.js';
import { VisiteError } from './navigateur.js';
import { InspirationError, inspirationDisponible, rechercherPourCollecte, traiterSite, siteIdDe, ajouterMetier } from './inspiration.js';
import { METIERS_COLLECTE, PAR_METIER_CHOIX, ANGLES_COLLECTE, planCollecte, angleCollecte, domaineDe } from '../engine/inspiration.js';

export const OUVRIERS = 3;
// Sites de réserve par métier, visités seulement pour compenser des sites écartés ou déjà connus
export const reserve = (parMetier) => Math.max(2, Math.ceil(parMetier * 0.4));
const BAIL_UNITE_MS = 7 * 60_000; // une unité « prise » depuis plus longtemps est reprise
const DEBUT_SITE_MAX_MS = 110_000; // après 1 min 50 de travail, plus de nouveau site dans ce passage
const DEBUT_RECHERCHE_MAX_MS = 15_000; // une recherche ne commence qu'en début de passage
const RECHERCHE_MAX_MS = 240_000;
const ESSAIS_MAX = 3;
const PANNES_NAVIGATEUR_MAX = 3;
const REPRISE_MS = 7 * 60_000; // sans nouvelle depuis 7 minutes : la surveillance relance les ouvriers
const DUREE_MAX_MS = 24 * 3600_000;
const FRAICHEUR_JOURS = 365;
const HISTORIQUE_MAX = 12;
const FATALES = ['no_key', 'auth', 'credit', 'model'];

export class CollecteError extends Error {
  constructor(message, code = 'failed', status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const S = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const maintenant = () => new Date().toISOString();
const age = (iso) => Date.now() - (Date.parse(iso || 0) || 0);
const frais = (iso) => iso && age(iso) < FRAICHEUR_JOURS * 86400_000;
const FINIS = ['ajoute', 'deja', 'ecarte', 'inutile'];

// ---------- Règles de partage du travail (pures, testables) ----------
// L'objectif compte les sites NOUVEAUX : un site déjà connu (vu pour un autre métier) reçoit juste ce
// métier en plus, sans compter
function reussisDuMetier(run, metier) {
  return run.candidats.filter((c) => c.metier === metier && c.etat === 'ajoute').length;
}

// Unités prises par un ouvrier qui ne donne plus de nouvelles : remises en jeu (ou abandonnées)
export function reprendreUnitesPerdues(run) {
  for (const t of run.taches) {
    if (t.etat !== 'pris' || age(t.prisLe) < BAIL_UNITE_MS) continue;
    if ((t.essais || 0) >= ESSAIS_MAX) Object.assign(t, { etat: 'erreur', note: 'Recherche interrompue plusieurs fois.', prisLe: null });
    else Object.assign(t, { etat: 'a_faire', prisLe: null });
  }
  for (const c of run.candidats) {
    if (c.etat !== 'pris' || age(c.prisLe) < BAIL_UNITE_MS) continue;
    if ((c.essais || 0) >= ESSAIS_MAX) Object.assign(c, { etat: 'ecarte', raison: 'Visite interrompue plusieurs fois.', prisLe: null });
    else Object.assign(c, { etat: 'a_faire', prisLe: null });
  }
}

// Réserves : visitées seulement pour compenser des sites écartés ; inutiles une fois l'objectif atteint.
// Métier encore en dessous de l'objectif une fois tout visité : une recherche de complément, sous un
// autre angle (une seule fois par métier et par collecte).
export function normaliserReserves(run) {
  for (const t of run.taches) {
    const m = t.metier;
    const principauxEnAttente = run.candidats.some((c) => c.metier === m && !c.reserve && (c.etat === 'a_faire' || c.etat === 'pris'));
    if (principauxEnAttente) continue;
    if (reussisDuMetier(run, m) >= run.parMetier) {
      for (const c of run.candidats) if (c.metier === m && c.reserve && c.etat === 'a_faire') Object.assign(c, { etat: 'inutile' });
      continue;
    }
    const restent = run.candidats.some((c) => c.metier === m && (c.etat === 'pris' || reserveDisponible(run, c)));
    if (t.etat === 'fait' && !t.complement && !restent && !run.angle) {
      const i = ANGLES_COLLECTE.findIndex((a) => a.id === t.angle);
      Object.assign(t, { etat: 'a_faire', complement: true, angle: ANGLES_COLLECTE[(i + 1) % ANGLES_COLLECTE.length].id, essais: 0, prisLe: null });
    }
  }
}

function reserveDisponible(run, c) {
  if (!c.reserve || c.etat !== 'a_faire') return false;
  const m = c.metier;
  if (run.candidats.some((x) => x.metier === m && !x.reserve && (x.etat === 'a_faire' || x.etat === 'pris'))) return false;
  const reservesEnCours = run.candidats.filter((x) => x.metier === m && x.reserve && x.etat === 'pris').length;
  return reussisDuMetier(run, m) + reservesEnCours < run.parMetier;
}

// La prochaine unité : d'abord les sites (la bibliothèque se remplit vite), puis les recherches
export function choisirUnite(run, { rechercheOk = true } = {}) {
  let i = run.candidats.findIndex((c) => !c.reserve && c.etat === 'a_faire');
  if (i < 0) i = run.candidats.findIndex((c) => reserveDisponible(run, c));
  if (i >= 0) return { type: 'site', i };
  const j = run.taches.findIndex((t) => t.etat === 'a_faire');
  if (j >= 0) return rechercheOk ? { type: 'recherche', i: j } : { type: 'plus_tard' };
  return null;
}

export function collecteTerminee(run) {
  return run.taches.every((t) => t.etat === 'fait' || t.etat === 'erreur') && run.candidats.every((c) => FINIS.includes(c.etat) || (c.reserve && c.etat === 'a_faire' && !reserveDisponible(run, c)));
}

export function bilanRun(run) {
  const n = (etat) => run.candidats.filter((c) => c.etat === etat).length;
  return { ajoutes: n('ajoute'), deja: n('deja'), ecartes: n('ecarte') };
}

function cloturer(etat, statut, extra = {}) {
  const run = etat.run;
  // Les réserves jamais visitées ne comptent pas comme « en attente »
  for (const c of run.candidats) if (c.reserve && c.etat === 'a_faire') c.etat = 'inutile';
  Object.assign(run, { statut, finLe: maintenant(), majLe: maintenant(), ...extra });
  for (const w of Object.keys(run.ouvriers || {})) run.ouvriers[w].actif = false;
  etat.historique = [
    { id: run.id, demandeLe: run.demandeLe, finLe: run.finLe, statut, metiers: run.taches.map((t) => t.metier), parMetier: run.parMetier, ...bilanRun(run) },
    ...(etat.historique || []).filter((h) => h.id !== run.id),
  ].slice(0, HISTORIQUE_MAX);
}

// ---------- Lancer, arrêter ----------
export function collecteDisponible() {
  return inspirationDisponible();
}

const enMarche = (run) => run?.statut === 'en_cours';

/**
 * Prépare une nouvelle collecte. Renvoie { run, ouvriers } : les ouvriers à réveiller.
 * metiers : liste d'identifiants ; parMetier : 3, 5 ou 10 ; angle : '' (varier) ou un angle ;
 * specialite : seulement pour un métier unique.
 */
export async function lancerCollecte({ metiers, parMetier, angle = '', specialite = '' } = {}) {
  if (!collecteDisponible().configured) throw new CollecteError(`Collecte indisponible : il manque ${collecteDisponible().missing.join(' et ')}.`, 'off', 503);
  const liste = [...new Set((Array.isArray(metiers) ? metiers : []).filter((m) => METIERS_COLLECTE.includes(m)))];
  if (!liste.length) throw new CollecteError('Choisis au moins un métier.', 'metiers');
  const n = Number(parMetier);
  if (!PAR_METIER_CHOIX.includes(n)) throw new CollecteError('Nombre de sites par métier invalide.', 'par_metier');
  if (angle && !angleCollecte(angle)) throw new CollecteError('Zone de recherche inconnue.', 'angle');
  const spec = liste.length === 1 ? S(String(specialite || '').replace(/[<>{}[\]`"\\]/g, ''), 60) : '';

  // Les métiers les moins fournis d'abord : la bibliothèque s'équilibre
  const idx = await getInspirationIndex();
  const nb = (m) => Object.values(idx.sites).filter((e) => e.metiers?.includes(m) && e.source !== 'actuel').length;
  liste.sort((a, b) => nb(a) - nb(b) || METIERS_COLLECTE.indexOf(a) - METIERS_COLLECTE.indexOf(b));

  let refus = null;
  const etat = await updateCollecte((c) => {
    refus = null;
    if (enMarche(c.run) && age(c.run.majLe) < 15 * 60_000) {
      refus = new CollecteError('Une collecte est déjà en cours : attends qu’elle finisse, ou arrête-la.', 'encours', 409);
      return null;
    }
    if (enMarche(c.run)) cloturer(c, 'arrete', { erreur: 'Collecte restée en plan, remplacée par une nouvelle.' });
    const rangs = { ...(c.rangs || {}) };
    const taches = liste.map((m) => {
      const plan = planCollecte(m, rangs[m] || 0, { angle, specialite: spec });
      rangs[m] = (rangs[m] || 0) + 1;
      return { metier: m, specialite: plan.specialite, angle: plan.angle, etat: 'a_faire', prisLe: null, essais: 0, trouves: 0, note: '' };
    });
    const id = 'c' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
    const nbOuvriers = Math.min(OUVRIERS, taches.length);
    const ouvriers = Object.fromEntries(Array.from({ length: OUVRIERS }, (_, w) => [String(w), { actif: w < nbOuvriers, vuLe: maintenant() }]));
    c.run = { id, statut: 'en_cours', demandeLe: maintenant(), majLe: maintenant(), finLe: null, parMetier: n, angle: angle || '', specialite: spec, taches, candidats: [], recherche: '', erreur: '', alerte: '', pannes: 0, ouvriers };
    c.rangs = rangs;
    return c;
  });
  if (refus) throw refus;
  const run = etat.run;
  return { run, ouvriers: Object.entries(run.ouvriers).filter(([, o]) => o.actif).map(([w]) => Number(w)) };
}

export async function arreterCollecte() {
  let arrete = false;
  await updateCollecte((c) => {
    arrete = false;
    if (!enMarche(c.run)) return null;
    cloturer(c, 'arrete');
    arrete = true;
    return c;
  });
  return arrete;
}

// ---------- Relances ----------
export async function relancerCollecte(origine, w, runId) {
  const exp = Math.floor(Date.now() / 1000) + 600;
  try {
    const r = await fetch(`${origine}/api/agence/inspiration/collecte/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-studio-agent': signer({ t: 'collecte', w, run: runId, exp }) },
      body: JSON.stringify({ w, run: runId }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok && r.status !== 202) console.warn('[collecte] relance refusée', r.status);
    return r.ok;
  } catch (e) {
    console.warn('[collecte] relance impossible', e?.name, String(e?.message || '').slice(0, 120));
    return false;
  }
}

// Ouvriers au repos réveillés (après une recherche qui a trouvé des sites, ou par la surveillance)
async function reveiller(origine, runId, { tous = false } = {}) {
  let aReveiller = [];
  await updateCollecte((c) => {
    aReveiller = [];
    if (!enMarche(c.run) || c.run.id !== runId) return null;
    for (const [w, o] of Object.entries(c.run.ouvriers || {})) {
      if (tous || !o.actif) {
        o.actif = true;
        o.vuLe = maintenant();
        aReveiller.push(Number(w));
      }
    }
    if (tous) c.run.majLe = maintenant();
    return aReveiller.length ? c : null;
  }).catch(() => {});
  for (const w of aReveiller) await relancerCollecte(origine, w, runId);
  return aReveiller.length;
}

// Surveillance : une collecte sans nouvelles depuis 7 minutes est relancée ; au-delà de 24 h, arrêtée
export async function reprendreCollecte(origine) {
  if (!collecteDisponible().configured) return 0;
  const { run } = await getCollecte();
  if (!enMarche(run)) return 0;
  if (age(run.demandeLe) > DUREE_MAX_MS) {
    await updateCollecte((c) => {
      if (!enMarche(c.run) || c.run.id !== run.id) return null;
      cloturer(c, 'erreur', { erreur: 'La collecte s’est arrêtée en route : relance-la.' });
      return c;
    }).catch(() => {});
    return 0;
  }
  if (age(run.majLe) < REPRISE_MS) return 0;
  return reveiller(origine, run.id, { tous: true });
}

// ---------- Le travail d'un ouvrier ----------
function avecDelai(promesse, ms, message) {
  let t;
  promesse.catch(() => {});
  return Promise.race([promesse, new Promise((_, rej) => (t = setTimeout(() => rej(new InspirationError(message, 'lent')), ms)))]).finally(() => clearTimeout(t));
}

async function faireRecherche(run, t) {
  const idx = await getInspirationIndex();
  const connusMetier = Object.values(idx.sites)
    .filter((e) => e.metiers?.includes(t.metier))
    .sort((a, b) => String(b.visiteLe).localeCompare(String(a.visiteLe)))
    .map((e) => e.domaine);
  const dejaLa = new Set([...connusMetier, ...run.candidats.map((c) => domaineDe(c.url))]);
  const { sites, recherche } = await avecDelai(
    rechercherPourCollecte({ metier: t.metier, specialite: t.specialite, angle: t.angle, combien: run.parMetier + reserve(run.parMetier), connus: connusMetier }),
    RECHERCHE_MAX_MS,
    'La recherche a pris trop de temps.'
  );
  const nouveaux = sites.filter((s) => !dejaLa.has(domaineDe(s.url))).slice(0, run.parMetier + reserve(run.parMetier));
  return { nouveaux, recherche };
}

async function faireSite(run, c) {
  // Déjà visité récemment (par un dossier client ou une autre collecte) : on note juste le métier
  const fiche = await getFicheSite(c.siteId);
  if (fiche?.analyse && frais(fiche.visiteLe)) {
    await ajouterMetier(c.siteId, c.metier);
    return 'deja';
  }
  await traiterSite(
    { url: c.url, nom: c.nom, source: 'collecte', pourquoi: c.pourquoi, siteId: c.siteId, specialite: c.specialite },
    { brief: { sector: c.metier, specialite: c.specialite }, metier: c.metier, collecte: run.id }
  );
  return 'ajoute';
}

// Enregistre le résultat d'une unité ; clôt la collecte quand tout est fait
async function enregistrer(runId, w, fn) {
  let fin = false;
  await updateCollecte((c) => {
    fin = false;
    if (!c.run || c.run.id !== runId) return null;
    fn(c.run);
    c.run.majLe = maintenant();
    if (c.run.ouvriers?.[w]) c.run.ouvriers[w].vuLe = maintenant();
    if (enMarche(c.run)) {
      normaliserReserves(c.run);
      if (collecteTerminee(c.run)) {
        cloturer(c, 'fini');
        fin = true;
      }
    }
    return c;
  });
  return fin;
}

async function auRepos(runId, w) {
  await updateCollecte((c) => {
    if (!c.run || c.run.id !== runId || !c.run.ouvriers?.[w]?.actif) return null;
    c.run.ouvriers[w].actif = false;
    return c;
  }).catch(() => {});
}

/**
 * Un passage d'un ouvrier (moins de 5 minutes). Renvoie { continuer } : true pour se relancer.
 */
export async function avancerCollecte({ w, runId, origine }) {
  const debut = Date.now();
  const cle = String(w);
  for (;;) {
    const ecoule = Date.now() - debut;
    if (ecoule > DEBUT_SITE_MAX_MS) return { continuer: true };

    // 1. Prendre une unité (atomique : deux ouvriers ne prennent jamais la même)
    let unite = null;
    let arret = '';
    let fin = false;
    await updateCollecte((c) => {
      unite = null;
      arret = '';
      fin = false;
      const run = c.run;
      if (!run || run.id !== runId) {
        arret = 'autre';
        return null;
      }
      if (!enMarche(run)) {
        arret = run.statut;
        return null;
      }
      reprendreUnitesPerdues(run);
      normaliserReserves(run);
      const u = choisirUnite(run, { rechercheOk: ecoule < DEBUT_RECHERCHE_MAX_MS });
      if (!u) {
        if (collecteTerminee(run)) {
          cloturer(c, 'fini');
          fin = true;
          return c;
        }
        arret = 'rien';
        if (run.ouvriers?.[cle]) run.ouvriers[cle].actif = false;
        return c;
      }
      if (u.type === 'plus_tard') {
        arret = 'plus_tard';
        return null;
      }
      const x = u.type === 'site' ? run.candidats[u.i] : run.taches[u.i];
      Object.assign(x, { etat: 'pris', prisLe: maintenant(), essais: (x.essais || 0) + 1 });
      run.majLe = maintenant();
      run.ouvriers = run.ouvriers || {};
      run.ouvriers[cle] = { actif: true, vuLe: maintenant() };
      unite = { type: u.type, i: u.i, x: structuredClone(x), parMetier: run.parMetier, candidats: structuredClone(run.candidats) };
      return c;
    });
    if (fin || arret === 'rien' || arret === 'autre' || arret === 'arrete' || arret === 'fini' || arret === 'erreur') return { continuer: false };
    if (arret === 'plus_tard') return { continuer: true }; // la recherche partira au début du passage suivant
    if (!unite) return { continuer: false };

    const memeUnite = (liste, x) => liste.find((y) => (unite.type === 'site' ? y.siteId === x.siteId : y.metier === x.metier));

    // 2. Faire le travail
    if (unite.type === 'recherche') {
      const t = unite.x;
      try {
        const { nouveaux, recherche } = await faireRecherche({ parMetier: unite.parMetier, candidats: unite.candidats }, t);
        let reveil = false;
        await enregistrer(runId, cle, (run) => {
          const tache = memeUnite(run.taches, t);
          if (recherche === 'memoire') {
            run.recherche = 'memoire';
            run.note = 'Recherche web désactivée dans la console Claude (platform.claude.com › Settings › Capabilities) : sites proposés de mémoire par l’IA, sans vérification.';
          } else if (!run.recherche) run.recherche = 'web';
          const pris = new Set(run.candidats.map((c) => domaineDe(c.url)));
          let rang = 0;
          for (const s of nouveaux) {
            const d = domaineDe(s.url);
            if (pris.has(d)) continue;
            pris.add(d);
            run.candidats.push({
              siteId: siteIdDe(s.url), url: s.url, nom: s.nom, pays: s.pays || '', pourquoi: s.pourquoi || '', metier: t.metier, specialite: t.specialite,
              reserve: rang >= run.parMetier, etat: 'a_faire', prisLe: null, essais: 0, raison: '',
            });
            rang++;
          }
          // Ce qui a vraiment été ajouté (un site peut avoir été trouvé en même temps pour un autre métier)
          const ailleurs = nouveaux.length - rang;
          if (tache) {
            const notes = [!rang ? 'Aucun nouveau site trouvé cette fois.' : '', ailleurs > 0 ? `${ailleurs} déjà prévu${ailleurs > 1 ? 's' : ''} pour un autre métier.` : ''].filter(Boolean);
            Object.assign(tache, { etat: 'fait', prisLe: null, trouves: (tache.trouves || 0) + rang, note: notes.join(' ') });
          }
          reveil = rang > 0 && Object.values(run.ouvriers || {}).some((o) => !o.actif);
          run.alerte = '';
        });
        if (reveil && origine) await reveiller(origine, runId);
      } catch (e) {
        const stop = await echec(runId, cle, e, {
          marquer: (run, raison) => {
            const tache = memeUnite(run.taches, t);
            if (!tache) return;
            if ((tache.essais || 0) >= 2) Object.assign(tache, { etat: 'erreur', prisLe: null, note: S(raison, 160) });
            else Object.assign(tache, { etat: 'a_faire', prisLe: null });
          },
          relacher: (run) => {
            const tache = memeUnite(run.taches, t);
            if (tache?.etat === 'pris') Object.assign(tache, { etat: 'a_faire', prisLe: null, essais: Math.max(0, (tache.essais || 1) - 1) });
          },
        });
        if (stop) return { continuer: false };
      }
      continue;
    }

    const c = unite.x;
    try {
      const resultat = await faireSite({ id: runId }, c);
      await enregistrer(runId, cle, (run) => {
        const x = memeUnite(run.candidats, c);
        if (x) Object.assign(x, { etat: resultat, prisLe: null, raison: '' });
        run.alerte = '';
      });
    } catch (e) {
      const stop = await echec(runId, cle, e, {
        marquer: (run, raison) => {
          const x = memeUnite(run.candidats, c);
          if (x) Object.assign(x, { etat: 'ecarte', prisLe: null, raison: S(raison, 160) });
        },
        relacher: (run) => {
          const x = memeUnite(run.candidats, c);
          if (x?.etat === 'pris') Object.assign(x, { etat: 'a_faire', prisLe: null, essais: Math.max(0, (x.essais || 1) - 1) });
        },
      });
      if (stop) return { continuer: false };
    }
  }
}

// Échec d'une unité. Renvoie true si l'ouvrier doit s'arrêter (problème général : clé, crédit, surcharge…).
// marquer(run, raison) : l'unité est abandonnée ; relacher(run) : elle est remise en jeu pour plus tard.
async function echec(runId, w, e, { marquer, relacher }) {
  const code = e?.code || '';
  if (!(e instanceof InspirationError) && !(e instanceof VisiteError)) console.warn('[collecte]', e?.name, String(e?.message || '').slice(0, 200));
  if (e instanceof InspirationError && FATALES.includes(code)) {
    await updateCollecte((c) => {
      if (!c.run || c.run.id !== runId || !enMarche(c.run)) return null;
      cloturer(c, 'erreur', { erreur: S(e.message, 300) });
      return c;
    }).catch(() => {});
    return true;
  }
  if (e instanceof InspirationError && (code === 'overloaded' || code === 'navigateur')) {
    // Problème passager : l'unité est remise en jeu, cet ouvrier se met au repos et la surveillance
    // relance la collecte dans quelques minutes (ou un autre ouvrier le réveille avant)
    await updateCollecte((c) => {
      const run = c.run;
      if (!run || run.id !== runId || !enMarche(run)) return null;
      relacher(run);
      if (code === 'navigateur') run.pannes = (run.pannes || 0) + 1;
      if (run.pannes >= PANNES_NAVIGATEUR_MAX) {
        // Le message garde le « Détail » de l'erreur (utile pour demander de l'aide, document 22, §F)
        cloturer(c, 'erreur', { erreur: S(`Plusieurs fois de suite : ${e.message}`, 400) });
        return c;
      }
      run.alerte = code === 'overloaded' ? 'Claude était surchargé : la collecte reprend toute seule dans quelques minutes.' : 'Le navigateur de l’agent n’a pas démarré : la collecte reprend toute seule dans quelques minutes.';
      if (run.ouvriers?.[w]) run.ouvriers[w].actif = false;
      return c;
    }).catch(() => {});
    return true;
  }
  const raison = e instanceof VisiteError || e instanceof InspirationError ? e.message : 'Le site n’a pas pu être analysé.';
  await enregistrer(runId, w, (run) => marquer(run, raison)).catch(() => {});
  return false;
}

// ---------- Ce que la page Inspiration affiche ----------
export function vueCollecte(etat, index) {
  const run = etat?.run || null;
  const sites = Object.values(index?.sites || {}).filter((e) => e.source !== 'actuel');
  const couverture = Object.fromEntries(METIERS_COLLECTE.map((m) => [m, sites.filter((e) => e.metiers?.includes(m)).length]));
  let vue = null;
  if (run) {
    const b = bilanRun(run);
    const enAttente = run.candidats.filter((c) => !c.reserve && (c.etat === 'a_faire' || c.etat === 'pris')).length;
    vue = {
      id: run.id,
      statut: run.statut,
      enCours: enMarche(run),
      demandeLe: run.demandeLe,
      finLe: run.finLe,
      majLe: run.majLe,
      parMetier: run.parMetier,
      angle: run.angle,
      specialite: run.specialite,
      objectif: run.taches.length * run.parMetier,
      recherches: { faites: run.taches.filter((t) => t.etat === 'fait' || t.etat === 'erreur').length, total: run.taches.length },
      ...b,
      enAttente,
      enVisite: run.candidats.filter((c) => c.etat === 'pris').length,
      metiers: run.taches.map((t) => ({
        metier: t.metier,
        specialite: t.specialite,
        angle: t.angle,
        etat: t.etat,
        note: t.note || '',
        trouves: t.trouves || 0,
        ajoutes: run.candidats.filter((c) => c.metier === t.metier && c.etat === 'ajoute').length,
        deja: run.candidats.filter((c) => c.metier === t.metier && c.etat === 'deja').length,
        ecartes: run.candidats.filter((c) => c.metier === t.metier && c.etat === 'ecarte').length,
      })),
      listeEcartes: run.candidats.filter((c) => c.etat === 'ecarte').slice(-20).map((c) => ({ nom: c.nom, url: c.url, metier: c.metier, raison: c.raison })),
      recherche: run.recherche || '',
      note: run.alerte || run.note || '',
      erreur: run.erreur || '',
    };
  }
  return { run: vue, historique: (etat?.historique || []).slice(0, HISTORIQUE_MAX), couverture, total: sites.length, ouvriers: OUVRIERS };
}
