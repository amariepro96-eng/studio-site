import { after } from 'next/server';
import { route, ok, fail, readBody, sanitizeBrief } from '../../../../src/server/http.js';
import { getClient, updateClient } from '../../../../src/server/store.js';
import { questionnaireView, studioInfo, EDITABLE } from '../../../../src/server/public.js';
import { rateLimited, clientIp } from '../../../../src/server/config.js';
import { driveStatus, envoyerVersDrive } from '../../../../src/server/drive.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Questionnaire envoyé : le brief et les photos partent ensuite vers Google Drive (sans faire attendre le client)
export const maxDuration = 300;

export const GET = route(async (req, { id }) => {
  const rec = await getClient(id);
  if (!rec) return fail(404, 'Ce lien n’est plus valable. Demandez un nouveau lien à votre interlocuteur.', 'not_found');
  return ok({ client: questionnaireView(rec), studio: await studioInfo() });
});

// Sauvegarde à chaque étape ; submit = questionnaire terminé
export const PATCH = route(async (req, { id }) => {
  if (rateLimited('q:' + clientIp(req), 300)) return fail(429, 'Trop d’enregistrements en peu de temps. Patientez quelques minutes.', 'too_many');
  const body = await readBody(req);
  let refused = false;
  let stale = false;
  const rec = await updateClient(id, (r) => {
    refused = false;
    stale = false;
    if (!EDITABLE.includes(r.status)) {
      refused = true;
      return null;
    }
    // Réponses modifiées entre-temps (par l'agence ou un autre appareil) : on n'écrase rien
    if (body?.brief && Number.isInteger(body?.briefRev) && body.briefRev !== (r.briefRev || 0)) {
      stale = true;
      return null;
    }
    if (body?.brief) {
      r.brief = sanitizeBrief(body.brief);
      r.briefRev = (r.briefRev || 0) + 1;
    }
    if (Number.isInteger(body?.qStep)) r.qStep = Math.max(r.qStep || 0, Math.min(7, body.qStep));
    if (body?.submit) {
      const first = r.status === 'sent';
      r.status = 'answered';
      r.submittedAt = new Date().toISOString();
      r.qStep = 7;
      r.log = [...(r.log || []), { at: r.submittedAt, what: first ? 'Réponses reçues du client' : 'Réponses modifiées par le client' }];
    }
    return r;
  });
  if (!rec) return fail(404, 'Ce lien n’est plus valable.', 'not_found');
  if (stale) return fail(409, 'Vos réponses ont été modifiées entre-temps, depuis un autre appareil ou par votre interlocuteur. Rechargez la page pour reprendre la dernière version.', 'stale');
  if (refused) return fail(409, 'Vos réponses ont déjà été prises en compte pour préparer vos propositions. Pour un changement, contactez votre interlocuteur.', 'locked');
  if (body?.submit && driveStatus().configured) after(() => envoyerVersDrive(id, { parClient: true }).catch((e) => console.warn('[drive]', e?.message)));
  return ok({ client: questionnaireView(rec) });
});
