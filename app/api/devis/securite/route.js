// Appli Devis & Factures : sécurité du compte (session ouverte). Mot de passe, codes de secours,
// changement de téléphone, appareils.
import { route, fail, readBody, memeOrigine } from '../../../../src/server/http.js';
import { updateDevisEspace } from '../../../../src/server/store.js';
import { rateLimited, clientIp } from '../../../../src/server/config.js';
import {
  lireSession,
  exigerSession,
  lireEtape,
  cookieEtape,
  effacerEtape,
  cookieSession,
  effacerSession,
  verifierMdp,
  hacherMdp,
  problemeMdp,
  consommerCode,
  enregistrerTelephone,
  regenererSecours,
  preparerTelephone,
  ajouterAppareil,
  noterEchec,
  ajouterEchec,
  bloque,
  MSG_BLOQUE,
  noterJournal,
} from '../../../../src/server/devisAcces.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reponse(data, cookies = []) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  for (const c of cookies) if (c) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(data), { headers });
}
const MSG_CODE = 'Code incorrect. Saisissez le code affiché maintenant dans Google Authenticator.';

// Vérifie le code de l'appli (sans code de secours) dans une mise à jour ; fn applique le changement
async function avecCode(s, code, fn, { secoursPermis = false } = {}) {
  let res = { ok: false };
  let bloq = false;
  // Contrôle du code et enregistrement de l'erreur dans la même écriture
  const esp = await updateDevisEspace(s.w, (e) => {
    res = { ok: false };
    bloq = false;
    if (bloque(e)) {
      bloq = true;
      return null;
    }
    res = consommerCode(e, code, { secoursPermis });
    if (res.ok && res.secours) noterJournal(e, `Code de secours utilisé (reste ${res.restants})`);
    if (!res.ok) {
      ajouterEchec(e);
      return e;
    }
    res.extra = fn(e);
    return e;
  });
  if (bloq) throw Object.assign(new Error(MSG_BLOQUE), { http: 429 });
  if (!res.ok) throw Object.assign(new Error(MSG_CODE), { http: 401 });
  return { esp, extra: res.extra };
}

export const POST = route(async (req) => {
  if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
  const s = exigerSession(await lireSession(req));
  if (rateLimited('devis-sec:' + clientIp(req), 60)) return fail(429, 'Trop d’essais : réessayez dans une heure.', 'rate');
  const body = await readBody(req);
  const action = String(body?.action || '');
  const ua = req.headers.get('user-agent') || '';
  try {
    switch (action) {
      case 'mdp': {
        if (!(await verifierMdp(body.ancien, s.esp.compte.mdp))) {
          await noterEchec(s.w);
          return fail(401, 'Mot de passe actuel incorrect.', 'mdp');
        }
        const pb = problemeMdp(body.nouveau, s.esp.compte.email);
        if (pb) return fail(400, pb, 'mdp');
        const mdp = await hacherMdp(body.nouveau);
        let app = null;
        const { esp } = await avecCode(s, body.code, (e) => {
          e.compte.mdp = mdp;
          e.compte.mdpChangeLe = new Date().toISOString();
          e.sv = (e.sv || 1) + 1;
          e.appareils = [];
          noterJournal(e, 'Mot de passe changé : les autres appareils sont déconnectés');
          app = ajouterAppareil(e, ua);
        });
        return reponse({ ok: true, note: 'Mot de passe changé. Vos autres appareils sont déconnectés.' }, [await cookieSession(s.w, app.id, esp.sv)]);
      }

      case 'secours': {
        const { extra } = await avecCode(s, body.code, (e) => {
          noterJournal(e, 'Nouveaux codes de secours');
          return regenererSecours(e);
        });
        return reponse({ ok: true, codes: extra });
      }

      // Changement de téléphone : code de l'ancien, puis code du nouveau
      // Téléphone perdu : un code de secours permet de relier le nouveau
      case 'telephone.preparer': {
        await avecCode(s, body.code, () => true, { secoursPermis: true });
        const tel = await preparerTelephone(s.esp);
        return reponse({ ok: true, telephone: { qr: tel.qr, lien: tel.lien, secret: tel.secretLisible } }, [await cookieEtape({ t: 'tel', w: s.w, enrol: tel.secret })]);
      }
      case 'telephone.activer': {
        const et = await lireEtape(req, ['tel']);
        if (!et?.enrol || et.w !== s.w) return fail(401, 'Étape expirée : recommencez.', 'etape');
        let res = { ok: false };
        let app = null;
        const esp = await updateDevisEspace(s.w, (e) => {
          res = enregistrerTelephone(e, et.enrol, body.code, { premier: false });
          if (!res.ok) return null;
          noterJournal(e, 'Téléphone changé : les autres appareils sont déconnectés');
          app = ajouterAppareil(e, ua);
          return e;
        });
        if (!res.ok) return fail(401, 'Code incorrect : saisissez le code affiché par le nouveau téléphone.', 'code');
        return reponse({ ok: true, note: 'Nouveau téléphone relié. L’ancien ne donne plus de code valable.' }, [await cookieSession(s.w, app.id, esp.sv), effacerEtape()]);
      }

      case 'deconnecter': {
        const id = String(body.appareil || '');
        const esp = await updateDevisEspace(s.w, (e) => {
          const a = (e.appareils || []).find((x) => x.id === id);
          if (!a) return null;
          e.appareils = e.appareils.filter((x) => x.id !== id);
          noterJournal(e, `Appareil retiré : ${a.nom}`);
          return e;
        });
        return reponse({ ok: true, moi: id === s.appareil.id, note: 'Appareil déconnecté.' }, id === s.appareil.id ? [effacerSession()] : []);
      }
      case 'deconnecterAutres': {
        let app = null;
        const esp = await updateDevisEspace(s.w, (e) => {
          e.sv = (e.sv || 1) + 1;
          app = { ...s.appareil, vuLe: new Date().toISOString() };
          e.appareils = [app];
          noterJournal(e, 'Tous les autres appareils ont été déconnectés');
          return e;
        });
        return reponse({ ok: true, note: 'Les autres appareils sont déconnectés.' }, [await cookieSession(s.w, app.id, esp.sv)]);
      }
      default:
        return fail(400, 'Action inconnue.', 'bad_request');
    }
  } catch (e) {
    if (e?.http) return fail(e.http, e.message, e.http === 429 ? 'bloque' : 'code');
    throw e;
  }
});
