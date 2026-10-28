'use client';
// Champs de saisie de l'espace client : libellé, aide, erreur, accessibilité
import { useId } from 'react';

export function Champ({ label, aide, erreur, children, moitie = false, id: idDonne }) {
  const auto = useId();
  const id = idDonne || auto;
  const aideId = aide ? `${id}-aide` : undefined;
  const errId = erreur ? `${id}-err` : undefined;
  const props = { id, 'aria-describedby': [aideId, errId].filter(Boolean).join(' ') || undefined, 'aria-invalid': erreur ? true : undefined };
  return (
    <div className={`q-field${moitie ? ' half' : ''}${erreur ? ' has-error' : ''}`}>
      <label className="q-label" htmlFor={id}>
        {label}
      </label>
      {aide && (
        <p className="q-hint" id={aideId}>
          {aide}
        </p>
      )}
      {children(props)}
      {erreur && (
        <p className="q-error" id={errId}>
          {erreur}
        </p>
      )}
    </div>
  );
}

export function Texte({ label, aide, erreur, value, onChange, max = 120, placeholder, type = 'text', moitie, disabled, inputMode, autoComplete }) {
  return (
    <Champ label={label} aide={aide} erreur={erreur} moitie={moitie}>
      {(p) => <input {...p} type={type} value={value || ''} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} disabled={disabled} inputMode={inputMode} autoComplete={autoComplete} />}
    </Champ>
  );
}

export function Zone({ label, aide, erreur, value, onChange, max = 500, rows = 3, placeholder, disabled }) {
  return (
    <Champ label={label} aide={aide} erreur={erreur}>
      {(p) => <textarea {...p} rows={rows} value={value || ''} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} disabled={disabled} />}
    </Champ>
  );
}

export function DateChamp({ label, aide, erreur, value, onChange, min, max, moitie = true, disabled }) {
  return (
    <Champ label={label} aide={aide} erreur={erreur} moitie={moitie}>
      {(p) => <input {...p} type="date" className="esp-date" value={value || ''} min={min} max={max} onChange={(e) => onChange(e.target.value)} disabled={disabled} />}
    </Champ>
  );
}

// Choix exclusif présenté en boutons (statut d'un produit, type de demande…)
export function Choix({ legende, options, value, onChange, disabled, name }) {
  const auto = useId();
  const nom = name || auto;
  return (
    <fieldset className="esp-choix" disabled={disabled}>
      <legend className="q-label">{legende}</legend>
      <div className="esp-choix-liste">
        {options.map((o) => (
          <label key={o.id} className={value === o.id ? 'on' : ''}>
            <input type="radio" name={nom} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Interrupteur({ label, aide, checked, onChange, disabled, cache = false }) {
  const id = useId();
  return (
    <label className={`esp-switch${disabled ? ' disabled' : ''}`} htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="esp-switch-piste" aria-hidden="true" />
      <span className={`esp-switch-txt${cache ? ' sr-only' : ''}`}>
        <span>{label}</span>
        {aide && <small>{aide}</small>}
      </span>
    </label>
  );
}

// Bouton qui demande une confirmation sur place (sans boîte de dialogue du navigateur)
export function Confirmer({ label, question, oui = 'Confirmer', onConfirm, className = 'btn-text small', disabled, ouvert, setOuvert }) {
  if (!ouvert)
    return (
      <button type="button" className={className} onClick={() => setOuvert(true)} disabled={disabled}>
        {label}
      </button>
    );
  return (
    <span className="esp-confirm" role="group" aria-label={question}>
      <span>{question}</span>
      <button
        type="button"
        className="btn small danger-solid"
        onClick={() => {
          setOuvert(false);
          onConfirm();
        }}
      >
        {oui}
      </button>
      <button type="button" className="btn-text small" onClick={() => setOuvert(false)}>
        Annuler
      </button>
    </span>
  );
}

export const fmtJour = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
export const fmtQuand = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');
export const fmtEuros = (n) => Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
