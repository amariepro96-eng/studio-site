'use client';
// Dossier d'un client : du questionnaire envoyé jusqu'au site en ligne
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, uploadImage, saveBlob } from '../api.js';
import { AgencyBar, StageStrip, Spinner } from '../Chrome.jsx';
import { AgencyForm } from '../Questionnaire.jsx';
import Publication from './Publication.jsx';
import EspaceAgence from './EspaceAgence.jsx';
import DriveAgence from './DriveAgence.jsx';
import SendBox from './SendBox.jsx';
import { remoteExtra } from '../RemoteMedia.jsx';
import { ThumbFrame, DeviceFrame, DeviceToggle, PageTabs } from '../Frames.jsx';
import { Generating, PreviewModal, ImageStatus, archName, varyModel, nextPalette } from '../App.jsx';
import { emptyBrief, remoteSteps, missingLegal, SECTORS, GOALS, PAGES, FEATURES, LEGAL_FORMS } from '../../engine/questions.js';
import { MOODS } from '../../engine/archetypes.js';
import { renderPage, sitePages } from '../../engine/render.js';
import { buildZip, zipName } from '../../engine/zip.js';
import { generateSite, apiRunner, apiImages } from '../../ai/generate.js';
import { apiImageGen, aiImagesNeeded, generateImages } from '../../ai/images.js';
import { insertVersions, baseOf } from '../../engine/variants.js';
import { stageOf, renderImages, renderBrief, timeAgo, CHECKS, MIN_PICK, MAX_PICK, plural } from '../../engine/records.js';

const STEPS7 = remoteSteps({ strict: false });
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');
// Brief à modifier : réponses existantes, nom du dossier si le client ne l'a pas encore saisi
const draftFrom = (rec) => ({ ...emptyBrief(), ...(rec.brief || {}), businessName: rec.brief?.businessName || rec.name || '' });

// ---------- Réponses du client ----------
const labelOf = (list, id) => list.find((o) => o.id === id)?.label || id;
const OPTIONS = { sector: SECTORS, goal: GOALS, pages: PAGES, features: FEATURES, moods: MOODS, legalForm: LEGAL_FORMS };

function AnswerValue({ f, b, srcOf }) {
  const v = b[f.id];
  if (f.type === 'photos') {
    const list = b.photos || [];
    return list.length ? (
      <span className="thumbs">
        {list.map((p) => (
          <img key={p.id} src={srcOf(p.id)} alt={p.alt || 'Photo du client'} loading="lazy" />
        ))}
      </span>
    ) : (
      <span className="muted">Aucune photo</span>
    );
  }
  if (f.type === 'logo') return b.logo ? <img className="logo-prev" src={srcOf(b.logo.id)} alt="Logo du client" /> : <span className="muted">Pas de logo</span>;
  if (f.type === 'toggle') return <span>{v === false ? 'Non' : 'Oui'}</span>;
  if (f.type === 'color') return v ? (
    <span>
      <span className="swatch" style={{ background: v.startsWith('#') ? v : '#' + v }} />
      {v}
    </span>
  ) : (
    <span className="muted">Pas de préférence</span>
  );
  if (Array.isArray(v)) return v.length ? <span>{v.map((x) => labelOf(OPTIONS[f.id] || f.options || [], x)).join(', ')}</span> : <span className="muted">Rien de coché</span>;
  if (f.type === 'select' || f.type === 'radio') return v ? <span>{labelOf(OPTIONS[f.id] || f.options || [], v)}</span> : <span className="muted">Non renseigné</span>;
  if (!String(v || '').trim()) return <span className="muted">Non renseigné</span>;
  return <span className="pre">{v}</span>;
}

function Answers({ rec, srcOf }) {
  const b = rec.brief;
  if (!b) return <p className="muted">Le client n’a pas encore répondu.</p>;
  const missing = missingLegal(b);
  return (
    <div className="answers">
      {rec.status === 'sent' && <p className="alert soft">Réponses partielles : le client n’a pas encore terminé le questionnaire.</p>}
      {missing.length > 0 && !['sent', 'answered'].includes(rec.status) && (
        <p className="alert soft">
          <strong>Infos légales à demander :</strong> {missing.join(', ')}.
        </p>
      )}
      {STEPS7.map((s, i) => (
        <details key={s.id} className="answer-group" open={i === 0}>
          <summary>{s.title}</summary>
          <dl>
            {s.fields
              .filter((f) => !f.showIf || f.showIf(b))
              .map((f) => (
                <div key={f.id}>
                  <dt>{f.label}</dt>
                  <dd>
                    <AnswerValue f={f} b={b} srcOf={srcOf} />
                  </dd>
                </div>
              ))}
          </dl>
        </details>
      ))}
    </div>
  );
}

