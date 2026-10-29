'use client';
// Connexion à l'espace agence : mot de passe, puis code à 6 chiffres de l'appli d'authentification.
// Premier passage : on relie le téléphone (QR code), puis on note les codes de secours.
import { useEffect, useRef, useState } from 'react';
import { BrandMark } from './Chrome.jsx';
import { copyText } from './api.js';

async function appel(body) {
  try {
    const res = await fetch('/api/agence-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json };
  } catch {
    return { ok: false, error: 'Connexion impossible. Vérifiez votre réseau.' };
  }
}

export function CodeSecours({ codes, onDone, titre = 'Vos codes de secours', bouton = 'J’ai noté mes codes, continuer' }) {
  const [copie, setCopie] = useState(false);
  const [noted, setNoted] = useState(false);
  return (
    <div className="secours">
      <h2>{titre}</h2>
      <p className="muted small">
        Si vous perdez votre téléphone, chacun de ces codes remplace <strong>une fois</strong> le code de l’appli. Notez-les sur papier ou dans votre gestionnaire de mots de passe : ils ne seront plus jamais affichés.
      </p>
      <ol className="secours-list">
        {codes.map((c) => (
          <li key={c}>
            <code>{c}</code>
          </li>
        ))}
      </ol>
      <div className="row-actions">
        <button
          type="button"
          className="btn secondary small"
          onClick={() =>
            copyText(codes.join('\n')).then((ok) => {
              setCopie(ok);
            })
          }
        >
          {copie ? 'Copiés' : 'Copier les codes'}
        </button>
      </div>
      <label className="q-toggle compact secours-ok">
        <input type="checkbox" checked={noted} onChange={(e) => setNoted(e.target.checked)} />
        <span>
          <span className="q-option-title">Je les ai notés en lieu sûr</span>
        </span>
      </label>
      <button type="button" className="btn primary block" disabled={!noted} onClick={onDone}>
        {bouton}
      </button>
    </div>
  );
}

export function ReliePhone({ qr, lien, secret, intro }) {
  const [voirCle, setVoirCle] = useState(false);
  return (
    <div className="relier">
      {intro}
      <ol className="relier-etapes">
        <li>
          Installez <strong>Google Authenticator</strong> (ou Microsoft Authenticator) sur votre téléphone.
        </li>
        <li>
          Dans l’appli, touchez <strong>+</strong> puis <strong>Scanner un code QR</strong>, et visez ce code :
        </li>
      </ol>
      <div className="relier-qr">
        <img src={qr} width={200} height={200} alt="Code QR à scanner avec l’appli d’authentification" />
      </div>
      <p className="small relier-mobile">
        Vous êtes sur le téléphone lui-même ?{' '}
        <a href={lien} className="btn-text small">
          Ajouter dans l’appli
        </a>{' '}
        ou{' '}
        <button type="button" className="btn-text small" onClick={() => setVoirCle((v) => !v)}>
          saisir la clé à la main
        </button>
      </p>
      {voirCle && (
        <p className="relier-cle">
          <span className="muted small">Clé de configuration (type : basé sur l’heure)</span>
          <code>{secret}</code>
        </p>
      )}
    </div>
  );
}

export default function AgencyLogin() {
  const [etape, setEtape] = useState('mdp');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [modeSecours, setModeSecours] = useState(false);
  const [activation, setActivation] = useState(null);
  const [codes, setCodes] = useState(null);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    if (etape === 'code' || etape === 'activer') codeRef.current?.focus();
  }, [etape, modeSecours]);

  const recommencer = (msg) => {
    setEtape('mdp');
    setCode('');
    setActivation(null);
    setModeSecours(false);
    setError(msg || '');
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (etape === 'mdp') {
        const r = await appel({ etape: 'mdp', password });
        if (r.ok) return window.location.reload();
        if (r.suite === 'code') {
          setPassword('');
          setEtape('code');
        } else if (r.suite === 'activer') {
          setPassword('');
          setActivation(r);
          setEtape('activer');
        } else setError(r.error || 'Connexion impossible.');
        return undefined;
      }
      const r = await appel({ etape: etape === 'activer' ? 'activer' : 'code', code });
      if (r.code === 'etape') return recommencer(r.error);
      if (!r.ok) {
        setError(r.error || 'Code refusé.');
        setCode('');
        return undefined;
      }
      if (r.codesSecours?.length) {
        setCodes(r.codesSecours);
        setEtape('secours');
        return undefined;
      }
      if (r.secours) {
        setInfo(r.restants > 0 ? `Code de secours accepté. Il vous en reste ${r.restants}. Pensez à en générer de nouveaux dans Réglages › Sécurité.` : 'Code de secours accepté. C’était le dernier : générez-en de nouveaux tout de suite dans Réglages › Sécurité.');
        setEtape('info');
        return undefined;
      }
      return window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  const codeOk = modeSecours ? code.replace(/[^A-Za-z0-9]/g, '').length === 10 : /^\d{6}$/.test(code);

  return (
    <div className="ss">
      <main className="login">
        <span className="brand">
          <BrandMark />
          {process.env.NEXT_PUBLIC_APP_NAME || 'Studio Site'}
        </span>

        {etape === 'secours' && codes && (
          <div className="card login-card">
            <p className="login-ok">Téléphone relié. La double authentification est active.</p>
            <CodeSecours codes={codes} onDone={() => window.location.reload()} />
          </div>
        )}

        {etape === 'info' && (
          <div className="card login-card">
            <h1>Connecté</h1>
            <p className="note small">{info}</p>
            <button type="button" className="btn primary block" onClick={() => window.location.reload()}>
              Continuer
            </button>
          </div>
        )}

        {['mdp', 'code', 'activer'].includes(etape) && (
          <form className="card login-card" onSubmit={submit} noValidate>
            {etape === 'mdp' && (
              <>
                <h1>Espace agence</h1>
                <p className="muted">Vos dossiers clients et le contrôle de vos sites sont ici. Saisissez votre mot de passe agence.</p>
                <div className="q-field">
                  <label className="q-label" htmlFor="pw">
                    Mot de passe
                  </label>
                  <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
                </div>
              </>
            )}

            {etape === 'code' && (
              <>
                <p className="login-step">Étape 2 sur 2</p>
                <h1>{modeSecours ? 'Code de secours' : 'Code de vérification'}</h1>
                <p className="muted">{modeSecours ? 'Saisissez un de vos codes de secours (10 caractères). Il ne servira qu’une fois.' : 'Ouvrez Google Authenticator sur votre téléphone et saisissez le code à 6 chiffres affiché pour Studio Site.'}</p>
                <div className="q-field">
                  <label className="q-label" htmlFor="code">
                    {modeSecours ? 'Code de secours' : 'Code à 6 chiffres'}
                  </label>
                  <input
                    id="code"
                    ref={codeRef}
                    className={modeSecours ? 'code-input secours-input' : 'code-input'}
                    type="text"
                    inputMode={modeSecours ? 'text' : 'numeric'}
                    autoComplete="one-time-code"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={modeSecours ? 11 : 6}
                    placeholder={modeSecours ? 'K7PQM-3XH9T' : '123456'}
                    value={code}
                    onChange={(e) => setCode(modeSecours ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </>
            )}

            {etape === 'activer' && activation && (
              <>
                <p className="login-step">Une seule fois : reliez votre téléphone</p>
                <h1>Double authentification</h1>
                <ReliePhone
                  qr={activation.qr}
                  lien={activation.lien}
                  secret={activation.secret}
                  intro={
                    <p className="muted small">
                      {activation.reset
                        ? 'La réinitialisation demandée dans Vercel est prise en compte : reliez votre nouveau téléphone. L’ancien ne marchera plus.'
                        : 'Désormais, l’entrée demandera votre mot de passe et un code à 6 chiffres affiché par votre téléphone. Même si votre mot de passe fuit, personne n’entre sans lui.'}
                    </p>
                  }
                />
                <div className="q-field">
                  <label className="q-label" htmlFor="code">
                    3. Saisissez le code à 6 chiffres affiché par l’appli
                  </label>
                  <input id="code" ref={codeRef} className="code-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                </div>
              </>
            )}

            {error && (
              <p className="q-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn primary block" type="submit" disabled={busy || (etape === 'mdp' ? !password : !codeOk)}>
              {busy ? 'Vérification…' : etape === 'mdp' ? 'Continuer' : etape === 'activer' ? 'Relier ce téléphone' : 'Entrer'}
            </button>
            {etape === 'code' && (
              <div className="login-links">
                <button
                  type="button"
                  className="btn-text small"
                  onClick={() => {
                    setModeSecours((m) => !m);
                    setCode('');
                    setError('');
                  }}
                >
                  {modeSecours ? 'Utiliser le code de l’appli' : 'Téléphone indisponible ? Code de secours'}
                </button>
                <button type="button" className="btn-text small quiet" onClick={() => recommencer('')}>
                  Retour
                </button>
              </div>
            )}
            {etape === 'activer' && (
              <div className="login-links">
                <button type="button" className="btn-text small quiet" onClick={() => recommencer('')}>
                  Retour
                </button>
              </div>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
