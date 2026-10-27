import { route, ok, readBody } from '../../../../src/server/http.js';
import { getSettings, saveSettings } from '../../../../src/server/store.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => ok({ settings: await getSettings() }), { agency: true });

export const PUT = route(
  async (req) => {
    const body = await readBody(req);
    return ok({ settings: await saveSettings(body?.settings || {}) });
  },
  { agency: true }
);
