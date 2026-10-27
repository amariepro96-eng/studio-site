// Fiche brief lisible (libellés du questionnaire) pour l'enregistrement dans Google Drive
import { STEPS, SECTORS, PAGES, FEATURES, GOALS } from './questions.js';
import { MOODS } from './archetypes.js';

const OPTIONS = {
  sector: SECTORS,
  pages: PAGES,
  features: FEATURES,
  goal: GOALS,
  moods: MOODS,
  siteType: [
    { id: 'vitrine', label: 'Site vitrine' },
    { id: 'boutique', label: 'Boutique en ligne' },
  ],
};

function label(list, id) {
  return list.find((o) => o.id === id)?.label || id;
}

function valeur(field, brief) {
  const v = brief[field.id];
  const list = OPTIONS[field.id];
  if (Array.isArray(v)) return v.map((x) => (list ? label(list, x) : x)).join(', ');
  if (typeof v !== 'string') return '';
  return list ? label(list, v) : v.trim();
}

/**
 * Sections et champs remplis, dans l'ordre du questionnaire.
 * extra : { photos: nombre de photos fournies, aiImages: booléen }
 */
export function ficheBrief(brief, extra = {}) {
  return STEPS.map((step) => {
    const champs = [];
    for (const f of step.fields) {
      if (f.showIf && !f.showIf(brief)) continue;
      if (f.type === 'photos') {
        champs.push({ label: 'Photos fournies', valeur: String(extra.photos || 0) });
        continue;
      }
      if (f.type === 'toggle') {
        champs.push({ label: 'Images créées par l’IA', valeur: extra.aiImages === false ? 'Non' : 'Oui' });
        continue;
      }
      const v = valeur(f, brief);
      if (v) champs.push({ label: f.label, valeur: v });
    }
    return { titre: step.title, champs };
  }).filter((s) => s.champs.length);
}
