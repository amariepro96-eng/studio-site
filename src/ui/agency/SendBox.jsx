'use client';
// Envoi d'un lien au client : message prêt à copier, messagerie ou SMS
import { useEffect, useState } from 'react';
import { copyText } from '../api.js';

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
const isPhone = (s) => /^[+\d][\d\s.-]{7,}$/.test(String(s || '').trim());

export default function SendBox({ link, text, contact, subject, openLabel, note: pied, linkLabel = 'Lien à envoyer' }) {
  const [note, setNote] = useState('');
  const [body, setBody] = useState(text);
  useEffect(() => setBody(text), [text]);
  async function copy(what, value) {
    const ok = await copyText(value);
    setNote(ok ? `${what} copié.` : 'Copie impossible : sélectionnez le texte à la main.');
    setTimeout(() => setNote(''), 2500);
  }
  const mail = `mailto:${isEmail(contact) ? contact.trim() : ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const sms = `sms:${String(contact || '').replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(body)}`;
  return (
    <div className="sendbox">
      <div className="linkline">
        <input type="text" readOnly value={link} aria-label={linkLabel} onFocus={(e) => e.target.select()} />
        <button type="button" className="btn secondary small" onClick={() => copy('Lien', link)}>
          Copier le lien
        </button>
        {openLabel && (
          <a className="btn-text small" href={link} target="_blank" rel="noopener noreferrer">
            {openLabel}
          </a>
        )}
      </div>
      <div className="q-field">
        <label className="q-label" htmlFor="send-text">
          Message à envoyer
        </label>
        <textarea id="send-text" rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="row-actions">
        <button type="button" className="btn primary small" onClick={() => copy('Message', body)}>
          Copier le message
        </button>
        <a className="btn secondary small" href={mail}>
          Ouvrir dans ma messagerie
        </a>
        {isPhone(contact) && (
          <a className="btn secondary small" href={sms}>
            Préparer un SMS
          </a>
        )}
        {note && (
          <span className="side-note" role="status">
            {note}
          </span>
        )}
      </div>
      <p className="muted small">{pied || 'L’application n’envoie rien elle-même : copiez le message ou ouvrez votre messagerie, puis envoyez-le.'}</p>
    </div>
  );
}
