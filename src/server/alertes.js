// Surveillance automatique et alertes par e-mail, même quand le Pilotage est fermé.
//
// Vercel appelle /api/cron/pilotage toutes les 5 minutes (vercel.json). Chaque passage revérifie
// tous les sites ; une panne confirmée (vue lors de deux vérifications, à 4 minutes d'écart au
// moins) déclenche un e-mail à l'adresse « E-mail de contact » des Réglages, puis un second e-mail
// quand elle est réglée. Envoi par Brevo (BREVO_API_KEY, EMAIL_FROM), déjà utilisé par les espaces
// clients. Ce qui a été envoyé est noté dans pilotage.json : jamais deux fois le même e-mail.
import { getSettings, getPilotage, updatePilotage, storageMode } from './store.js';
import { etatPilotage } from './pilotage.js';
import { mailPret, mailStatus, envoyerMail, emailValide } from './mail.js';

export const INTERVALLE_AUTO_MIN = 5;
const ECART_MIN_MS = 3 * 60_000; // deux passages trop rapprochés (doublon de Vercel, appel extérieur) : on ignore le second
const CONFIRMATION_MS = 4 * 60_000; // une panne doit durer au moins ça avant l'e-mail (évite les fausses alertes)

const heure = (iso) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');
const jourHeure = (iso) => new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).replace(/(\d{2}):(\d{2})$/, '$1 h $2');

