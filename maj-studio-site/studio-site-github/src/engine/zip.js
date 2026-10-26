// Export du site final en archive .zip prête à mettre en ligne
import JSZip from 'jszip';
import { renderPage, allPageSlugs } from './render.js';
import { ARCHETYPE_MAP } from './archetypes.js';
import { slugify } from './util.js';

export function readme(brief, model) {
  const arch = ARCHETYPE_MAP[model.archetype];
  return `SITE ${brief.businessName || ''}
Modèle : ${arch?.name || model.archetype}

CONTENU DU DOSSIER
- index.html : page d'accueil
- les autres fichiers .html : une page chacun
Tout est autonome : il n'y a rien à installer.

METTRE LE SITE EN LIGNE GRATUITEMENT (5 minutes)
1. Dézippez ce dossier sur votre ordinateur.
2. Ouvrez https://app.netlify.com/drop dans votre navigateur.
3. Faites glisser le dossier dézippé dans la zone indiquée.
4. Netlify vous donne une adresse du type https://nom-au-hasard.netlify.app : votre site est en ligne.
5. Créez un compte Netlify gratuit pour garder le site et le relier à votre nom de domaine.

AVANT LA MISE EN LIGNE
- Complétez la page « Mentions légales » (les passages entre crochets).
- Vérifiez les textes, les prix et les horaires.
- Formulaires : ils ouvrent la messagerie du visiteur avec le message prêt à envoyer à ${brief.email || 'votre adresse e-mail'}.
${brief.siteType === 'boutique' ? '- Boutique : les commandes arrivent par e-mail ; le paiement en ligne n’est pas encore branché.\n' : ''}`;
}

export async function buildZip({ brief, content, model, images }) {
  const zip = new JSZip();
  const folder = zip.folder(slugify(brief.businessName || 'mon-site'));
  for (const slug of allPageSlugs(brief, content)) {
    folder.file(`${slug}.html`, renderPage(slug, { brief, content, model, images, mode: 'export' }));
  }
  for (const img of images || []) {
    if (img?.blob && img.file) folder.file(img.file, img.blob);
  }
  folder.file('LISEZ-MOI.txt', readme(brief, model));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export function zipName(brief) {
  return `${slugify(brief.businessName || 'mon-site')}-site.zip`;
}
