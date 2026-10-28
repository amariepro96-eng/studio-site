import { route, ok, fail, readBody, memeOrigine, origine } from '../../../../src/server/http.js';
import { getSettings, getPilotage, storageMode } from '../../../../src/server/store.js';
import { etatAlertes, mailDeTest } from '../../../../src/server/alertes.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(
  async () => {
    if (storageMode() === 'none') return ok({ alertes: null });
    const [settings, pil] = await Promise.all([getSettings(), getPilotage()]);
    return ok({ alertes: etatAlertes(settings, pil) });
  },
  { agency: true }
);

// { action: 'test' } : envoie un e-mail de test à l'adresse de contact
export const POST = route(
  async (req) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    const body = await readBody(req);
    if (body?.action !== 'test') return fail(400, 'Action inconnue.', 'bad_request');
    try {
      const r = await mailDeTest(origine(req));
      return ok({ envoye: true, email: r.email });
    } catch (e) {
      if (e?.code === 'no_email') return fail(400, e.message, 'no_email');
      throw e;
    }
  },
  { agency: true }
);
