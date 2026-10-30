// Téléchargement de la facture au format Factur-X (PDF lisible + XML réglementaire embarqué).
// Session obligatoire. Seulement pour une facture émise (ou payée).
import { route, fail } from '../../../../src/server/http.js';
import { getClient } from '../../../../src/server/store.js';
import { lireSession } from '../../../../src/server/devisAcces.js';
import { pdfFacturX } from '../../../../src/server/facturxPdf.js';
import { themeDossier } from '../../../../src/server/factureTheme.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const GET = route(async (req) => {
  const s = await lireSession(req);
  if (!s) return fail(401, 'Session expirée : reconnectez-vous.', 'unauthorized');
  const id = new URL(req.url).searchParams.get('id');
  const f = (s.esp.factures || []).find((x) => x.id === id);
  if (!f || !['emise', 'payee'].includes(f.statut)) return fail(404, 'Facture émise introuvable.', 'not_found');
  // Couleurs du site du client (modèle choisi), si disponibles
  let theme = null;
  try {
    if (s.esp.clientId) {
      const rec = await getClient(s.esp.clientId);
      if (rec) theme = themeDossier(rec);
    }
  } catch {}
  const bytes = await pdfFacturX(f, theme);
  const nom = `Facture-${String(f.numero || '').replace(/[^\w-]/g, '')}-facturx.pdf`;
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nom}"`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
});
