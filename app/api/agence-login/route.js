import { after } from 'next/server';
import { config, rateLimited, clientIp } from '../../../src/server/config.js';
import { safeEqual, readCookie, memeOrigine } from '../../../src/server/http.js';
import {
  cookieSession,
  cookieEtape,
  effacerSession,
  effacerEtape,
  lireJeton,
  securite,
  doubleFacteurPossible,
  doubleFacteurActif,
  bloque,
  noterEchec,
  consommerCode,
  preparerActivation,
  activer,
  prevenirTelephoneRelie,
} from '../../../src/server/securite.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data, status = 200, cookies = []) => {
  const res = Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  for (const c of cookies) res.headers.append('Set-Cookie', c);
  return res;
};
const TROP = 'Trop d’essais. Réessayez dans 15 minutes.';

// Connexion en deux temps : { etape: 'mdp', password } puis { etape: 'code', code }
// Premier passage (aucun téléphone relié) : { etape: 'activer', code } avec le QR code affiché
export async function POST(req) {
  const { agencyPassword } = config();
  if (!agencyPassword) {
    if (!process.env.VERCEL) return json({ ok: true });
    return json({ ok: false, error: 'Aucun mot de passe agence n’est défini : ajoutez la variable AGENCY_PASSWORD dans Vercel, puis redéployez.' }, 503);
  }
  if (!memeOrigine(req)) return json({ ok: false, error: 'Requête refusée.' }, 403);
  let body = {};
  try {
    body = (await req.json()) || {};
  } catch {}
  const ip = clientIp(req);
  const etape = body.etape || 'mdp';

  try {
    if (etape === 'mdp') {
      if (rateLimited('login:' + ip, 10)) return json({ ok: false, error: 'Trop d’essais. Réessayez dans une heure.' }, 429);
      if (!safeEqual(String(body.password || ''), agencyPassword)) return json({ ok: false, error: 'Mot de passe incorrect.' }, 401);
      // Sans stockage, nulle part où ranger le secret de l'appli : en ligne, on refuse plutôt que
      // d'ouvrir avec le mot de passe seul ; en local (npm run dev), le mot de passe suffit (sv 0)
      if (!doubleFacteurPossible()) {
        if (process.env.VERCEL) return json({ ok: false, error: 'Le stockage des dossiers n’est pas branché : la connexion sécurisée ne peut pas fonctionner. Dans Vercel : Storage › Create › Blob (accès Private), relie-le au projet puis redéploie (document 10, §H).' }, 503);
        return json({ ok: true }, 200, [cookieSession(0), effacerEtape()]);
      }
      const sec = await securite({ frais: true });
      if (doubleFacteurActif(sec)) {
        if (bloque(sec)) return json({ ok: false, error: TROP }, 429);
        return json({ ok: false, suite: 'code' }, 200, [cookieEtape()]);
      }
      // Aucun téléphone relié : on prépare l'activation (secret gardé dans le cookie signé de l'étape)
      const act = await preparerActivation();
      return json({ ok: false, suite: 'activer', qr: act.qr, lien: act.lien, secret: act.secretLisible, reset: Boolean(sec?.totp?.secret) }, 200, [cookieEtape({ enrol: act.secret })]);
    }

    const pre = lireJeton(readCookie(req, 'agence_etape'), 'p');
    if (!pre) return json({ ok: false, error: 'Étape expirée : saisissez à nouveau votre mot de passe.', code: 'etape' }, 401, [effacerEtape()]);
    if (rateLimited('code:' + ip, 20)) return json({ ok: false, error: TROP }, 429);

    if (etape === 'code') {
      const r = await consommerCode(String(body.code || ''));
      if (!r.ok) {
        const sec = r.bloque ? null : await noterEchec();
        return json({ ok: false, error: r.bloque || (sec && bloque(sec)) ? TROP : 'Code incorrect. Vérifiez l’heure de votre téléphone, puis réessayez avec le code affiché maintenant.' }, r.bloque ? 429 : 401);
      }
      return json({ ok: true, secours: r.secours, restants: r.restants ?? null }, 200, [cookieSession(r.sv), effacerEtape()]);
    }

    if (etape === 'activer') {
      if (!pre.enrol) return json({ ok: false, error: 'Étape expirée : saisissez à nouveau votre mot de passe.', code: 'etape' }, 401, [effacerEtape()]);
      const sec = await securite({ frais: true });
      if (bloque(sec)) return json({ ok: false, error: TROP }, 429);
      const r = await activer(pre.enrol, String(body.code || ''), { premier: true });
      if (!r.ok && r.raison === 'code') {
        await noterEchec();
        return json({ ok: false, error: 'Code incorrect. Saisissez le code à 6 chiffres affiché maintenant dans l’appli.' }, 401);
      }
      if (!r.ok) return json({ ok: false, error: 'Un téléphone vient déjà d’être relié. Saisissez à nouveau votre mot de passe.', code: 'etape' }, 409, [effacerEtape()]);
      after(() => prevenirTelephoneRelie('relié'));
      return json({ ok: true, codesSecours: r.codes }, 200, [cookieSession(r.sv), effacerEtape()]);
    }
  } catch (e) {
    console.error('[login]', e?.name, String(e?.message || '').slice(0, 200));
    return json({ ok: false, error: 'Connexion impossible pour le moment (stockage indisponible). Réessayez dans un instant.' }, 503);
  }
  return json({ ok: false, error: 'Requête invalide.' }, 400);
}

// Déconnexion : efface les cookies de session
export async function DELETE(req) {
  if (!memeOrigine(req)) return json({ ok: false }, 403);
  return json({ ok: true }, 200, [effacerSession(), effacerEtape()]);
}
