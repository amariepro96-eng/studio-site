// Les 4 versions d'un style : la version 1 est le modèle généré, les versions 2 à 4 sont ses
// déclinaisons (flavors.js) : autres polices, couleurs, formes, haut de page et sections.
// Les textes restent ceux du modèle d'origine.
import { ARCHETYPE_MAP } from './archetypes.js';
import { FLAVORS, BASE_LABELS, flavorOf } from './flavors.js';

export const VERSION_COUNT = 4;

// Nom affiché : « Rétro », « Rétro, diner américain »…
export function modelName(m) {
  const base = ARCHETYPE_MAP[m?.archetype]?.name || m?.archetype || 'Modèle';
  const fl = m?.flavor ? flavorOf(m.archetype, m.flavor) : null;
  if (fl) return `${base}, ${fl.name}`;
  return m?.version > 1 ? `${base}, version ${m.version}` : base;
}

// Nom court de la version, pour les onglets de « Voir en grand »
export function versionLabel(m, index = 0) {
  const fl = m?.flavor ? flavorOf(m.archetype, m.flavor) : null;
  if (fl) return fl.label;
  if (!m?.version || m.version === 1) return BASE_LABELS[m?.archetype] || 'Original';
  return `Version ${index + 1}`;
}

// Les 4 versions d'un style, toujours identiques pour un même modèle de départ
// (identifiants fixes : l'agence et le client voient exactement les mêmes versions).
export function versionsOf(base) {
  const fls = FLAVORS[base.archetype] || [];
  const extra = fls.slice(0, VERSION_COUNT - 1).map((f, k) => ({
    ...base,
    id: `${base.id}-f${k + 2}`,
    version: k + 2,
    variantOf: base.id,
    flavor: f.id,
    seed: 0,
    paletteIndex: 0,
    variants: undefined,
  }));
  return [base, ...extra];
}

// Modèle de départ d'une version (ou le modèle lui-même)
export function baseOf(m, pool) {
  if (!m?.variantOf) return m;
  return pool.find((x) => x.id === m.variantOf) || m;
}

// Insère des versions juste après le dernier modèle du même style
export function insertVersions(models, m, versions) {
  let at = -1;
  models.forEach((x, i) => {
    if (x.archetype === m.archetype) at = i;
  });
  const out = [...models];
  out.splice(at + 1, 0, ...versions);
  return out;
}
