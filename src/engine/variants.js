// Plusieurs versions d'un même style : autre enchaînement de sections, autre héros,
// autre menu, autre palette. Les textes restent ceux du modèle d'origine.
import { ARCHETYPE_MAP } from './archetypes.js';
import { resolveModel } from './render.js';
import { uid } from './util.js';

// Nom affiché : « Rétro », puis « Rétro, version 2 », « Rétro, version 3 »…
export function modelName(m) {
  const base = ARCHETYPE_MAP[m?.archetype]?.name || m?.archetype || 'Modèle';
  return m?.version > 1 ? `${base}, version ${m.version}` : base;
}

const signature = (m) => {
  const r = resolveModel(m);
  return [r.variants.sections, r.variants.hero, r.variants.nav, r.paletteIndex].join('|');
};

// Jusqu'à `count` nouvelles versions du style de `m`, toutes différentes de celles déjà présentes
export function declineModel(m, models, count = 3) {
  const arch = ARCHETYPE_MAP[m.archetype];
  if (!arch) return [];
  const same = models.filter((x) => x.archetype === m.archetype);
  const taken = new Set(same.map(signature));
  const src = resolveModel(m);
  const nPal = arch.palettes.length || 1;
  const basePal = Number.isInteger(m.paletteIndex) ? m.paletteIndex : src.paletteIndex;
  const candidates = [];
  for (let s = 1; s <= 240; s++) {
    // Une version sur deux change aussi de palette, pour varier les couleurs
    const paletteIndex = (basePal + (s % 2)) % nPal;
    const cand = { ...m, seed: (Number(m.seed) || 0) + s * 7, variants: undefined, paletteIndex };
    const sig = signature(cand);
    if (taken.has(sig)) continue;
    taken.add(sig);
    candidates.push({ cand, r: resolveModel(cand) });
  }
  // Écart entre deux versions : ce qui se voit en premier (haut de page, couleurs) compte le plus
  const gap = (a, b) => (a.variants.hero !== b.variants.hero ? 4 : 0) + (a.paletteIndex !== b.paletteIndex ? 3 : 0) + (a.variants.recipe !== b.variants.recipe ? 2 : 0) + (a.variants.nav !== b.variants.nav ? 1 : 0) + (a.variants.sections !== b.variants.sections ? 1 : 0);
  // Choix glouton : chaque nouvelle version est la plus éloignée de celles déjà présentes
  const chosen = [];
  const refs = [src, ...same.filter((x) => x !== m).map(resolveModel)];
  while (chosen.length < count && candidates.length) {
    let best = 0;
    let bestScore = -1;
    candidates.forEach((c, i) => {
      const score = Math.min(...[...refs, ...chosen.map((x) => x.r)].map((o) => gap(c.r, o)));
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    chosen.push(candidates.splice(best, 1)[0]);
  }
  let version = Math.max(1, ...same.map((x) => x.version || 1));
  return chosen.map(({ cand }) => ({ ...cand, id: uid(), version: ++version, variantOf: m.variantOf || m.id }));
}

// Insère les nouvelles versions juste après le dernier modèle du même style
export function insertVersions(models, m, versions) {
  let at = -1;
  models.forEach((x, i) => {
    if (x.archetype === m.archetype) at = i;
  });
  const out = [...models];
  out.splice(at + 1, 0, ...versions);
  return out;
}

// Les 4 versions d'un style, toujours les mêmes pour un même modèle de départ
// (identifiants fixes : l'agence et le client voient exactement les mêmes versions).
export const VERSION_COUNT = 4;
const cache = new Map();
export function versionsOf(base) {
  const key = JSON.stringify([base.id, base.archetype, base.seed, base.paletteIndex, base.variants || null, base.headline || '']);
  if (cache.has(key)) return cache.get(key);
  const extra = declineModel(base, [base], VERSION_COUNT - 1).map((v, k) => ({ ...v, id: `${base.id}-v${k + 2}`, version: k + 2, variantOf: base.id }));
  const list = [base, ...extra];
  if (cache.size > 200) cache.clear();
  cache.set(key, list);
  return list;
}

// Modèle de départ d'une version (ou le modèle lui-même)
export function baseOf(m, pool) {
  if (!m?.variantOf) return m;
  return pool.find((x) => x.id === m.variantOf) || m;
}
