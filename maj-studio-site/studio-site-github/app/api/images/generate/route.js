import { config, rateLimited, clientIp } from '../../../../src/server/config.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Consignes ajoutées à chaque description pour obtenir une photo exploitable sur un site
const STYLE =
  'Photorealistic photograph for a small business website. Natural light, true-to-life colors, professional composition. No text, no letters, no signage, no logos, no watermark, no borders.';

const RATIOS = ['1:1', '3:4', '4:3', '4:5', '5:4', '2:3', '3:2', '16:9', '9:16', '21:9'];

function fail(status, error, code) {
  return Response.json({ error, code }, { status });
}

// Trouve l'image dans la réponse de l'API Gemini (generateContent)
function extractImage(json) {
  for (const cand of json?.candidates || []) {
    for (const part of cand?.content?.parts || []) {
      const inline = part.inlineData || part.inline_data;
      if (inline?.data) return { data: inline.data, mime: inline.mimeType || inline.mime_type || 'image/png' };
    }
  }
  return null;
}

export async function POST(req) {
  const cfg = config();
  if (!cfg.geminiKey) return fail(503, 'La génération d’images n’est pas configurée (variable GEMINI_API_KEY).', 'no_key');

  let prompt = '';
  let ratio = '4:3';
  try {
    const body = await req.json();
    prompt = String(body?.prompt || '').slice(0, 600).trim();
    if (RATIOS.includes(body?.ratio)) ratio = body.ratio;
  } catch {}
  if (!prompt) return fail(400, 'Description d’image manquante.', 'bad_request');

  if (rateLimited('img:' + clientIp(req), cfg.imagesPerHour)) {
    return fail(429, 'Trop d’images créées en peu de temps. Réessayez dans une heure.', 'rate_limited');
  }

  const body = {
    contents: [{ role: 'user', parts: [{ text: `${prompt}\n\n${STYLE}` }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: ratio },
    },
  };

  let lastStatus = 0;
  let lastMessage = '';
  // v1beta d'abord, puis v1 (Google fait évoluer les versions de l'API)
  for (const version of ['v1beta', 'v1']) {
    try {
      const res = await fetch(`${process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com'}/${version}/models/${encodeURIComponent(cfg.geminiImageModel)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.geminiKey },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        const img = extractImage(json);
        if (img) return Response.json(img);
        const reason = json?.candidates?.[0]?.finishReason || json?.promptFeedback?.blockReason || '';
        return fail(422, `L’IA n’a pas renvoyé d’image${reason ? ` (${reason})` : ''}. Modifiez la description ou relancez.`, 'no_image');
      }
      lastStatus = res.status;
      lastMessage = json?.error?.message || '';
      if (res.status !== 404) break;
    } catch (e) {
      lastMessage = String(e?.message || '');
    }
  }

  console.error('[images/generate]', lastStatus, lastMessage);
  if (lastStatus === 400 && /api key/i.test(lastMessage)) return fail(502, 'La clé Gemini a été refusée. Vérifiez GEMINI_API_KEY.', 'auth');
  if (lastStatus === 401 || lastStatus === 403) return fail(502, 'La clé Gemini a été refusée ou n’a pas accès à ce modèle. Vérifiez GEMINI_API_KEY.', 'auth');
  if (lastStatus === 404) return fail(502, `Le modèle d’image « ${cfg.geminiImageModel} » est introuvable. Vérifiez GEMINI_IMAGE_MODEL.`, 'model');
  if (lastStatus === 429) return fail(429, 'Quota Gemini atteint. Patientez un peu ou vérifiez la facturation de votre projet Google.', 'rate_limited');
  return fail(502, 'La création de l’image a échoué. Relancez dans quelques instants.', 'failed');
}
