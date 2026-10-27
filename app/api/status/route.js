import { config } from '../../../src/server/config.js';

export const dynamic = 'force-dynamic';

export function GET() {
  const cfg = config();
  return Response.json({ ai: Boolean(cfg.apiKey), images: Boolean(cfg.unsplashKey), aiImages: Boolean(cfg.geminiKey), model: cfg.model });
}
