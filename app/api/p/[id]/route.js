import { route, ok, fail, readBody } from '../../../../src/server/http.js';
import { getClient, updateClient } from '../../../../src/server/store.js';
import { proposalsView, studioInfo } from '../../../../src/server/public.js';
import { modelName, versionsOf, baseOf, insertVersions } from '../../../../src/engine/variants.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req, { id }) => {
  const rec = await getClient(id);
  if (!rec) return fail(404, 'Ce lien n’est plus valable. Demandez un nouveau lien à votre interlocuteur.', 'not_found');
  return ok({ client: proposalsView(rec), studio: await studioInfo() });
});

// Le client choisit un modèle (il peut changer d'avis tant que le site n'est pas en ligne)
export const POST = route(async (req, { id }) => {
  const body = await readBody(req);
  const modelId = String(body?.modelId || '');
  const comment = String(body?.comment || '').slice(0, 2000);
  let error = '';
  const rec = await updateClient(id, (r) => {
    if (!['proposed', 'chosen'].includes(r.status)) {
      error = r.status === 'live' ? 'Votre site est déjà en ligne.' : 'Les propositions ne sont pas encore prêtes.';
      return null;
    }
    // Le client peut choisir un modèle envoyé ou l'une des 4 versions de son style.
    // Les versions sont recalculées ici : le client ne peut pas inventer un modèle.
    const models = r.result?.models || [];
    let model = null;
    for (const pid of r.picked || []) {
      const p = models.find((m) => m.id === pid);
      if (!p) continue;
      if (p.id === modelId) model = p;
      else model = versionsOf(baseOf(p, models)).find((v) => v.id === modelId) || model;
      if (model) break;
    }
    if (!model) {
      error = 'Ce modèle ne fait pas partie de la sélection.';
      return null;
    }
    if (!models.some((m) => m.id === model.id)) r.result = { ...r.result, models: insertVersions(models, baseOf(model, models), [model]) };
    const at = new Date().toISOString();
    r.choice = { modelId, comment, at, by: 'client' };
    r.status = 'chosen';
    r.log = [...(r.log || []), { at, what: `Modèle choisi par le client : ${modelName(model)}` }];
    return r;
  });
  if (!rec) return fail(404, 'Ce lien n’est plus valable.', 'not_found');
  if (error) return fail(409, error, 'locked');
  return ok({ client: proposalsView(rec) });
});
