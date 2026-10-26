import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt, PARTS } from '../../../src/engine/prompts.js';
import { parseJsonLoose } from '../../../src/engine/util.js';
import { config, rateLimited, clientIp, cleanBrief } from '../../../src/server/config.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function fail(status, error, code) {
  return Response.json({ error, code }, { status });
}

export async function POST(req) {
  const cfg = config();
  if (!cfg.apiKey) return fail(503, 'La clé API n’est pas configurée sur le serveur (variable ANTHROPIC_API_KEY).', 'no_key');

  let body;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Requête illisible.', 'bad_request');
  }
  const part = body?.part;
  if (!PARTS.includes(part)) return fail(400, 'Partie demandée inconnue.', 'bad_request');
  const brief = cleanBrief(body?.brief);
  if (!brief.businessName.trim() || !brief.description.trim()) return fail(400, 'Le questionnaire est incomplet.', 'bad_request');

  // 3 appels par génération complète
  if (rateLimited(clientIp(req), cfg.generationsPerHour * PARTS.length)) {
    return fail(429, 'Trop de générations en peu de temps. Réessayez dans une heure.', 'rate_limited');
  }

  const prompt = buildPrompt(part, brief);
  const client = new Anthropic({ apiKey: cfg.apiKey, ...(cfg.workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': cfg.workspaceId } } : {}) });
  try {
    const msg = await client.messages.create({
      model: cfg.model,
      max_tokens: prompt.maxTokens,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    });
    const text = (msg.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const data = parseJsonLoose(text);
    return Response.json({ data });
  } catch (e) {
    const status = e?.status;
    const message = String(e?.message || '');
    if (/workspace/i.test(message)) return fail(502, 'La clé Claude n’est rattachée à aucun workspace. Recréez-la en choisissant un workspace, ou ajoutez ANTHROPIC_WORKSPACE_ID dans Vercel.', 'workspace');
    if (status === 401) return fail(502, 'La clé API a été refusée par Anthropic. Vérifiez ANTHROPIC_API_KEY.', 'auth');
    if (status === 400 && /credit|balance|billing/i.test(message)) return fail(402, 'Le crédit de votre compte API Anthropic est épuisé. Rechargez-le sur platform.claude.com (Billing).', 'credit');
    if (status === 404) return fail(502, `Le modèle « ${cfg.model} » est introuvable. Vérifiez la variable CLAUDE_MODEL.`, 'model');
    if (status === 429) return fail(429, 'Limite de l’API atteinte. Patientez une minute puis relancez.', 'rate_limited');
    if (status === 529 || status === 503) return fail(503, 'Le service IA est momentanément surchargé. Relancez dans quelques instants.', 'overloaded');
    if (/JSON/i.test(message)) return fail(502, 'La réponse de l’IA était incomplète. Relancez la génération.', 'invalid_json');
    console.error('[generate]', part, status, message);
    return fail(500, 'La génération a échoué. Relancez dans quelques instants.', 'failed');
  }
}
