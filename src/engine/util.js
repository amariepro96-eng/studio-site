// Petits utilitaires partagés (navigateur + serveur)

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function hashString(str) {
  let h = 2166136261;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Générateur pseudo-aléatoire reproductible (même graine = même résultat)
export function rng(seed) {
  let a = (typeof seed === 'number' ? seed : hashString(seed)) >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(list, rand) {
  if (!list || !list.length) return undefined;
  return list[Math.floor(rand() * list.length) % list.length];
}

export function slugify(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'site';
}

export function lines(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function clampText(str, max) {
  const s = String(str ?? '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '') + '…';
}

export function formatPrice(price) {
  if (price === null || price === undefined || price === '') return '';
  if (typeof price === 'number' && isFinite(price)) {
    return price.toLocaleString('fr-FR', { minimumFractionDigits: price % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €';
  }
  const s = String(price).trim();
  if (/^\d+([.,]\d+)?$/.test(s)) return formatPrice(parseFloat(s.replace(',', '.')));
  return s;
}

export function priceNumber(price) {
  if (typeof price === 'number') return price;
  const m = String(price ?? '').replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

let uidCounter = 0;
export function uid() {
  uidCounter += 1;
  return 'm' + Date.now().toString(36) + uidCounter.toString(36) + Math.random().toString(36).slice(2, 6);
}

// Lecture tolérante d'une réponse JSON (texte brut, bloc ``` ou du premier { au dernier })
export function parseJsonLoose(text) {
  const t = String(text ?? '').trim();
  try {
    return JSON.parse(t);
  } catch {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {}
  }
  const first = t.search(/[\[{]/);
  const last = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(t.slice(first, last + 1));
    } catch {}
  }
  throw new Error('Réponse IA illisible (JSON invalide)');
}
