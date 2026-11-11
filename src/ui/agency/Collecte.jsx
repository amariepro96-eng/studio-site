'use client';
// Collecte en amont : en haut de la page Inspiration. On choisit les métiers et le nombre de nouveaux
// sites ; l'agent part chercher, visiter et analyser tout seul (on peut fermer la page). Chaque
// actualisation cherche sous un autre angle : on peut la relancer quand on veut pour en avoir plus.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { SECTORS } from '../../engine/questions.js';
import { METIERS_COLLECTE, ANGLES_COLLECTE, PAR_METIER_CHOIX, SPECIALITES, estimationCollecte, angleCollecte } from '../../engine/inspiration.js';

const metierLabel = (id) => SECTORS.find((s) => s.id === id)?.label || id;
const metierCourt = (id) => metierLabel(id).split(' / ')[0];
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');
const pluriel = (n, mot, motPluriel = mot + 's') => `${n} ${n > 1 ? motPluriel : mot}`;
const duree = (min) => (min < 60 ? `${min} minutes` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`);
const euros = (x) => x.toLocaleString('fr-FR', { minimumFractionDigits: x < 10 ? 1 : 0, maximumFractionDigits: 1 }) + ' €';
const SEUIL_PEU = 10; // en dessous, un métier est « peu fourni » (même seuil que le choix pour un client)

function Bilan({ run }) {
  return (
    <details className="collecte-detail small">
      <summary>Détail par métier</summary>
      <ul>
        {run.metiers.map((m) => (
          <li key={m.metier}>
            <strong>{metierCourt(m.metier)}</strong>
            <span className="muted">
              {' '}
              · {m.specialite}
              {angleCollecte(m.angle) ? `, ${angleCollecte(m.angle).label.toLowerCase()}` : ''}
            </span>
            {' : '}
            {m.etat === 'a_faire' || m.etat === 'pris'
              ? m.etat === 'pris'
                ? 'recherche en cours…'
                : 'en attente'
              : m.etat === 'erreur'
                ? `recherche en échec (${m.note || 'erreur'})`
                : `${pluriel(m.ajoutes, 'nouveau site', 'nouveaux sites')}${m.deja ? `, ${m.deja} déjà connu${m.deja > 1 ? 's' : ''}` : ''}${m.ecartes ? `, ${m.ecartes} laissé${m.ecartes > 1 ? 's' : ''} de côté` : ''}${m.note ? ` · ${m.note}` : ''}`}
          </li>
        ))}
      </ul>
      {run.listeEcartes?.length > 0 && (
        <>
          <p className="muted">Laissés de côté :</p>
          <ul>
            {run.listeEcartes.map((e, i) => (
              <li key={i}>
                {e.nom || e.url} ({metierCourt(e.metier)}) : {e.raison}
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}

export default function Collecte({ onNouveauxSites }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [formulaire, setFormulaire] = useState(false);
  const [metiers, setMetiers] = useState(METIERS_COLLECTE);
  const [parMetier, setParMetier] = useState(5);
  const [angle, setAngle] = useState('');
  const [specialite, setSpecialite] = useState('');
  const [busy, setBusy] = useState(false);
  const [arret, setArret] = useState(false);
  const vus = useRef(-1);

  const charger = useCallback(
    () =>
      api('/api/agence/inspiration/collecte')
        .then((d) => {
          setData(d);
          // De nouveaux sites sont arrivés : la grille se met à jour
          const n = d.total;
          if (vus.current >= 0 && n !== vus.current) onNouveauxSites?.();
          vus.current = n;
          return d;
        })
        .catch((e) => setErr(e.message)),
    [onNouveauxSites]
  );
  useEffect(() => {
    charger();
  }, [charger]);
  const enCours = Boolean(data?.run?.enCours);
  useEffect(() => {
    if (!enCours) return undefined;
    const t = setInterval(charger, 8000);
    return () => clearInterval(t);
  }, [enCours, charger]);

  const couverture = data?.couverture || {};
  const peuFournis = useMemo(() => METIERS_COLLECTE.filter((m) => (couverture[m] || 0) < SEUIL_PEU), [couverture]);
  const estimation = estimationCollecte(metiers.length, parMetier, data?.ouvriers || 3);

  function ouvrirFormulaire() {
    setErr('');
    // Par défaut : les métiers peu fournis s'il y en a, sinon tous
    setMetiers(peuFournis.length ? peuFournis : METIERS_COLLECTE);
    setFormulaire(true);
  }
  const basculer = (m) => setMetiers((l) => (l.includes(m) ? l.filter((x) => x !== m) : METIERS_COLLECTE.filter((x) => x === m || l.includes(x))));

  async function lancer() {
    setBusy(true);
    setErr('');
    try {
      const d = await api('/api/agence/inspiration/collecte', {
        method: 'POST',
        body: { action: 'lancer', metiers, parMetier, angle, specialite: metiers.length === 1 ? specialite : '' },
      });
      setData(d);
      setFormulaire(false);
      setSpecialite('');
      setTimeout(charger, 4000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function arreter() {
    setBusy(true);
    setErr('');
    try {
      setData(await api('/api/agence/inspiration/collecte', { method: 'POST', body: { action: 'arreter' } }));
      setArret(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !err) return null;
  const dispo = data?.disponible?.configured !== false;
  const run = data?.run;
  const dernier = data?.historique?.[0];
  const faits = run ? run.ajoutes + run.deja + run.ecartes : 0;
  const pct = run?.objectif ? Math.min(100, Math.round((run.ajoutes / run.objectif) * 100)) : 0;
  const nbCouverts = METIERS_COLLECTE.filter((m) => couverture[m] > 0).length;

  return (
    <section className="card collecte" aria-labelledby="collecte-titre">
      <div className="collecte-tete">
        <div>
          <h2 id="collecte-titre">Remplir la bibliothèque</h2>
          <p className="muted small">
            {pluriel(data?.total || 0, 'site')} · {nbCouverts} métier{nbCouverts > 1 ? 's' : ''} sur {METIERS_COLLECTE.length} couverts
            {dernier ? ` · dernière collecte le ${fmt(dernier.finLe || dernier.demandeLe)}` : ''}
          </p>
        </div>
        {dispo && !enCours && !formulaire && (
          <button type="button" className="btn primary small" onClick={ouvrirFormulaire}>
            Actualiser la bibliothèque
          </button>
        )}
      </div>

      {!dispo && <p className="muted small">Collecte indisponible : il manque {data.disponible.missing.join(' et ')}.</p>}
      {dispo && !run && !formulaire && (
        <p className="small collecte-intro">
          L’agent part chercher à l’avance de très bons sites pour chaque métier, les visite, relève leurs fonctionnalités et les range ici. Quand un client envoie son questionnaire, il pioche dans cette bibliothèque les sites les plus proches de son brief : des pistes plus riches, en quelques secondes.
        </p>
      )}

      {enCours && (
        <div className="collecte-suivi" role="status">
          <p className="insp-statut">
            <span className="gen-dot" aria-hidden="true" />
            Collecte en cours : {pluriel(run.ajoutes, 'nouveau site', 'nouveaux sites')} sur {run.objectif} environ
          </p>
          <div className="collecte-barre" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="muted small">
            Recherches {run.recherches.faites} sur {run.recherches.total}
            {run.enVisite ? ` · ${pluriel(run.enVisite, 'site')} en visite` : ''}
            {run.ecartes ? ` · ${run.ecartes} laissé${run.ecartes > 1 ? 's' : ''} de côté` : ''} · tu peux fermer la page, elle continue toute seule.
          </p>
          {run.note && <p className="note small">{run.note}</p>}
          {faits > 0 || run.recherches.faites > 0 ? <Bilan run={run} /> : null}
          <div className="side-row">
            {arret ? (
              <span className="small">
                Arrêter la collecte ? Les sites déjà ajoutés restent dans la bibliothèque.{' '}
                <button type="button" className="btn-text small danger" onClick={arreter} disabled={busy}>
                  Arrêter
                </button>{' '}
                <button type="button" className="btn-text small" onClick={() => setArret(false)}>
                  Continuer
                </button>
              </span>
            ) : (
              <button type="button" className="btn-text small quiet" onClick={() => setArret(true)}>
                Arrêter la collecte
              </button>
            )}
          </div>
        </div>
      )}

      {run && !enCours && !formulaire && (
        <div className="collecte-suivi">
          {run.statut === 'erreur' ? (
            <p className="q-error" role="alert">
              {run.erreur}
            </p>
          ) : (
            <p className="small">
              <strong>
                {run.statut === 'arrete' ? 'Collecte arrêtée' : 'Dernière collecte'} le {fmt(run.finLe)} : +{pluriel(run.ajoutes, 'nouveau site', 'nouveaux sites')}
              </strong>
              {run.deja ? `, ${run.deja} déjà connu${run.deja > 1 ? 's' : ''}` : ''}
              {run.ecartes ? `, ${run.ecartes} laissé${run.ecartes > 1 ? 's' : ''} de côté` : ''}.
            </p>
          )}
          {run.recherche === 'memoire' && run.note && <p className="note small">{run.note}</p>}
          <Bilan run={run} />
        </div>
      )}

      {dispo && !formulaire && !enCours && peuFournis.length > 0 && nbCouverts > 0 && (
        <p className="muted small collecte-peu">
          Peu fournis : {peuFournis.map((m) => `${metierCourt(m)} (${couverture[m] || 0})`).join(' · ')}
        </p>
      )}

      {formulaire && (
        <div className="collecte-form">
          <div className="q-field">
            <div className="collecte-ligne">
              <span className="q-label">Métiers</span>
              <span className="collecte-raccourcis small">
                <button type="button" className="btn-text small" onClick={() => setMetiers(METIERS_COLLECTE)}>
                  Tous
                </button>
                {peuFournis.length > 0 && peuFournis.length < METIERS_COLLECTE.length && (
                  <button type="button" className="btn-text small" onClick={() => setMetiers(peuFournis)}>
                    Les moins fournis ({peuFournis.length})
                  </button>
                )}
                <button type="button" className="btn-text small" onClick={() => setMetiers([])}>
                  Aucun
                </button>
              </span>
            </div>
            <div className="q-options collecte-metiers">
              {METIERS_COLLECTE.map((m) => (
                <label key={m} className={`q-option ${metiers.includes(m) ? 'on' : ''}`}>
                  <input type="checkbox" checked={metiers.includes(m)} onChange={() => basculer(m)} />
                  <span className="q-option-title">{metierLabel(m)}</span>
                  <span className="q-option-hint">{couverture[m] ? pluriel(couverture[m], 'site') : 'Aucun site'}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="collecte-reglages">
            <fieldset className="q-field collecte-nombre">
              <legend className="q-label">Nouveaux sites par métier</legend>
              <div className="collecte-segments">
                {PAR_METIER_CHOIX.map((n) => (
                  <label key={n} className={parMetier === n ? 'on' : ''}>
                    <input type="radio" name="par-metier" value={n} checked={parMetier === n} onChange={() => setParMetier(n)} />
                    {n}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="q-field">
              <span className="q-label">Où chercher</span>
              <select value={angle} onChange={(e) => setAngle(e.target.value)}>
                <option value="">Varier à chaque fois (conseillé)</option>
                {ANGLES_COLLECTE.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            {metiers.length === 1 && (
              <label className="q-field">
                <span className="q-label">Spécialité (facultatif)</span>
                <input type="text" value={specialite} maxLength={60} onChange={(e) => setSpecialite(e.target.value)} placeholder={`ex. ${(SPECIALITES[metiers[0]] || []).slice(0, 2).join(', ')}`} />
              </label>
            )}
          </div>

          <p className="small collecte-estimation">
            {metiers.length ? (
              <>
                Environ <strong>{estimation.sites} nouveaux sites</strong> · compte {duree(estimation.minutes)} · environ {euros(estimation.euros)} de crédit Claude. Tu peux fermer la page pendant la collecte.
              </>
            ) : (
              'Choisis au moins un métier.'
            )}
          </p>
          {angle === '' && <p className="muted small">Chaque actualisation cherche sous un autre angle (spécialité, France, Europe, galeries de design…) : en relançant, tu obtiens de nouveaux sites, jamais les mêmes.</p>}

          {err && (
            <p className="q-error" role="alert">
              {err}
            </p>
          )}
          <div className="side-row">
            <button type="button" className="btn primary small" onClick={lancer} disabled={busy || !metiers.length}>
              {busy ? 'Lancement…' : 'Lancer la collecte'}
            </button>
            <button type="button" className="btn secondary small" onClick={() => setFormulaire(false)} disabled={busy}>
              Annuler
            </button>
          </div>
        </div>
      )}
      {err && !formulaire && (
        <p className="q-error" role="alert">
          {err}
        </p>
      )}
    </section>
  );
}
