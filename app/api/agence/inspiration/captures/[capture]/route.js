// Captures d'écran des sites de la bibliothèque : visibles seulement dans l'espace agence
import { isAgency, fail } from '../../../../../../src/server/http.js';
import { readCapture, captureIdValide } from '../../../../../../src/server/store.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, ctx) {
  if (!(await isAgency(req))) return fail(401, 'Session agence expirée : reconnectez-vous.', 'unauthorized');
  const { capture } = await ctx.params;
  if (!captureIdValide(capture)) return fail(400, 'Capture invalide.', 'bad_id');
  const img = await readCapture(capture).catch(() => null);
  if (!img) return fail(404, 'Capture introuvable.', 'not_found');
  // Comme tout l'espace agence : jamais gardée en cache (ordinateur partagé, captures privées)
  return new Response(img.buffer, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" },
  });
}
