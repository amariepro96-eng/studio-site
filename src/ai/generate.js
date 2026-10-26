// Orchestration de la génération, en 3 étapes successives :
//   1. choix des 10 directions artistiques
//   2. rédaction des textes principaux
//   3. préparation des pages secondaires
// Chaque réponse est contrôlée ; une réponse incomplète ou en échec est redemandée.
// Avec l'IA branchée, aucun texte générique ne remplace jamais une réponse manquante.
import { PARTS } from '../engine/prompts.js';
import { validatePart } from '../engine/validate.js';
import { demoContent, demoConcepts, normalizeConcepts, normalizeContent, conceptsToModels } from '../engine/content.js';

export class GenerationError extends Error {
  constructor(message, code, part) {
    super(message);
    this.code = code;
    this.part = part;
  }
}

export const PART_LABELS = {
  concepts: 'Choix des 10 directions artistiques',
  core: 'Rédaction des textes principaux',
  pages: 'Préparation des pages secondaires',
};

// Erreurs qu'une nouvelle tentative ne corrigera pas
const NO_RETRY = new Set(['auth', 'credit', 'workspace', 'model', 'no_key', 'bad_request', 'cancelled', 'not_granted', 'sampling_disabled', 'refused', 'prompt_too_large', 'capability_disabled', 'capability_removed', 'session_expired', 'not_declared', 'too_many', 'api_400']);
const RETRY_DELAYS = [4000, 12000, 30000];

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener?.('abort', () => {
      clearTimeout(t);
      reject(new GenerationError('Génération annulée.', 'cancelled'));
    });
  });
}

// Relance automatique : limite de débit, surcharge, délai dépassé, réponse incomplète
async function withRetry(fn, { signal, onRetry } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      if (signal?.aborted || NO_RETRY.has(e?.code) || attempt >= RETRY_DELAYS.length) throw e;
      onRetry?.(attempt + 1, e);
      await wait(RETRY_DELAYS[attempt], signal);
    }
  }
}

async function runStep(part, brief, runner, { signal, onPart }) {
  onPart?.(part, 'running');
  try {
    const data = await withRetry(
      async (attempt) => {
        const out = await runner(part, brief, signal, { retry: attempt > 0 });
        const problems = validatePart(part, out, brief);
        if (problems.length) throw new GenerationError(`La réponse de l’IA était incomplète (${problems.join(' ; ')}).`, 'incomplete', part);
        return out;
      },
      { signal, onRetry: () => onPart?.(part, 'retrying') }
    );
    onPart?.(part, 'done');
    return data;
  } catch (e) {
    onPart?.(part, signal?.aborted ? 'pending' : 'failed');
    if (e instanceof GenerationError) {
      e.part = part;
      throw e;
    }
    throw new GenerationError(e?.message || 'L’IA n’a pas répondu.', e?.code || 'failed', part);
  }
}

// `done` : résultats déjà obtenus (pour reprendre à l'étape qui a échoué)
export async function generateSite(brief, runner, { onPart, signal, done = {} } = {}) {
  if (!runner) {
    for (const p of PARTS) onPart?.(p, 'done');
    return { content: demoContent(brief), models: conceptsToModels(demoConcepts(brief)), source: 'demo', warnings: [] };
  }
  const results = { ...done };
  for (const p of PARTS) if (results[p]) onPart?.(p, 'done');
  for (const part of PARTS) {
    if (results[part]) continue;
    if (signal?.aborted) throw new GenerationError('Génération annulée.', 'cancelled', part);
    try {
      results[part] = await runStep(part, brief, runner, { signal, onPart });
    } catch (e) {
      e.partial = results;
      throw e;
    }
  }
  return {
    content: normalizeContent(results.core, results.pages, brief),
    models: conceptsToModels(normalizeConcepts(results.concepts, brief)),
    source: 'ai',
    warnings: [],
  };
}

// Appel au serveur Next.js (clé API gardée côté serveur)
export function apiRunner(base = '') {
  return async (part, brief, signal, { retry = false } = {}) => {
    let res;
    try {
      res = await fetch(`${base}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part, brief, retry }),
        signal,
      });
    } catch (e) {
      if (signal?.aborted) throw new GenerationError('Génération annulée.', 'cancelled', part);
      throw new GenerationError('Connexion au serveur impossible. Vérifiez votre réseau.', 'network', part);
    }
    let json = null;
    try {
      json = await res.json();
    } catch {}
    if (!res.ok || !json || json.error) {
      const timeout = res.status === 504 || res.status === 408;
      throw new GenerationError(
        json?.error || (timeout ? 'Le serveur a mis trop de temps à répondre.' : `Le serveur a répondu ${res.status}.`),
        json?.code || (timeout ? 'timeout' : 'server'),
        part
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
