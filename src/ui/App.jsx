'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emptyBrief, STEPS } from '../engine/questions.js';
import { ARCHETYPE_MAP } from '../engine/archetypes.js';
import { modelName, insertVersions, versionsOf, baseOf, versionLabel } from '../engine/variants.js';
import { renderPage, sitePages, resolveModel } from '../engine/render.js';
import { buildZip, zipName } from '../engine/zip.js';
import { generateSite, PART_LABELS } from '../ai/generate.js';
import { PARTS } from '../engine/prompts.js';
import { aiImagesNeeded, generateImages } from '../ai/images.js';
import { ClientStepper, AgencyForm } from './Questionnaire.jsx';
import { ThumbFrame, DeviceFrame, DeviceToggle, PageTabs } from './Frames.jsx';

const store = {
  get(key) {
    try {
      const v = window.localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

export const archName = (m) => modelName(m);

// Nouvelle mise en page pour le même modèle (on garde la palette)
export function varyModel(m) {
  const current = JSON.stringify(resolveModel(m).variants);
  const paletteIndex = m.paletteIndex ?? resolveModel(m).paletteIndex;
  for (let s = (m.seed || 0) + 1; s < (m.seed || 0) + 25; s++) {
    const next = { ...m, seed: s, variants: undefined, paletteIndex };
    if (JSON.stringify(resolveModel(next).variants) !== current) return next;
  }
  return { ...m, seed: (m.seed || 0) + 1, variants: undefined, paletteIndex };
}

export function nextPalette(m) {
  const n = resolveModel(m).arch.palettes.length || 1;
  return { ...m, paletteIndex: ((m.paletteIndex ?? resolveModel(m).paletteIndex) + 1) % n };
}

// ---------- En-tête ----------
function Header({ mode, appName, modeSwitch, onHome }) {
  return (
    <header className="app-header">
      <button type="button" className="brand" onClick={onHome} aria-label={`${appName} — revenir au début`}>
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        {appName}
      </button>
      <div className="app-header-right">
        {modeSwitch}
        {!modeSwitch && mode === 'agence' && <span className="badge">Mode agence</span>}
      </div>
    </header>
  );
}

// ---------- Génération en cours (3 étapes successives) ----------
const STATE_TEXT = { done: 'terminé', failed: 'échec', running: 'en cours', retrying: 'nouvelle tentative', pending: 'en attente' };

export function Generating({ progress, onCancel, name, source, failure, onResume, onEdit }) {
  return (
    <div className="generating">
      <div className={`gen-visual${failure ? ' stopped' : ''}`} aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
      <h1>{failure ? 'La génération s’est arrêtée' : `Nous préparons 10 propositions pour ${name || 'votre site'}`}</h1>
      <p className="muted">
        {failure
          ? 'Les étapes déjà terminées sont conservées : la reprise repart de l’étape interrompue.'
          : source === 'ai'
            ? 'Trois étapes, l’une après l’autre. Comptez en général 1 à 3 minutes.'
            : 'Quelques secondes suffisent.'}
      </p>
      <ol className="gen-list" aria-live="polite">
        {PARTS.map((id) => {
          const st = progress[id] || 'pending';
          return (
            <li key={id} className={`gen-item ${st}`}>
              <span className="gen-dot" aria-hidden="true" />
              {PART_LABELS[id]}
              {st === 'retrying' && <span className="gen-note">Nouvelle tentative…</span>}
              {st === 'pending' && <span className="gen-wait">En attente</span>}
              <span className="sr-only"> : {STATE_TEXT[st]}</span>
            </li>
          );
        })}
      </ol>
      {failure ? (
        <div className="gen-failure">
          <div className="alert" role="alert">
            <strong>{failure.part ? `L’étape « ${PART_LABELS[failure.part]} » n’a pas abouti.` : 'Une étape n’a pas abouti.'}</strong> {failure.message}
          </div>
          <div className="gen-actions">
            {failure.canResume && (
              <button type="button" className="btn primary" onClick={onResume}>
                Reprendre la génération
              </button>
            )}
            <button type="button" className="btn secondary" onClick={onEdit}>
              Modifier le brief
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn secondary" onClick={onCancel}>
          Annuler
        </button>
      )}
    </div>
  );
}

// ---------- Galerie des 10 modèles ----------
function ModelCard({ model, index, brief, content, images, agency, onOpen, onChoose, onVary, onPalette }) {
  const html = useMemo(() => renderPage('index', { brief, content, model, images, mode: 'preview', imageSize: 'thumb' }), [brief, content, model, images]);
  return (
    <article className="model-card">
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
          <button type="button" className="btn secondary small" onClick={onOpen}>
            Voir en grand
          </button>
          <button type="button" className="btn primary small" onClick={onChoose}>
            Choisir
          </button>
          {agency && (
            <>
              <button type="button" className="btn-text small" onClick={onVary}>
                Varier la mise en page
              </button>
              <button type="button" className="btn-text small" onClick={onPalette}>
                Autre palette
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

// withVersions : chaque style se parcourt en 4 versions (onglets « Version 1 » à « Version 4 »)
// pool : modèles où chercher le modèle de départ d'une version (en plus de `models`)
export function PreviewModal({ models, index, setIndex, brief, content, images, onChoose, onClose, renderAction, label, withVersions = false, pool = [] }) {
  const current = models[index];
  const base = withVersions ? baseOf(current, [...models, ...pool]) : current;
  const versions = useMemo(() => (withVersions ? versionsOf(base) : [current]), [withVersions, base, current]);
  const [vIndex, setVIndex] = useState(() => versions.findIndex((v) => v.id === current.id));
  useEffect(() => setVIndex(versions.findIndex((v) => v.id === current.id)), [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const model = versions[vIndex] || current;
  const [page, setPage] = useState('index');
  const [device, setDevice] = useState('desktop');
  const pages = useMemo(() => sitePages(brief, content), [brief, content]);
  const html = useMemo(() => renderPage(page, { brief, content, model, images, mode: 'preview' }), [page, brief, content, model, images]);
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => setPage('index'), [index]);
  const nav = useCallback((p) => setPage(p), []);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`Modèle ${archName(model)}`}>
      <div className="toolbar">
        <div className="toolbar-left">
          <button type="button" className="icon-btn" onClick={() => setIndex((index + models.length - 1) % models.length)} aria-label="Modèle précédent">
            ‹
          </button>
          <div className="toolbar-title">
            <span className="model-rank">{index + 1}</span>
            <strong>{label ? label(model, index) : archName(model)}</strong>
          </div>
          <button type="button" className="icon-btn" onClick={() => setIndex((index + 1) % models.length)} aria-label="Modèle suivant">
            ›
          </button>
          {versions.length > 1 && (
            <div className="vtabs" role="group" aria-label="Versions de ce style">
              {versions.map((v, i) => (
                <button key={v.id} type="button" aria-pressed={i === vIndex} onClick={() => setVIndex(i)} title={archName(v)}>
                  {versionLabel(v, i)}
                </button>
              ))}
            </div>
          )}
        </div>
        <PageTabs pages={pages} value={page} onChange={setPage} />
        <div className="toolbar-right">
          <DeviceToggle value={device} onChange={setDevice} />
          {renderAction ? (
            renderAction(model)
          ) : (
            <button type="button" className="btn primary small" onClick={() => onChoose(model)}>
              Choisir ce modèle
            </button>
          )}
          <button type="button" className="icon-btn" ref={closeRef} onClick={onClose} aria-label="Fermer l’aperçu">
            ✕
          </button>
        </div>
      </div>
      <div className="stage">
        <DeviceFrame html={html} device={device} onNavigate={nav} title={`Site ${archName(model)}`} />
      </div>
    </div>
  );
}

export function ImageStatus({ status, agency, onRetry }) {
  if (!status || status.state === 'idle') return null;
  if (status.state === 'running') {
    return (
      <div className="img-status" role="status">
        <span className="gen-dot" aria-hidden="true" />
        Création des images par l’IA : {status.done} sur {status.total}. Les modèles se mettent à jour tout seuls.
      </div>
    );
  }
  if (status.state === 'failed') {
    return (
      <div className="alert soft" role="status">
        Les images n’ont pas pu être créées. {status.error || ''} Les modèles utilisent vos photos et des illustrations.{' '}
        {onRetry && (
          <button type="button" className="btn-text small" onClick={onRetry}>
            Réessayer
          </button>
        )}
      </div>
    );
  }
  if (!agency) return null;
  return (
    <div className="img-status done" role="status">
      {status.done < status.total ? `${status.done} images sur ${status.total} créées par l’IA.` : `${status.done} images créées par l’IA.`}{' '}
      {onRetry && (
        <button type="button" className="btn-text small" onClick={onRetry}>
          Créer d’autres images
        </button>
      )}
    </div>
  );
}

function Gallery({ result, brief, images, agency, onChoose, onUpdateModel, onEdit, onRegenerate, warnings, imgStatus, onRetryImages }) {
  const [open, setOpen] = useState(null);
  const { models, content } = result;
  return (
    <div className="gallery">
      <div className="gallery-head">
        <div>
          <h1>{agency ? `10 modèles pour ${brief.businessName}` : 'Vos 10 propositions'}</h1>
          <p className="muted">Classées de la plus adaptée à la moins adaptée. Ouvrez celles qui vous plaisent, puis choisissez votre modèle.</p>
        </div>
        <div className="gallery-head-actions">
          <button type="button" className="btn secondary" onClick={onEdit}>
            {agency ? 'Modifier le brief' : 'Modifier mes réponses'}
          </button>
          {agency && (
            <button type="button" className="btn secondary" onClick={onRegenerate}>
              Relancer la génération
            </button>
          )}
        </div>
      </div>
      {warnings.map((w) => (
        <div key={w} className="alert soft">
          {w}
        </div>
      ))}
      <ImageStatus status={imgStatus} agency={agency} onRetry={onRetryImages} />
      <div className="model-grid">
        {models.map((m, i) => (
          <ModelCard
            key={m.id}
            model={m}
            index={i}
            brief={brief}
            content={content}
            images={images}
            agency={agency}
            onOpen={() => setOpen(i)}
            onChoose={() => onChoose(m)}
            onVary={() => onUpdateModel(varyModel(m))}
            onPalette={() => onUpdateModel(nextPalette(m))}
          />
        ))}
      </div>
      {open !== null && (
        <PreviewModal
          models={models}
          index={open}
          setIndex={setOpen}
          brief={brief}
          content={content}
          images={images}
          onChoose={(m) => {
            setOpen(null);
            onChoose(m);
          }}
          onClose={() => setOpen(null)}
          withVersions
        />
      )}
    </div>
  );
}

// ---------- Site final ----------
function FinalView({ result, model, brief, images, agency, onBack, onEdit, onUpdateModel, saveFile, imgStatus, onRetryImages }) {
  const { content } = result;
  const [page, setPage] = useState('index');
  const [device, setDevice] = useState('desktop');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const pages = useMemo(() => sitePages(brief, content), [brief, content]);
  const html = useMemo(() => renderPage(page, { brief, content, model, images, mode: 'preview' }), [page, brief, content, model, images]);
  const nav = useCallback((p) => setPage(p), []);

  async function download() {
    setBusy(true);
    setNote('');
    try {
      const blob = await buildZip({ brief, content, model, images });
      const r = await saveFile(blob, zipName(brief));
      if (r !== false) setNote('Le fichier .zip est prêt dans vos téléchargements.');
    } catch (e) {
      setNote(e?.message || 'Le téléchargement n’a pas abouti. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  async function copyBrief() {
    const text = JSON.stringify({ brief, modele: { archetype: model.archetype, seed: model.seed, paletteIndex: model.paletteIndex } }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setNote('Brief copié dans le presse-papiers.');
    } catch {
      setNote('Copie impossible ici : utilisez le téléchargement du site, le brief y figure.');
    }
  }

  const notes = [];
  if (content.productsAreExamples) notes.push('Les produits affichés sont des exemples proposés par l’IA : remplacez-les par les vrais produits avant la mise en ligne.');
  notes.push('Complétez la page « Mentions légales » (SIRET, hébergeur…) avant la mise en ligne.');
  if (!images?.length) notes.push('Aucune photo : les visuels sont des illustrations graphiques. Ajoutez les photos du client ou activez les images IA (clé Gemini).');
  if (images?.some((i) => i.source === 'ia')) notes.push('Les images créées par l’IA servent d’illustrations d’ambiance : ne les présentez pas comme de vrais produits, de vrais lieux ou de vraies personnes.');
  if (brief.siteType === 'boutique') notes.push('Boutique : les commandes arrivent par e-mail, le paiement en ligne n’est pas encore branché.');
  notes.push('Les formulaires ouvrent la messagerie du visiteur avec le message prêt à envoyer.');

  return (
    <div className="final">
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="toolbar-title">
            <strong>{agency ? `${brief.businessName}` : 'Votre site est prêt'}</strong>
            <span className="muted">Modèle {archName(model)}</span>
          </div>
        </div>
        <PageTabs pages={pages} value={page} onChange={setPage} />
        <div className="toolbar-right">
          <DeviceToggle value={device} onChange={setDevice} />
        </div>
      </div>
      <div className="final-body">
        <div className="stage">
          <DeviceFrame html={html} device={device} onNavigate={nav} title={`Site ${brief.businessName}`} />
        </div>
        <aside className="final-side">
          <ImageStatus status={imgStatus} agency={agency} onRetry={onRetryImages} />
          <button type="button" className="btn primary block" onClick={download} disabled={busy || imgStatus?.state === 'running'}>
            {busy ? 'Préparation du fichier…' : agency ? 'Télécharger le site (.zip)' : 'Télécharger mon site'}
          </button>
          {note && (
            <p className="side-note" role="status">
              {note}
            </p>
          )}
          <button type="button" className="btn secondary block" onClick={onBack}>
            Choisir un autre modèle
          </button>
          {agency && (
            <div className="side-row">
              <button type="button" className="btn-text small" onClick={() => onUpdateModel(varyModel(model))}>
                Varier la mise en page
              </button>
              <button type="button" className="btn-text small" onClick={() => onUpdateModel(nextPalette(model))}>
                Autre palette
              </button>
            </div>
          )}
          <button type="button" className="btn-text small" onClick={onEdit}>
            {agency ? 'Modifier le brief' : 'Modifier mes réponses'}
          </button>
          {agency && (
            <button type="button" className="btn-text small" onClick={copyBrief}>
              Copier le brief (JSON)
            </button>
          )}
          <div className="side-block">
            <h2>{agency ? 'Avant de livrer' : 'Pour le mettre en ligne'}</h2>
            {agency ? (
              <ul>
                {notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : (
              <ol>
                <li>Téléchargez puis dézippez le fichier.</li>
                <li>
                  Ouvrez{' '}
                  <a href="https://app.netlify.com/drop" target="_blank" rel="noopener noreferrer">
                    app.netlify.com/drop
                  </a>
                  .
                </li>
                <li>Glissez-y le dossier : votre site est en ligne.</li>
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------- Application ----------
export default function App({ mode = 'client', runner = null, imagesFn = null, imageGen = null, saveFile, banner = null, modeSwitch = null, appName = 'Studio Site', header }) {
  const agency = mode === 'agence';
  const draftKey = `studio-site:brief:${mode}`;
  const [brief, setBrief] = useState(() => emptyBrief());
  const [screen, setScreen] = useState('form');
  const [progress, setProgress] = useState({});
  const [result, setResult] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [aiImgs, setAiImgs] = useState([]);
  const [stockImgs, setStockImgs] = useState([]);
  const [imgStatus, setImgStatus] = useState({ state: 'idle' });
  const imgAbortRef = useRef(null);
  // Ordre d'utilisation : photos du client, puis images IA, puis photos libres de droits
  const images = useMemo(() => [...photos, ...aiImgs, ...(aiImgs.length ? [] : stockImgs)], [photos, aiImgs, stockImgs]);
  const [chosenId, setChosenId] = useState(null);
  const [error, setError] = useState(null);
  const [errorStep, setErrorStep] = useState(0);
  const [source, setSource] = useState(runner ? 'ai' : 'demo');
  const [failure, setFailure] = useState(null);
  const partialRef = useRef({});
  const abortRef = useRef(null);
  const loaded = useRef(false);

  // Brouillon conservé dans le navigateur
  useEffect(() => {
    const saved = store.get(draftKey);
    if (saved && typeof saved === 'object') setBrief({ ...emptyBrief(), ...saved });
    loaded.current = true;
  }, [draftKey]);
  useEffect(() => {
    if (loaded.current) store.set(draftKey, brief);
  }, [brief, draftKey]);

  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [screen]);

  // resume = true : reprend à l'étape interrompue en gardant les étapes terminées
  async function run({ resume = false } = {}) {
    const useRunner = runner;
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setError(null);
    setFailure(null);
    if (!resume) partialRef.current = {};
    imgAbortRef.current?.abort();
    setAiImgs([]);
    setStockImgs([]);
    setImgStatus({ state: 'idle' });
    setSource(useRunner ? 'ai' : 'demo');
    setProgress({});
    setScreen('generating');
    try {
      const started = Date.now();
      const r = await generateSite(brief, useRunner, {
        signal: ctl.signal,
        done: partialRef.current,
        onPart: (part, state) => setProgress((p) => ({ ...p, [part]: state })),
      });
      partialRef.current = {};
      if (!useRunner) await new Promise((res) => setTimeout(res, Math.max(0, 900 - (Date.now() - started))));
      if (ctl.signal.aborted) return;
      setResult(r);
      setChosenId(null);
      setScreen('gallery');
      startImages(r.content);
    } catch (e) {
      if (ctl.signal.aborted || e?.code === 'cancelled') return;
      if (e?.partial) partialRef.current = e.partial;
      const fixable = ['auth', 'credit', 'workspace', 'model', 'no_key'].includes(e?.code);
      setFailure({
        part: e?.part,
        message: (e?.message || 'L’IA n’a pas répondu.') + (fixable ? ' Corrigez ce réglage dans Vercel, puis reprenez.' : ''),
        canResume: e?.code !== 'bad_request',
      });
    }
  }

  // Images : création par l'IA pour compléter les photos du client, sinon photos libres de droits
  function startImages(content) {
    imgAbortRef.current?.abort();
    const ctl = new AbortController();
    imgAbortRef.current = ctl;
    setAiImgs([]);
    setStockImgs([]);
    const needed = aiImagesNeeded(photos.length);
    const prompts = (content.imagePrompts || []).slice(0, needed);
    if (imageGen && brief.aiImages !== false && prompts.length) {
      setImgStatus({ state: 'running', done: 0, total: prompts.length });
      generateImages(imageGen, prompts, {
        signal: ctl.signal,
        onImage: (list) => {
          if (ctl.signal.aborted) return;
          setAiImgs(list);
          setImgStatus((st) => ({ ...st, done: list.length }));
        },
      }).then(({ images: done, errors }) => {
        if (ctl.signal.aborted) return;
        setAiImgs(done);
        setImgStatus({ state: done.length ? 'done' : 'failed', done: done.length, total: prompts.length, error: errors[0]?.message || '' });
      });
      return;
    }
    setImgStatus({ state: 'idle' });
    if (imagesFn && photos.length < 3 && content.imageKeywords?.length) {
      imagesFn(content.imageKeywords)
        .then((imgs) => {
          if (!ctl.signal.aborted && Array.isArray(imgs) && imgs.length) setStockImgs(imgs);
        })
        .catch(() => {});
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setScreen(result ? 'gallery' : 'form');
  }

  function updateModel(m) {
    setResult((r) => ({ ...r, models: r.models.map((x) => (x.id === m.id ? m : x)) }));
  }

  // Une version choisie dans « Voir en grand » rejoint la galerie (juste après son style)
  function ensureInGallery(m) {
    setResult((r) => (r.models.some((x) => x.id === m.id) ? r : { ...r, models: insertVersions(r.models, baseOf(m, r.models), [m]) }));
  }

  const chosen = result?.models.find((m) => m.id === chosenId) || null;
  const formExtra = { photos, setPhotos, aiAvailable: Boolean(imageGen) };

  return (
    <div className={`ss ss-${screen}`}>
      {header !== undefined ? header : <Header mode={mode} appName={appName} modeSwitch={modeSwitch} onHome={() => setScreen(result ? 'gallery' : 'form')} />}
      {banner && screen === 'form' && <div className="banner">{banner}</div>}
      <main className="app-main">
        {screen === 'form' &&
          (agency ? (
            <AgencyForm brief={brief} setBrief={setBrief} onSubmit={() => run()} error={error} extra={formExtra} />
          ) : (
            <ClientStepper brief={brief} setBrief={setBrief} onSubmit={() => run()} error={error} initialStep={errorStep} extra={formExtra} />
          ))}
        {screen === 'generating' && (
          <Generating
            progress={progress}
            onCancel={cancel}
            name={brief.businessName}
            source={source}
            failure={failure}
            onResume={() => run({ resume: true })}
            onEdit={() => {
              setFailure(null);
              setErrorStep(0);
              setScreen('form');
            }}
          />
        )}
        {screen === 'gallery' && result && (
          <Gallery
            result={result}
            brief={brief}
            images={images}
            agency={agency}
            warnings={[...(result.source === 'demo' && runner ? ['Textes génériques : relancez la génération pour obtenir des textes rédigés par l’IA.'] : []), ...result.warnings]}
            onChoose={(m) => {
              ensureInGallery(m);
              setChosenId(m.id);
              setScreen('final');
            }}
            onUpdateModel={updateModel}
            onEdit={() => {
              setErrorStep(0);
              setError(null);
              setScreen('form');
            }}
            onRegenerate={() => run()}
            imgStatus={imgStatus}
            onRetryImages={imageGen && agency ? () => startImages(result.content) : imgStatus.state === 'failed' && imageGen ? () => startImages(result.content) : null}
          />
        )}
        {screen === 'final' && result && chosen && (
          <FinalView
            result={result}
            model={chosen}
            brief={brief}
            images={images}
            agency={agency}
            saveFile={saveFile}
            onBack={() => setScreen('gallery')}
            onEdit={() => {
              setErrorStep(0);
              setError(null);
              setScreen('form');
            }}
            onUpdateModel={updateModel}
            imgStatus={imgStatus}
            onRetryImages={imageGen && (agency || imgStatus.state === 'failed') ? () => startImages(result.content) : null}
          />
        )}
      </main>
    </div>
  );
}
