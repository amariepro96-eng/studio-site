// Envoi vers Google Drive (via la route serveur /api/drive) : brief, photos du client, .zip du site.
import { uid } from '../engine/util.js';

// Taille d'un morceau en caractères base64 (multiple de 4, environ 2,25 Mo de données)
export const MORCEAU = 3_145_728;

async function post(base, payload, signal) {
  const r = await fetch(`${base}/api/drive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  let data = null;
  try {
    data = await r.json();
  } catch {}
  if (!r.ok || !data?.ok) throw new Error(data?.erreur || `Envoi vers le Drive impossible (${r.status}).`);
  return data;
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Fichier illisible.'));
    reader.readAsDataURL(blob);
  });
}

export function apiDrive(base = '') {
  return {
    // { identifiant, jeton, dossier? }
    brief: (brief, { mode, photos }, signal) => post(base, { action: 'brief', brief, mode, photos }, signal),
    // Envoie un fichier morceau par morceau ; dossier : 'photos' ou 'versions'
    async fichier({ identifiant, jeton, dossier, nom, blob }, signal) {
      const b64 = await blobToBase64(blob);
      const total = Math.max(1, Math.ceil(b64.length / MORCEAU));
      const envoi = uid().replace(/[^a-z0-9]/gi, '');
      let last = null;
      for (let index = 0; index < total; index++) {
        const data = b64.slice(index * MORCEAU, (index + 1) * MORCEAU);
        last = await post(base, { action: 'fichier', identifiant, jeton, dossier, nom, envoi, index, total, data }, signal);
      }
      return last;
    },
  };
}
