import { after } from 'next/server';
import { route, ok, fail, readBody, memeOrigine, readCookie } from '../../../../src/server/http.js';
import {
  securite,
  vueSecurite,
  verifierCodeAppli,
  regenererSecours,
  deconnecterTout,
  preparerActivation,
  activer,
  noterEchec,
  bloque,
  cookieSession,
  cookieChangement,
  effacerChangement,
  lireJeton,
  doubleFacteurActif,
  prevenirTelephoneRelie,
} from '../../../../src/server/securite.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const avecCookies = (res, cookies) => {
  for (const c of cookies) res.headers.append('Set-Cookie', c);
  return res;
};
const TROP = 'Trop d’essais. Réessayez dans 15 minutes.';
const MAUVAIS = 'Code incorrect. Saisissez le code à 6 chiffres affiché maintenant dans l’appli.';

export const GET = route(async () => ok({ securite: vueSecurite(await securite({ frais: true })) }), { agency: true });

// Actions : nouveaux-codes { code }, telephone { code }, confirmer-telephone { code }, deconnecter-tout
export const POST = route(
  async (req) => {
    if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
    const body = await readBody(req);
    const action = String(body?.action || '');
    const code = String(body?.code || '');
    const sec = await securite({ frais: true });
    if (!doubleFacteurActif(sec)) return fail(409, 'La double authentification n’est pas active : reconnectez-vous pour relier votre téléphone.', 'inactif');
    if (bloque(sec)) return fail(429, TROP, 'bloque');

    // Exige le code actuel de l'appli (preuve que le téléphone est entre vos mains)
    const exigerCode = async () => {
      if (await verifierCodeAppli(code)) return null;
      const s = await noterEchec();
      return fail(bloque(s) ? 429 : 401, bloque(s) ? TROP : MAUVAIS, 'code');
    };

    if (action === 'nouveaux-codes') {
      const refus = await exigerCode();
      if (refus) return refus;
      const codes = await regenererSecours();
      return ok({ codesSecours: codes, securite: vueSecurite(await securite()) });
    }

    if (action === 'telephone') {
      const refus = await exigerCode();
      if (refus) return refus;
      const act = await preparerActivation();
      return avecCookies(ok({ qr: act.qr, lien: act.lien, secret: act.secretLisible }), [cookieChangement(act.secret)]);
    }

    if (action === 'confirmer-telephone') {
      const enAttente = lireJeton(readCookie(req, 'agence_tel'), 'c');
      if (!enAttente?.enrol) return fail(409, 'Étape expirée : recommencez le changement de téléphone.', 'etape');
      const r = await activer(enAttente.enrol, code, { premier: false });
      if (!r.ok && r.raison === 'code') {
        const s = await noterEchec();
        return fail(bloque(s) ? 429 : 401, bloque(s) ? TROP : MAUVAIS, 'code');
      }
      if (!r.ok) return fail(409, 'Changement impossible : reconnectez-vous puis recommencez.', 'etape');
      // Les autres appareils sont déconnectés ; celui-ci reçoit une session neuve
      after(() => prevenirTelephoneRelie('changé'));
      return avecCookies(ok({ securite: vueSecurite(await securite()) }), [cookieSession(r.sv), effacerChangement()]);
    }

    if (action === 'deconnecter-tout') {
      const sv = await deconnecterTout();
      return avecCookies(ok({ securite: vueSecurite(await securite()) }), [cookieSession(sv)]);
    }

    return fail(400, 'Action inconnue.', 'bad_request');
  },
  { agency: true }
);
