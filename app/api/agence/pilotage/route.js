import { route, ok } from '../../../../src/server/http.js';
import { storageMode, getSettings, getPilotage } from '../../../../src/server/store.js';
import { etatAlertes } from '../../../../src/server/alertes.js';
import { etatPilotage } from '../../../../src/server/pilotage.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// « Revérifier maintenant » : au plus une vérification forcée toutes les 10 s
let derniereForcee = 0;

export const GET = route(
  async (req) => {
    if (storageMode() === 'none') return ok({ storage: 'none', sites: [] });
    const demande = new URL(req.url).searchParams.get('force') === '1';
    const force = demande && Date.now() - derniereForcee > 10_000;
    if (force) derniereForcee = Date.now();
    const data = await etatPilotage({ force });
    const [settings, pil] = await Promise.all([getSettings(), getPilotage()]);
    return ok({ storage: storageMode(), ...data, surveillance: etatAlertes(settings, pil) });
  },
  { agency: true }
);
