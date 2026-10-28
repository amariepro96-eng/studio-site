// Envoi d'e-mails transactionnels par Brevo. Facultatif : sans ces variables, l'application
// prépare les messages et l'agence les envoie elle-même (copier-coller ou messagerie).
//   BREVO_API_KEY    clé API Brevo (SMTP & API › API Keys)
//   EMAIL_FROM       adresse d'expédition validée dans Brevo (ex. contact@ton-domaine.fr)
//   EMAIL_FROM_NAME  nom affiché comme expéditeur (par défaut : le nom du studio dans Réglages)
import { StoreError } from './store.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const emailValide = (s) => EMAIL_RE.test(String(s || '').trim());

export function mailEnv() {
  return {
    key: (process.env.BREVO_API_KEY || '').trim(),
    from: (process.env.EMAIL_FROM || '').trim(),
    fromName: (process.env.EMAIL_FROM_NAME || '').trim(),
  };
}

export function mailStatus() {
  const e = mailEnv();
  const missing = [];
  if (!e.key) missing.push('BREVO_API_KEY');
  if (!emailValide(e.from)) missing.push('EMAIL_FROM');
  return { configured: missing.length === 0, missing, from: missing.length ? '' : e.from };
}
export const mailPret = () => mailStatus().configured;

const echap = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Version HTML simple d'un texte : paragraphes, retours à la ligne et liens cliquables
export function texteEnHtml(text) {
  const paras = String(text || '')
    .trim()
    .split(/\n{2,}/)
    .map((p) =>
      echap(p)
        .replace(/https:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#1f5e4e">${u}</a>`)
        .replace(/\n/g, '<br>')
    );
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f3f4f1"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dde1db;border-radius:12px;padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#16201c">${paras
    .map((p) => `<p style="margin:0 0 14px">${p}</p>`)
    .join('')}</div></body></html>`;
}

export async function envoyerMail({ to, toName = '', subject, text, replyTo = '', fromName = '' }) {
  const e = mailEnv();
  if (!mailPret()) throw new StoreError('Envoi d’e-mails pas branché : ajoute BREVO_API_KEY et EMAIL_FROM dans Vercel.', 'mail_off', 503);
  if (!emailValide(to)) throw new StoreError('Adresse e-mail du destinataire invalide.', 'bad_email', 400);
  const body = {
    sender: { email: e.from, name: String(fromName || e.fromName || 'Studio Site').slice(0, 70) },
    to: [{ email: String(to).trim(), ...(toName ? { name: String(toName).slice(0, 70) } : {}) }],
    subject: String(subject).slice(0, 200),
    textContent: String(text),
    htmlContent: texteEnHtml(text),
    ...(emailValide(replyTo) ? { replyTo: { email: String(replyTo).trim() } } : {}),
  };
  let r;
  try {
    r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': e.key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new StoreError('Brevo ne répond pas : l’e-mail n’est pas parti. Réessaie dans un instant.', 'mail_down', 502);
  }
  const data = await r.json().catch(() => null);
  if (r.status === 401) {
    // Brevo bloque aussi les adresses IP qu'il ne connaît pas (celles de Vercel changent)
    if (/\bIP\b/i.test(String(data?.message || ''))) throw new StoreError('Brevo bloque l’adresse du serveur : dans Brevo, Settings › Security › Authorized IPs › Deactivate blocking (document 17).', 'mail_ip', 502);
    throw new StoreError('La clé Brevo est refusée : remplace BREVO_API_KEY dans Vercel.', 'mail_auth', 502);
  }
  if (!r.ok) {
    const msg = String(data?.message || '').slice(0, 160);
    throw new StoreError(`Brevo a refusé l’e-mail (erreur ${r.status}${msg ? ' : ' + msg : ''}). Vérifie que l’adresse d’expédition est validée dans Brevo.`, 'mail_failed', 502);
  }
  return { messageId: data?.messageId || '' };
}
