// Appli Devis & Factures : devis, factures, produits, page du client final et e-mails.
//
// Un devis envoyé est « photographié » (envoi) : le client final voit et accepte exactement cette
// version, même si l'entreprise le retouche ensuite (elle le renvoie alors : nouvelle version,
// nouveau lien). Le lien du client final contient 32 octets aléatoires après le « # » : seule son
// empreinte est enregistrée. Un devis accepté devient une facture « à émettre » ; le numéro de
// facture (F-AAAA-0001, sans trou) n'est attribué qu'à l'émission, et une facture émise ne se
// supprime plus.
import crypto from 'node:crypto';
import * as D from '../engine/devis.js';
import { nettoyerCalculateur, modeleCalc, MODELES } from '../engine/calculateur.js';
import { StoreError } from './store.js';
import { empreinte, noterJournal } from './devisAcces.js';
import { mailPret, envoyerMail } from './mail.js';
import { safeEqual } from './http.js';

const maintenant = () => new Date().toISOString();
const erreur = (msg, code = 'bad_request', status = 400) => new StoreError(msg, code, status);
const CLOS = ['accepte', 'refuse', 'annule'];
const histo = (doc, txt) => {
  doc.historique = [...(doc.historique || []), { at: maintenant(), txt: String(txt).slice(0, 200) }].slice(-40);
};

export function normaliser(esp) {
  esp.entreprise = D.nettoyerEntreprise(esp.entreprise);
  esp.produits = Array.isArray(esp.produits) ? esp.produits : [];
  esp.devis = Array.isArray(esp.devis) ? esp.devis : [];
  esp.factures = Array.isArray(esp.factures) ? esp.factures : [];
  esp.compteurs = { devis: { ...(esp.compteurs?.devis || {}) }, factures: { ...(esp.compteurs?.factures || {}) } };
  return esp;
}

// ---------- Ce que reçoit l'appli ----------
const sansLien = ({ lien, ...x }) => ({ ...x, aLien: Boolean(lien) });
export function vueApp(esp, appareil) {
  const c = esp.compte || {};
  return {
    entreprise: esp.entreprise,
    produits: esp.produits,
    devis: esp.devis.map(sansLien),
    factures: esp.factures.map(sansLien),
    compte: {
      email: c.email,
      creeLe: c.creeLe,
      telephoneLe: c.totp?.activeLe || null,
      secoursRestants: (c.secours || []).filter((x) => !x.utiliseLe).length,
      appareils: (esp.appareils || []).map((a) => ({ ...a, actuel: a.id === appareil?.id })).reverse(),
      journal: (esp.journal || []).slice(-30).reverse(),
    },
    calculateur: esp.calculateur || null,
    manques: D.manquesEntreprise(esp.entreprise),
    mail: mailPret(),
    jour: D.aujourdhuiParis(),
  };
}

// ---------- Réglages ----------
export function enregistrerEntreprise(esp, entreprise) {
  esp.entreprise = D.nettoyerEntreprise(entreprise);
}
export function enregistrerProduits(esp, produits) {
  esp.produits = D.nettoyerProduits(produits);
}

// ---------- Calculateur d'estimation (option activée par l'agence, tarifs réglés par le client) ----------
export function enregistrerCalculateur(esp, c) {
  if (!esp.calculateur?.actif) throw erreur('Le calculateur n’est pas activé : demandez-le à votre prestataire.', 'calc_off', 403);
  esp.calculateur = nettoyerCalculateur({ ...c, actif: true, modele: esp.calculateur.modele });
}
export function appliquerModeleCalc(esp, id) {
  if (!esp.calculateur?.actif) throw erreur('Le calculateur n’est pas activé : demandez-le à votre prestataire.', 'calc_off', 403);
  if (!MODELES[id]) throw erreur('Modèle inconnu.');
  esp.calculateur = modeleCalc(id, true);
}
// Côté agence : activer (avec un modèle de départ, la première fois) ou désactiver
export function activerCalculateur(esp, { actif, modele }) {
  if (actif) esp.calculateur = esp.calculateur ? { ...esp.calculateur, actif: true } : modeleCalc(modele, true);
  else if (esp.calculateur) esp.calculateur = { ...esp.calculateur, actif: false };
}

