'use client';
// Page Inspiration : la bibliothèque des sites visités par l'agent (captures, style, fonctionnalités,
// idées). Elle grandit à chaque questionnaire reçu et sert d'un client à l'autre du même métier.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { AgencyBar, Spinner } from '../Chrome.jsx';
import { SECTORS } from '../../engine/questions.js';
import { FONCTIONNALITES, DANS_LE_BRIEF, labelFonctionnalite, nomArchetype } from '../../engine/inspiration.js';
import { SOURCES, vignette } from './InspirationDossier.jsx';
import Collecte from './Collecte.jsx';

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

function Fiche({ id, usage = 0, onFermer, onRetire }) {
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
                {a.specialite ? ` · ${a.specialite}` : ''} · vu le {fmtJour(fiche.visiteLe)} · <span title={`Intérêt ${a.note}/5`}>{etoiles(a.note)}</span>
                {a.originalite ? ` · originalité ${a.originalite}/5` : ''}
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
              {a.trouvailles?.length > 0 && (
                <>
                  <h3>Trouvailles</h3>
                  <ul className="insp-liste">
                    {a.trouvailles.map((t, i) => (
                      <li key={i}>
                        <strong>{t.titre}</strong>
                        {t.description ? ` : ${t.description}` : ''}
                      </li>
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
              {usage > 0 && (
                <p className="muted small">
                  A servi aux pistes de {usage} client{usage > 1 ? 's' : ''} : l’agent le propose moins souvent aux suivants, pour que chacun ait des sites différents.
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

// Ce que l'agent a repéré, tous sites confondus (ou pour un métier) : fonctionnalités courantes et
// trouvailles originales. Touche une fonctionnalité : la grille des sites qui l'ont.
function Catalogue({ sites, onFonction, onOuvrir }) {
  const total = sites.length;
  const comptes = FONCTIONNALITES.map((f) => ({ ...f, n: sites.filter((s) => (s.fonctionnalites || []).includes(f.id)).length }))
    .filter((f) => f.n > 0)
    .sort((a, b) => b.n - a.n);
  const trouvailles = [];
  for (const s of sites) for (const t of s.trouvailles || []) trouvailles.push({ titre: t, site: s });
  trouvailles.sort((a, b) => (b.site.originalite || 0) - (a.site.originalite || 0) || (b.site.note || 0) - (a.site.note || 0));
  if (!total) return <p className="muted">Aucun site pour ce métier pour l’instant.</p>;
  return (
    <div className="insp-catalogue">
      <section>
        <h2>Fonctionnalités repérées</h2>
        <p className="muted small">
          Sur {total} site{total > 1 ? 's' : ''}. « Studio Site le fait » : déjà proposé dans le questionnaire. Les autres sont des idées à proposer en option.
        </p>
        <ul className="insp-compteurs">
          {comptes.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => onFonction(f.id)}>
                <span className="insp-compteur-nom">
                  {f.label}
                  {DANS_LE_BRIEF[f.id] && <span className="tag ok">Studio Site le fait</span>}
                </span>
                <span className="insp-compteur-barre" aria-hidden="true">
                  <span style={{ width: `${Math.max(4, Math.round((f.n / total) * 100))}%` }} />
                </span>
                <span className="insp-compteur-n">
                  {f.n} <span className="muted small">({Math.round((f.n / total) * 100)} %)</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Trouvailles originales</h2>
        <p className="muted small">Les idées qui sortent de l’ordinaire, relevées par l’agent. Touche une ligne pour voir le site.</p>
        {trouvailles.length === 0 ? (
          <p className="muted small">Pas encore de trouvailles : elles sont relevées sur les sites visités depuis la mise à jour « Collecte ».</p>
        ) : (
          <ul className="insp-trouvailles">
            {trouvailles.slice(0, 120).map((t, i) => (
              <li key={i}>
                <button type="button" onClick={() => onOuvrir(t.site.id)}>
                  <strong>{t.titre}</strong>
                  <span className="muted small">
                    {t.site.nom}
                    {t.site.specialite ? ` · ${t.site.specialite}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
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
  const [fonction, setFonction] = useState('');
  const [vue, setVue] = useState('sites');
  const [ouvert, setOuvert] = useState(siteInitial);

  // Rechargé quand la collecte ajoute des sites
  const recharger = useCallback(() => {
    if (dossierId) return;
    api('/api/agence/inspiration')
      .then((d) => setSites(d.sites))
      .catch(() => {});
  }, [dossierId]);

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
  const duMetier = useMemo(() => (sites || []).filter((s) => !metier || (s.metiers || []).includes(metier)), [sites, metier]);
  const liste = useMemo(() => {
    const t = texte.trim().toLowerCase();
    const out = duMetier.filter(
      (s) =>
        (!fonction || (s.fonctionnalites || []).includes(fonction)) &&
        (!t || [s.nom, s.domaine, s.specialite, ...(s.ambiance || []), ...(s.trouvailles || []), ...(s.fonctionnalites || []).map(labelFonctionnalite)].join(' ').toLowerCase().includes(t))
    );
    if (tri === 'notes') out.sort((a, b) => (b.note || 0) - (a.note || 0));
    if (tri === 'originaux') out.sort((a, b) => (b.originalite || 0) - (a.originalite || 0) || (b.note || 0) - (a.note || 0));
    return out;
  }, [duMetier, texte, tri, fonction]);
  const fonctionsPresentes = useMemo(() => FONCTIONNALITES.filter((f) => duMetier.some((s) => (s.fonctionnalites || []).includes(f.id))), [duMetier]);

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
                : 'Les sites visités par l’agent d’inspiration : à chaque questionnaire reçu, et quand tu remplis la bibliothèque à l’avance. Ils servent d’idées pour les modèles : rien n’est copié, et les captures ne sont visibles que par toi.'}
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

        {!dossierId && dispo?.configured !== false && <Collecte onNouveauxSites={recharger} />}

        {sites && sites.length > 0 && !dossierId && (
          <div className="insp-vues" role="tablist" aria-label="Affichage">
            <button type="button" role="tab" aria-selected={vue === 'sites'} className={vue === 'sites' ? 'on' : ''} onClick={() => setVue('sites')}>
              Sites
            </button>
            <button type="button" role="tab" aria-selected={vue === 'fonctions'} className={vue === 'fonctions' ? 'on' : ''} onClick={() => setVue('fonctions')}>
              Fonctionnalités
            </button>
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
                    {metierLabel(m)} ({sites.filter((s) => (s.metiers || []).includes(m)).length})
                  </option>
                ))}
              </select>
            </label>
            {vue === 'sites' && (
              <>
                <label className="insp-recherche">
                  <span className="sr-only">Rechercher</span>
                  <input type="search" value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Rechercher : nom, spécialité, ambiance, réservation…" />
                </label>
                <label>
                  <span className="sr-only">Fonctionnalité</span>
                  <select value={fonction} onChange={(e) => setFonction(e.target.value)}>
                    <option value="">Toutes les fonctionnalités</option>
                    {fonctionsPresentes.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                    {fonction && !fonctionsPresentes.some((f) => f.id === fonction) && <option value={fonction}>{labelFonctionnalite(fonction)}</option>}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Trier</span>
                  <select value={tri} onChange={(e) => setTri(e.target.value)}>
                    <option value="recents">Les plus récents</option>
                    <option value="notes">Les mieux notés</option>
                    <option value="originaux">Les plus originaux</option>
                  </select>
                </label>
              </>
            )}
          </div>
        )}

        {sites && sites.length === 0 && (
          <div className="card empty">
            <p>
              {dossierId
                ? 'Aucun site pour ce client pour l’instant.'
                : 'Aucun site pour l’instant. Remplis la bibliothèque à l’avance avec « Actualiser la bibliothèque », ou laisse l’agent la compléter à chaque questionnaire reçu.'}
            </p>
          </div>
        )}

        {vue === 'fonctions' && !dossierId && sites && sites.length > 0 && (
          <Catalogue
            sites={duMetier}
            onOuvrir={ouvrir}
            onFonction={(id) => {
              setFonction(id);
              setTexte('');
              setVue('sites');
            }}
          />
        )}

        {vue === 'sites' && sites && sites.length > 0 && liste.length === 0 && <p className="muted">Aucun site ne correspond.</p>}

        {vue === 'sites' && (
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
                    {s.specialite || (s.metiers || []).map(metierLabel).slice(0, 2).join(' · ')}
                    {s.originalite >= 4 ? ' · très original' : ''}
                    {s.source && SOURCES[s.source] && s.source !== 'metier' && s.source !== 'collecte' ? ` · ${SOURCES[s.source]}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        )}
      </main>
      {ouvert && (
        <Fiche
          id={ouvert}
          usage={(sites || []).find((x) => x.id === ouvert)?.utilisePar?.length || 0}
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
