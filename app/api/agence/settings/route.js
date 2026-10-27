import { route, ok, readBody } from '../../../../src/server/http.js';
import { getSettings, saveSettings } from '../../../../src/server/store.js';
import { publishStatus } from '../../../../src/server/publish.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(
  async () => {
    const settings = await getSettings();
    return ok({ settings, publication: publishStatus(settings) });
  },
  { agency: true }
);

export const PUT = route(
  async (req) => {
    const body = await readBody(req);
    const settings = await saveSettings(body?.settings || {});
    return ok({ settings, publication: publishStatus(settings) });
  },
  { agency: true }
);
