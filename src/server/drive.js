// Enregistrement automatique dans Google Drive, côté serveur : le brief, les photos du client
// et le .zip du site partent vers le script « Automatisation dossiers clients » du tableau
// Suivi clients (document 11 et son annexe). L'adresse et la clé restent dans Vercel :
//   DRIVE_WEBHOOK_URL     adresse de l'application Web Google (elle finit par /exec)
//   DRIVE_WEBHOOK_SECRET  clé affichée par « Clients › Connecter Studio Site »
//
// Quand : questionnaire envoyé par le client, génération des modèles, mise en ligne d'une
// version depuis le dossier, ou clic sur « Envoyer ce qui manque » dans le dossier.
// Chaque envoi ne fait que ce qui manque : une fiche brief n'est refaite que si les réponses
// ont changé, une photo déjà rangée ne repart pas, le site n'est archivé que s'il a changé.
// La création du site n'attend jamais le Drive : un échec est noté dans le dossier.
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { config } from './config.js';
import { getClient, updateClient, getSettings, readImage } from './store.js';
import { siteFiles } from './publish.js';
import { renderBrief } from '../engine/records.js';
import { ficheBrief } from '../engine/fiche.js';
import { remoteSteps } from '../engine/questions.js';
import { readme } from '../engine/zip.js';
import { slugify } from '../engine/util.js';

// Un morceau par appel (multiple de 4 caractères base64, environ 2,25 Mo de données) ;
// le script accepte 20 morceaux au plus, soit des fichiers jusqu'à 45 Mo
export const MORCEAU = 3_145_728;
export const MAX_MORCEAUX = 20;
// Un envoi en cours bloque les autres pendant 5 minutes au plus (évite les fiches en double)
const BAIL_MS = 5 * 60_000;

export function driveStatus() {
  const cfg = config();
  const missing = [];
  if (!cfg.driveUrl) missing.push('DRIVE_WEBHOOK_URL');
  if (!cfg.driveSecret) missing.push('DRIVE_WEBHOOK_SECRET');
  return { configured: missing.length === 0, missing };
}

class DriveError extends Error {}

// Un appel au script Google (qui répond par une redirection vers sa réponse JSON)
async function appel(payload) {
  const cfg = config();
  let r;
  try {
    r = await fetch(cfg.driveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, cle: cfg.driveSecret }),
      redirect: 'follow',
      signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    throw new DriveError(e?.name === 'TimeoutError' ? 'Le script Google n’a pas répondu à temps.' : 'Le script Google est injoignable : vérifie DRIVE_WEBHOOK_URL.');
  }
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new DriveError(
      r.ok ? 'Réponse inattendue du script Google : vérifie qu’il est déployé en « Application Web », accès « Tout le monde ».' : `Le script Google a répondu ${r.status} : vérifie DRIVE_WEBHOOK_URL.`
    );
  }
  if (!data?.ok) throw new DriveError(String(data?.erreur || 'Le script Google a refusé la demande.').slice(0, 300));
  return data;
}

// Un fichier envoyé morceau par morceau. L'identifiant d'envoi dépend du contenu :
// si un envoi est coupé, le suivant réutilise les morceaux déjà reçus par Google.
async function envoyerFichier({ identifiant, dossier, nom, type, buffer }) {
  const b64 = buffer.toString('base64');
  const total = Math.max(1, Math.ceil(b64.length / MORCEAU));
  if (total > MAX_MORCEAUX) throw new DriveError(`Fichier trop lourd pour le Drive automatique (${Math.round(buffer.length / 1e6)} Mo) : range-le à la main.`);
  const envoi = crypto.createHash('sha256').update([identifiant, dossier, nom].join('|')).update(buffer).digest('hex').slice(0, 32);
  let out = null;
  for (let index = 0; index < total; index++) {
    out = await appel({ action: 'fichier', identifiant, dossier, nom, type, envoi, index, total, data: b64.slice(index * MORCEAU, (index + 1) * MORCEAU) });
  }
  if (!out?.termine) throw new DriveError('Le script Google n’a pas rassemblé le fichier : réessaie.');
  return out;
}

async function lireImage(clientId, imgId) {
  const res = await readImage(clientId, imgId).catch(() => null);
  if (!res) return null;
  if (res.buffer) return res.buffer;
  return Buffer.from(await new Response(res.stream).arrayBuffer());
}

const ext = (img) => (img.ext === 'png' ? 'png' : img.ext === 'webp' ? 'webp' : 'jpg');

