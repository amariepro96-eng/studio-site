// Outils communs aux routes : accès agence, réponses d'erreur, nettoyage des données reçues
import crypto from 'node:crypto';
import { BlobError } from '@vercel/blob';
import { config, agencyToken } from './config.js';
import { StoreError, validId, storageMode } from './store.js';
import { emptyBrief } from '../engine/questions.js';

export function fail(status, error, code) {
  return Response.json({ error, code }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function ok(data) {
  return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
}

function readCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return '';
}

// En ligne, sans mot de passe défini, l'espace agence reste fermé. En local, il est ouvert.
export function isAgency(req) {
  const { agencyPassword } = config();
  if (!agencyPassword) return !process.env.VERCEL;
  return safeEqual(readCookie(req, 'agence'), agencyToken(agencyPassword));
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Enveloppe : erreurs de stockage traduites en messages lisibles
export function route(fn, { agency = false } = {}) {
  return async (req, ctx) => {
    if (agency && !isAgency(req)) return fail(401, 'Session agence expirée : reconnectez-vous.', 'unauthorized');
    try {
      const params = ctx?.params ? await ctx.params : {};
      return await fn(req, params);
    } catch (e) {
      if (e instanceof StoreError) return fail(e.status, e.message, e.code);
      console.error('[api]', req.method, new URL(req.url).pathname, e?.name, String(e?.message || '').slice(0, 300));
      if (e instanceof BlobError) {
        return fail(503, 'Le stockage Vercel Blob a refusé l’opération. Vérifiez qu’il est relié au projet (Storage › Projects), puis redéployez.', 'storage_access');
      }
      return fail(500, 'L’opération a échoué. Réessayez dans un instant.', 'failed');
    }
  };
}

export async function readBody(req) {
  try {
    return await req.json();
  } catch {
    throw new StoreError('Requête illisible.', 'bad_request', 400);
  }
}

export function storageInfo() {
  return { storage: storageMode() };
}

// ---------- Nettoyage du brief reçu ----------
const LONG = new Set(['description', 'services', 'products', 'reviews', 'hours', 'strengths']);

function cleanImageRef(x) {
  if (!x || typeof x !== 'object' || !validId(x.id)) return null;
  return { id: x.id, ext: ['jpg', 'png', 'webp'].includes(x.ext) ? x.ext : 'jpg', alt: typeof x.alt === 'string' ? x.alt.slice(0, 160) : '' };
}

export function sanitizeBrief(raw) {
  const base = emptyBrief();
  const out = {};
  for (const [k, def] of Object.entries(base)) {
    const v = raw?.[k];
    if (k === 'photos') out.photos = Array.isArray(v) ? v.map(cleanImageRef).filter(Boolean).slice(0, 10) : [];
    else if (k === 'logo') out.logo = cleanImageRef(v);
    else if (typeof def === 'boolean') out[k] = typeof v === 'boolean' ? v : def;
    else if (Array.isArray(def)) out[k] = Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 12).map((x) => x.slice(0, 40)) : def;
    else out[k] = typeof v === 'string' ? v.slice(0, LONG.has(k) ? 3000 : 600) : def;
  }
  if (out.siteType !== 'boutique') out.siteType = 'vitrine';
  return out;
}
