'use client';
import { useState } from 'react';
import { BrandMark } from './Chrome.jsx';

export default function AgencyLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/agence-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) window.location.reload();
      else setError(json.error || 'Connexion impossible.');
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ss">
      <main className="login">
        <span className="brand">
          <BrandMark />
          {process.env.NEXT_PUBLIC_APP_NAME || 'Studio Site'}
        </span>
        <form className="card" onSubmit={submit}>
          <h1>Espace agence</h1>
          <p className="muted">Vos dossiers clients sont ici. Saisissez votre mot de passe agence.</p>
          <div className="q-field">
            <label className="q-label" htmlFor="pw">
              Mot de passe
            </label>
            <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
          </div>
          {error && <p className="q-error">{error}</p>}
          <button className="btn primary block" type="submit" disabled={busy || !password}>
            {busy ? 'Vérification…' : 'Entrer'}
          </button>
        </form>
      </main>
    </div>
  );
}
