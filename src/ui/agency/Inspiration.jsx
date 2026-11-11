'use client';
// Page Inspiration : la bibliothèque des sites visités par l'agent (captures, style, fonctionnalités,
// idées). Elle grandit à chaque questionnaire reçu et sert d'un client à l'autre du même métier.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { AgencyBar, Spinner } from '../Chrome.jsx';
import { SECTORS } from '../../engine/questions.js';
import { labelFonctionnalite, nomArchetype } from '../../engine/inspiration.js';
import { SOURCES, vignette } from './InspirationDossier.jsx';

const fmtJour = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const metierLabel = (id) => SECTORS.find((s) => s.id === id)?.label || id;
const etoiles = (n) => '★'.repeat(Math.max(0, Math.min(5, n || 0))) + '☆'.repeat(5 - Math.max(0, Math.min(5, n || 0)));
const urlCapture = (c, fiche) => `/api/agence/inspiration/captures/${c.id}?v=${encodeURIComponent(fiche.visiteLe || '')}`;
const ONGLETS = [
  ['accueil', 'Ordinateur'],
  ['mobile', 'Téléphone'],
  ['page-1', 'Page intérieure'],
  ['page-2', 'Autre page'],
];

function Fiche({ id, onFermer, onRetire }) {
  const [fiche, setFiche] = useState(null);
  const [err, setErr] = useState('');
  const [onglet, setOnglet] = useState('accueil');
  const [retrait, setRetrait] = useState(false);
  useEffect(() => {
    setFiche(null);
    setErr('');
    api(`/api/agence/inspiration/sites/${id}`)
      .then((d) => setFiche(d.fiche))
      .catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', k);
    // La page derrière la fiche ne défile pas pendant qu'elle est ouverte
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = avant;
    };
  }, [onFermer]);

  async function retirer() {
    try {
      await api(`/api/agence/inspiration/sites/${id}`, { method: 'DELETE' });
      onRetire(id);
    } catch (e) {
      setErr(e.message);
    }
  }

  const a = fiche?.analyse || {};
  const caps = fiche?.captures || [];
  const visibles = ONGLETS.filter(([nom]) => caps.some((c) => c.nom === nom));
  const cap = caps.find((c) => c.nom === onglet) || caps.find((c) => c.nom === 'accueil');
  return (
    <div className="insp-fiche-fond" role="dialog" aria-modal="true" aria-label={fiche ? a.nom || fiche.domaine : 'Fiche du site'} onClick={(e) => e.target === e.currentTarget && onFermer()}>
      <article className="insp-fiche">
        <header className="insp-fiche-tete">
          <div>
            <h2>{fiche ? a.nom || fiche.domaine : 'Chargement…'}</h2>
            {fiche && (
              <p className="muted small">
                <a href={fiche.urlFinale || fiche.url} target="_blank" rel="noopener noreferrer nofollow">
                  {fiche.domaine} ↗
                </a>{' '}
                · vu le {fmtJour(fiche.visiteLe)} · <span title={`${a.note}/5`}>{etoiles(a.note)}</span>
                {fiche.source ? ` · ${SOURCES[fiche.source] || ''}` : ''}
              </p>
            )}
          </div>
          <button type="button" className="btn secondary small" onClick={onFermer}>
            Fermer
          </button>
        </header>
        {err && (
          <p className="q-error" role="alert">
            {err}
          </p>
        )}
        {!fiche && !err && <Spinner />}
        {fiche && (
          <div className="insp-fiche-corps">
            <div className="insp-captures">
              <div className="insp-onglets" role="tablist" aria-label="Captures">
                {visibles.map(([nom, label]) => (
                  <button key={nom} type="button" role="tab" aria-selected={onglet === nom} className={onglet === nom ? 'on' : ''} onClick={() => setOnglet(nom)}>
                    {label}
                  </button>
                ))}
              </div>
              {cap && (
                <div className={`insp-capture ${cap.nom === 'mobile' ? 'mobile' : ''}`}>
                  <img src={urlCapture(cap, fiche)} alt={`Capture : ${ONGLETS.find(([n]) => n === cap.nom)?.[1] || cap.nom}`} />
                </div>
              )}
              {cap?.page && <p className="muted small insp-page">{cap.page}</p>}
            </div>
            <div className="insp-analyse">
              {a.resume && <p className="insp-resume">{a.resume}</p>}
              {a.ambiance?.length > 0 && (
                <ul className="insp-chips">
                  {a.ambiance.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
              {a.palette?.length > 0 && (
                <>
                  <h3>Couleurs</h3>
                  <ul className="insp-palette">
                    {a.palette.map((c) => (
                      <li key={c.hex + c.usage}>
                        <span className="insp-pastille" style={{ background: c.hex }} aria-hidden="true" />
                        <code>{c.hex}</code> <span className="muted small">{c.usage}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {(a.typographies?.titres || a.typographies?.texte) && (
                <>
                  <h3>Typographies</h3>
                  <p className="small">
                    Titres : {a.typographies.titres || '—'}
                    <br />
                    Texte : {a.typographies.texte || '—'}
                  </p>
                </>
              )}
              {a.styleProche && (
                <p className="small">
                  <strong>Style proche dans Studio Site :</strong> {nomArchetype(a.styleProche)}
                </p>
              )}
              {a.miseEnPage?.length > 0 && (
                <>
                  <h3>Mise en page</h3>
                  <ul className="insp-liste">
                    {a.miseEnPage.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </>
              )}
              {a.fonctionnalites?.length > 0 && (
                <>
                  <h3>Fonctionnalités</h3>
                  <ul className="insp-chips">
                    {a.fonctionnalites.map((f) => (
                      <li key={f}>{labelFonctionnalite(f)}</li>
                    ))}
                  </ul>
                </>
              )}
              {a.idees?.length > 0 && (
                <>
                  <h3>Idées à retenir</h3>
                  <ul className="insp-liste">
                    {a.idees.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </>
              )}
              {a.pointsFaibles?.length > 0 && (
                <>
                  <h3>À ne pas reproduire</h3>
                  <ul className="insp-liste">
                    {a.pointsFaibles.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </>
              )}
              {a.identite && (
                <p className="small">
                  <strong>Identité à garder :</strong> {a.identite}
                </p>
              )}
              <p className="muted small insp-rappel">Une source d’idées : rien de ce site (textes, photos, logo) ne doit être repris tel quel.</p>
              <div className="side-row">
                {retrait ? (
                  <span className="small">
                    Retirer ce site et ses captures de la bibliothèque ?{' '}
                    <button type="button" className="btn-text small danger" onClick={retirer}>
                      Retirer
                    </button>{' '}
                    <button type="button" className="btn-text small" onClick={() => setRetrait(false)}>
                      Annuler
                    </button>
                  </span>
                ) : (
                  <button type="button" className="btn-text small quiet" onClick={() => setRetrait(true)}>
                    Retirer de la bibliothèque
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

export default function Inspiration({ studioName, dossierId = '', siteInitial = '' }) {
  const [sites, setSites] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [dispo, setDispo] = useState(null);
  const [err, setErr] = useState('');
  const [metier, setMetier] = useState('');
  const [texte, setTexte] = useState('');
  const [tri, setTri] = useState('recents');
  const [ouvert, setOuvert] = useState(siteInitial);

  useEffect(() => {
    if (dossierId) {
      api(`/api/agence/inspiration?dossier=${dossierId}`)
        .then((d) => {
          setDossier(d);
          setDispo(d.disponible);
          setSites(d.inspiration?.sites || []);
        })
        .catch((e) => setErr(e.message));
    } else {
      api('/api/agence/inspiration')
        .then((d) => {
          setSites(d.sites);
          setDispo(d.disponible);
        })
        .catch((e) => setErr(e.message));
    }
  }, [dossierId]);

  // L'adresse suit la fiche ouverte (lien partageable entre tes onglets, retour arrière du navigateur)
  function ouvrir(id) {
    setOuvert(id);
    const u = new URL(window.location.href);
    if (id) u.searchParams.set('site', id);
    else u.searchParams.delete('site');
    window.history.replaceState(null, '', u);
  }

  const metiers = useMemo(() => [...new Set((sites || []).flatMap((s) => s.metiers || []))].sort((a, b) => metierLabel(a).localeCompare(metierLabel(b))), [sites]);
  const liste = useMemo(() => {
    const t = texte.trim().toLowerCase();
    const out = (sites || []).filter(
      (s) =>
        (!metier || (s.metiers || []).includes(metier)) &&
        (!t || [s.nom, s.domaine, ...(s.ambiance || []), ...(s.fonctionnalites || []).map(labelFonctionnalite)].join(' ').toLowerCase().includes(t))
    );
    if (tri === 'notes') out.sort((a, b) => (b.note || 0) - (a.note || 0));
    return out;
  }, [sites, metier, texte, tri]);

  return (
    <div className="ss">
      <AgencyBar studioName={studioName} current="inspiration" />
      <main className="page page-wide">
        <div className="page-head">
          <div>
            {dossierId && (
              <a className="back" href={`/agence/clients/${dossierId}`}>
                {dossier?.nom || 'Dossier'}
              </a>
            )}
            <h1>{dossierId ? `Inspiration pour ${dossier?.nom || '…'}` : 'Inspiration'}</h1>
            <p className="muted">
              {dossierId
                ? 'Les sites que l’agent a visités pour ce client, et les pistes qu’il en tire.'
                : 'Les sites visités par l’agent d’inspiration, à chaque questionnaire reçu. Ils servent d’idées pour les modèles : rien n’est copié, et les captures ne sont visibles que par toi.'}
            </p>
          </div>
          {dossierId && (
            <a className="btn secondary small" href="/agence/inspiration">
              Toute la bibliothèque
            </a>
          )}
        </div>
        {dispo && !dispo.configured && <div className="alert soft">Agent d’inspiration indisponible : il manque {dispo.missing.join(' et ')}.</div>}
        {err && (
          <div className="alert" role="alert">
            {err}
          </div>
        )}
        {!sites && !err && <Spinner />}

        {dossier?.inspiration?.pistes?.resume && (
          <div className="card insp-bandeau">
            <p>{dossier.inspiration.pistes.resume}</p>
            {dossier.inspiration.pistes.stylesConseilles?.length > 0 && (
              <p className="small muted">Styles conseillés : {dossier.inspiration.pistes.stylesConseilles.map((s) => nomArchetype(s.archetype)).join(' · ')}</p>
            )}
          </div>
        )}

        {sites && sites.length > 0 && !dossierId && (
          <div className="insp-filtres">
            <label>
              <span className="sr-only">Métier</span>
              <select value={metier} onChange={(e) => setMetier(e.target.value)}>
                <option value="">Tous les métiers ({sites.length})</option>
                {metiers.map((m) => (
                  <option key={m} value={m}>
                    {metierLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="insp-recherche">
              <span className="sr-only">Rechercher</span>
              <input type="search" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Rechercher : nom, ambiance, réservation…" />
            </label>
            <label>
              <span className="sr-only">Trier</span>
              <select value={tri} onChange={(e) => setTri(e.target.value)}>
                <option value="recents">Les plus récents</option>
                <option value="notes">Les mieux notés</option>
              </select>
            </label>
          </div>
        )}

        {sites && sites.length === 0 && (
          <div className="card empty">
            <p>Aucun site pour l’instant. L’agent en visite à chaque questionnaire reçu : la bibliothèque se remplit toute seule.</p>
          </div>
        )}
        {sites && sites.length > 0 && liste.length === 0 && <p className="muted">Aucun site ne correspond.</p>}

        <ul className="insp-grille">
          {liste.map((s) => (
            <li key={s.id}>
              <button type="button" className="insp-carte" onClick={() => ouvrir(s.id)}>
                <span className="insp-vignette">{vignette(s) ? <img src={vignette(s)} alt="" loading="lazy" /> : null}</span>
                <span className="insp-carte-texte">
                  <strong>{s.nom}</strong>
                  <span className="muted small">
                    {s.domaine} · <span aria-label={`${s.note} sur 5`}>{etoiles(s.note)}</span>
                  </span>
                  {s.ambiance?.length > 0 && <span className="small">{s.ambiance.slice(0, 3).join(' · ')}</span>}
                  <span className="muted small">
                    {(s.metiers || []).map(metierLabel).slice(0, 2).join(' · ')}
                    {s.source && SOURCES[s.source] && s.source !== 'metier' ? ` · ${SOURCES[s.source]}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>
      {ouvert && (
        <Fiche
          id={ouvert}
          onFermer={() => ouvrir('')}
          onRetire={(id) => {
            setSites((l) => (l || []).filter((s) => s.id !== id));
            ouvrir('');
          }}
        />
      )}
    </div>
  );
}
