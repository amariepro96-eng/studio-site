import Anthropic from '@anthropic-ai/sdk';
import { isAgency } from '../../../src/server/http.js';
import { buildPrompt, PARTS } from '../../../src/engine/prompts.js';
import { schemaFor } from '../../../src/engine/schemas.js';
import { validatePart } from '../../../src/engine/validate.js';
import { parseJsonLoose } from '../../../src/engine/util.js';
import { config, rateLimited, clientIp, cleanBrief } from '../../../src/server/config.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Laisse à Claude le temps de réfléchir (maximum de l'offre gratuite Vercel : 5 minutes)
export const maxDuration = 300;

function fail(status, error, code) {
  return Response.json({ error, code }, { status });
}

class StepError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function textOf(msg) {
  return (msg.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

// Un appel à Claude, avec format JSON imposé. Si le modèle choisi ne prend pas en charge
// le format imposé ou le niveau d'effort, on recommence sans eux (JSON demandé dans la consigne).
async function ask(client, cfg, prompt, schema, extra = '') {
  const messages = [{ role: 'user', content: prompt.user + extra }];
  const base = { model: cfg.model, max_tokens: prompt.maxTokens, system: prompt.system, messages };
  const structured = { ...base, output_config: { format: { type: 'json_schema', schema }, ...(cfg.effort ? { effort: cfg.effort } : {}) } };
  let msg;
  try {
    msg = await client.messages.create(structured);
  } catch (e) {
    if (e?.status === 400 && /output_config|json_schema|schema|effort|format/i.test(String(e?.message))) {
      console.warn('[generate] format imposé refusé, nouvel essai sans :', String(e.message).slice(0, 200));
      msg = await client.messages.create(base);
    } else {
      throw e;
    }
  }
  if (msg.stop_reason === 'refusal') throw new StepError('Claude a refusé cette demande. Reformulez la description de l’activité.', 'refused');
  if (msg.stop_reason === 'max_tokens') throw new StepError('La réponse de l’IA a été coupée.', 'truncated');
  try {
    return parseJsonLoose(textOf(msg));
  } catch {
    throw new StepError('La réponse de l’IA était illisible.', 'invalid_json');
  }
}

export async function POST(req) {
  if (!isAgency(req)) return fail(401, 'Session agence expirée : reconnectez-vous.', 'unauthorized');
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

  // Une génération complète commence toujours par les directions artistiques
  if (part === 'concepts' && !body?.retry && rateLimited(clientIp(req), cfg.generationsPerHour)) {
    return fail(429, 'Trop de générations en peu de temps. Réessayez dans une heure.', 'too_many');
  }

  const prompt = buildPrompt(part, brief);
  const schema = schemaFor(part, brief);
  const client = new Anthropic({
    apiKey: cfg.apiKey,
    maxRetries: 3,
    timeout: 280_000,
    ...(cfg.workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': cfg.workspaceId } } : {}),
  });

  try {
    // Jusqu'à 2 essais : le second précise ce qui manquait au premier
    let data = null;
    let problems = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const extra = problems.length
        ? `\n\nAttention : ta réponse précédente n'était pas complète (${problems.join(' ; ')}). Fournis une réponse complète qui respecte toutes les consignes.`
        : '';
      try {
        data = await ask(client, cfg, prompt, schema, extra);
      } catch (e) {
        if (e instanceof StepError && (e.code === 'truncated' || e.code === 'invalid_json') && attempt === 0) {
          problems = [e.code === 'truncated' ? 'elle était trop longue et a été coupée, sois plus concis' : "elle n'était pas un JSON valide"];
          continue;
        }
        throw e;
      }
      problems = validatePart(part, data, brief);
      if (!problems.length) return Response.json({ data });
      console.warn('[generate]', part, 'réponse incomplète :', problems.join(' ; '));
    }
    return fail(422, `La réponse de l’IA était incomplète (${problems.join(' ; ')}).`, 'incomplete');
  } catch (e) {
    const status = e?.status;
    const message = String(e?.message || '');
    // Trace complète dans les journaux Vercel (onglet Logs)
    console.error('[generate]', part, status || e?.code || '-', message.slice(0, 400));
    if (e instanceof StepError) return fail(502, e.message, e.code);
    if (/workspace/i.test(message)) return fail(502, 'La clé Claude n’est rattachée à aucun workspace. Recréez-la en choisissant un workspace, ou ajoutez ANTHROPIC_WORKSPACE_ID dans Vercel.', 'workspace');
    if (status === 401 || status === 403) return fail(502, 'La clé API a été refusée par Anthropic. Vérifiez ANTHROPIC_API_KEY.', 'auth');
    if (status === 400 && /credit|balance|billing/i.test(message)) return fail(402, 'Le crédit API du mois est épuisé. Il revient au prochain renouvellement, ou rechargez sur platform.claude.com (Billing).', 'credit');
    if (status === 404) return fail(502, `Le modèle « ${cfg.model} » est introuvable. Vérifiez la variable CLAUDE_MODEL.`, 'model');
    if (status === 429) return fail(429, 'Limite de débit de l’API atteinte.', 'rate_limited');
    if (status === 529 || status === 503 || status === 500) return fail(503, 'Le service IA est momentanément surchargé.', 'overloaded');
    if (/timed? ?out|timeout/i.test(message)) return fail(504, 'L’IA a mis trop de temps à répondre.', 'timeout');
    if (status === 400) return fail(502, `Requête refusée par l’API : ${message.slice(0, 160)}`, 'api_400');
    return fail(500, 'La génération a échoué.', 'failed');
  }
}