// ---------- Sélection des modèles ----------
function SelectCard({ model, index, html, picked, onToggle, onOpen, onVary, onPalette, onRemove, full }) {
  return (
    <article className={`model-card${picked ? ' picked' : ''}`}>
      <button type="button" className="model-thumb" onClick={onOpen} aria-label={`Voir le modèle ${archName(model)} en grand`}>
        <ThumbFrame html={html} title={`Aperçu ${archName(model)}`} />
      </button>
      <div className="model-info">
        <div className="model-title">
          <span className="model-rank" title="Classement de pertinence">
            {index + 1}
          </span>
          <h3>{archName(model)}</h3>
        </div>
        {model.why && <p>{model.why}</p>}
        <div className="model-actions">
          <button type="button" className={`btn small ${picked ? 'primary' : 'secondary'}`} aria-pressed={picked} onClick={onToggle} disabled={!picked && full}>
            {picked ? 'Retenu' : 'Retenir'}
          </button>
          <button type="button" className="btn-text small" onClick={onOpen}>
            Voir en grand
          </button>
          <button type="button" className="btn-text small" onClick={onVary}>
            Varier
          </button>
          <button type="button" className="btn-text small" onClick={onPalette}>
            Autre palette
          </button>
          {onRemove && (
            <button type="button" className="btn-text small quiet" onClick={onRemove}>
              Retirer
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function defaultMessage(rec) {
  const name = rec.brief?.businessName || rec.name;
  return `Bonjour,\n\nVoici les propositions que j’ai retenues pour le site de ${name}. Ouvrez chacune en grand et parcourez ses pages : accueil, services, contact…\n\nChoisissez ensuite celle que vous préférez. Si un détail vous gêne (une couleur, une photo, un texte), dites-le dans votre commentaire : je l’ajuste avant la mise en ligne.`;
}

function SelectPanel({ rec, settings, brief, images, save, onRegenerate, imgStatus, onRetryImages, onClose }) {
  const models = rec.result.models;
  const [picked, setPicked] = useState(() => (rec.picked?.length ? rec.picked : []));
  const [message, setMessage] = useState(() => rec.message || defaultMessage(rec));
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRegen, setConfirmRegen] = useState(false);
  const composer = useRef(null);
  const content = rec.result.content;
  const full = picked.length >= MAX_PICK;
  const toggle = (m) => {
    // Une version retenue dans « Voir en grand » rejoint la galerie, juste après son style
    if (!models.some((x) => x.id === m.id)) {
      if (picked.length >= MAX_PICK) return;
      save({ result: { ...rec.result, models: insertVersions(models, baseOf(m, models), [m]) } }, null, true);
    }
    setPicked((p) => (p.includes(m.id) ? p.filter((x) => x !== m.id) : p.length >= MAX_PICK ? p : [...p, m.id]));
  };
  const thumbs = useMemo(() => models.map((m) => renderPage('index', { brief, content, model: m, images, mode: 'preview', imageSize: 'thumb' })), [models, brief, content, images]);
  const updateModel = (m) => save({ result: { ...rec.result, models: models.map((x) => (x.id === m.id ? m : x)) } }, null, true);
  const removeVersion = (m) => {
    setPicked((p) => p.filter((x) => x !== m.id));
    save({ result: { ...rec.result, models: models.filter((x) => x.id !== m.id) } }, null, true);
  };
  const okCount = picked.length >= MIN_PICK && picked.length <= MAX_PICK;

  async function send() {
    if (!okCount) return;
    setBusy(true);
    setError('');
    try {
      // On garde l'ordre de pertinence
      const ordered = models.map((m) => m.id).filter((id) => picked.includes(id));
      await save({ picked: ordered, message, status: 'proposed', choice: null }, `Sélection envoyée (${ordered.length} modèles)`);
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Choisissez les modèles à montrer</h2>
          <p className="muted">
            Retenez {MIN_PICK} à {MAX_PICK} modèles parmi les {models.length}. Le client ne verra que ceux-là, jamais la génération. Dans <strong>Voir en grand</strong>, chaque style existe en 4 versions.
          </p>
        </div>
        <div className="row-actions">
          {onClose && (
            <button type="button" className="btn secondary small" onClick={onClose}>
              Annuler
            </button>
          )}
          {confirmRegen ? (
            <span className="confirm">
              Les 10 modèles actuels seront remplacés.{' '}
              <button type="button" className="btn-text small danger" onClick={onRegenerate}>
                Relancer
              </button>{' '}
              <button type="button" className="btn-text small" onClick={() => setConfirmRegen(false)}>
                Garder
              </button>
            </span>
          ) : (
            <button type="button" className="btn-text small" onClick={() => setConfirmRegen(true)}>
              Relancer la génération
            </button>
          )}
        </div>
      </div>
      {rec.result.source === 'demo' && <div className="alert soft">Textes génériques (mode démo) : branchez la clé Claude pour des textes rédigés par l’IA, puis relancez la génération.</div>}
      <ImageStatus status={imgStatus} agency onRetry={onRetryImages} />
      <div className="model-grid">
        {models.map((m, i) => (
          <SelectCard
            key={m.id}
            model={m}
            index={i}
            html={thumbs[i]}
            picked={picked.includes(m.id)}
            full={full}
            onToggle={() => toggle(m)}
            onOpen={() => setOpen(i)}
            onVary={() => updateModel(varyModel(m))}
            onPalette={() => updateModel(nextPalette(m))}
            onRemove={m.variantOf ? () => removeVersion(m) : null}
          />
        ))}
      </div>
      <div className="card composer" ref={composer}>
        <h3>Message affiché au client</h3>
        <p className="muted small">Il apparaît en haut de sa page de propositions, signé {settings?.ownerName || 'de votre prénom'}.</p>
        <div className="q-field">
          <label className="sr-only" htmlFor="pick-msg">
            Message affiché au client
          </label>
          <textarea id="pick-msg" rows={7} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        {error && (
          <p className="q-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="sticky-bar">
        <p>{picked.length === 0 ? `Retenez ${MIN_PICK} à ${MAX_PICK} modèles.` : okCount ? `${plural(picked.length, 'modèle retenu', 'modèles retenus')}.` : `${plural(picked.length, 'modèle retenu', 'modèles retenus')} : il en faut au moins ${MIN_PICK}.`}</p>
        <div className="row-actions">
          <button type="button" className="btn-text small invert" onClick={() => composer.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            Relire le message
          </button>
          <button type="button" className="btn primary" disabled={!okCount || busy} onClick={send}>
            {busy ? 'Enregistrement…' : 'Valider la sélection'}
          </button>
        </div>
      </div>
      {open !== null && (
        <PreviewModal
          models={models}
          index={open}
          setIndex={setOpen}
          brief={brief}
          content={content}
          images={images}
          onClose={() => setOpen(null)}
          withVersions
          renderAction={(m) => (
            <button type="button" className={`btn small ${picked.includes(m.id) ? 'primary' : 'secondary'}`} aria-pressed={picked.includes(m.id)} onClick={() => toggle(m)} disabled={!picked.includes(m.id) && full}>
              {picked.includes(m.id) ? 'Retenue' : 'Retenir cette version'}
            </button>
          )}
        />
      )}
    </section>
  );
}

// ---------- Mise en service ----------
function Workspace({ rec, settings, brief, images, save, onReselect, onRecord, onEditBrief }) {
  const content = rec.result.content;
  const model = rec.result.models.find((m) => m.id === rec.choice?.modelId);
  const [page, setPage] = useState('index');
  const [device, setDevice] = useState('desktop');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [liveUrl, setLiveUrl] = useState(rec.liveUrl || '');
  // L'adresse peut être remplie par la mise en ligne automatique (domaine validé)
  useEffect(() => setLiveUrl(rec.liveUrl || ''), [rec.liveUrl]);
  const pages = useMemo(() => sitePages(brief, content), [brief, content]);
  const html = useMemo(() => (model ? renderPage(page, { brief, content, model, images, mode: 'preview' }) : ''), [page, brief, content, model, images]);
  const nav = useCallback((p) => setPage(p), []);
  if (!model) return <div className="alert">Le modèle choisi est introuvable. Proposez une nouvelle sélection.</div>;
  const checks = rec.checks || {};
  const doneCount = CHECKS.filter((c) => checks[c.id]).length;
  const updateModel = (m) => save({ result: { ...rec.result, models: rec.result.models.map((x) => (x.id === m.id ? m : x)) } }, null, true);

  async function download() {
    setBusy(true);
    setNote('');
    try {
      const fetchBlob = async (url) => {
        const r = await fetch(url);
        if (!r.ok) throw new Error('Une image n’a pas pu être récupérée. Réessayez.');
        return r.blob();
      };
      const imgs = await Promise.all(images.map(async (img) => (img.source === 'unsplash' ? img : { ...img, blob: await fetchBlob(img.url) })));
      const extraFiles = brief.logoUrl ? [{ file: brief.logoFile, blob: await fetchBlob(brief.logoUrl) }] : [];
      const blob = await buildZip({ brief, content, model, images: imgs, extraFiles });
      saveBlob(blob, zipName(brief));
      setNote('Le fichier .zip est dans vos téléchargements.');
    } catch (e) {
      setNote(e?.message || 'Le téléchargement n’a pas abouti. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  const live = rec.status === 'live';
  return (
    <section className="panel">
      <div className="choice-card card">
        <div>
          <p className="choice-kicker">{rec.choice.by === 'agence' ? 'Choix noté par vous' : `Choix du client, ${timeAgo(rec.choice.at)}`}</p>
          <h2>{archName(model)}</h2>
          {rec.choice.comment ? <blockquote>{rec.choice.comment}</blockquote> : <p className="muted">Aucun commentaire.</p>}
        </div>
        {!live && (
          <button type="button" className="btn-text small" onClick={onReselect}>
            Proposer d’autres modèles
          </button>
        )}
      </div>
      <div className="workspace">
        <div className="workspace-preview">
          <div className="toolbar">
            <PageTabs pages={[...pages, { slug: 'mentions-legales', label: 'Mentions légales' }]} value={page} onChange={setPage} />
            <DeviceToggle value={device} onChange={setDevice} />
          </div>
          <div className="stage">
            <DeviceFrame html={html} device={device} onNavigate={nav} title={`Site ${brief.businessName}`} />
          </div>
        </div>
        <aside className="workspace-side">
          <Publication rec={rec} onRecord={onRecord} onEditBrief={onEditBrief} />
          <EspaceAgence rec={rec} onRecord={onRecord} settings={settings} />
          <button type="button" className="btn secondary block" onClick={download} disabled={busy}>
            {busy ? 'Préparation du fichier…' : 'Télécharger le site (.zip)'}
          </button>
          {note && (
            <p className="side-note" role="status">
              {note}
            </p>
          )}
          {!live && (
            <div className="side-row">
              <button type="button" className="btn-text small" onClick={() => updateModel(varyModel(model))}>
                Varier la mise en page
              </button>
              <button type="button" className="btn-text small" onClick={() => updateModel(nextPalette(model))}>
                Autre palette
              </button>
            </div>
          )}
          {rec.brief?.logo && (
            <label className="q-toggle compact">
              <input type="checkbox" checked={rec.brief.logoInHeader !== false} onChange={(e) => save({ brief: { ...rec.brief, logoInHeader: e.target.checked } }, null, true, { briefRev: rec.briefRev || 0 }).catch(() => {})} />
              <span>
                <span className="q-option-title">Logo du client dans l’en-tête</span>
              </span>
            </label>
          )}
          <div className="side-block">
            <h3>
              Mise en service <span className="muted">{doneCount} sur {CHECKS.length}</span>
            </h3>
            <ul className="checklist">
              {CHECKS.map((c) => (
                <li key={c.id}>
                  <label>
                    <input type="checkbox" checked={!!checks[c.id]} onChange={(e) => save({ checks: { ...checks, [c.id]: e.target.checked } }, null, true)} />
                    <span>{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="side-block">
            <div className="q-field">
              <label className="q-label" htmlFor="live-url">
                Adresse du site en ligne
              </label>
              <input id="live-url" type="text" value={liveUrl} placeholder="https://www.exemple.fr" onChange={(e) => setLiveUrl(e.target.value)} onBlur={() => liveUrl !== (rec.liveUrl || '') && save({ liveUrl: liveUrl.trim() }, null, true)} />
            </div>
            {live ? (
              <>
                <p className="side-note">En ligne depuis le {fmtDate(rec.liveAt)}.</p>
                <button type="button" className="btn-text small" onClick={() => save({ status: 'chosen' }, 'Dossier repassé en mise en service')}>
                  Repasser en mise en service
                </button>
              </>
            ) : (
              <>
                {doneCount < CHECKS.length && <p className="muted small">Cochez toute la liste avant de marquer le site en ligne.</p>}
                <button type="button" className="btn secondary block" onClick={() => save({ status: 'live', liveUrl: liveUrl.trim() })}>
                  Marquer le site en ligne
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

// ---------- Choix noté par l'agence (client joint par téléphone) ----------
function ChooseForClient({ rec, save, onCancel }) {
  const models = (rec.picked || []).map((id) => rec.result.models.find((m) => m.id === id)).filter(Boolean);
  const [modelId, setModelId] = useState(models[0]?.id || '');
  const [comment, setComment] = useState('');
  return (
    <div className="card inline-form">
      <h3>Noter le choix du client</h3>
      <div className="q-options">
        {models.map((m) => (
          <label key={m.id} className={`q-option${modelId === m.id ? ' on' : ''}`}>
            <input type="radio" name="choose" checked={modelId === m.id} onChange={() => setModelId(m.id)} />
            <span className="q-option-title">{archName(m)}</span>
          </label>
        ))}
      </div>
      <div className="q-field">
        <label className="q-label" htmlFor="choose-comment">
          Ses remarques
        </label>
        <textarea id="choose-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <div className="row-actions">
        <button type="button" className="btn primary small" disabled={!modelId} onClick={() => save({ status: 'chosen', choice: { modelId, comment, by: 'agence' } }, `Choix noté par l’agence : ${archName(models.find((m) => m.id === modelId))}`)}>
          Enregistrer son choix
        </button>
        <button type="button" className="btn-text small" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// ---------- Dossier ----------
export default function ClientFile({ id, studioName }) {
  const [rec, setRec] = useState(null);
  const [settings, setSettings] = useState(null);
  const [svc, setSvc] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState(null);
  const [draft, setDraft] = useState(null);
  const [savingBrief, setSavingBrief] = useState(false);
  const [gen, setGen] = useState(null);
  const [imgStatus, setImgStatus] = useState({ state: 'idle' });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [origin, setOrigin] = useState('');
  const abortRef = useRef(null);
  const imgAbortRef = useRef(null);
  const draftRevRef = useRef(0);
  // Ouvre le brief en édition, en notant la version des réponses qu'on modifie
  const openEdit = (r) => {
    setDraft(draftFrom(r));
    draftRevRef.current = r.briefRev || 0;
    setView('edit');
  };
  const partialRef = useRef({});

  useEffect(() => {
    setOrigin(window.location.origin);
    api(`/api/agence/clients/${id}`)
      .then(({ client, settings: s }) => {
        setRec(client);
        setSettings(s);
        // Dossier « rempli par l'agence » tout neuf : on ouvre directement le brief
        if (client.status === 'answered' && !client.brief) {
          openEdit(client);
        }
      })
      .catch((e) => setError(e.message));
    fetch('/api/status')
      .then((r) => r.json())
      .then(setSvc)
      .catch(() => setSvc({ ai: false, aiImages: false, images: false }));
    return () => {
      abortRef.current?.abort();
      imgAbortRef.current?.abort();
    };
  }, [id]);

  // Les enregistrements partent un par un, dans l'ordre des clics.
  // quiet = affichage mis à jour tout de suite, erreur affichée en haut du dossier
  const queueRef = useRef(Promise.resolve());
  const pendingRef = useRef(0);
  const save = useCallback(
    (set, log, quiet = false, extra = {}) => {
      if (quiet) setRec((r) => ({ ...r, ...set }));
      pendingRef.current++;
      const run = queueRef.current.then(async () => {
        try {
          const { client } = await api(`/api/agence/clients/${id}`, { method: 'PATCH', body: { set, log: log || undefined, ...extra } });
          pendingRef.current--;
          // N'écrase pas l'affichage tant que d'autres changements sont en route
          if (pendingRef.current === 0) setRec(client);
          return client;
        } catch (e) {
          pendingRef.current--;
          if (quiet) {
            setError(e.message);
            // On réaffiche l'état réellement enregistré
            api(`/api/agence/clients/${id}`)
              .then(({ client }) => pendingRef.current === 0 && setRec(client))
              .catch(() => {});
          }
          throw e;
        }
      });
      queueRef.current = run.catch(() => {});
      return run;
    },
    [id]
  );

  const brief = useMemo(() => (rec ? renderBrief(rec, origin, settings?.hosting) : null), [rec, origin, settings]);
  const images = useMemo(() => (rec ? renderImages(rec, origin) : []), [rec?.brief?.photos, rec?.aiImages, rec?.stockImages, rec?.id, origin]); // eslint-disable-line react-hooks/exhaustive-deps
  const srcOf = useCallback((imgId) => `/api/files/${id}/${imgId}`, [id]);

  const runner = svc?.ai ? apiRunner() : null;
  const imageGen = svc?.aiImages ? apiImageGen() : null;
  const imagesFn = svc?.images ? apiImages() : null;

  function startImages(content, current, { more = false } = {}) {
    imgAbortRef.current?.abort();
    const ctl = new AbortController();
    imgAbortRef.current = ctl;
    const photos = (current.brief?.photos || []).length;
    const base = more ? current.aiImages || [] : [];
    const prompts = (content.imagePrompts || []).slice(0, more ? Math.max(4, aiImagesNeeded(photos)) : aiImagesNeeded(photos));
    if (imageGen && current.brief?.aiImages !== false && prompts.length) {
      setImgStatus({ state: 'running', done: 0, total: prompts.length });
      const genOne = async (p, signal) => {
        const img = await imageGen(p, signal);
        return uploadImage(`/api/agence/clients/${id}/images`, img.blob, { kind: 'ia', alt: img.alt || p.alt || '', filename: 'image-ia.jpg', batch: current.imageBatch || '', signal });
      };
      generateImages(genOne, prompts, {
        signal: ctl.signal,
        onImage: (list) => {
          if (ctl.signal.aborted) return;
          setRec((r) => ({ ...r, aiImages: [...base, ...list] }));
          setImgStatus((st) => ({ ...st, done: list.length }));
        },
      }).then(({ images: done, errors }) => {
        if (ctl.signal.aborted) return;
        setImgStatus({ state: done.length ? 'done' : 'failed', done: done.length, total: prompts.length, error: errors[0]?.message || '' });
      });
      return;
    }
    setImgStatus({ state: 'idle' });
    if (imagesFn && photos < 3 && content.imageKeywords?.length) {
      imagesFn(content.imageKeywords)
        .then((imgs) => {
          if (!ctl.signal.aborted && imgs?.length) save({ stockImages: imgs.slice(0, 12) }, null, true).catch(() => {});
        })
        .catch(() => {});
    }
  }

  async function generate({ resume = false } = {}) {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    if (!resume) partialRef.current = {};
    imgAbortRef.current?.abort();
    setImgStatus({ state: 'idle' });
    setGen({ progress: {}, failure: null });
    setView(null);
    try {
      const r = await generateSite(rec.brief, runner, {
        signal: ctl.signal,
        done: partialRef.current,
        onPart: (part, state) => setGen((g) => ({ ...g, progress: { ...g.progress, [part]: state } })),
      });
      partialRef.current = {};
      if (ctl.signal.aborted) return;
      // Nouveau lot d'images : une image d'une génération précédente encore en route sera ignorée
      const imageBatch = Math.random().toString(36).slice(2, 12);
      const client = await save({ result: r, status: 'generated', aiImages: [], stockImages: [], picked: [], choice: null, imageBatch }, `Propositions générées (${r.models.length} modèles${r.source === 'demo' ? ', textes génériques' : ''})`);
      setGen(null);
      startImages(r.content, client);
    } catch (e) {
      if (ctl.signal.aborted || e?.code === 'cancelled') return;
      if (e?.partial) partialRef.current = e.partial;
      const fixable = ['auth', 'credit', 'workspace', 'model', 'no_key'].includes(e?.code);
      setGen((g) => ({ ...g, failure: { part: e?.part, message: (e?.message || 'L’IA n’a pas répondu.') + (fixable ? ' Corrigez ce réglage dans Vercel, puis reprenez.' : ''), canResume: e?.code !== 'bad_request' } }));
    }
  }

  async function saveBrief() {
    setSavingBrief(true);
    try {
      const set = { brief: draft };
      if (!draft.businessName && rec.name) set.brief = { ...draft, businessName: rec.name };
      if (rec.status === 'sent') set.status = 'answered';
      await save(set, rec.status === 'sent' ? 'Brief rempli par l’agence' : 'Brief modifié par l’agence', false, { briefRev: draftRevRef.current });
      setView(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingBrief(false);
    }
  }

  async function remove() {
    try {
      await api(`/api/agence/clients/${id}`, { method: 'DELETE' });
      window.location.href = '/agence';
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !rec) {
    return (
      <div className="ss">
        <AgencyBar studioName={studioName} />
        <main className="page">
          <a className="back" href="/agence">
            Tous les clients
          </a>
          <div className="alert" role="alert">
            {error}
          </div>
        </main>
      </div>
    );
  }
  if (!rec || !svc) {
    return (
      <div className="ss">
        <AgencyBar studioName={studioName} />
        <main className="page">
          <Spinner label="Ouverture du dossier…" />
        </main>
      </div>
    );
  }

  const name = rec.brief?.businessName || rec.name;
  const qLink = `${origin}/questionnaire/${id}`;
  const pLink = `${origin}/propositions/${id}`;
  const owner = settings?.ownerName || '';
  const qText = `Bonjour,\n\nPour créer le site de ${name}, voici votre questionnaire :\n${qLink}\n\nComptez une dizaine de minutes. Vos réponses sont enregistrées à chaque étape : vous pouvez vous arrêter et reprendre plus tard avec le même lien. Pensez à préparer votre logo et quelques photos (votre lieu, votre équipe, vos réalisations).\n\nÀ bientôt,\n${owner}`;
  const pText = `Bonjour,\n\nVos propositions de site pour ${name} sont prêtes :\n${pLink}\n\nOuvrez chaque modèle en grand, parcourez ses pages, puis choisissez celui que vous préférez. Vous pouvez ajouter un commentaire avec votre choix.\n\nÀ bientôt,\n${owner}`;
  const stage = stageOf(rec.status);

  let panel;
  if (view === 'edit') {
    panel = (
      <AgencyForm
        brief={draft}
        setBrief={setDraft}
        steps={STEPS7}
        title={`Brief de ${name}`}
        intro="Les mêmes questions que le questionnaire client. Ce qui est enregistré ici remplace ses réponses."
        submitLabel="Enregistrer le brief"
        barText="Enregistrez pour revenir au dossier."
        examples={false}
        onCancel={() => setView(null)}
        onSubmit={saveBrief}
        busy={savingBrief}
        extra={remoteExtra({ brief: draft, setBrief: setDraft, uploadUrl: `/api/agence/clients/${id}/images`, srcOf, aiAvailable: Boolean(imageGen) })}
      />
    );
  } else if (gen) {
    panel = (
      <section className="panel">
        <Generating
          progress={gen.progress}
          name={name}
          source={runner ? 'ai' : 'demo'}
          failure={gen.failure}
          onCancel={() => {
            abortRef.current?.abort();
            setGen(null);
          }}
          onResume={() => generate({ resume: true })}
          onEdit={() => {
            setGen(null);
            openEdit(rec);
          }}
        />
      </section>
    );
  } else if (view === 'select' || (rec.status === 'generated' && rec.result)) {
    panel = (
      <SelectPanel
        rec={rec}
        settings={settings}
        brief={brief}
        images={images}
        save={save}
        onRegenerate={() => generate()}
        imgStatus={imgStatus}
        onRetryImages={imageGen ? () => startImages(rec.result.content, rec, { more: imgStatus.state !== 'failed' }) : null}
        onClose={view === 'select' ? () => setView(null) : null}
      />
    );
  } else if (rec.status === 'sent') {
    panel = (
      <section className="panel card">
        <h2>Envoyez le questionnaire à votre client</h2>
        <p className="muted">
          {rec.qStep > 0 ? `Le client a commencé : étape ${Math.min(rec.qStep + 1, 7)} sur 7, dernière activité ${timeAgo(rec.updatedAt)}.` : 'Il répond depuis son téléphone ou son ordinateur. Vous êtes prévenu ici dès qu’il a terminé.'}
        </p>
        <SendBox link={qLink} text={qText} contact={rec.contact} subject={`Votre site internet : le questionnaire`} openLabel="Voir le questionnaire" />
        <div className="panel-foot">
          <span className="muted">Vous avez ses infos sous la main ?</span>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => {
              openEdit(rec);
            }}
          >
            Remplir le brief à sa place
          </button>
        </div>
      </section>
    );
  } else if (!rec.brief) {
    panel = (
      <section className="panel card">
        <h2>Remplissez le brief</h2>
        <p className="muted">Les mêmes questions que le questionnaire client, sur une seule page.</p>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            openEdit(rec);
          }}
        >
          Remplir le brief
        </button>
      </section>
    );
  } else if (rec.status === 'answered' || !rec.result) {
    const missing = missingLegal(rec.brief);
    panel = (
      <section className="panel card">
        <h2>{rec.filledBy === 'agence' && !rec.submittedAt ? 'Brief prêt' : 'Les réponses sont arrivées'}</h2>
        <p className="muted">
          {rec.submittedAt ? `Questionnaire terminé le ${fmtDate(rec.submittedAt)}. ` : ''}Relisez les réponses du client, puis lancez la génération : il ne voit rien de cette étape.
        </p>
        {!runner && <div className="alert soft">Mode démo : aucune clé Claude n’est configurée, les modèles utiliseront des textes génériques.</div>}
        {missing.length > 0 && <p className="note">Il manque encore : {missing.join(', ')}. Vous pourrez les compléter avant la mise en ligne.</p>}
        <div className="row-actions">
          <button type="button" className="btn primary" onClick={() => generate()}>
            Générer les 10 propositions
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              openEdit(rec);
            }}
          >
            Modifier le brief
          </button>
        </div>
      </section>
    );
  } else if (rec.status === 'proposed') {
    const pickedModels = (rec.picked || []).map((pid) => rec.result.models.find((m) => m.id === pid)).filter(Boolean);
    panel = (
      <section className="panel card">
        <h2>Envoyez la sélection à votre client</h2>
        <p className="muted">
          {plural(pickedModels.length, 'modèle retenu', 'modèles retenus')} : {pickedModels.map(archName).join(', ')}. Sélection validée {timeAgo(rec.proposedAt)}. Le client choisit depuis sa page, et vous le voyez ici.
        </p>
        <SendBox link={pLink} text={pText} contact={rec.contact} subject={`Votre site internet : vos propositions`} openLabel="Voir sa page" />
        <div className="panel-foot">
          <button type="button" className="btn secondary small" onClick={() => setView('select')}>
            Modifier la sélection
          </button>
          <button type="button" className="btn-text small" onClick={() => setChoosing((c) => !c)}>
            Il m’a donné son choix par téléphone
          </button>
        </div>
        {choosing && <ChooseForClient rec={rec} save={save} onCancel={() => setChoosing(false)} />}
      </section>
    );
  } else {
    panel = <Workspace rec={rec} settings={settings} brief={brief} images={images} save={save} onReselect={() => setView('select')} onRecord={(client) => pendingRef.current === 0 && setRec(client)} onEditBrief={() => openEdit(rec)} />;
  }

  return (
    <div className={`ss file-${rec.status}`}>
      <AgencyBar studioName={studioName} />
      <main className="page page-wide">
        <a className="back" href="/agence">
          Tous les clients
        </a>
        <div className="file-head">
          <div>
            <h1>{name}</h1>
            <p className="muted">{[rec.contact, rec.formula && `Formule ${rec.formula}`, `Dossier créé ${timeAgo(rec.createdAt)}`].filter(Boolean).join(' — ')}</p>
          </div>
          <span className={`turn-badge turn-${rec.status === 'live' ? 'done' : stage.waiting}`}>{rec.status === 'live' ? 'Terminé' : stage.waiting === 'agence' ? 'À vous de jouer' : 'En attente du client'}</span>
        </div>
        <StageStrip status={rec.status} />
        {error && (
          <div className="alert" role="alert">
            {error}{' '}
            <button type="button" className="btn-text small" onClick={() => setError('')}>
              Fermer
            </button>
          </div>
        )}
        <div className={`file-grid${view === 'edit' || view === 'select' || (rec.status === 'generated' && !gen) || ['chosen', 'live'].includes(rec.status) ? ' wide' : ''}`}>
          <div className="file-main">{panel}</div>
          <aside className="file-side">
            <section className="card side-card">
              <h2>Réponses du client</h2>
              <Answers rec={rec} srcOf={srcOf} />
              {rec.brief && view !== 'edit' && rec.status !== 'live' && (
                <button
                  type="button"
                  className="btn-text small"
                  onClick={() => {
                    openEdit(rec);
                  }}
                >
                  Modifier le brief
                </button>
              )}
            </section>
            <DriveAgence rec={rec} onRecord={(client) => pendingRef.current === 0 && setRec(client)} />
            <section className="card side-card">
              <h2>Historique</h2>
              <ol className="log">
                {[...(rec.log || [])].reverse().slice(0, 10).map((l, i) => (
                  <li key={i}>
                    <span>{l.what}</span>
                    <time className="muted" dateTime={l.at}>
                      {fmtDate(l.at)}
                    </time>
                  </li>
                ))}
              </ol>
            </section>
            <section className="side-danger">
              {confirmDelete ? (
                <p>
                  Supprimer définitivement le dossier, les réponses et les photos ?{' '}
                  <button type="button" className="btn-text small danger" onClick={remove}>
                    Supprimer
                  </button>{' '}
                  <button type="button" className="btn-text small" onClick={() => setConfirmDelete(false)}>
                    Annuler
                  </button>
                </p>
              ) : (
                <button type="button" className="btn-text small quiet" onClick={() => setConfirmDelete(true)}>
                  Supprimer le dossier
                </button>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
