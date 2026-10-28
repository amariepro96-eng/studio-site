import { after } from 'next/server';
import { route, ok, readBody, fail, sanitizeBrief } from '../../../../../src/server/http.js';
import { getClient, updateClient, deleteClient, STATUSES, validId, getSettings } from '../../../../../src/server/store.js';
import { STAGES } from '../../../../../src/engine/records.js';
import { driveStatus, envoyerVersDrive } from '../../../../../src/server/drive.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Génération enregistrée : le brief et les photos partent ensuite vers Google Drive
export const maxDuration = 300;

const TEXT = { name: 120, contact: 200, formula: 60, message: 4000, liveUrl: 300 };

function cleanResult(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.models) || !r.content) return null;
  return { content: r.content, models: r.models.slice(0, 60), source: r.source === 'ai' ? 'ai' : 'demo', warnings: Array.isArray(r.warnings) ? r.warnings.slice(0, 5) : [] };
}

export const GET = route(
  async (req, { id }) => {
    const rec = await getClient(id);
    if (!rec) return fail(404, 'Dossier introuvable.', 'not_found');
    return ok({ client: rec, settings: await getSettings() });
  },
  { agency: true }
);

// Modification par l'agence : { set: {...}, log: 'texte' }
export const PATCH = route(
  async (req, { id }) => {
    const body = await readBody(req);
    const set = body?.set || {};
    let stale = false;
    const rec = await updateClient(id, (r) => {
      // Brief ouvert avant une modification du client : on ne l'écrase pas
      if (set.brief && Number.isInteger(body?.briefRev) && body.briefRev !== (r.briefRev || 0)) {
        stale = true;
        return null;
      }
      stale = false;
      for (const [k, max] of Object.entries(TEXT)) if (typeof set[k] === 'string') r[k] = set[k].slice(0, max);
      // Adresse du site : uniquement http(s), « https:// » ajouté si oublié
      if (typeof set.liveUrl === 'string') r.liveUrl = !set.liveUrl.trim() ? '' : /^https?:\/\//i.test(set.liveUrl.trim()) ? set.liveUrl.trim().slice(0, 300) : 'https://' + set.liveUrl.trim().replace(/^[a-z]+:\/*/i, '').slice(0, 290);
      if (set.brief) {
        r.brief = sanitizeBrief(set.brief);
        r.briefRev = (r.briefRev || 0) + 1;
      }
      if (typeof set.imageBatch === 'string') r.imageBatch = set.imageBatch.slice(0, 40);
      if (set.status && STATUSES.includes(set.status)) r.status = set.status;
      if (Number.isInteger(set.qStep)) r.qStep = Math.max(0, Math.min(7, set.qStep));
      if ('result' in set) {
        const clean = set.result === null ? null : cleanResult(set.result);
        // Les textes du site ne changent qu'à une nouvelle génération : une modification du modèle
        // (variante, palette) ne doit pas effacer ce que le client a changé depuis son espace
        if (clean && r.result?.content && set.status !== 'generated') clean.content = r.result.content;
        r.result = set.result === null ? null : clean || r.result;
      }
      if (Array.isArray(set.aiImages)) r.aiImages = set.aiImages.filter((x) => validId(x?.id)).map((x) => ({ id: x.id, ext: ['png', 'webp'].includes(x.ext) ? x.ext : 'jpg', alt: String(x.alt || '').slice(0, 200), ...(x.reel ? { reel: true } : {}) })).slice(0, 20);
      if (Array.isArray(set.stockImages)) r.stockImages = set.stockImages.filter((x) => typeof x?.url === 'string' && /^https:\/\//.test(x.url)).slice(0, 12);
      if (Array.isArray(set.picked)) r.picked = set.picked.filter((x) => typeof x === 'string').slice(0, 5);
      if ('choice' in set) r.choice = set.choice && typeof set.choice.modelId === 'string' ? { modelId: set.choice.modelId, comment: String(set.choice.comment || '').slice(0, 2000), at: set.choice.at || new Date().toISOString(), by: set.choice.by === 'agence' ? 'agence' : 'client' } : null;
      if (set.checks && typeof set.checks === 'object') r.checks = Object.fromEntries(Object.entries(set.checks).filter(([, v]) => typeof v === 'boolean'));
      if (set.status === 'proposed') r.proposedAt = new Date().toISOString();
      if (set.status === 'live') r.liveAt = new Date().toISOString();
      if (set.status === 'answered' && !r.submittedAt) r.submittedAt = new Date().toISOString();
      const what = typeof body?.log === 'string' ? body.log.slice(0, 200) : set.status ? STAGES.find((s) => s.id === set.status)?.label : '';
      if (what) r.log = [...(r.log || []), { at: new Date().toISOString(), what }];
      return r;
    });
    if (!rec) return fail(404, 'Dossier introuvable.', 'not_found');
    if (stale) return fail(409, 'Le client a modifié ses réponses pendant que vous éditiez le brief. Rechargez la page pour repartir de sa dernière version.', 'stale');
    if (set.status === 'generated' && driveStatus().configured) after(() => envoyerVersDrive(id).catch((e) => console.warn('[drive]', e?.message)));
    return ok({ client: rec });
  },
  { agency: true }
);

export const DELETE = route(
  async (req, { id }) => {
    await deleteClient(id);
    return ok({ ok: true });
  },
  { agency: true }
);
