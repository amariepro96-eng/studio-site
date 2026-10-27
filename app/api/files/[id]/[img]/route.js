import { route, fail } from '../../../../../src/server/http.js';
import { readImage } from '../../../../../src/server/store.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Image d'un dossier. L'adresse contient l'identifiant secret du dossier : seuls le client
// et l'agence la connaissent. Les images ne changent jamais : cache long côté navigateur.
export const GET = route(async (req, { id, img }) => {
  const res = await readImage(id, img);
  if (!res) return fail(404, 'Image introuvable.', 'not_found');
  const body = res.stream || res.buffer;
  return new Response(body, {
    headers: {
      'Content-Type': res.contentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
