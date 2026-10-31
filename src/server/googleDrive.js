// Connexion du Google Drive de CHAQUE client à son espace Devis & Factures.
// Objectif : quand le client émet une facture, le PDF se range tout seul dans SON Drive.
//
// Choix de sécurité :
//   • Périmètre minimal : scope « drive.file » — l'appli ne peut créer et revoir QUE les
//     fichiers qu'elle dépose elle-même. Elle ne voit jamais le reste du Drive du client.
//     (Ce scope évite aussi la lourde validation Google des scopes « restreints ».)
//   • Le « refresh token » (qui permet de redéposer plus tard sans redemander le mot de passe
//     Google) est CHIFFRÉ au repos (AES-256-GCM) avant d'être stocké dans l'espace privé.
//   • L'échange OAuth est protégé par un état signé (anti-CSRF), lié à l'espace et à durée de vie
//     courte. La clé secrète Google ne quitte jamais le serveur.
import crypto from 'node:crypto';
import { config } from './config.js';

export const SCOPES = 'openid email https://www.googleapis.com/auth/drive.file';
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const REVOKE = 'https://oauth2.googleapis.com/revoke';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export function driveConfigure() {
  const { googleClientId, googleClientSecret } = config();
  return Boolean(googleClientId && googleClientSecret);
}

// ---------- Clés dérivées de la clé secrète Google (pas de variable d'environnement en plus) ----------
function cleDe(usage, longueur = 32) {
  const { googleClientSecret } = config();
  return crypto.hkdfSync('sha256', Buffer.from(googleClientSecret || 'x'), Buffer.from('studio-site-drive:v1'), Buffer.from(usage), longueur);
}

// ---------- Chiffrement du refresh token ----------
export function chiffrerJeton(texte) {
  const cle = Buffer.from(cleDe('refresh-token'));
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', cle, iv);
  const enc = Buffer.concat([c.update(String(texte), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
export function dechiffrerJeton(blob) {
  try {
    const buf = Buffer.from(String(blob || ''), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const cle = Buffer.from(cleDe('refresh-token'));
    const d = crypto.createDecipheriv('aes-256-gcm', cle, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch {
    return null; // clé changée ou donnée corrompue : on considère la connexion perdue
  }
}

// ---------- État OAuth signé (anti-CSRF), déposé en cookie le temps de l'aller-retour ----------
export function signerEtat(donnees) {
  const corps = Buffer.from(JSON.stringify({ ...donnees, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', cleDe('oauth-state')).update(corps).digest('base64url');
  return `${corps}.${sig}`;
}
export function lireEtat(jeton) {
  const [corps, sig] = String(jeton || '').split('.');
  if (!corps || !sig) return null;
  const attendu = crypto.createHmac('sha256', cleDe('oauth-state')).update(corps).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(attendu);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(corps, 'base64url').toString('utf8'));
    if (!d.exp || d.exp < Date.now()) return null;
    return d;
  } catch {
    return null;
  }
}

// ---------- OAuth ----------
export function urlConsentement({ redirectUri, state }) {
  const { googleClientId } = config();
  const p = new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline', // pour obtenir un refresh token
    prompt: 'consent', // force un nouveau refresh token même si déjà autorisé
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH}?${p.toString()}`;
}

async function postForm(url, params) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Google ${r.status} : ${data.error_description || data.error || 'échange refusé'}`);
  return data;
}

// Décode l'e-mail depuis l'id_token (JWT reçu directement de Google en TLS ; lecture seule pour l'affichage)
function emailDeIdToken(idToken) {
  try {
    const p = JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64').toString('utf8'));
    return p.email || '';
  } catch {
    return '';
  }
}

// Échange le code d'autorisation contre les jetons. Renvoie { refreshToken, email }.
export async function echangerCode({ code, redirectUri }) {
  const { googleClientId, googleClientSecret } = config();
  const data = await postForm(TOKEN, {
    code,
    client_id: googleClientId,
    client_secret: googleClientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  if (!data.refresh_token) throw new Error('Google n’a pas renvoyé de jeton durable (refresh token). Réessayez la connexion.');
  return { refreshToken: data.refresh_token, email: emailDeIdToken(data.id_token), accessToken: data.access_token };
}

async function accessToken(refreshToken) {
  const { googleClientId, googleClientSecret } = config();
  const data = await postForm(TOKEN, {
    refresh_token: refreshToken,
    client_id: googleClientId,
    client_secret: googleClientSecret,
    grant_type: 'refresh_token',
  });
  return data.access_token;
}

export async function revoquer(refreshToken) {
  try {
    await postForm(REVOKE, { token: refreshToken });
  } catch {} // la révocation est un « mieux » ; on efface de toute façon côté serveur
}

// ---------- Dépôt d'un fichier dans le Drive du client ----------
const nomFichierSain = (s) => String(s || '').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

async function dossierExistant(tok, nom) {
  const q = `name='${nom.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = `${DRIVE}/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)&pageSize=1`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) return null;
  const d = await r.json().catch(() => ({}));
  return d.files && d.files[0] ? d.files[0].id : null;
}

async function creerDossier(tok, nom) {
  const r = await fetch(`${DRIVE}/files?fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nom, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!r.ok) throw new Error('Impossible de créer le dossier dans le Drive.');
  return (await r.json()).id;
}

// S'assure que le dossier cible existe (le réutilise via son id mémorisé, sinon le retrouve/crée)
async function dossierCible(tok, nomDossier, folderIdConnu) {
  if (folderIdConnu) {
    // vérifie qu'il existe toujours (pas supprimé par le client)
    const r = await fetch(`${DRIVE}/files/${folderIdConnu}?fields=id,trashed`, { headers: { Authorization: `Bearer ${tok}` } });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      if (d.id && !d.trashed) return d.id;
    }
  }
  return (await dossierExistant(tok, nomDossier)) || (await creerDossier(tok, nomDossier));
}

async function televerser(tok, { nom, folderId, bytes, mimeType = 'application/pdf' }) {
  const bound = 'studiosite' + crypto.randomBytes(12).toString('hex');
  const meta = JSON.stringify({ name: nom, parents: [folderId] });
  const head = `--${bound}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${bound}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const tail = `\r\n--${bound}--`;
  const body = Buffer.concat([Buffer.from(head, 'utf8'), Buffer.from(bytes), Buffer.from(tail, 'utf8')]);
  const r = await fetch(`${UPLOAD}?uploadType=multipart&fields=id,webViewLink`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': `multipart/related; boundary=${bound}` },
    body,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Dépôt refusé par le Drive (${r.status}).`);
  return { id: d.id, lien: d.webViewLink || '' };
}

// Dépose un PDF dans le Drive du client. Renvoie { id, lien, folderId }.
// Lève une erreur en cas d'échec (l'appelant la consigne sans bloquer l'émission).
export async function deposerPdf({ refreshToken, nomDossier, nomFichier, bytes, folderId }) {
  const tok = await accessToken(refreshToken);
  const dossier = await dossierCible(tok, nomFichierSain(nomDossier) || 'Factures', folderId);
  const res = await televerser(tok, { nom: nomFichierSain(nomFichier), folderId: dossier, bytes });
  return { ...res, folderId: dossier };
}
