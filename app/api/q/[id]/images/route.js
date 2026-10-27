import { route, ok, fail } from '../../../../../src/server/http.js';
import { saveImage, updateClient } from '../../../../../src/server/store.js';
import { EDITABLE } from '../../../../../src/server/public.js';
import { rateLimited, clientIp } from '../../../../../src/server/config.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOADS = 40;

// Photo ou logo envoyé par le client depuis son questionnaire
export const POST = route(async (req, { id }) => {
  if (rateLimited('up:' + clientIp(req), 80)) return fail(429, 'Trop d’envois en peu de temps. Patientez quelques minutes.', 'too_many');
  // Une place est réservée avant l'envoi : des envois simultanés ne dépassent pas la limite
  let refusal = null;
  const rec = await updateClient(id, (r) => {
    refusal = null;
    if (!EDITABLE.includes(r.status)) refusal = [409, 'Le questionnaire est clos.', 'locked'];
    else if ((r.uploads || 0) >= MAX_UPLOADS) refusal = [429, 'Nombre maximum d’envois atteint pour ce questionnaire.', 'too_many'];
    if (refusal) return null;
    return { ...r, uploads: (r.uploads || 0) + 1 };
  });
  if (!rec) return fail(404, 'Ce lien n’est plus valable.', 'not_found');
  if (refusal) return fail(...refusal);
  let form;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'Envoi illisible.', 'bad_request');
  }
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return fail(400, 'Aucune image reçue.', 'bad_request');
  const alt = String(form.get('alt') || '').slice(0, 160);
  const img = await saveImage(id, Buffer.from(await file.arrayBuffer()), file.type);
  return ok({ image: { id: img.id, ext: img.ext, alt } });
});
