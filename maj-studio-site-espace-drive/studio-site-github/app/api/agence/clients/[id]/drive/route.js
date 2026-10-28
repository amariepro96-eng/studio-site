// Google Drive, vu du dossier (espace agence uniquement) : état du rangement, et envoi de ce qui manque
import { route, ok, fail, memeOrigine } from '../../../../../../src/server/http.js';
import { getClient } from '../../../../../../src/server/store.js';
import { rateLimited, clientIp } from '../../../../../../src/server/config.js';
import { driveStatus, envoyerVersDrive, vueDrive } from '../../../../../../src/server/drive.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Photos et .zip partent en plusieurs morceaux : le script Google répond en quelques secondes chacun
export const maxDuration = 300;

export const GET = route(
  async (req, { id }) => {
    const rec = await getClient(id);
    if (!rec) return fail(404, 'Dossier introuvable.', 'not_found');
    return ok({ status: driveStatus(), drive: vueDrive(rec) });
  },
  { agency: true }
);

export const POST = route(
  async (req, { id }) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    if (rateLimited('drive-agence:' + clientIp(req), 60)) return fail(429, 'Trop d’envois : réessaie dans une heure.', 'rate');
    const res = await envoyerVersDrive(id, { site: true });
    if (res.raison === 'off') return fail(503, `Google Drive pas branché : il manque ${driveStatus().missing.join(' et ')} dans Vercel.`, 'drive_off');
    if (res.raison === 'introuvable') return fail(404, 'Dossier introuvable.', 'not_found');
    if (res.raison === 'vide') return fail(409, 'Le brief est encore vide : rien à envoyer.', 'empty');
    if (res.raison === 'occupe') return fail(409, 'Un envoi vers Drive est déjà en cours : réessaie dans quelques minutes.', 'busy');
    return ok({ client: res.client, drive: vueDrive(res.client), bilan: res.bilan, erreur: res.erreur });
  },
  { agency: true }
);
