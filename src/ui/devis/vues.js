// Mise en forme des devis et factures de l'appli pour le composant Document
import { totaux, mentionsDocument, statutDevis, statutFacture } from '../../engine/devis.js';

// Ce que le client final voit (version envoyée), ou la version en cours de rédaction
export function vueDevis(d, entreprise) {
  const envoyee = d.envoi && !d.aRenvoyer ? d.envoi : null;
  const src = envoyee || { client: d.client, objet: d.objet, lignes: d.lignes, acomptePct: d.acomptePct, notes: d.notes, vendeur: entreprise, date: null, validite: null };
  const vendeur = src.vendeur || entreprise || {};
  return {
    type: 'devis',
    numero: d.numero,
    date: src.date,
    validite: src.validite,
    vendeur,
    client: src.client,
    objet: src.objet,
    lignes: src.lignes,
    notes: src.notes,
    totaux: totaux(src.lignes, { franchise: vendeur.franchise, acomptePct: src.acomptePct }),
    reponse: d.statut === 'accepte' ? d.reponse : null,
    mentions: mentionsDocument(vendeur),
  };
}

export function vueFacture(f, entreprise) {
  const vendeur = f.vendeur || entreprise || {};
  const t = totaux(f.lignes, { franchise: vendeur.franchise });
  return {
    type: 'facture',
    numero: f.numero,
    date: f.emiseLe || null,
    datePrestation: f.datePrestation || null,
    echeance: f.echeance || null,
    devisNumero: f.devisNumero,
    vendeur,
    client: f.client,
    objet: f.objet,
    lignes: f.lignes,
    totaux: t,
    acompteVerse: f.acompteVerse || 0,
    reste: Math.max(0, t.ttc - (f.acompteVerse || 0)),
    statut: statutFacture(f),
    payeeLe: f.payeeLe,
    mentions: mentionsDocument(vendeur, { facture: true, clientPro: f.client?.pro }),
  };
}

export const montantDevis = (d, entreprise) => vueDevis(d, entreprise).totaux.ttc;
export const montantFacture = (f, entreprise) => vueFacture(f, entreprise).totaux.ttc;
export { statutDevis, statutFacture };
