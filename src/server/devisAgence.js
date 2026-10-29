// Appli Devis & Factures vue par l'agence : résumé d'un espace (jamais de devis, de facture, de
// prix ni de mot de passe) et suppression complète d'un espace.
import { getClient, updateClient, getDevisEspace, supprimerDevisEspace } from './store.js';
import { libererEmail, masquerEmail } from './devisAcces.js';
import { oublierAppareilsCompte } from './espace.js';

export function resumeEspace(esp) {
  if (!esp) return null;
  const inv = esp.invitation;
  const appareils = esp.appareils || [];
  return {
    actif: esp.actif !== false,
    creeLe: esp.creeLe,
    emailPropose: esp.emailPropose || '',
    // Une fois le compte créé, tout nouveau lien part UNIQUEMENT à l'adresse du propriétaire
    proprietaire: esp.emailProprietaire ? masquerEmail(esp.emailProprietaire) : '',
    invitation: inv ? { creeLe: inv.creeLe, exp: new Date(inv.exp).toISOString(), utiliseeLe: inv.utiliseeLe || null } : null,
    compte: esp.compte ? { email: masquerEmail(esp.compte.email), creeLe: esp.compte.creeLe, deuxFacteurs: Boolean(esp.compte.totp) } : null,
    appareils: appareils.length,
    dernierVu: appareils.map((a) => a.vuLe).sort().pop() || null,
    nbDevis: (esp.devis || []).length,
    nbFactures: (esp.factures || []).filter((f) => f.numero).length,
    nbProduits: (esp.produits || []).length,
    // Seulement l'état et le modèle : jamais ses tarifs
    calculateur: esp.calculateur ? { actif: esp.calculateur.actif === true, modele: esp.calculateur.modele } : null,
  };
}

// État simple, pour la liste des comptes
export function etatEspace(r) {
  if (!r) return 'absent';
  if (!r.actif) return 'suspendu';
  if (r.compte?.deuxFacteurs) return 'actif';
  const inv = r.invitation;
  if (inv && !inv.utiliseeLe && new Date(inv.exp) > new Date()) return 'invitation';
  if (inv?.utiliseeLe) return 'a_terminer';
  return 'expiree';
}

// Supprime l'appli d'un client : compte, adresse de connexion, devis, factures, produits.
// Les liens déjà envoyés à ses clients cessent de marcher. Le dossier du site n'est pas touché.
export async function supprimerAppli(w, { clientId = '', qui = '' } = {}) {
  const esp = await getDevisEspace(w);
  if (!esp) return false;
  const emails = [...new Set([esp.compte?.email, esp.emailProprietaire].filter(Boolean))];
  await supprimerDevisEspace(w);
  for (const e of emails) await libererEmail(e, w).catch(() => null);
  const id = clientId || esp.clientId;
  if (id && (await getClient(id))) {
    await updateClient(id, (r) => {
      if (r.appliDevis?.wid !== w) return null;
      delete r.appliDevis;
      oublierAppareilsCompte(r); // couper l'accès « Mon site » ouvert depuis ce compte
      r.log = [...(r.log || []), { at: new Date().toISOString(), what: `Appli Devis & Factures supprimée${qui ? ` par ${qui}` : ''} (compte, devis et factures effacés)` }];
      return r;
    });
  }
  return true;
}
