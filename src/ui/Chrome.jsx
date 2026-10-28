'use client';
// Éléments communs : marque, barre agence, chemin de fer des étapes, cadre des pages client
import { STAGES, stageIndex } from '../engine/records.js';

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export function AgencyBar({ studioName = 'Studio Site', current = 'clients' }) {
  const links = [
    ['pilotage', '/pilotage', 'Pilotage'],
    ['clients', '/agence', 'Clients'],
    ['atelier', '/agence/atelier', 'Atelier libre'],
    ['reglages', '/agence/reglages', 'Réglages'],
  ];
  async function logout() {
    try {
      await fetch('/api/agence-login', { method: 'DELETE' });
    } catch {}
    window.location.href = current === 'pilotage' ? '/pilotage' : '/agence';
  }
  return (
    <header className="app-header">
      <a className="brand" href="/agence">
        <BrandMark />
        <span className="brand-name">{studioName}</span>
      </a>
      <nav className="app-nav" aria-label="Espace agence">
        {links.map(([id, href, label]) => (
          <a key={id} href={href} data-nav={id} aria-current={current === id ? 'page' : undefined}>
            {label}
          </a>
        ))}
      </nav>
      <button type="button" className="btn-text small quiet" onClick={logout}>
        Se déconnecter
      </button>
    </header>
  );
}

// Les 6 étapes d'un dossier. `turn` indique qui doit agir sur l'étape en cours.
export function StageStrip({ status }) {
  const cur = stageIndex(status);
  return (
    <ol className="milestones" aria-label="Avancement du dossier">
      {STAGES.map((s, i) => {
        const state = i < cur || status === 'live' ? 'done' : i === cur ? 'current' : 'todo';
        const turn = state === 'current' ? s.waiting : null;
        return (
          <li key={s.id} className={`milestone ${state}`} data-turn={turn || undefined} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="ms-bar" aria-hidden="true" />
            <span className="ms-num" aria-hidden="true">
              {state === 'done' ? '✓' : i + 1}
            </span>
            <span className="ms-label">{s.label}</span>
            {turn && <span className="ms-turn">{turn === 'agence' ? 'À vous' : 'Chez le client'}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function MiniStages({ status }) {
  const cur = stageIndex(status);
  const turn = STAGES[cur]?.waiting;
  return (
    <span className="mini-stages" aria-hidden="true" data-turn={status === 'live' ? 'done' : turn || undefined}>
      {STAGES.map((s, i) => (
        <i key={s.id} className={i < cur || status === 'live' ? 'done' : i === cur ? 'current' : ''} />
      ))}
    </span>
  );
}

// Cadre des pages ouvertes par le client
export function ClientShell({ studio, children, aside }) {
  const name = studio?.studioName || 'Studio Site';
  return (
    <div className="ss ss-public">
      <header className="public-header">
        <span className="brand">
          <BrandMark />
          {name}
        </span>
      </header>
      <main className="public-main">{children}</main>
      <footer className="public-footer">
        {aside}
        <p>
          Une question ? {studio?.ownerName || 'Votre interlocuteur'}
          {studio?.phone ? (
            <>
              {' '}
              au <a href={`tel:${studio.phone.replace(/[^\d+]/g, '')}`}>{studio.phone}</a>
            </>
          ) : null}
          {studio?.email ? (
            <>
              {studio?.phone ? ' ou ' : ' : '}
              <a href={`mailto:${studio.email}`}>{studio.email}</a>
            </>
          ) : null}
          {!studio?.phone && !studio?.email ? ' vous répond par le moyen habituel.' : '.'}
        </p>
      </footer>
    </div>
  );
}

export function Spinner({ label = 'Chargement…' }) {
  return (
    <div className="loading" role="status">
      <span className="gen-dot" aria-hidden="true" />
      {label}
    </div>
  );
}
