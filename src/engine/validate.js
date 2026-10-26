// Contrôle de complétude des réponses de l'IA.
// Une réponse incomplète est redemandée : aucun texte générique ne la remplace.
import { ARCHETYPE_MAP } from './archetypes.js';
import { parseOfferLines } from './content.js';

const filled = (v) => typeof v === 'string' && v.trim().length > 0;
const arr = (v) => (Array.isArray(v) ? v : []);

export function validatePart(part, data, brief) {
  const p = [];
  if (!data || typeof data !== 'object') return ['la réponse est vide'];

  if (part === 'concepts') {
    const seen = new Set();
    for (const m of arr(data.models)) {
      const id = String(m?.archetype || '').toLowerCase();
      if (ARCHETYPE_MAP[id] && filled(m.headline) && filled(m.subheadline) && filled(m.why)) seen.add(id);
    }
    if (seen.size < 10) p.push(`il faut 10 directions artistiques différentes et complètes, la réponse n'en contient que ${seen.size}`);
    return p;
  }

  if (part === 'core') {
    if (!filled(data.brand?.tagline) || !filled(data.brand?.short)) p.push('la phrase de marque ou la présentation manque');
    if (arr(data.highlights).filter((h) => filled(h?.title) && filled(h?.text)).length < 3) p.push('il faut au moins 3 atouts');
    if (arr(data.services).filter((s) => filled(s?.name)).length < 1) p.push('il faut au moins un service');
    const given = parseOfferLines(brief?.services);
    if (given.length && arr(data.services).length < given.length) p.push(`il faut reprendre les ${given.length} services listés par le client`);
    if (!filled(data.about?.intro) || arr(data.about?.story).filter(filled).length < 2) p.push("l'histoire doit contenir une introduction et au moins 2 paragraphes");
    if (arr(data.about?.values).filter((v) => filled(v?.title)).length < 2) p.push('il faut au moins 2 valeurs');
    if (!filled(data.statement)) p.push('le manifeste manque');
    if (arr(data.process?.steps).filter((s) => filled(s?.title)).length < 3) p.push('il faut 3 ou 4 étapes');
    if (!filled(data.ctaBand?.title)) p.push("le titre de l'appel à l'action manque");
    if (!filled(data.seo?.title)) p.push('le titre SEO manque');
    if (arr(data.imagePrompts).filter((x) => filled(x?.prompt)).length < 8) p.push('il faut 8 descriptions de photos');
    return p;
  }

  // pages
  if (arr(data.faq).filter((f) => filled(f?.q) && filled(f?.a)).length < 4) p.push('il faut au moins 4 questions fréquentes avec leur réponse');
  if (!filled(data.contact?.title) || !filled(data.contact?.intro)) p.push('le titre ou l’introduction de la page contact manque');
  if (brief?.siteType === 'boutique') {
    const given = parseOfferLines(brief.products);
    const n = arr(data.products).filter((x) => filled(x?.name)).length;
    if (n < Math.max(1, given.length)) p.push(given.length ? `il faut reprendre les ${given.length} produits listés par le client` : 'il faut proposer des produits');
  }
  return p;
}