// ---------- Devis ----------
const trouver = (list, id, quoi) => {
  const x = list.find((d) => d.id === id);
  if (!x) throw erreur(`${quoi} introuvable.`, 'not_found', 404);
  return x;
};
function limiteDocuments(esp) {
  if (esp.devis.length + esp.factures.length >= D.LIMITES.documents) throw erreur('Nombre maximal de documents atteint : demandez à votre prestataire d’archiver les plus anciens.', 'limite', 409);
}
function prochainNumero(esp, type, jour) {
  const a = jour.slice(0, 4);
  const cle = type === 'facture' ? 'factures' : 'devis';
  const n = (Number(esp.compteurs[cle][a]) || 0) + 1;
  esp.compteurs[cle][a] = n;
  return D.numero(type, a, n);
}

export function enregistrerDevis(esp, saisieBrute) {
  const saisie = D.nettoyerSaisieDevis(saisieBrute, esp.entreprise);
  if (saisieBrute?.id) {
    const d = trouver(esp.devis, saisieBrute.id, 'Devis');
    if (CLOS.includes(d.statut)) throw erreur('Ce devis est clos : dupliquez-le pour en faire un nouveau.', 'clos', 409);
    Object.assign(d, saisie, { modifieLe: maintenant() });
    if (d.envoi) d.aRenvoyer = true;
    return d;
  }
  limiteDocuments(esp);
  const jour = D.aujourdhuiParis();
  const d = { id: D.nouvelId(), numero: prochainNumero(esp, 'devis', jour), statut: 'brouillon', creeLe: maintenant(), modifieLe: maintenant(), version: 0, ...saisie, historique: [] };
  histo(d, 'Devis créé');
  esp.devis.push(d);
  return d;
}

// Prépare l'envoi : nouvelle version figée et nouveau lien pour le client final
// Au plus 60 e-mails de devis et factures par jour et par entreprise (limite les abus d'un compte volé)
export const ENVOIS_PAR_JOUR = 60;
function compterEnvoi(esp) {
  const jour = D.aujourdhuiParis();
  if (esp.envois?.jour !== jour) esp.envois = { jour, n: 0 };
  if (esp.envois.n >= ENVOIS_PAR_JOUR) throw erreur(`Limite de ${ENVOIS_PAR_JOUR} e-mails par jour atteinte : utilisez « Créer un lien à envoyer moi-même ».`, 'quota', 429);
  esp.envois.n += 1;
}

export function preparerEnvoiDevis(esp, id, { email = '', mode = 'email' } = {}) {
  const d = trouver(esp.devis, id, 'Devis');
  if (CLOS.includes(d.statut)) throw erreur('Ce devis est clos : dupliquez-le pour en faire un nouveau.', 'clos', 409);
  const mq = D.manquesDevis(d);
  if (mq.length) throw erreur(`Avant l’envoi, ajoutez ${mq.join(', ')}.`, 'incomplet');
  const me = D.manquesEntreprise(esp.entreprise);
  if (me.length) throw erreur(`Complétez d’abord Réglages › Entreprise : ${me.join(', ')}. Ces mentions sont obligatoires sur un devis.`, 'entreprise', 409);
  if (mode === 'email') {
    const dest = String(email || d.client.email || '').trim();
    if (!D.emailOk(dest)) throw erreur('Indiquez l’adresse e-mail du client.', 'email');
    compterEnvoi(esp);
    d.client = { ...d.client, email: dest };
  }
  const jour = D.aujourdhuiParis();
  const jeton = crypto.randomBytes(32).toString('base64url');
  d.version = (d.version || 0) + 1;
  d.envoi = { version: d.version, at: maintenant(), date: jour, validite: D.ajouterJours(jour, d.validiteJours), client: { ...d.client }, objet: d.objet, lignes: d.lignes.map((l) => ({ ...l })), acomptePct: d.acomptePct, notes: d.notes, vendeur: { ...esp.entreprise } };
  d.lien = { h: empreinte(jeton), creeLe: maintenant() };
  d.statut = 'envoye';
  d.reponse = null;
  d.vuLe = null;
  d.aRenvoyer = false;
  d.envoyeLe = maintenant();
  histo(d, mode === 'email' ? `Version ${d.version} envoyée par e-mail à ${d.client.email}` : `Version ${d.version} : lien créé (envoyé par vos soins)`);
  return { d, jeton };
}