// Adresse de l'application, pour le lien vers le Pilotage dans l'e-mail
export function adresseAppli(origineRequete = '') {
  const prod = (process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  if (prod) return 'https://' + prod.replace(/^https?:\/\//, '');
  return origineRequete;
}

export function etatAlertes(settings, pil) {
  const mail = mailStatus();
  const email = emailValide(settings?.email) ? settings.email.trim() : '';
  const actif = settings?.alertesEmail !== false;
  return {
    actif,
    email,
    mail: { configured: mail.configured, missing: mail.missing },
    pret: actif && mail.configured && Boolean(email),
    derniereLe: pil?.auto?.derniereLe || null,
    dernierEnvoiLe: pil?.auto?.dernierEnvoiLe || null,
    erreur: pil?.auto?.erreur || null,
    enCours: Object.values(pil?.alertes || {}).map((a) => ({ nom: a.nom, titre: a.titre, depuis: a.depuis, envoyeLe: a.envoyeLe })),
    intervalle: INTERVALLE_AUTO_MIN,
  };
}

// ---------- Les e-mails ----------
function blocProbleme(s, p) {
  const lignes = [`● ${s.nom} : ${p.titre}`];
  if (s.url) lignes.push(s.url);
  lignes.push(`Constaté depuis ${heure(p.depuis)}. ${p.resume || ''}`.trim());
  if (p.quoi) lignes.push(`Ce qui se passe : ${p.quoi}`);
  if (p.etapes?.length) lignes.push('Que faire :\n' + p.etapes.map((e, i) => `${i + 1}. ${e}`).join('\n'));
  return lignes.join('\n');
}

export function mailPanne(nouvelles, { studio, owner, lien }) {
  const noms = [...new Set(nouvelles.map((x) => x.site.nom))];
  const sujet = noms.length > 1 ? `${noms.length} sites en panne : ${noms.join(', ')}` : `Site en panne : ${noms[0]}`;
  const texte = [
    `Bonjour ${owner},`,
    noms.length > 1 ? `Studio Site a détecté un problème sur ${noms.length} sites de tes clients.` : `Studio Site a détecté un problème sur le site de ${noms[0]}.`,
    ...nouvelles.map(({ site, probleme }) => blocProbleme(site, probleme)),
    `Ouvre le Pilotage pour voir les détails et revérifier :\n${lien}`,
    'Tu recevras un autre e-mail dès que ce sera réglé.',
    studio,
  ].join('\n\n');
  return { sujet: sujet.slice(0, 180), texte };
}

export function mailResolu(resolues, { studio, owner, lien, maintenant = Date.now() }) {
  const noms = [...new Set(resolues.map((x) => x.nom))];
  const sujet = noms.length > 1 ? `Réglé : ${noms.join(', ')}` : `Réglé : ${noms[0]} fonctionne à nouveau`;
  const texte = [
    `Bonjour ${owner},`,
    ...resolues.map((a) => `● ${a.nom} : réglé (« ${a.titre} », constaté de ${heure(a.depuis)} à ${heure(new Date(maintenant).toISOString())}).`),
    'Rien d’autre à faire. Si ton client a été gêné, un petit mot pour le prévenir que tout est rentré dans l’ordre fait toujours plaisir (document 03, §5).',
    `Pilotage : ${lien}`,
    studio,
  ].join('\n\n');
  return { sujet: sujet.slice(0, 180), texte };
}

// ---------- Un passage de la surveillance automatique ----------
export async function verificationAutomatique({ origine = '', maintenant = Date.now() } = {}) {
  if (storageMode() === 'none') return { saute: 'stockage' };
  // 1. Réserver ce passage (un seul à la fois, même si Vercel appelle deux fois)
  let reserve = false;
  await updatePilotage((p) => {
    const der = p.auto?.derniereLe ? new Date(p.auto.derniereLe).getTime() : 0;
    if (maintenant - der < ECART_MIN_MS) return null;
    reserve = true;
    return { ...p, auto: { ...(p.auto || {}), derniereLe: new Date(maintenant).toISOString() } };
  });
  if (!reserve) return { saute: 'recent' };

  // 2. Revérifier tous les sites (met aussi à jour l'activité récente du Pilotage)
  const data = await etatPilotage({ force: true });
  const settings = await getSettings();
  const pannes = new Map();
  for (const s of data.sites || [])
    for (const p of s.problemes || [])
      if (p.niveau === 'panne' && p.depuis && maintenant - new Date(p.depuis).getTime() >= CONFIRMATION_MS) pannes.set(`${s.id}:${p.id}`, { site: s, probleme: p });
  const encorePanne = new Set();
  for (const s of data.sites || []) for (const p of s.problemes || []) if (p.niveau === 'panne') encorePanne.add(`${s.id}:${p.id}`);
  const existe = new Set((data.sites || []).map((s) => s.id));

  // 3. Noter ce qu'il faut envoyer (atomique : un autre passage ne renverra pas le même e-mail)
  const envoyer = settings.alertesEmail !== false && mailPret() && emailValide(settings.email);
  let nouvelles = [];
  let resolues = [];
  await updatePilotage((p) => {
    const alertes = { ...(p.alertes || {}) };
    nouvelles = [];
    resolues = [];
    // Alertes coupées ou pas branchées : rien de nouveau n'est noté (une panne encore en cours
    // quand elles seront rallumées sera annoncée à ce moment-là)
    if (envoyer)
      for (const [cle, x] of pannes) {
        if (alertes[cle]) continue;
        nouvelles.push(x);
        alertes[cle] = { clientId: x.site.id, nom: x.site.nom, titre: x.probleme.titre, depuis: x.probleme.depuis, envoyeLe: new Date(maintenant).toISOString() };
      }
    for (const [cle, a] of Object.entries(alertes)) {
      if (encorePanne.has(cle)) continue;
      delete alertes[cle];
      // Site supprimé entre-temps : rien à annoncer
      if (existe.has(a.clientId)) resolues.push(a);
    }
    if (!nouvelles.length && !resolues.length) return null;
    return { ...p, alertes };
  });
  if (!envoyer || (!nouvelles.length && !resolues.length)) return { nouvelles: nouvelles.length, resolues: resolues.length, envoye: false };
  // (alertes coupées entre-temps : les pannes réglées sont simplement retirées, sans e-mail)

  // 4. Envoyer
  const ctx = { studio: settings.studioName || 'Studio Site', owner: settings.ownerName || '', lien: `${adresseAppli(origine)}/pilotage`, maintenant };
  const erreurs = [];
  for (const [liste, faire] of [
    [nouvelles, mailPanne],
    [resolues, mailResolu],
  ]) {
    if (!liste.length) continue;
    const { sujet, texte } = faire(liste, ctx);
    try {
      await envoyerMail({ to: settings.email, subject: sujet, text: texte, fromName: settings.studioName });
    } catch (e) {
      erreurs.push(String(e?.message || 'Envoi impossible.').slice(0, 300));
      // Panne non annoncée : on la retire pour réessayer au passage suivant
      if (faire === mailPanne)
        await updatePilotage((p) => {
          const alertes = { ...(p.alertes || {}) };
          for (const x of liste) delete alertes[`${x.site.id}:${x.probleme.id}`];
          return { ...p, alertes };
        }).catch(() => {});
    }
  }
  await updatePilotage((p) => ({
    ...p,
    auto: { ...(p.auto || {}), ...(erreurs.length ? { erreur: { at: new Date(maintenant).toISOString(), message: erreurs[0] } } : { erreur: null, dernierEnvoiLe: new Date(maintenant).toISOString() }) },
  })).catch(() => {});
  return { nouvelles: nouvelles.length, resolues: resolues.length, envoye: !erreurs.length, erreurs };
}

// E-mail de test (bouton dans Réglages)
export async function mailDeTest(origine = '') {
  const settings = await getSettings();
  if (!emailValide(settings.email)) throw Object.assign(new Error('Renseigne d’abord ton « E-mail de contact » ci-dessus, puis Enregistrer.'), { code: 'no_email' });
  const lien = `${adresseAppli(origine)}/pilotage`;
  const pil = await getPilotage();
  const der = pil.auto?.derniereLe;
  await envoyerMail({
    to: settings.email,
    subject: `${settings.studioName || 'Studio Site'} : e-mail de test des alertes`,
    text: [
      `Bonjour ${settings.ownerName || ''},`,
      'Ceci est un e-mail de test : les alertes du Pilotage arrivent bien jusqu’à toi.',
      `Quand un site de tes clients tombe en panne, tu reçois un e-mail comme celui-ci en moins de 10 minutes, même si le Pilotage est fermé, puis un autre quand c’est réglé.`,
      der ? `Dernière vérification automatique : ${jourHeure(der)}.` : 'La surveillance automatique démarre dans les 5 minutes qui suivent la mise en ligne de cette version.',
      `Pilotage : ${lien}`,
      settings.studioName || 'Studio Site',
    ].join('\n\n'),
    fromName: settings.studioName,
  });
  return { email: settings.email };
}
