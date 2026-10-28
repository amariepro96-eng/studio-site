import { route, ok, readBody } from '../../../../src/server/http.js';
import { getSettings, saveSettings } from '../../../../src/server/store.js';
import { publishStatus } from '../../../../src/server/publish.js';
import { driveStatus } from '../../../../src/server/drive.js';
import { mailStatus } from '../../../../src/server/mail.js';
import { ovhStatus } from '../../../../src/server/ovh.js';

// Services branchés par des variables Vercel (jamais les clés elles-mêmes)
const services = () => ({ drive: driveStatus(), mail: mailStatus(), ovh: ovhStatus() });

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(
  async () => {
    const settings = await getSettings();
    return ok({ settings, publication: publishStatus(settings), services: services() });
  },
  { agency: true }
);

export const PUT = route(
  async (req) => {
    const body = await readBody(req);
    const settings = await saveSettings(body?.settings || {});
    return ok({ settings, publication: publishStatus(settings), services: services() });
  },
  { agency: true }
);
