// Agent d'inspiration : un passage de travail (5 minutes au plus) sur un dossier.
// Appelé par l'agence (bouton « Relancer ») ou par l'agent lui-même pour continuer (jeton signé).
import { after } from 'next/server';
import { fail, isAgency, memeOrigine, origine } from '../../../../../src/server/http.js';
import { lireJeton } from '../../../../../src/server/securite.js';
import { validId, getClient, getInspirationIndex } from '../../../../../src/server/store.js';
import { rateLimited, clientIp, config } from '../../../../../src/server/config.js';
import { avancerInspiration, preparerInspiration, relancerAgent, inspirationDisponible, vueInspiration } from '../../../../../src/server/inspiration.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Navigateur sans écran + analyses Claude : chaque passage s'arrête de lui-même avant 5 minutes
export const maxDuration = 300;

const MOTIFS = {
  off: null,
  introuvable: [404, 'Dossier introuvable.'],
  demo: [409, 'Le client de démonstration n’a pas d’agent d’inspiration.'],
  vide: [409, 'Le brief est encore vide : l’agent a besoin au moins du nom et du métier.'],
  encours: [409, 'L’agent travaille déjà sur ce dossier : attends la fin de son passage.'],
};

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Requête illisible.', 'bad_request');
  }
  const id = body?.id;
  if (!validId(id)) return fail(400, 'Dossier invalide.', 'bad_id');
  const jeton = req.headers.get('x-studio-agent');
  // Relance interne : jeton signé avec la clé tirée du mot de passe agence (jamais sans mot de passe en ligne)
  const interne = Boolean(jeton) && Boolean(config().agencyPassword || !process.env.VERCEL) && lireJeton(jeton, 'agent')?.id === id;
  if (!interne) {
    if (!(await isAgency(req))) return fail(401, 'Session agence expirée : reconnectez-vous.', 'unauthorized');
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    if (rateLimited('inspiration:' + clientIp(req), 30)) return fail(429, 'Trop de relances : réessaie dans une heure.', 'rate');
  }
  const dispo = inspirationDisponible();
  if (!dispo.configured) return fail(503, `Agent d’inspiration indisponible : il manque ${dispo.missing.join(' et ')}.`, 'off');

  // Demande de l'agence : le dossier repart de zéro (les anciennes pistes restent visibles en attendant)
  if (!interne) {
    const res = await preparerInspiration(id, { force: true });
    const m = res.raison && MOTIFS[res.raison];
    if (m) return fail(m[0], m[1], res.raison);
  }

  const base = origine(req);
  after(async () => {
    try {
      const r = await avancerInspiration(id);
      if (r.continuer) await relancerAgent(base, id);
    } catch (e) {
      console.error('[inspiration] passage', e?.name, String(e?.message || '').slice(0, 200));
    }
  });
  const rec = await getClient(id);
  return Response.json({ ok: true, inspiration: rec ? vueInspiration(rec, await getInspirationIndex()) : null }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
