// Schémas JSON imposés à l'IA (sorties structurées de l'API Claude).
// Tous les champs sont obligatoires : l'IA ne peut pas en oublier.
import { ARCHETYPES } from './archetypes.js';
import { ICON_NAMES } from './icons.js';

const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const list = (items) => ({ type: 'array', items });
const iconEnum = { type: 'string', enum: ICON_NAMES };

export function schemaFor(part, brief) {
  if (part === 'concepts') {
    return obj({
      models: list(
        obj({
          archetype: { type: 'string', enum: ARCHETYPES.map((a) => a.id) },
          headline: str,
          subheadline: str,
          cta: str,
          why: str,
        })
      ),
    });
  }
  if (part === 'core') {
    const item = obj({ title: str, text: str, icon: iconEnum });
    return obj({
      brand: obj({ tagline: str, short: str }),
      highlightsTitle: str,
      highlightsIntro: str,
      highlights: list(item),
      servicesTitle: str,
      servicesIntro: str,
      services: list(obj({ name: str, description: str, price: { type: ['string', 'null'] }, icon: iconEnum })),
      about: obj({ title: str, intro: str, quote: str, story: list(str), valuesTitle: str, values: list(item) }),
      statement: str,
      process: obj({ title: str, intro: str, steps: list(obj({ title: str, text: str })) }),
      galleryTitle: str,
      ctaBand: obj({ title: str, text: str }),
      seo: obj({ title: str, description: str }),
      imageKeywords: list(str),
      imagePrompts: list(obj({ prompt: str, alt: str })),
    });
  }
  // pages
  const base = {
    faqIntro: str,
    faq: list(obj({ q: str, a: str })),
    contact: obj({ title: str, intro: str, formTitle: str }),
  };
  if (brief?.siteType === 'boutique') {
    base.productsTitle = str;
    base.productsIntro = str;
    base.products = list(
      obj({ name: str, description: str, price: { type: ['number', 'null'] }, category: str, badge: { type: ['string', 'null'] } })
    );
  }
  return obj(base);
}
