import { route, ok, readBody, fail } from '../../../../src/server/http.js';
import { createClient, listClients, storageMode } from '../../../../src/server/store.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Résumé de chaque dossier pour le tableau de bord
function summary(r) {
  return {
    id: r.id,
    name: r.brief?.businessName || r.name || 'Client sans nom',
    contact: r.contact,
    formula: r.formula,
    status: r.status,
    qStep: r.qStep || 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    sector: r.brief?.sector || '',
    city: r.brief?.city || '',
    picked: (r.picked || []).length,
    chosen: Boolean(r.choice),
    liveUrl: r.liveUrl || '',
  };
}

export const GET = route(
  async () => {
    if (storageMode() === 'none') return ok({ storage: 'none', clients: [] });
    const clients = await listClients();
    return ok({ storage: storageMode(), clients: clients.map(summary) });
  },
  { agency: true }
);

export const POST = route(
  async (req) => {
    const body = await readBody(req);
    const name = String(body?.name || '').trim();
    if (!name) return fail(400, 'Indiquez le nom du client.', 'bad_request');
    const rec = await createClient({ name, contact: body?.contact, formula: body?.formula, mode: body?.mode === 'self' ? 'self' : 'send' });
    return ok({ client: rec });
  },
  { agency: true }
);
