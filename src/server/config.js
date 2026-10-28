// Réglages côté serveur (lus depuis les variables d'environnement Vercel)
import crypto from 'node:crypto';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';

export function config() {
  return {
    apiKey: (process.env.ANTHROPIC_API_KEY || '').trim(),
    // Nécessaire seulement si la clé Claude n'est rattachée à aucun workspace
    workspaceId: (process.env.ANTHROPIC_WORKSPACE_ID || '').trim(),
    model: (process.env.CLAUDE_MODEL || DEFAULT_MODEL).trim(),
    // Niveau d'effort de Claude (low, medium, high) ; « auto » laisse le réglage du modèle
    effort: ['low', 'medium', 'high'].includes((process.env.AI_EFFORT || 'medium').trim()) ? (process.env.AI_EFFORT || 'medium').trim() : '',
    unsplashKey: process.env.UNSPLASH_ACCESS_KEY || '',
    geminiKey: (process.env.GEMINI_API_KEY || '').trim(),
    // Modèle d'image Gemini (« Nano Banana »). Liste à jour : ai.google.dev/gemini-api/docs/image-generation
    geminiImageModel: process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1',
    imagesPerHour: Math.max(1, parseInt(process.env.IMAGES_PER_HOUR || '80', 10) || 80),
    agencyPassword: process.env.AGENCY_PASSWORD || '',
    // Enregistrement automatique dans Google Drive (script du tableau Suivi clients, document 11)
    driveUrl: (process.env.DRIVE_WEBHOOK_URL || '').trim(),
    driveSecret: (process.env.DRIVE_WEBHOOK_SECRET || '').trim(),
    // Nombre de générations complètes autorisées par visiteur et par heure
    generationsPerHour: Math.max(1, parseInt(process.env.GENERATIONS_PER_HOUR || '20', 10) || 20),
  };
}

export function agencyToken(password) {
  return crypto.createHash('sha256').update('studio-site:' + password).digest('hex');
}

// Limite simple en mémoire (protège contre les abus ; remise à zéro au redémarrage du serveur)
const hits = new Map();
export function rateLimited(ip, maxCallsPerHour) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 3600_000);
  if (list.length >= maxCallsPerHour) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

export function clientIp(req) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
}

// Ne garder que les champs attendus du questionnaire, en texte borné
const FIELDS = ['businessName', 'sector', 'sectorOther', 'city', 'description', 'siteType', 'goal', 'services', 'products', 'strengths', 'color', 'audience', 'inspirations', 'phone', 'email', 'address', 'hours', 'instagram', 'facebook', 'reviews'];
const LISTS = ['pages', 'features', 'moods'];

export function cleanBrief(raw) {
  const b = {};
  for (const k of FIELDS) b[k] = typeof raw?.[k] === 'string' ? raw[k].slice(0, k === 'description' || k === 'services' || k === 'products' ? 3000 : 600) : '';
  for (const k of LISTS) b[k] = Array.isArray(raw?.[k]) ? raw[k].filter((x) => typeof x === 'string').slice(0, 12).map((x) => x.slice(0, 40)) : [];
  if (b.siteType !== 'boutique') b.siteType = 'vitrine';
  return b;
}
