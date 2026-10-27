// Stockage des dossiers clients.
// En ligne : Vercel Blob en mode privé (à créer une fois dans Vercel › Storage).
// En local (npm run dev) sans Vercel Blob : dossier .data/ à la racine du projet.
//
// Organisation :
//   settings.json                 réglages de l'agence
//   clients/<id>.json             un dossier client
//   clients/<id>/img/<imgId>      photos, logo et images IA du client
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export class StoreError extends Error {
  constructor(message, code, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const ID_RE = /^[A-Za-z0-9_-]{8,40}$/;
export const validId = (id) => typeof id === 'string' && ID_RE.test(id);
export const newId = (bytes = 12) => crypto.randomBytes(bytes).toString('base64url');

function blobConfigured() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

// Le repli sur disque ne sert qu'en local : sur Vercel le disque est effacé à chaque appel
export function storageMode() {
  if (blobConfigured()) return 'blob';
  if (!process.env.VERCEL) return 'local';
  return 'none';
}

function assertReady() {
  if (storageMode() === 'none') {
    throw new StoreError('Le stockage n’est pas encore branché. Dans Vercel : Storage › Create › Blob (accès Private), reliez-le au projet puis redéployez.', 'no_storage', 503);
  }
}

// ---------- Accès bas niveau ----------
let blobLib = null;
async function blob() {
  if (!blobLib) blobLib = await import('@vercel/blob');
  return blobLib;
}

const LOCAL_ROOT = path.join(process.cwd(), '.data');
const localPath = (p) => {
  const full = path.join(LOCAL_ROOT, p);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new StoreError('Chemin invalide.', 'bad_path', 400);
  return full;
};

async function readRaw(pathname) {
  assertReady();
  if (storageMode() === 'local') {
    try {
      const buf = await fs.readFile(localPath(pathname));
      let meta = {};
      try {
        meta = JSON.parse(await fs.readFile(localPath(pathname) + '.meta', 'utf8'));
      } catch {}
      return { buffer: buf, contentType: meta.contentType || 'application/octet-stream', etag: String(buf.length) + ':' + crypto.createHash('md5').update(buf).digest('hex') };
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  const { get } = await blob();
  let res;
  try {
    res = await get(pathname, { access: 'private', useCache: false });
  } catch (e) {
    if (e instanceof blobLib.BlobNotFoundError) return null;
    throw e;
  }
  if (!res || res.statusCode !== 200) return null;
  const buffer = Buffer.from(await new Response(res.stream).arrayBuffer());
  return { buffer, contentType: res.blob.contentType, etag: res.blob.etag };
}

async function writeRaw(pathname, body, { contentType, ifMatch, overwrite = true, cacheSeconds } = {}) {
  assertReady();
  if (storageMode() === 'local') {
    const file = localPath(pathname);
    await fs.mkdir(path.dirname(file), { recursive: true });
    if (ifMatch) {
      const cur = await readRaw(pathname);
      if (cur && cur.etag !== ifMatch) {
        const e = new Error('precondition failed');
        e.name = 'BlobPreconditionFailedError';
        throw e;
      }
    }
    // Écriture atomique : fichier temporaire puis renommage
    const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await fs.writeFile(tmp, body);
    await fs.rename(tmp, file);
    await fs.writeFile(file + '.meta', JSON.stringify({ contentType }));
    return;
  }
  const { put } = await blob();
  await put(pathname, body, {
    access: 'private',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: overwrite,
    ...(ifMatch ? { ifMatch } : {}),
    ...(cacheSeconds ? { cacheControlMaxAge: cacheSeconds } : {}),
  });
}

async function listJson(prefix) {
  assertReady();
  if (storageMode() === 'local') {
    try {
      const names = await fs.readdir(localPath(prefix.replace(/\/$/, '')));
      return names.filter((n) => n.endsWith('.json')).map((n) => prefix + n);
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }
  const { list } = await blob();
  const out = [];
  let cursor;
  do {
    const res = await list({ prefix, mode: 'folded', cursor, limit: 1000 });
    for (const b of res.blobs) if (b.pathname.endsWith('.json')) out.push(b.pathname);
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
  return out;
}

async function removePrefix(prefix, extra = []) {
  assertReady();
  if (storageMode() === 'local') {
    for (const p of extra) {
      await fs.rm(localPath(p), { force: true });
      await fs.rm(localPath(p) + '.meta', { force: true });
    }
    await fs.rm(localPath(prefix.replace(/\/$/, '')), { recursive: true, force: true });
    return;
  }
  const { list, del } = await blob();
  // Le dossier d'abord : s'il ne reste que des images orphelines, plus rien ne les affiche
  if (extra.length) await del(extra);
  let cursor;
  do {
    const res = await list({ prefix, cursor, limit: 1000 });
    if (res.blobs.length) await del(res.blobs.map((b) => b.url));
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);
}

async function readJson(pathname) {
  const raw = await readRaw(pathname);
  if (!raw) return null;
  try {
    return { data: JSON.parse(raw.buffer.toString('utf8')), etag: raw.etag };
  } catch {
    return null;
  }
}

function isConflict(e) {
  if (blobLib && e instanceof blobLib.BlobPreconditionFailedError) return true;
  return e?.name === 'BlobPreconditionFailedError' || /precondition/i.test(String(e?.message || ''));
}

// En local, les modifications d'un même fichier passent une par une
const locks = new Map();
function withLocalLock(key, fn) {
  if (storageMode() !== 'local') return fn();
  const prev = locks.get(key) || Promise.resolve();
  const run = prev.then(fn, fn);
  locks.set(key, run.catch(() => {}));
  return run;
}

// Lecture, modification, écriture : si quelqu'un a écrit entre-temps, on recommence
function updateJson(pathname, fn) {
  return withLocalLock(pathname, () => updateJsonOnce(pathname, fn));
}

// Lecture avant modification. L'ETag vient des métadonnées de l'API Blob (head), comme le
// prévoit la documentation des écritures conditionnelles : celui renvoyé avec le contenu passe
// par le CDN, qui le transforme (« W/… ») quand il compresse un fichier, et ne serait jamais reconnu.
async function readForUpdate(pathname) {
  if (storageMode() === 'local') return readJson(pathname);
  const { head } = await blob();
  let meta;
  try {
    meta = await head(pathname);
  } catch (e) {
    if (e instanceof blobLib.BlobNotFoundError) return null;
    throw e;
  }
  // Contenu lu après l'ETag : si quelqu'un écrit entre les deux, l'écriture conditionnelle échoue et on recommence
  const cur = await readJson(pathname);
  if (!cur) return null;
  return { data: cur.data, etag: meta?.etag || '' };
}

async function updateJsonOnce(pathname, fn) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const cur = await readForUpdate(pathname);
    if (!cur) return null;
    // Sans ETag, impossible d'écrire sans risquer d'effacer une autre modification
    if (!cur.etag) throw new StoreError('Le dossier n’a pas pu être verrouillé pour l’enregistrement. Réessayez.', 'conflict', 409);
    const next = await fn(structuredClone(cur.data));
    if (!next) return cur.data;
    try {
      await writeRaw(pathname, JSON.stringify(next), { contentType: 'application/json', ifMatch: cur.etag });
      return next;
    } catch (e) {
      if (!isConflict(e)) throw e;
      await new Promise((r) => setTimeout(r, 80 + Math.random() * 220));
    }
  }
  throw new StoreError('Le dossier a été modifié en même temps ailleurs. Réessayez.', 'conflict', 409);
}

// ---------- Réglages de l'agence ----------
export const DEFAULT_HOSTING = 'Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis — vercel.com';

export const DEFAULT_SETTINGS = {
  studioName: process.env.NEXT_PUBLIC_APP_NAME || 'Studio Site',
  ownerName: 'Alexandre',
  email: '',
  phone: '',
  hosting: DEFAULT_HOSTING,
  // Mise en ligne automatique (GitHub + Vercel) : coupée tant que tu ne l'actives pas
  autoPublish: false,
};

export async function getSettings() {
  if (storageMode() === 'none') return { ...DEFAULT_SETTINGS };
  const cur = await readJson('settings.json').catch(() => null);
  return { ...DEFAULT_SETTINGS, ...(cur?.data || {}) };
}

export async function saveSettings(input) {
  const s = { ...(await getSettings()) };
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (typeof DEFAULT_SETTINGS[k] === 'string' && typeof input?.[k] === 'string') s[k] = input[k].slice(0, 300).trim();
  if (typeof input?.autoPublish === 'boolean') s.autoPublish = input.autoPublish;
  if (!s.studioName) s.studioName = DEFAULT_SETTINGS.studioName;
  if (!s.ownerName) s.ownerName = DEFAULT_SETTINGS.ownerName;
  await writeRaw('settings.json', JSON.stringify(s), { contentType: 'application/json' });
  return s;
}

// ---------- Dossiers clients ----------
export const STATUSES = ['sent', 'answered', 'generated', 'proposed', 'chosen', 'live'];

const recordPath = (id) => {
  if (!validId(id)) throw new StoreError('Lien invalide.', 'bad_id', 404);
  return `clients/${id}.json`;
};

export async function createClient({ name = '', contact = '', formula = '', mode = 'send' } = {}) {
  const now = new Date().toISOString();
  const rec = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    name: String(name).slice(0, 120).trim(),
    contact: String(contact).slice(0, 200).trim(),
    formula: String(formula).slice(0, 60),
    status: mode === 'self' ? 'answered' : 'sent',
    filledBy: mode === 'self' ? 'agence' : 'client',
    qStep: 0,
    brief: null,
    submittedAt: null,
    result: null,
    aiImages: [],
    stockImages: [],
    picked: [],
    message: '',
    proposedAt: null,
    choice: null,
    checks: {},
    liveUrl: '',
    liveAt: null,
    log: [{ at: now, what: mode === 'self' ? 'Dossier créé (brief rempli par l’agence)' : 'Dossier créé, questionnaire prêt à envoyer' }],
  };
  await writeRaw(recordPath(rec.id), JSON.stringify(rec), { contentType: 'application/json', overwrite: false });
  return rec;
}

export async function getClient(id) {
  const cur = await readJson(recordPath(id));
  return cur?.data || null;
}

export async function updateClient(id, fn) {
  return updateJson(recordPath(id), async (rec) => {
    const next = await fn(rec);
    if (!next) return null;
    next.updatedAt = new Date().toISOString();
    if (Array.isArray(next.log) && next.log.length > 60) next.log = next.log.slice(-60);
    return next;
  });
}

export async function listClients() {
  const paths = await listJson('clients/');
  const recs = await Promise.all(paths.map((p) => readJson(p).then((r) => r?.data).catch(() => null)));
  return recs.filter(Boolean).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function deleteClient(id) {
  const json = recordPath(id);
  await removePrefix(`clients/${id}/`, [json]);
}

// ---------- Images ----------
const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function saveImage(clientId, buffer, contentType) {
  if (!validId(clientId)) throw new StoreError('Lien invalide.', 'bad_id', 404);
  if (!IMG_TYPES[contentType]) throw new StoreError('Format d’image non accepté (JPEG, PNG ou WebP).', 'bad_type', 415);
  if (!buffer?.length || buffer.length > MAX_IMAGE_BYTES) throw new StoreError('Image trop lourde (4 Mo au maximum).', 'too_big', 413);
  const id = newId(9);
  // Image jamais réécrite : elle peut rester en cache longtemps
  await writeRaw(`clients/${clientId}/img/${id}`, buffer, { contentType, overwrite: false, cacheSeconds: 60 * 60 * 24 * 30 });
  return { id, ext: IMG_TYPES[contentType] };
}

export async function readImage(clientId, imgId) {
  if (!validId(clientId) || !validId(imgId)) return null;
  assertReady();
  if (storageMode() === 'local') return readRaw(`clients/${clientId}/img/${imgId}`);
  // Les images ne changent jamais : la lecture via le cache est sûre et plus rapide
  const { get } = await blob();
  const res = await get(`clients/${clientId}/img/${imgId}`, { access: 'private' }).catch((e) => {
    if (e instanceof blobLib.BlobNotFoundError) return null;
    throw e;
  });
  if (!res || res.statusCode !== 200) return null;
  return { stream: res.stream, contentType: res.blob.contentType, etag: res.blob.etag };
}
