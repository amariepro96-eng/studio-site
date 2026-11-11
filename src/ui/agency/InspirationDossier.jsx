'use client';
// Inspiration, vue du dossier : où en est l'agent, les pistes pour ce client et les sites analysés
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { STATUTS_INSPIRATION, labelFonctionnalite, nomArchetype, dejaDansLeBrief } from '../../engine/inspiration.js';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');
export const SOURCES = { actuel: 'Son site actuel', client: 'Cité par le client', metier: 'Même métier' };
export const vignette = (s) => (s?.vignette ? `/api/agence/inspiration/captures/${s.vignette}?v=${encodeURIComponent(s.visiteLe || '')}` : '');

export default function InspirationDossier({ rec }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [toutes, setToutes] = useState(false);

  const charger = useCallback(
    () =>
      api(`/api/agence/inspiration?dossier=${rec.id}`)
        .then((d) => {
          setData(d);
          return d;
        })
        .catch((e) => setErr(e.message)),
    [rec.id]
  );
  useEffect(() => {
    charger();
  }, [charger, rec.status]);
  // Tant que l'agent travaille, on regarde où il en est toutes les 8 secondes
  const enCours = Boolean(data?.inspiration?.enCours);
  useEffect(() => {
    if (!enCours) return undefined;
    const t = setInterval(charger, 8000);
    return () => clearInterval(t);
  }, [enCours, charger]);

  async function lancer() {
    setBusy(true);
    setErr('');
    try {
      const d = await api('/api/agence/inspiration/agent', { method: 'POST', body: { id: rec.id } });
      setData((x) => ({ ...(x || {}), inspiration: d.inspiration }));
      setTimeout(charger, 3000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !err) return null;
  const insp = data?.inspiration;
  const p = insp?.pistes;
  const brief = rec.brief || {};
  const dispo = data?.disponible?.configured !== false;

  return (
    <section className="card side-card insp-card">
      <h2>Inspiration</h2>
      {!dispo && <p className="muted small">Agent indisponible : il manque {data.disponible.missing.join(' et ')}.</p>}

      {dispo && !insp && (
        <>
          <p className="muted small">
            {String(brief.businessName || '').trim()
              ? 'L’agent n’a pas encore cherché de sites pour ce client. Il part tout seul quand le questionnaire arrive.'
              : 'L’agent partira quand le questionnaire sera rempli.'}
          </p>
          {String(brief.businessName || '').trim() && (
            <button type="button" className="btn secondary small" onClick={lancer} disabled={busy}>
              Chercher de l’inspiration
            </button>
          )}
        </>
      )}

      {insp?.enCours && (
        <p className="insp-statut" role="status">
          <span className="gen-dot" aria-hidden="true" />
          {insp.statut === 'visite' && insp.total ? `Visite des sites : ${insp.faits} sur ${insp.total}` : STATUTS_INSPIRATION[insp.statut] || 'En cours'}
          <span className="muted small"> · 2 à 6 minutes, rien à faire</span>
        </p>
      )}
      {insp?.statut === 'pret' && (
        <p className="muted small">
          {insp.sites.length} site{insp.sites.length > 1 ? 's' : ''} analysé{insp.sites.length > 1 ? 's' : ''} le {fmt(insp.finLe)}. Les pistes sont ajoutées aux consignes de la génération des modèles.
        </p>
      )}
      {insp?.statut === 'erreur' && (
        <p className="q-error" role="alert">
          {insp.erreur}
        </p>
      )}
      {insp?.note && <p className="note small">{insp.note}</p>}
      {err && (
        <p className="q-error" role="alert">
          {err}
        </p>
      )}

      {p && (
        <div className="insp-pistes">
          {p.resume && <p className="insp-resume">{p.resume}</p>}
          {p.stylesConseilles?.length > 0 && (
            <>
              <h3>Styles conseillés</h3>
              <ul className="insp-chips">
                {p.stylesConseilles.map((s) => (
                  <li key={s.archetype} title={s.pourquoi}>
                    {nomArchetype(s.archetype)}
                  </li>
                ))}
              </ul>
            </>
          )}
          {p.fonctionnalites?.length > 0 && (
            <>
              <h3>Fonctionnalités utiles</h3>
              <ul className="insp-fonctions">
                {p.fonctionnalites.map((f) => {
                  const deja = dejaDansLeBrief(f.id, brief);
                  return (
                    <li key={f.id}>
                      <span className={`tag ${deja ? 'ok' : 'wait'}`}>{deja ? 'Déjà prévu' : 'À proposer'}</span> <strong>{labelFonctionnalite(f.id)}</strong>
                      {f.pourquoi && <span className="muted small"> — {f.pourquoi}</span>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {p.idees?.length > 0 && (
            <>
              <h3>Idées pour son site</h3>
              <ul className="insp-idees">
                {(toutes ? p.idees : p.idees.slice(0, 5)).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
              {p.idees.length > 5 && (
                <button type="button" className="btn-text small" onClick={() => setToutes((v) => !v)}>
                  {toutes ? 'Moins d’idées' : `Les ${p.idees.length} idées`}
                </button>
              )}
            </>
          )}
          {p.siteActuel && <p className="small"><strong>Son site actuel :</strong> {p.siteActuel}</p>}
          {p.aEviter?.length > 0 && (
            <details className="insp-eviter">
              <summary>À éviter ({p.aEviter.length})</summary>
              <ul>
                {p.aEviter.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {insp?.sites?.length > 0 && (
        <ul className="insp-vignettes">
          {insp.sites.map((s) => (
            <li key={s.id}>
              <a href={`/agence/inspiration?site=${s.id}&dossier=${rec.id}`}>
                {vignette(s) ? <img src={vignette(s)} alt="" loading="lazy" /> : <span className="insp-vide" />}
                <span className="insp-nom">{s.nom}</span>
                <span className="muted small">{SOURCES[s.source] || ''}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {insp?.ecartes?.length > 0 && (
        <details className="insp-ecartes small">
          <summary>
            {insp.ecartes.length} site{insp.ecartes.length > 1 ? 's' : ''} laissé{insp.ecartes.length > 1 ? 's' : ''} de côté
          </summary>
          <ul>
            {insp.ecartes.map((e, i) => (
              <li key={i}>
                {e.nom || e.url} : {e.raison}
              </li>
            ))}
          </ul>
        </details>
      )}

      {dispo && insp && (
        <div className="side-row">
          {insp.sites?.length > 0 && (
            <a className="btn-text small" href={`/agence/inspiration?dossier=${rec.id}`}>
              Voir les fiches
            </a>
          )}
          {!insp.enCours && (
            <button type="button" className="btn-text small" onClick={lancer} disabled={busy}>
              {insp.statut === 'erreur' ? 'Relancer' : 'Refaire la recherche'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
