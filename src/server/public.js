// Vues publiques d'un dossier (pages ouvertes par le client avec son lien)
import { getSettings } from './store.js';
import { config } from './config.js';

export async function studioInfo() {
  const s = await getSettings();
  return { studioName: s.studioName, ownerName: s.ownerName, email: s.email, phone: s.phone };
}

export const EDITABLE = ['sent', 'answered'];
export const PROPOSED = ['proposed', 'chosen', 'live'];

export function questionnaireView(rec) {
  return {
    id: rec.id,
    status: rec.status,
    name: rec.name,
    qStep: rec.qStep || 0,
    brief: rec.brief,
    briefRev: rec.briefRev || 0,
    submittedAt: rec.submittedAt,
    editable: EDITABLE.includes(rec.status),
    proposalsReady: PROPOSED.includes(rec.status),
    aiAvailable: Boolean(config().geminiKey),
  };
}

export function proposalsView(rec) {
  if (!PROPOSED.includes(rec.status) || !rec.result) return { id: rec.id, ready: false, name: rec.brief?.businessName || rec.name };
  const byId = Object.fromEntries((rec.result.models || []).map((m) => [m.id, m]));
  const picked = (rec.picked || []).map((id) => byId[id]).filter(Boolean);
  // Modèles de départ des versions envoyées : le client parcourt les 4 versions de chaque style
  const bases = [...new Set(picked.filter((m) => m.variantOf && !rec.picked.includes(m.variantOf)).map((m) => m.variantOf))].map((id) => byId[id]).filter(Boolean);
  return {
    id: rec.id,
    ready: true,
    status: rec.status,
    name: rec.brief?.businessName || rec.name,
    message: rec.message,
    brief: rec.brief,
    content: rec.result.content,
    models: picked,
    bases,
    chosenModel: rec.choice ? byId[rec.choice.modelId] || null : null,
    aiImages: rec.aiImages || [],
    stockImages: rec.stockImages || [],
    choice: rec.choice,
    liveUrl: rec.status === 'live' ? rec.liveUrl : '',
  };
}
