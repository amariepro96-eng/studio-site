'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { AgencyBar, MiniStages, Spinner } from '../Chrome.jsx';
import { STAGES, stageOf, nextAction, timeAgo } from '../../engine/records.js';
import { SECTORS } from '../../engine/questions.js';

export const FORMULAS = ['Essentiel', 'Pro', 'Boutique', 'Zéro apport'];

const FILTERS = [
  { id: 'all', label: 'Tous', test: () => true },
  { id: 'agence', label: 'À traiter', test: (c) => stageOf(c.status).waiting === 'agence' },
  { id: 'client', label: 'Chez le client', test: (c) => stageOf(c.status).waiting === 'client' },
  { id: 'live', label: 'En ligne', test: (c) => c.status === 'live' },
];

export function StorageSetup() {
  return (
    <section className="card setup">
      <h2>Une dernière étape : brancher le stockage</h2>
      <p>Les dossiers clients, les réponses et les photos sont enregistrés dans Vercel Blob. Il faut le créer une seule fois :</p>
      <ol>
        <li>
          Sur <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>, ouvrez le projet de Studio Site, puis <strong>Storage</strong> dans le menu de gauche.
        </li>
        <li>
          <strong>Create Storage</strong> › <strong>Blob</strong> › <strong>Continue</strong>. Accès <strong>Private</strong>, région Paris si elle est proposée, puis <strong>Create a new Blob store</strong>. Laissez cochés Production et Preview, sans toucher aux options avancées.
        </li>
        <li>
          Vérifiez dans <strong>Settings</strong> › <strong>Environment Variables</strong> que <code>BLOB_READ_WRITE_TOKEN</code> apparaît pour Production.
        </li>
        <li>
          <strong>Deployments</strong> › <strong>⋯</strong> sur la première ligne › <strong>Redeploy</strong>. Quand c’est <strong>Ready</strong>, rechargez cette page (Ctrl + F5).
        </li>
      </ol>
      <p className="muted">En attendant, l’Atelier libre fonctionne comme avant, sans rien enregistrer.</p>
    </section>
  );
}

