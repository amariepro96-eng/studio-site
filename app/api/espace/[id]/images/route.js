// Photo envoyée depuis l'espace client (déjà recadrée et allégée dans le navigateur).
// Elle n'entre dans le site qu'à la publication, après les contrôles habituels.
import { route, ok, fail, memeOrigine } from '../../../../../src/server/http.js';
import { getClient, updateClient, saveImage, MAX_IMAGE_BYTES } from '../../../../../src/server/store.js';
import { rateLimited } from '../../../../../src/server/config.js';
import { espaceDe, espaceActif, quiAppelle, typeImage } from '../../../../../src/server/espace.js';
import { peutModifier } from '../../../../../src/engine/espace.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req, { id }) => {
  if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
  const rec = await getClient(id);
  if (!rec || !espaceActif(rec)) return fail(404, 'Cet espace n’existe pas ou a été fermé.', 'not_found');
  const q = quiAppelle(req, rec);
  if (!q) return fail(401, 'Votre session a expiré : reconnectez-vous.', 'connexion');
  if (!peutModifier(espaceDe(rec).gestion, q.role)) return fail(403, 'Vous ne pouvez pas modifier ce site pour le moment.', 'interdit');
  if (rateLimited('espace-img:' + id, 60)) return fail(429, 'Trop de photos envoyées en peu de temps. Réessayez dans une heure.', 'rate');
  let form;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'Envoi illisible.', 'bad_request');
  }
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return fail(400, 'Aucune photo reçue.', 'bad_request');
  if (file.size > MAX_IMAGE_BYTES) return fail(413, 'Photo trop lourde (4 Mo au maximum).', 'too_big');
  const buf = Buffer.from(await file.arrayBuffer());
  // Le type vient du contenu du fichier, pas de ce qu'annonce le navigateur
  const type = typeImage(buf);
  if (!type) return fail(415, 'Format non accepté : choisissez une photo JPEG, PNG ou WebP.', 'bad_type');
  const alt = String(form.get('alt') || '').slice(0, 160);
  const img = await saveImage(id, buf, type);
  await updateClient(id, (r) => {
    const e = espaceDe(r);
    e.images = [...e.images, img.id].slice(-300);
    r.espace = e;
    return r;
  });
  return ok({ image: { id: img.id, ext: img.ext, alt } });
});
