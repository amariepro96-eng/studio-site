'use client';
// Bac à sable de l'atelier : un client de démo (site + espace prêts) pour tester les
// fonctionnalités directement, comme sur un vrai dossier.
import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function BacASable() {
  const [demo, setDemo] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    api('/api/agence/atelier').then((d) => setDemo(d.demo)).catch(() => setDemo(null));
  }, []);
  async function act(action) {
    setBusy(true);
    setErr('');
    try {
      const d = await api('/api/agence/atelier', { method: 'POST', body: { action } });
      setDemo(d.demo);
      if (action === 'creer' && d.demo) window.location.assign(`/agence/clients/${d.demo}`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (demo === undefined) return null;
  return (
    <div className="bac-sable">
      <div className="bac-sable-txt">
        <strong>Bac à sable</strong> — un client de démo (site + espace prêts) pour tester les fonctionnalités comme sur un vrai dossier : active l’appli Devis, le calculateur, la variante « Modifier son site », etc.
      </div>
      <div className="bac-sable-actions">
        {demo ? (
          <>
            <a className="btn primary small" href={`/agence/clients/${demo}`}>
              Ouvrir le client de démo
            </a>
            <button type="button" className="btn secondary small" disabled={busy} onClick={() => act('creer')}>
              {busy ? '…' : 'Remettre à neuf'}
            </button>
            <button type="button" className="btn-text small danger" disabled={busy} onClick={() => act('supprimer')}>
              Supprimer
            </button>
          </>
        ) : (
          <button type="button" className="btn primary small" disabled={busy} onClick={() => act('creer')}>
            {busy ? 'Création…' : 'Créer un client de démo'}
          </button>
        )}
      </div>
      {err && (
        <p className="q-error" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