export const lienPublic = (origin, w, type, jeton) => `${origin}/d/${w}#${type}.${jeton}`;

export function annulerDevis(esp, id) {
  const d = trouver(esp.devis, id, 'Devis');
  if (CLOS.includes(d.statut)) throw erreur('Ce devis est déjà clos.', 'clos', 409);
  d.statut = 'annule';
  histo(d, 'Devis annulé par l’entreprise');
  return d;
}

export function supprimerDevis(esp, id) {
  const d = trouver(esp.devis, id, 'Devis');
  if (d.statut !== 'brouillon' || d.envoi) throw erreur('Seul un brouillon jamais envoyé peut être supprimé. Sinon, annulez-le.', 'interdit', 409);
  esp.devis = esp.devis.filter((x) => x.id !== id);
}

export function dupliquerDevis(esp, id) {
  const src = trouver(esp.devis, id, 'Devis');
  const d = enregistrerDevis(esp, { client: src.client, objet: src.objet, lignes: src.lignes.map(({ id: _, ...l }) => l), validiteJours: src.validiteJours, acomptePct: src.acomptePct, notes: src.notes });
  histo(d, `Copie du devis ${src.numero}`);
  return d;
}

// Accord donné hors ligne (devis signé sur papier, accord par téléphone)
export function accepterHorsLigne(esp, id, { nom = '' } = {}) {
  const d = trouver(esp.devis, id, 'Devis');
  if (CLOS.includes(d.statut)) throw erreur('Ce devis est déjà clos.', 'clos', 409);
  if (!d.envoi) {
    const mq = D.manquesDevis(d);
    if (mq.length) throw erreur(`Avant de le marquer accepté, ajoutez ${mq.join(', ')}.`, 'incomplet');
    const jour = D.aujourdhuiParis();
    d.version = (d.version || 0) + 1;
    d.envoi = { version: d.version, at: maintenant(), date: jour, validite: D.ajouterJours(jour, d.validiteJours), client: { ...d.client }, objet: d.objet, lignes: d.lignes.map((l) => ({ ...l })), acomptePct: d.acomptePct, notes: d.notes, vendeur: { ...esp.entreprise } };
  }
  d.statut = 'accepte';
  d.reponse = { type: 'accepte', nom: D.texte(nom, 120) || d.envoi.client.nom, at: maintenant(), horsLigne: true };
  histo(d, `Marqué accepté par l’entreprise (accord hors ligne, version ${d.envoi.version})`);
  return factureDepuisDevis(esp, d, 'accord hors ligne');
}

function factureDepuisDevis(esp, d, origine) {
  if (d.factureId && esp.factures.some((f) => f.id === d.factureId)) return esp.factures.find((f) => f.id === d.factureId);
  const s = d.envoi;
  const f = { id: D.nouvelId(), numero: null, devisId: d.id, devisNumero: d.numero, client: { ...s.client }, objet: s.objet, lignes: s.lignes.map((l) => ({ ...l })), acomptePct: s.acomptePct, statut: 'a_emettre', creeLe: maintenant(), historique: [] };
  histo(f, `Créée depuis le devis ${d.numero} (${origine})`);
  esp.factures.push(f);
  d.factureId = f.id;
  return f;
}

