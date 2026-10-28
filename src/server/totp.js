// Codes à 6 chiffres des applis d'authentification (Google Authenticator, etc.) : norme TOTP
// (RFC 6238), HMAC-SHA1, un code toutes les 30 secondes.
import crypto from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const PAS_MS = 30_000;

export function base32(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of buf) {
    value = ((value << 8) | b) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function deBase32(s) {
  const clean = String(s || '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const c of clean) {
    value = ((value << 5) | B32.indexOf(c)) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const nouveauSecret = () => base32(crypto.randomBytes(20));

export function hotp(cle, compteur, chiffres = 6) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(compteur));
  const h = crypto.createHmac('sha1', cle).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** chiffres).padStart(chiffres, '0');
}

export const pasActuel = (maintenant = Date.now()) => Math.floor(maintenant / PAS_MS);

// Renvoie le numéro du pas de 30 s qui correspond au code (0 si refusé). On accepte le code
// précédent et le suivant (horloge du téléphone un peu décalée), jamais un pas déjà utilisé.
export function verifierCode(secret, code, { dernierPas = 0, maintenant = Date.now() } = {}) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return 0;
  const cle = deBase32(secret);
  if (cle.length < 10) return 0;
  const pas = pasActuel(maintenant);
  let trouve = 0;
  for (const d of [-1, 0, 1]) {
    const p = pas + d;
    if (p <= dernierPas) continue;
    const attendu = Buffer.from(hotp(cle, p));
    // Comparaison à temps constant, sur toutes les fenêtres
    if (crypto.timingSafeEqual(attendu, Buffer.from(c)) && !trouve) trouve = p;
  }
  return trouve;
}

// Adresse lue par l'appli d'authentification (QR code ou lien sur le téléphone)
export function lienAppli(secret, { emetteur = 'Studio Site', compte = 'Espace agence' } = {}) {
  const e = emetteur.replace(/:/g, ' ').trim() || 'Studio Site';
  const label = encodeURIComponent(`${e}:${compte}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(e)}&algorithm=SHA1&digits=6&period=30`;
}

// ---------- Codes de secours ----------
// 10 caractères sans lettres ambiguës (pas de O/0, I/1, L), présentés en deux groupes : K7PQM-3XH9T
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function codeSecours() {
  const bytes = crypto.randomBytes(10);
  let s = '';
  for (const b of bytes) s += ALPHA[b % ALPHA.length];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}
export const normaliserSecours = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
export const empreinteSecours = (s) => crypto.createHash('sha256').update('studio-site-secours:' + normaliserSecours(s)).digest('hex');
export const ressembleSecours = (s) => normaliserSecours(s).length === 10;
