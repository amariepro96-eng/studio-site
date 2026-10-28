import { route, ok } from '../../../../src/server/http.js';
import { listClients, getSettings, storageMode } from '../../../../src/server/store.js';
import { resumeFinances, aujourdhuiParis, facturationVide } from '../../../../src/engine/finances.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Suivi financier : synthèse calculée à partir des dossiers clients et des charges (Réglages)
export const GET = route(
  async () => {
    if (storageMode() === 'none') return ok({ storage: 'none' });
    const [clients, settings] = await Promise.all([listClients(), getSettings()]);
    const liste = clients.map((c) => ({
      id: c.id,
      nom: c.brief?.businessName || c.name || 'Client sans nom',
      formule: c.formula || '',
      statut: c.status,
      facturation: c.facturation || facturationVide(),
    }));
    const jour = aujourdhuiParis();
    return ok({ storage: storageMode(), jour, resume: resumeFinances(liste, settings.charges || [], jour), clients: liste.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')), charges: settings.charges || [] });
  },
  { agency: true }
);
