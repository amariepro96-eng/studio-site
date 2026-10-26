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

// Erreurs qu'une nouvelle tentative ne corrigera pas
const NO_RETRY = new Set(['auth', 'credit', 'workspace', 'model', 'no_key', 'bad_request', 'cancelled', 'not_granted', 'sampling_disabled', 'refused', 'prompt_too_large', 'capability_disabled', 'capability_removed', 'session_expired', 'not_declared']);
const RETRY_DELAYS = [6000, 18000];

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener?.('abort', () => {
      clearTimeout(t);
      reject(new GenerationError('Génération annulée.', 'cancelled'));
    });
  });
}

// Relance automatique en cas d'erreur passagère (limite de débit, surcharge, réponse incomplète)
async function withRetry(fn, { signal, onRetry } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (signal?.aborted || NO_RETRY.has(e?.code) || attempt >= RETRY_DELAYS.length) throw e;
      onRetry?.(attempt + 1, e);
      await wait(RETRY_DELAYS[attempt], signal);
    }
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
        const data = await withRetry(() => runner(part, brief, signal), { signal, onRetry: () => onPart?.(part, 'retrying') });
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

  const warnings = failed.map((f) => {
    const why = f.error?.message ? ` Cause : ${String(f.error.message).replace(/\s*\.$/, '')}.` : '';
    const retry = /relancez/i.test(why) ? '' : ' Relancez la génération pour réessayer.';
    return `L’IA n’a pas pu rédiger ${PART_LABELS[f.part]} : des textes génériques les remplacent.${why}${retry}`;
  });

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
      const timeout = res.status === 504 || res.status === 408;
      throw new GenerationError(
        json?.error || (timeout ? 'Le serveur a mis trop de temps à répondre.' : `Le serveur a répondu ${res.status}.`),
        json?.code || (timeout ? 'timeout' : 'server')
      );
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
