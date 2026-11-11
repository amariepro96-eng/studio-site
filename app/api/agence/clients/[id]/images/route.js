import { route, ok, fail } from '../../../../../../src/server/http.js';
import { saveImage, updateClient } from '../../../../../../src/server/store.js';
import { infoImageIa, dimensions } from '../../../../../../src/server/photosIa.js';
import { ROLES } from '../../../../../../src/engine/placement.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Image envoyée par l'agence : photo, logo ou image créée par l'IA
export const POST = route(
  async (req, { id }) => {
    let form;
    try {
      form = await req.formData();
    } catch {
      return fail(400, 'Envoi illisible.', 'bad_request');
    }
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return fail(400, 'Aucune image reçue.', 'bad_request');
    const kind = String(form.get('kind') || 'photo');
    const alt = String(form.get('alt') || '').slice(0, 200);
    const buffer = Buffer.from(await file.arrayBuffer());
    const img = await saveImage(id, buffer, file.type);
    // Rôle de l'image IA (vue d'ensemble, geste, produit…) : sert à la placer au bon endroit du site
    const role = ROLES.includes(String(form.get('role') || '')) ? String(form.get('role')) : '';
    const dim = role ? dimensions(buffer) : null;
    // Les images IA s'ajoutent au dossier ici même : plusieurs arrivent en parallèle
    // Une image d'un ancien lot (génération relancée entre-temps) n'est pas ajoutée
    if (kind === 'ia') {
      const batch = String(form.get('batch') || '');
      await updateClient(id, (r) => {
        if (r.imageBatch && batch !== r.imageBatch) return null;
        r.aiImages = [...(r.aiImages || []), { id: img.id, ext: img.ext, alt }].slice(-20);
        if (role) infoImageIa(r, img, { role, buffer });
        return r;
      });
    }
    return ok({ image: { id: img.id, ext: img.ext, alt, ...(role ? { role, ...(dim || {}) } : {}) } });
  },
  { agency: true }
);