function NewClient({ onCancel, onCreated }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [formula, setFormula] = useState('');
  const [mode, setMode] = useState('send');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Indiquez le nom de l’entreprise du client.');
      document.getElementById('nc-name')?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { client } = await api('/api/agence/clients', { method: 'POST', body: { name, contact, formula, mode } });
      onCreated(client);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <form className="card new-client" onSubmit={submit} noValidate>
      <div className="new-client-head">
        <h2>Nouveau client</h2>
        <button type="button" className="btn-text small" onClick={onCancel}>
          Annuler
        </button>
      </div>
      <div className="q-grid">
        <div className="q-field half">
          <label className="q-label" htmlFor="nc-name">
            Nom de l’entreprise
          </label>
          <input id="nc-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Boulangerie Martin" autoFocus autoComplete="off" />
        </div>
        <div className="q-field half">
          <label className="q-label" htmlFor="nc-contact">
            E-mail ou téléphone du client
          </label>
          <input id="nc-contact" type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Pour lui envoyer le lien" autoComplete="off" />
        </div>
        <div className="q-field half">
          <label className="q-label" htmlFor="nc-formula">
            Formule
          </label>
          <select id="nc-formula" value={formula} onChange={(e) => setFormula(e.target.value)}>
            <option value="">Pas encore définie</option>
            {FORMULAS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="q-field">
          <legend className="q-label">Qui remplit le questionnaire ?</legend>
          <div className="q-options">
            <label className={`q-option${mode === 'send' ? ' on' : ''}`}>
              <input type="radio" name="nc-mode" checked={mode === 'send'} onChange={() => setMode('send')} />
              <span className="q-option-title">Le client, avec un lien</span>
              <span className="q-option-hint">Vous lui envoyez le lien, il répond chez lui.</span>
            </label>
            <label className={`q-option${mode === 'self' ? ' on' : ''}`}>
              <input type="radio" name="nc-mode" checked={mode === 'self'} onChange={() => setMode('self')} />
              <span className="q-option-title">Moi, avec ses infos</span>
              <span className="q-option-hint">En rendez-vous ou à partir de vos notes.</span>
            </label>
          </div>
        </fieldset>
      </div>
      {error && (
        <p className="q-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Création…' : 'Créer le dossier'}
        </button>
      </div>
    </form>
  );
}

function ClientRow({ c }) {
  const stage = stageOf(c.status);
  const sector = SECTORS.find((s) => s.id === c.sector)?.label;
  const turn = c.status === 'live' ? 'done' : stage.waiting;
  return (
    <li>
      <a className="client-row" href={`/agence/clients/${c.id}`}>
        <span className="client-name">
          <strong>{c.name}</strong>
          <span className="muted">{[sector, c.city, c.formula && `Formule ${c.formula}`].filter(Boolean).join(', ') || c.contact || 'Questionnaire pas encore rempli'}</span>
        </span>
        <span className="client-stage">
          <MiniStages status={c.status} />
          <span className="client-stage-label">{stage.label}</span>
        </span>
        <span className={`client-next turn-${turn}`}>{nextAction(c)}</span>
        <span className="client-time muted">{timeAgo(c.updatedAt)}</span>
      </a>
    </li>
  );
}

export default function Dashboard({ studioName, open }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);

  async function load() {
    setError('');
    try {
      setData(await api('/api/agence/clients'));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const clients = data?.clients || [];
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, clients.filter(f.test).length])), [clients]);
  const shown = clients.filter(FILTERS.find((f) => f.id === filter).test);
  const todo = counts.agence || 0;

  return (
    <div className="ss">
      <AgencyBar studioName={studioName} current="clients" />
      <main className="page">
        <div className="page-head">
          <div>
            <h1>Clients</h1>
            <p className="muted">
              {!data ? 'Chargement des dossiers…' : clients.length === 0 ? 'Aucun dossier pour l’instant.' : todo ? `${todo} dossier${todo > 1 ? 's attendent' : ' attend'} une action de votre part.` : 'Rien à traiter : la balle est dans le camp de vos clients.'}
            </p>
          </div>
          {data?.storage !== 'none' && !creating && (
            <button type="button" className="btn primary" onClick={() => setCreating(true)}>
              Nouveau client
            </button>
          )}
        </div>
        {open && (
          <div className="alert soft">
            <strong>L’espace agence n’a pas de mot de passe.</strong> Ajoutez la variable <code>AGENCY_PASSWORD</code> dans Vercel : les dossiers de vos clients ne doivent pas être accessibles à tous.
          </div>
        )}
        {data?.storage === 'local' && <div className="alert soft">Mode local : les dossiers sont enregistrés dans le dossier .data de votre ordinateur.</div>}
        {error && (
          <div className="alert" role="alert">
            {error}{' '}
            <button type="button" className="btn-text small" onClick={load}>
              Réessayer
            </button>
          </div>
        )}
        {data?.storage === 'none' && <StorageSetup />}
        {creating && <NewClient onCancel={() => setCreating(false)} onCreated={(c) => (window.location.href = `/agence/clients/${c.id}`)} />}
        {!data && !error && <Spinner label="Chargement des dossiers…" />}
        {data && data.storage !== 'none' && clients.length > 0 && (
          <>
            <div className="seg filters" role="group" aria-label="Filtrer les dossiers">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label} <span className="count">{counts[f.id]}</span>
                </button>
              ))}
            </div>
            {shown.length ? (
              <ul className="client-list">
                {shown.map((c) => (
                  <ClientRow key={c.id} c={c} />
                ))}
              </ul>
            ) : (
              <p className="empty">Aucun dossier dans ce filtre.</p>
            )}
          </>
        )}
        {data && data.storage !== 'none' && clients.length === 0 && !creating && (
          <section className="empty-state">
            <h2>Votre premier client commence ici</h2>
            <p>Créez son dossier : vous obtenez un lien de questionnaire à lui envoyer. Ses réponses, ses photos et vos propositions restent ensuite rangées dans ce dossier.</p>
            <ol className="how">
              {STAGES.map((s) => (
                <li key={s.id}>{s.label}</li>
              ))}
            </ol>
            <button type="button" className="btn primary" onClick={() => setCreating(true)}>
              Créer un dossier client
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
