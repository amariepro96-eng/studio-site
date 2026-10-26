// Orchestration de la génération : 3 demandes en parallèle à l'IA,
// puis nettoyage des réponses. Sans IA, on bascule sur les contenus de démonstration.
import { PARTS } from '../engine/prompts.js';
import { demoContent, demoConcepts, normalizeConcepts, normalizeContent, conceptsToModels } from '../engine/content.js';

export class GenerationError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const PART_LABELS = {
  concepts: 'les directions artistiques',
  core: 'les textes principaux',
  pages: 'les pages secondaires',
};

export async function generateSite(brief, runner, { onPart, signal } = {}) {
  if (!runner) {
    for (const p of PARTS) onPart?.(p, 'done');
    return {
      content: demoContent(brief),
      models: conceptsToModels(demoConcepts(brief)),
      source: 'demo',
      warnings: [],
    };
  }

  const settled = await Promise.allSettled(
    PARTS.map(async (part) => {
      onPart?.(part, 'running');
      try {
        const data = await runner(part, brief, signal);
        onPart?.(part, 'done');
        return data;
      } catch (e) {
        onPart?.(part, 'failed');
        throw e;
      }
    })
  );

  if (signal?.aborted) throw new GenerationError('Génération annulée.', 'cancelled');

  const [concepts, core, pages] = settled.map((s) => (s.status === 'fulfilled' ? s.value : null));
  const failed = settled.map((s, i) => (s.status === 'rejected' ? { part: PARTS[i], error: s.reason } : null)).filter(Boolean);

  if (failed.length === PARTS.length) {
    const first = failed[0].error;
    throw new GenerationError(first?.message || 'L’IA n’a pas répondu.', first?.code || 'failed');
  }

  const warnings = failed.map((f) => `L’IA n’a pas pu rédiger ${PART_LABELS[f.part]} : des textes génériques les remplacent. Relancez la génération pour réessayer.`);

  return {
    content: normalizeContent(core, pages, brief),
    models: conceptsToModels(normalizeConcepts(concepts, brief)),
    source: 'ai',
    warnings,
  };
}

// Appel au serveur Next.js (clé API gardée côté serveur)
export function apiRunner(base = '') {
  return async (part, brief, signal) => {
    const res = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ part, brief }),
      signal,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {}
    if (!res.ok || !json || json.error) {
      throw new GenerationError(json?.error || `Le serveur a répondu ${res.status}.`, json?.code || 'server');
    }
    return json.data;
  };
}

export function apiImages(base = '') {
  return async (keywords) => {
    const res = await fetch(`${base}/api/images?q=${encodeURIComponent(keywords.slice(0, 3).join(' '))}`);
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    return Array.isArray(json?.images) ? json.images : [];
  };
}
