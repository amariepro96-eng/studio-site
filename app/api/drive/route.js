// Enregistrement automatique dans Google Drive : le brief, les photos du client et le .zip
// partent vers le script « Automatisation dossiers clients » du tableau Suivi clients.
// L'adresse et la clé secrète du script restent côté serveur.
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { config, rateLimited, clientIp, cleanBrief, agencyToken } from '../../../src/server/config.js';
import { ficheBrief } from '../../../src/engine/fiche.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Un morceau de fichier par requête (Vercel limite le corps d'une requête à 4,5 Mo)
const MAX_MORCEAU = 3_200_000;
const MAX_MORCEAUX = 20;

function fail(status, erreur) {
  return Response.json({ ok: false, erreur }, { status });
}

function jeton(secret, identifiant) {
  return crypto.createHmac('sha256', secret).update('drive:' + identifiant).digest('hex').slice(0, 40);
}

function jetonValide(secret, identifiant, recu) {
  const attendu = Buffer.from(jeton(secret, identifiant));
  const donne = Buffer.from(String(recu || ''));
  return attendu.length === donne.length && crypto.timingSafeEqual(attendu, donne);
}

async function versDrive(cfg, payload) {
  let r;
  try {
    r = await fetch(cfg.driveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, cle: cfg.driveSecret }),
      redirect: 'follow',
      signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    throw new Error(e?.name === 'TimeoutError' ? 'Le script Google n’a pas répondu à temps.' : 'Le script Google est injoignable : vérifiez DRIVE_WEBHOOK_URL.');
  }
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      r.ok
        ? 'Réponse inattendue du script Google : vérifiez qu’il est déployé en « Application Web », accès « Tout le monde ».'
        : `Le script Google a répondu ${r.status} : vérifiez DRIVE_WEBHOOK_URL.`
    );
  }
  if (!data?.ok) throw new Error(data?.erreur || 'Le script Google a refusé la demande.');
  return data;
}

async function estAgence(cfg) {
  if (!cfg.agencyPassword) return true;
  const store = await cookies();
  return store.get('agence')?.value === agencyToken(cfg.agencyPassword);
}

export async function POST(req) {
  const cfg = config();
  if (!cfg.driveUrl || !cfg.driveSecret) return fail(404, 'L’enregistrement dans Google Drive n’est pas configuré.');
  const ip = clientIp(req);
  let body;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Requête illisible.');
  }

  try {
    if (body?.action === 'brief') {
      if (rateLimited('drive-brief:' + ip, 12)) return fail(429, 'Trop d’envois : réessayez dans une heure.');
      const brief = cleanBrief(body.brief);
      const nom = brief.businessName.trim();
      if (!nom) return fail(400, 'Le nom de l’entreprise est vide.');
      const agence = body.mode === 'agence' && (await estAgence(cfg));
      const photos = Math.max(0, Math.min(20, parseInt(body.photos, 10) || 0));
      const out = await versDrive(cfg, {
        action: 'brief',
        client: { nom, email: brief.email.trim(), telephone: brief.phone.trim() },
        statut: agence ? 'En cours (mode agence)' : 'Prospect (questionnaire)',
        source: agence ? 'Mode agence' : 'Questionnaire client',
        fiche: ficheBrief(brief, { photos, aiImages: body.brief?.aiImages !== false }),
      });
      return Response.json({
        ok: true,
        identifiant: out.identifiant,
        jeton: jeton(cfg.driveSecret, out.identifiant),
        // Le lien du dossier n'est montré qu'en mode agence
        ...(agence ? { dossier: out.dossier, fiche: out.fiche } : {}),
      });
    }

    if (body?.action === 'fichier') {
      if (rateLimited('drive-fichier:' + ip, 300)) return fail(429, 'Trop d’envois : réessayez dans une heure.');
      const identifiant = String(body.identifiant || '');
      if (!/^[a-z0-9-]{1,80}$/.test(identifiant) || !jetonValide(cfg.driveSecret, identifiant, body.jeton)) return fail(403, 'Envoi refusé.');
      const dossier = body.dossier === 'versions' ? 'versions' : body.dossier === 'photos' ? 'photos' : '';
      const total = Number(body.total);
      const index = Number(body.index);
      const data = typeof body.data === 'string' ? body.data : '';
      if (!dossier || !Number.isInteger(total) || !Number.isInteger(index) || total < 1 || total > MAX_MORCEAUX || index < 0 || index >= total) return fail(400, 'Envoi de fichier invalide.');
      if (!data || data.length > MAX_MORCEAU || !/^[A-Za-z0-9+/=]+$/.test(data)) return fail(400, 'Morceau de fichier invalide.');
      const envoi = String(body.envoi || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
      if (!envoi) return fail(400, 'Envoi de fichier invalide.');
      const nom = dossier === 'versions' ? 'auto' : String(body.nom || 'photo.jpg').replace(/[^a-z0-9._-]/gi, '').slice(0, 80) || 'photo.jpg';
      const out = await versDrive(cfg, {
        action: 'fichier',
        identifiant,
        dossier,
        nom,
        type: dossier === 'versions' ? 'application/zip' : 'image/jpeg',
        envoi,
        index,
        total,
        data,
      });
      return Response.json({ ok: true, termine: Boolean(out.termine), nom: out.nom });
    }

    return fail(400, 'Action inconnue.');
  } catch (e) {
    console.warn('[drive]', e?.message);
    return fail(502, e?.message || 'L’enregistrement dans Google Drive a échoué.');
  }
}
