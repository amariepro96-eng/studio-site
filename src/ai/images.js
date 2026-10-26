// Images des sites : photos du client (redimensionnées dans le navigateur)
// et images créées par l'IA (Gemini, via le serveur).
// Chaque image a trois formes : une miniature pour les vignettes, une version
// pour l'aperçu (data URL, seul format accepté par les aperçus isolés) et un
// fichier JPEG pour l'export .zip.
import { uid } from '../engine/util.js';

const FULL = 1600;
const THUMB = 640;

async function loadBitmap(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {}
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible'));
    };
    img.src = url;
  });
}

function draw(bmp, max) {
  const w = bmp.width;
  const h = bmp.height;
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

function toBlob(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversion impossible'))), 'image/jpeg', quality));
}

export async function prepareImage(blob, { source = 'client', alt = '' } = {}) {
  const bmp = await loadBitmap(blob);
  const big = draw(bmp, FULL);
  const small = draw(bmp, THUMB);
  const id = uid();
  return {
    id,
    source,
    alt,
    url: big.toDataURL('image/jpeg', 0.84),
    thumb: small.toDataURL('image/jpeg', 0.72),
    blob: await toBlob(big, 0.86),
    file: `images/${source === 'ia' ? 'image-ia' : 'photo'}-${id.slice(-6)}.jpg`,
    width: big.width,
    height: big.height,
  };
}

export function base64ToBlob(b64, mime = 'image/png') {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export const MAX_PHOTOS = 10;
export const TARGET_VISUALS = 10;

// Nombre d'images à faire créer par l'IA pour compléter les photos du client
export function aiImagesNeeded(photoCount) {
  return Math.max(0, Math.min(8, TARGET_VISUALS - photoCount));
}

// Génération via la route serveur (la clé Gemini reste sur le serveur)
export function apiImageGen(base = '') {
  return async ({ prompt, alt, ratio }, signal) => {
    const res = await fetch(`${base}/api/images/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, ratio }),
      signal,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {}
    if (!res.ok || !json?.data) throw new Error(json?.error || `Le serveur a répondu ${res.status}.`);
    return prepareImage(base64ToBlob(json.data, json.mime || 'image/png'), { source: 'ia', alt });
  };
}

// Lance plusieurs générations, trois à la fois, et signale chaque image terminée
export async function generateImages(gen, prompts, { onImage, signal } = {}) {
  const results = [];
  const errors = [];
  let next = 0;
  async function worker() {
    while (next < prompts.length) {
      const i = next++;
      if (signal?.aborted) return;
      try {
        const img = await gen(prompts[i], signal);
        if (signal?.aborted) return;
        results[i] = img;
        onImage?.(results.filter(Boolean));
      } catch (e) {
        errors.push(e);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return { images: results.filter(Boolean), errors };
}
