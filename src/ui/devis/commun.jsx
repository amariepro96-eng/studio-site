'use client';
// Éléments communs de l'appli Devis & Factures
import { useEffect, useState } from 'react';
import { copyText } from '../api.js';
import { STATUTS_DEVIS, STATUTS_FACTURE, euros, lireEuros, versSaisie, dateLongue } from '../../engine/devis.js';

export async function appelAcces(body) {
  try {
    const res = await fetch('/api/devis/acces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json };
  } catch {
    return { status: 0, error: 'Connexion impossible. Vérifiez votre réseau, puis réessayez.' };
  }
}

export function Marque({ nom = '', titre = 'Devis & Factures' }) {
  return (
    <span className="dv-marque">
      <img src="/icons/devis-180.png" alt="" width={30} height={30} />
      <span className="dv-marque-texte">
        <strong>{titre}</strong>
        {nom && <span>{nom}</span>}
      </span>
    </span>
  );
}

export function Pastille({ statut, type = 'devis' }) {
  const s = (type === 'devis' ? STATUTS_DEVIS : STATUTS_FACTURE)[statut] || { label: statut, ton: 'neutre' };
  return <span className={`dv-pastille ton-${s.ton}`}>{s.label}</span>;
}

export const fmtJour = (jour) => (jour ? dateLongue(String(jour).slice(0, 10)) : '');
export const fmtQuand = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

// Saisie d'un montant en euros (centimes en sortie)
export function ChampEuros({ id, value, onChange, label = 'Montant', negatif = false, suffixe = '€ HT', ...rest }) {
  const [txt, setTxt] = useState(() => (value ? versSaisieSigne(value) : ''));
  const [faux, setFaux] = useState(false);
  useEffect(() => {
    const cur = lire(txt, negatif);
    if (cur !== value) setTxt(value ? versSaisieSigne(value) : '');
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className="euro-input">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={txt}
        aria-invalid={faux || undefined}
        placeholder="0"
        onChange={(e) => {
          setTxt(e.target.value);
          const v = lire(e.target.value, negatif);
          setFaux(v === null);
          if (v !== null) onChange(v);
        }}
        {...rest}
      />
      <span aria-hidden="true">{suffixe}</span>
    </span>
  );
}
function versSaisieSigne(c) {
  return c < 0 ? '-' + versSaisie(-c) : versSaisie(c);
}
function lire(t, negatif) {
  const s = String(t || '').trim();
  if (negatif && /^[-−]/.test(s)) {
    const v = lireEuros(s.replace(/^[-−]\s*/, ''));
    return v === null ? null : -v;
  }
  return lireEuros(s);
}

// Fenêtre de dialogue simple (bas de l'écran sur téléphone)
export function Fenetre({ titre, onClose, children, large = false }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', k);
      document.body.style.overflow = avant;
    };
  }, [onClose]);
  return (
    <div className="dv-voile" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dv-fenetre${large === 'xl' ? ' xl' : large ? ' large' : ''}`} role="dialog" aria-modal="true" aria-label={titre}>
        <div className="dv-fenetre-tete">
          <h2>{titre}</h2>
          <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="dv-fenetre-corps">{children}</div>
      </div>
    </div>
  );
}

export function ChampMdp({ id, value, onChange, label, autoComplete = 'current-password', aide }) {
  const [voir, setVoir] = useState(false);
  return (
    <div className="q-field">
      <label className="q-label" htmlFor={id}>
        {label}
      </label>
      {aide && <p className="q-hint">{aide}</p>}
      <span className="dv-mdp">
        <input id={id} type={voir ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} spellCheck={false} autoCapitalize="none" />
        <button type="button" className="btn-text small" onClick={() => setVoir((v) => !v)} aria-pressed={voir}>
          {voir ? 'Masquer' : 'Afficher'}
        </button>
      </span>
    </div>
  );
}

export function ChampCode({ id = 'code', value, onChange, secours = false, label, autoFocus = true }) {
  return (
    <div className="q-field">
      <label className="q-label" htmlFor={id}>
        {label || (secours ? 'Code de secours' : 'Code à 6 chiffres')}
      </label>
      <input
        id={id}
        className={secours ? 'code-input secours-input' : 'code-input'}
        type="text"
        inputMode={secours ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        autoFocus={autoFocus}
        maxLength={secours ? 11 : 6}
        placeholder={secours ? 'K7PQM-3XH9T' : '123456'}
        value={value}
        onChange={(e) => onChange(secours ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))}
      />
    </div>
  );
}
export const codeComplet = (c, secours) => (secours ? c.replace(/[^A-Za-z0-9]/g, '').length === 10 : /^\d{6}$/.test(c));

// Lien personnel créé pour le client (montré une seule fois) : copier, partager, messagerie
export function LienCree({ lien, sujet, texte, email }) {
  const [copie, setCopie] = useState('');
  const partager = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <div className="dv-lien">
      <p className="note small">Lien personnel du client, montré une seule fois. Il remplace les liens envoyés avant.</p>
      <div className="linkline">
        <input type="text" readOnly value={lien} aria-label="Lien à envoyer" onFocus={(e) => e.target.select()} />
        <button type="button" className="btn secondary small" onClick={() => copyText(lien).then((ok) => setCopie(ok ? 'Lien copié.' : 'Copie impossible : sélectionnez le lien.'))}>
          Copier le lien
        </button>
      </div>
      <div className="row-actions">
        {partager && (
          <button type="button" className="btn primary small" onClick={() => navigator.share({ title: sujet, text: texte, url: lien }).catch(() => {})}>
            Partager (SMS, WhatsApp…)
          </button>
        )}
        <a className="btn secondary small" href={`mailto:${email || ''}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(`${texte}\n\n${lien}`)}`}>
          Ouvrir dans ma messagerie
        </a>
      </div>
      {copie && (
        <p className="side-note" role="status">
          {copie}
        </p>
      )}
    </div>
  );
}

export { euros };
