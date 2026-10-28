import { config } from '../../../src/server/config.js';
import { driveStatus } from '../../../src/server/drive.js';

export const dynamic = 'force-dynamic';

export function GET() {
  const cfg = config();
  return Response.json({ ai: Boolean(cfg.apiKey), images: Boolean(cfg.unsplashKey), aiImages: Boolean(cfg.geminiKey), drive: driveStatus().configured, model: cfg.model });
}
