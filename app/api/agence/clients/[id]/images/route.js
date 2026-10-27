import { route, ok, fail } from '../../../../../../src/server/http.js';
import { saveImage, updateClient } from '../../../../../../src/server/store.js';

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
    const img = await saveImage(id, Buffer.from(await file.arrayBuffer()), file.type);
    // Les images IA s'ajoutent au dossier ici même : plusieurs arrivent en parallèle
    // Une image d'un ancien lot (génération relancée entre-temps) n'est pas ajoutée
    if (kind === 'ia') {
      const batch = String(form.get('batch') || '');
      await updateClient(id, (r) => (r.imageBatch && batch !== r.imageBatch ? null : { ...r, aiImages: [...(r.aiImages || []), { id: img.id, ext: img.ext, alt }].slice(-20) }));
    }
    return ok({ image: { id: img.id, ext: img.ext, alt } });
  },
  { agency: true }
);