// Photos et logo fournis par le client (y compris ses vraies photos ajoutées depuis son espace)
function photosDuClient(rec) {
  const b = rec.brief || {};
  const out = [];
  if (b.logo?.id) out.push({ id: b.logo.id, nom: `logo-${b.logo.id}.${ext(b.logo)}` });
  for (const p of b.photos || []) if (p?.id) out.push({ id: p.id, nom: `photo-${p.id}.${ext(p)}` });
  for (const p of rec.aiImages || []) if (p?.id && p.reel) out.push({ id: p.id, nom: `photo-${p.id}.${ext(p)}` });
  const vus = new Set();
  return out.filter((p) => !vus.has(p.id) && vus.add(p.id));
}

// Le site tel qu'il serait téléchargé (.zip), avec une empreinte pour ne pas l'archiver deux fois
async function siteActuel(rec) {
  const model = rec.result?.models?.find((m) => m.id === rec.choice?.modelId);
  if (!rec.result?.content || !model) return null;
  const settings = await getSettings();
  const { pages, binaries } = await siteFiles(rec, settings);
  const h = crypto.createHash('sha256');
  for (const p of pages) h.update(p.path).update('\0').update(p.text).update('\0');
  for (const b of binaries) h.update(b.path).update('\0').update(b.id).update('\0');
  const empreinte = h.digest('hex').slice(0, 32);
  async function zip() {
    const brief = renderBrief(rec, '', settings?.hosting || '');
    const z = new JSZip();
    const folder = z.folder(slugify(brief.businessName || 'mon-site'));
    for (const p of pages) folder.file(p.path, p.text);
    for (const b of binaries) {
      const buf = await lireImage(rec.id, b.id);
      if (!buf) throw new DriveError('Une image du site est introuvable : remplace-la, puis réessaie.');
      folder.file(b.path, buf, { compression: 'STORE' });
    }
    folder.file('LISEZ-MOI.txt', readme(brief, model));
    return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
  return { empreinte, zip };
}

// Réserve le dossier pour un envoi : renvoie le dossier à jour, ou null si un envoi est déjà en cours
async function reserver(id) {
  let pris = false;
  const rec = await updateClient(id, (r) => {
    pris = false;
    const d = r.drive || {};
    if (d.enCours && Date.now() - Date.parse(d.enCours) < BAIL_MS) return null;
    pris = true;
    r.drive = { ...d, enCours: new Date().toISOString() };
    return r;
  });
  return rec && pris ? rec : null;
}

function resumeEnvoi(b) {
  const parts = [];
  if (b.brief) parts.push('brief');
  if (b.photos) parts.push(`${b.photos} photo${b.photos > 1 ? 's' : ''}`);
  if (b.site) parts.push(`site (${b.site})`);
  if (!parts.length) return '';
  const liste = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}` : parts[0];
  const accord = parts.length === 1 && b.photos ? (b.photos > 1 ? 'enregistrées' : 'enregistrée') : parts.length > 1 ? 'enregistrés' : 'enregistré';
  return `Drive : ${liste} ${accord}`;
}

/**
 * Envoie vers Drive ce qui manque pour ce dossier.
 * site : archiver aussi le site s'il a changé (mise en ligne ou clic de l'agence).
 * parClient : envoi déclenché par le client (questionnaire) : au plus un toutes les 10 minutes,
 *          pour qu'un lien de questionnaire ne puisse pas remplir le Drive de fiches.
 * Renvoie { fait, raison?, bilan, erreur, client }.
 */
export async function envoyerVersDrive(id, { site = false, parClient = false } = {}) {
  if (!driveStatus().configured) return { fait: false, raison: 'off' };
  const avant = await getClient(id);
  if (!avant) return { fait: false, raison: 'introuvable' };
  // Pas encore de réponses (questionnaire pas commencé) : rien à ranger
  const nom = String(avant.brief?.businessName || '').trim().slice(0, 120);
  if (!nom) return { fait: false, raison: 'vide', client: avant };
  // Les réponses renvoyées entre-temps partiront au prochain envoi (génération, mise en ligne, clic)
  const dernier = Date.parse(avant.drive?.dernierEnvoi || '');
  if (parClient && dernier && Date.now() - dernier < 10 * 60_000) return { fait: false, raison: 'attente', client: avant };
  const rec = await reserver(id);
  if (!rec) return { fait: false, raison: 'occupe', client: avant };

  const d = rec.drive || {};
  const patch = {};
  const bilan = { brief: false, photos: 0, site: '' };
  let erreur = '';
  let envoyees = new Set(d.photos || []);
  try {
    // 1. La fiche brief : à la première fois, puis à chaque changement des réponses
    let identifiant = d.identifiant || '';
    const rev = rec.briefRev || 0;
    if (!identifiant || d.briefRev !== rev) {
      const agence = rec.filledBy === 'agence';
      const b = rec.brief;
      const out = await appel({
        action: 'brief',
        client: { nom: String(b.businessName || '').trim().slice(0, 120) || nom, email: String(b.email || '').trim().slice(0, 160), telephone: String(b.phone || '').trim().slice(0, 60) },
        statut: agence ? 'En cours (mode agence)' : 'Prospect (questionnaire)',
        source: agence ? 'Mode agence' : 'Questionnaire client',
        fiche: ficheBrief(b, { photos: (b.photos || []).length, aiImages: b.aiImages !== false, dossier: [{ label: 'Contact', valeur: rec.contact }, { label: 'Formule', valeur: rec.formula }] }, remoteSteps({ strict: false })),
      });
      if (!/^[a-z0-9-]{1,80}$/.test(String(out.identifiant || ''))) throw new DriveError('Réponse inattendue du script Google (identifiant manquant).');
      // Nom d'entreprise changé : le script range dans un autre dossier, on y renvoie tout
      if (identifiant && out.identifiant !== identifiant) {
        envoyees = new Set();
        patch.siteEmpreinte = '';
      }
      identifiant = out.identifiant;
      Object.assign(patch, { identifiant, dossier: String(out.dossier || ''), fiche: String(out.fiche || ''), briefRev: rev, briefAt: new Date().toISOString() });
      bilan.brief = true;
    }

    // 2. Les photos et le logo du client
    for (const p of photosDuClient(rec)) {
      if (envoyees.has(p.id)) continue;
      const buffer = await lireImage(rec.id, p.id);
      if (!buffer) continue;
      await envoyerFichier({ identifiant, dossier: 'photos', nom: p.nom, type: 'image/jpeg', buffer });
      envoyees.add(p.id);
      bilan.photos++;
    }

    // 3. Le site (.zip) dans « 3-Versions du site », s'il a changé depuis le dernier archivage
    if (site) {
      const s = await siteActuel(rec);
      const derniere = 'siteEmpreinte' in patch ? patch.siteEmpreinte : d.siteEmpreinte;
      if (s && s.empreinte !== derniere) {
        const out = await envoyerFichier({ identifiant, dossier: 'versions', nom: 'auto', type: 'application/zip', buffer: await s.zip() });
        Object.assign(patch, { siteEmpreinte: s.empreinte, siteNom: String(out.nom || '').slice(0, 120), siteUrl: String(out.url || ''), siteAt: new Date().toISOString() });
        bilan.site = patch.siteNom || 'zip';
      }
    }
  } catch (e) {
    erreur = e instanceof DriveError ? e.message : 'L’enregistrement dans Google Drive a échoué.';
    if (!(e instanceof DriveError)) console.warn('[drive]', e?.name, String(e?.message || '').slice(0, 200));
    // Dossier supprimé dans Drive : au prochain envoi, la fiche le recrée et tout y est renvoyé
    if (/^Dossier du client introuvable/.test(erreur)) {
      Object.assign(patch, { identifiant: '', briefRev: null, siteEmpreinte: '' });
      envoyees = new Set();
      erreur += ' : réessaie, il sera recréé.';
    }
  }

  const at = new Date().toISOString();
  const ligne = erreur ? `Drive : envoi en échec (${erreur})` : resumeEnvoi(bilan);
  const client = await updateClient(id, (r) => {
    r.drive = { ...(r.drive || {}), ...patch, photos: [...envoyees].slice(-60), enCours: null, dernierEnvoi: at, erreur: erreur ? { at, message: erreur } : null };
    if (ligne) r.log = [...(r.log || []), { at, what: ligne.slice(0, 200) }];
    return r;
  });
  return { fait: !erreur, bilan, erreur, client };
}

// Vue du dossier Drive pour l'écran agence
export function vueDrive(rec) {
  const d = rec?.drive || {};
  return {
    identifiant: d.identifiant || '',
    dossier: d.dossier || '',
    fiche: d.fiche || '',
    briefAt: d.briefAt || null,
    briefAJour: Boolean(d.identifiant) && d.briefRev === (rec?.briefRev || 0),
    photos: (d.photos || []).length,
    photosClient: photosDuClient(rec || {}).length,
    siteNom: d.siteNom || '',
    siteAt: d.siteAt || null,
    enCours: Boolean(d.enCours && Date.now() - Date.parse(d.enCours) < BAIL_MS),
    erreur: d.erreur || null,
  };
}
