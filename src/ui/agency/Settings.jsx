'use client';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { AgencyBar, Spinner } from '../Chrome.jsx';
import { StorageSetup } from './Dashboard.jsx';

const FIELDS = [
  { id: 'studioName', label: 'Nom affiché aux clients', hint: 'En haut du questionnaire et de la page de propositions.' },
  { id: 'ownerName', label: 'Votre prénom', hint: 'Signature des messages : « Alexandre prépare vos propositions ».' },
  { id: 'email', label: 'E-mail de contact', hint: 'Affiché en bas des pages client. Facultatif.' },
  { id: 'phone', label: 'Téléphone de contact', hint: 'Affiché en bas des pages client. Facultatif.' },
  { id: 'hosting', label: 'Hébergeur des sites (mentions légales)', hint: 'Repris automatiquement dans la page « Mentions légales » de chaque site. Vérifiez l’adresse sur vercel.com/legal.', long: true },
];

export default function Settings({ studioName }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState(null);
  const [pub, setPub] = useState(null);
  useEffect(() => {
    api('/api/agence/settings')
      .then((d) => {
        setS(d.settings);
        setPub(d.publication || null);
      })
      .catch((e) => setError(e.message));
    api('/api/agence/clients')
      .then((d) => setStorage(d.storage))
      .catch(() => {});
  }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNote('');
    try {
      const d = await api('/api/agence/settings', { method: 'PUT', body: { settings: s } });
      setS(d.settings);
      setPub(d.publication || null);
      setNote('Réglages enregistrés.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ss">
      <AgencyBar studioName={studioName} current="reglages" />
      <main className="page page-narrow">
        <div className="page-head">
          <div>
            <h1>Réglages</h1>
            <p className="muted">Ce que vos clients voient sur leurs pages, et ce qui remplit les mentions légales.</p>
          </div>
        </div>
        {storage === 'none' && <StorageSetup />}
        {!s && !error && <Spinner />}
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        {s && storage !== 'none' && (
          <form className="card settings" onSubmit={submit}>
            {FIELDS.map((f) => (
              <div key={f.id} className="q-field">
                <label className="q-label" htmlFor={`s-${f.id}`}>
                  {f.label}
                </label>
                <p className="q-hint">{f.hint}</p>
                {f.long ? (
                  <textarea id={`s-${f.id}`} rows={2} value={s[f.id] || ''} onChange={(e) => setS({ ...s, [f.id]: e.target.value })} />
                ) : (
                  <input id={`s-${f.id}`} type="text" value={s[f.id] || ''} onChange={(e) => setS({ ...s, [f.id]: e.target.value })} />
                )}
              </div>
            ))}
            {pub && <PublishSettings pub={pub} value={!!s.autoPublish} onChange={(v) => setS({ ...s, autoPublish: v })} />}
            <div className="form-actions">
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              {note && (
                <span className="side-note" role="status">
                  {note}
                </span>
              )}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

// Mise en ligne automatique : état des deux clés et interrupteur général
function PublishSettings({ pub, value, onChange }) {
  const key = (name) => !pub.missing.includes(name);
  return (
    <div className="q-field pub-settings">
      <span className="q-label">Mise en ligne automatique</span>
      <p className="q-hint">
        Depuis le dossier d’un client, un clic crée le dépôt privé dans l’organisation GitHub <strong>{pub.org}</strong>, crée le projet Vercel et met le site en ligne. Rien ne part sans ton clic.
      </p>
      <ul className="pub-keys">
        <li className={key('GITHUB_PUBLISH_TOKEN') ? 'is-ok' : 'is-ko'}>
          <span>
            Clé GitHub <code>GITHUB_PUBLISH_TOKEN</code> : {key('GITHUB_PUBLISH_TOKEN') ? 'présente' : 'manquante'}
          </span>
        </li>
        <li className={key('VERCEL_PUBLISH_TOKEN') ? 'is-ok' : 'is-ko'}>
          <span>
            Clé Vercel <code>VERCEL_PUBLISH_TOKEN</code> : {key('VERCEL_PUBLISH_TOKEN') ? 'présente' : 'manquante'}
          </span>
        </li>
      </ul>
      {!pub.configured && <p className="q-hint">Ajoute les clés manquantes dans Vercel › Settings › Environment Variables, puis redéploie sans le cache (document 13, §J).</p>}
      <label className="q-toggle compact">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        <span>
          <span className="q-option-title">Autoriser la mise en ligne automatique</span>
          <span className="q-option-hint">Décoche puis enregistre pour tout couper d’un coup : plus aucun dossier ne peut publier.</span>
        </span>
      </label>
    </div>
  );
}
