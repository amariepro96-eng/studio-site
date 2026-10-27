'use client';
// Appels aux routes de l'application, avec des erreurs lisibles

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Connexion impossible. Vérifiez votre réseau, puis réessayez.', 'network', 0);
  }
  let json = null;
  try {
    json = await res.json();
  } catch {}
  if (!res.ok || !json || json.error) {
    throw new ApiError(json?.error || `Le serveur a répondu ${res.status}.`, json?.code || 'server', res.status);
  }
  return json;
}

export async function uploadImage(url, blob, { kind = 'photo', alt = '', filename = 'image.jpg', batch = '', signal } = {}) {
  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('kind', kind);
  fd.append('alt', alt);
  if (batch) fd.append('batch', batch);
  let res;
  try {
    res = await fetch(url, { method: 'POST', body: fd, signal });
  } catch {
    if (signal?.aborted) throw new ApiError('Envoi annulé.', 'cancelled', 0);
    throw new ApiError('Envoi impossible. Vérifiez votre réseau, puis réessayez.', 'network', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.image) throw new ApiError(json?.error || `Le serveur a répondu ${res.status}.`, json?.code || 'server', res.status);
  return json.image;
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(() => true, () => fallbackCopy(text));
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