// ---------- Factures ----------
export function emettreFacture(esp, id, { acompteVerse = 0, datePrestation = '' } = {}) {
  const f = trouver(esp.factures, id, 'Facture');
  if (f.statut !== 'a_emettre') throw erreur('Cette facture est déjà émise.', 'deja', 409);
  const me = D.manquesEntreprise(esp.entreprise);
  if (me.length) throw erreur(`Complétez d’abord Réglages › Entreprise : ${me.join(', ')}. Ces mentions sont obligatoires sur une facture.`, 'entreprise', 409);
  const jour = D.aujourdhuiParis();
  const vendeur = { ...esp.entreprise };
  const t = D.totaux(f.lignes, { franchise: vendeur.franchise });
  if (t.ttc <= 0) throw erreur('Le montant de la facture doit être positif.', 'montant');
  f.numero = prochainNumero(esp, 'facture', jour);
  f.emiseLe = jour;
  // Date de la vente ou de la prestation (mention obligatoire quand elle diffère de la date de la facture)
  f.datePrestation = D.jourValide(datePrestation) && datePrestation <= jour && datePrestation >= D.ajouterJours(jour, -730) ? datePrestation : jour;
  f.echeance = D.ajouterJours(jour, vendeur.delaiPaiementJours);
  f.vendeur = vendeur;
  f.acompteVerse = Math.max(0, Math.min(t.ttc, Math.round(Number(acompteVerse) || 0)));
  f.statut = 'emise';
  histo(f, `Facture ${f.numero} émise`);
  return f;
}

export function supprimerFacture(esp, id) {
  const f = trouver(esp.factures, id, 'Facture');
  if (f.statut !== 'a_emettre') throw erreur('Une facture émise ne peut pas être supprimée (numérotation continue obligatoire). Pour l’annuler, il faut un avoir : voyez avec votre expert-comptable.', 'interdit', 409);
  esp.factures = esp.factures.filter((x) => x.id !== id);
  const d = esp.devis.find((x) => x.factureId === id);
  if (d) {
    d.factureId = null;
    histo(d, 'Facture à émettre supprimée');
  }
}

export function preparerEnvoiFacture(esp, id, { email = '', mode = 'email' } = {}) {
  const f = trouver(esp.factures, id, 'Facture');
  if (!['emise', 'payee'].includes(f.statut)) throw erreur('Émettez d’abord la facture.', 'a_emettre', 409);
  if (mode === 'email') {
    const dest = String(email || f.client.email || '').trim();
    if (!D.emailOk(dest)) throw erreur('Indiquez l’adresse e-mail du client.', 'email');
    compterEnvoi(esp);
    f.client = { ...f.client, email: dest };
  }
  const jeton = crypto.randomBytes(32).toString('base64url');
  f.lien = { h: empreinte(jeton), creeLe: maintenant() };
  f.envoyeLe = maintenant();
  histo(f, mode === 'email' ? `Envoyée par e-mail à ${f.client.email}` : 'Lien créé (envoyé par vos soins)');
  return { f, jeton };
}

export function marquerPayee(esp, id, { le = '' } = {}) {
  const f = trouver(esp.factures, id, 'Facture');
  if (f.statut === 'a_emettre') throw erreur('Émettez d’abord la facture.', 'a_emettre', 409);
  const jour = D.aujourdhuiParis();
  f.statut = 'payee';
  f.payeeLe = D.jourValide(le) && le <= jour && le >= f.emiseLe ? le : jour;
  histo(f, `Payée le ${D.dateLongue(f.payeeLe)}`);
  return f;
}
export function marquerNonPayee(esp, id) {
  const f = trouver(esp.factures, id, 'Facture');
  if (f.statut !== 'payee') throw erreur('Cette facture n’est pas marquée payée.', 'etat', 409);
  f.statut = 'emise';
  f.payeeLe = null;
  histo(f, 'Paiement annulé (remise en « à encaisser »)');
  return f;
}

// ---------- Page du client final ----------
const jetonForme = (j) => typeof j === 'string' && j.length >= 40 && j.length <= 64 && /^[A-Za-z0-9_-]+$/.test(j);
export function trouverParLien(esp, type, jeton) {
  if (!jetonForme(jeton) || !['d', 'f'].includes(type)) return null;
  const h = empreinte(jeton);
  const list = type === 'd' ? esp.devis : esp.factures;
  return list.find((x) => x.lien?.h && safeEqual(x.lien.h, h)) || null;
}

const vendeurPublic = (v, { facture }) => {
  const { iban, bic, validiteJours, delaiPaiementJours, acomptePct, ...reste } = v || {};
  return facture ? { ...reste, iban, bic } : reste;
};

export function vuePublique(doc, type) {
  if (type === 'd') {
    const s = doc.envoi;
    return {
      type: 'devis',
      numero: doc.numero,
      version: s.version,
      date: s.date,
      validite: s.validite,
      vendeur: vendeurPublic(s.vendeur, { facture: false }),
      client: s.client,
      objet: s.objet,
      lignes: s.lignes,
      notes: s.notes,
      totaux: D.totaux(s.lignes, { franchise: s.vendeur?.franchise, acomptePct: s.acomptePct }),
      statut: D.statutDevis(doc),
      reponse: doc.reponse ? { type: doc.reponse.type, nom: doc.reponse.nom || '', at: doc.reponse.at, message: doc.reponse.message || '' } : null,
      mentions: D.mentionsDocument(s.vendeur, { facture: false }),
    };
  }
  const t = D.totaux(doc.lignes, { franchise: doc.vendeur?.franchise });
  return {
    type: 'facture',
    numero: doc.numero,
    date: doc.emiseLe,
    datePrestation: doc.datePrestation || null,
    echeance: doc.echeance,
    devisNumero: doc.devisNumero,
    vendeur: vendeurPublic(doc.vendeur, { facture: true }),
    client: doc.client,
    objet: doc.objet,
    lignes: doc.lignes,
    totaux: t,
    acompteVerse: doc.acompteVerse || 0,
    reste: Math.max(0, t.ttc - (doc.acompteVerse || 0)),
    statut: D.statutFacture(doc),
    payeeLe: doc.payeeLe || null,
    mentions: D.mentionsDocument(doc.vendeur, { facture: true, clientPro: doc.client?.pro }),
  };
}

// Réponse du client final (dans une mise à jour de l'espace). Renvoie { d, quoi, facture }.
export function repondre(esp, d, { action, nom = '', message = '' }) {
  const statut = D.statutDevis(d);
  if (!D.EN_ATTENTE_CLIENT.includes(d.statut)) return { d, quoi: 'deja' };
  const msg = D.texte(message, 1500, { lignes: true });
  const at = maintenant();
  if (action === 'accepter') {
    if (statut === 'expire') throw erreur('Ce devis a dépassé sa date de validité : vous pouvez demander une modification pour en recevoir un nouveau.', 'expire', 409);
    const n = D.texte(nom, 120);
    if (n.length < 2) throw erreur('Indiquez votre nom pour donner votre accord.', 'nom');
    d.statut = 'accepte';
    d.reponse = { type: 'accepte', nom: n, message: msg, at, version: d.envoi.version };
    histo(d, `Accepté en ligne par ${n} (version ${d.envoi.version})`);
    const facture = factureDepuisDevis(esp, d, 'acceptation en ligne');
    return { d, quoi: 'accepte', facture };
  }
  if (action === 'modifier') {
    if (d.statut === 'modification') return { d, quoi: 'deja' };
    if (msg.length < 3) throw erreur('Décrivez les modifications souhaitées.', 'message');
    d.statut = 'modification';
    d.reponse = { type: 'modification', message: msg, at, version: d.envoi.version };
    histo(d, 'Modification demandée par le client');
    return { d, quoi: 'modification' };
  }
  if (action === 'refuser') {
    d.statut = 'refuse';
    d.reponse = { type: 'refuse', message: msg, at, version: d.envoi.version };
    histo(d, 'Refusé par le client');
    return { d, quoi: 'refuse' };
  }
  throw erreur('Action inconnue.');
}

export function marquerVu(d) {
  if (d.statut !== 'envoye') return false;
  d.statut = 'vu';
  d.vuLe = maintenant();
  histo(d, 'Consulté par le client');
  return true;
}

// ---------- E-mails ----------
const signature = (v) => [v?.nom, v?.telephone, v?.email].filter(Boolean).join('\n');

export function mailDevis(d, url, message = '') {
  const s = d.envoi;
  const v = s.vendeur;
  const t = D.totaux(s.lignes, { franchise: v.franchise, acomptePct: s.acomptePct });
  const qui = s.client.contact || s.client.nom;
  return {
    subject: `Devis ${d.numero}${s.objet ? ` : ${s.objet}` : ''} (${v.nom})`.slice(0, 190),
    text: [
      `Bonjour${qui ? ` ${qui}` : ''},`,
      D.texte(message, 1000, { lignes: true }) || `Voici notre devis ${d.numero}${s.objet ? ` pour « ${s.objet} »` : ''}, d’un montant de ${D.euros(t.ttc)}${v.franchise ? '' : ' TTC'}.`,
      `Pour le consulter, l’accepter en ligne, demander une modification ou le refuser :\n${url}`,
      `Ce devis est valable jusqu’au ${D.dateLongue(s.validite)}.${t.acompte ? ` Un acompte de ${D.euros(t.acompte)} est demandé à la commande.` : ''}`,
      signature(v),
    ].join('\n\n'),
  };
}

export function mailFacture(f, url) {
  const v = f.vendeur;
  const t = D.totaux(f.lignes, { franchise: v.franchise });
  const reste = Math.max(0, t.ttc - (f.acompteVerse || 0));
  const qui = f.client.contact || f.client.nom;
  return {
    subject: `Facture ${f.numero} (${v.nom})`.slice(0, 190),
    text: [
      `Bonjour${qui ? ` ${qui}` : ''},`,
      `Voici notre facture ${f.numero}${f.objet ? ` pour « ${f.objet} »` : ''}, d’un montant de ${D.euros(t.ttc)}${v.franchise ? '' : ' TTC'}${f.acompteVerse ? `, dont ${D.euros(f.acompteVerse)} déjà réglés : reste ${D.euros(reste)}` : ''}, à régler avant le ${D.dateLongue(f.echeance)}.`,
      `Pour la consulter ou l’imprimer :\n${url}`,
      v.iban ? `Règlement par virement : IBAN ${v.iban}${v.bic ? ` · BIC ${v.bic}` : ''}` : '',
      signature(v),
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

// Prévient l'entreprise (réponse d'un client final). Ne bloque jamais la réponse.
export async function prevenirEntreprise(esp, origin, sujet, texte, replyTo = '') {
  try {
    if (!mailPret()) return false;
    const to = D.emailOk(esp.entreprise?.email) ? esp.entreprise.email : esp.compte?.email;
    if (!D.emailOk(to)) return false;
    await envoyerMail({ to, subject: sujet, text: `${texte}\n\nOuvrir l’appli Devis & Factures :\n${origin}/devis`, replyTo, fromName: 'Devis & Factures' });
    return true;
  } catch (e) {
    console.warn('[devis] e-mail entreprise', e?.code || e?.message);
    return false;
  }
}

export { noterJournal };
