'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emptyBrief, STEPS } from '../engine/questions.js';
import { ARCHETYPE_MAP } from '../engine/archetypes.js';
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

const archName = (m) => ARCHETYPE_MAP[m.archetype]?.name || m.archetype;

// Nouvelle mise en page pour le même modèle (on garde la palette)
function varyModel(m) {
  const current = JSON.stringify(resolveModel(m).variants);
  const paletteIndex = m.paletteIndex ?? resolveModel(m).paletteIndex;
  for (let s = (m.seed || 0) + 1; s < (m.seed || 0) + 25; s++) {
    const next = { ...m, seed: s, variants: undefined, paletteIndex };
    if (JSON.stringify(resolveModel(next).variants) !== current) return next;
  }
  return { ...m, seed: (m.seed || 0) + 1, variants: undefined, paletteIndex };
}

function nextPalette(m) {
  const n = ARCHETYPE_MAP[m.archetype]?.palettes.length || 1;
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

function Generating({ progress, onCancel, name, source, failure, onResume, onEdit }) {
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

function PreviewModal({ models, index, setIndex, brief, content, images, onChoose, onClose }) {
  const model = models[index];
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
            <strong>{archName(model)}</strong>
          </div>
          <button type="button" className="icon-btn" onClick={() => setIndex((index + 1) % models.length)} aria-label="Modèle suivant">
            ›
          </button>
        </div>
        <PageTabs pages={pages} value={page} onChange={setPage} />
        <div className="toolbar-right">
          <DeviceToggle value={device} onChange={setDevice} />
          <button type="button" className="btn primary small" onClick={() => onChoose(model)}>
            Choisir ce modèle
          </button>
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

function ImageStatus({ status, agency, onRetry }) {
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

// Enregistrement dans Google Drive : visible seulement en mode agence
function DriveStatus({ status, onRetry }) {
  if (!status || status.state === 'idle') return null;
  if (status.state === 'running') {
    return (
      <div className="img-status drive-status" role="status">
        <span className="gen-dot" aria-hidden="true" />
        Drive : enregistrement en cours…
      </div>
    );
  }
  if (status.state === 'failed') {
    return (
      <div className="alert soft drive-status" role="status">
        Drive : l’enregistrement a échoué. {status.message || ''}{' '}
        {onRetry && (
          <button type="button" className="btn-text small" onClick={onRetry}>
            Réessayer
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="img-status done drive-status" role="status">
      Drive : {status.zip ? 'brief, photos et site enregistrés' : 'brief et photos enregistrés'}.{' '}
      {status.dossier && (
        <a href={status.dossier} target="_blank" rel="noopener noreferrer">
          Ouvrir le dossier
        </a>
      )}
    </div>
  );
}

function Gallery({ result, brief, images, agency, onChoose, onUpdateModel, onEdit, onRegenerate, warnings, imgStatus, onRetryImages, driveStatus, onRetryDrive }) {
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
      {agency && <DriveStatus status={driveStatus} onRetry={onRetryDrive} />}
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
        />
      )}
    </div>
  );
}

// ---------- Site final ----------
function FinalView({ result, model, brief, images, agency, onBack, onEdit, onUpdateModel, saveFile, imgStatus, onRetryImages, onZip, driveStatus, onRetryDrive }) {
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
      onZip?.(blob);
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
          {agency && <DriveStatus status={driveStatus} onRetry={onRetryDrive} />}
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
export default function App({ mode = 'client', runner = null, imagesFn = null, imageGen = null, drive = null, saveFile, banner = null, modeSwitch = null, appName = 'Studio Site' }) {
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
  // Enregistrement dans Google Drive (brief, photos, .zip), les envois passent l'un après l'autre
  const [driveStatus, setDriveStatus] = useState({ state: 'idle' });
  const driveSession = useRef(null);
  const driveBriefKey = useRef('');
  const drivePhotos = useRef(new Set());
  const driveZipKey = useRef('');
  const driveTask = useRef(Promise.resolve());

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
    if (!resume) {
      partialRef.current = {};
      syncDrive();
    }
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

  // Brief et nouvelles photos vers le Drive (sans bloquer la génération)
  function syncDrive() {
    if (!drive) return driveTask.current;
    const snapshot = { brief, photos: photos.filter((p) => p.source === 'client' && p.blob) };
    driveTask.current = driveTask.current.catch(() => {}).then(() => pushDrive(snapshot));
    return driveTask.current;
  }

  async function pushDrive({ brief: b, photos: list }) {
    const key = JSON.stringify(b);
    const pending = () => list.filter((p) => !drivePhotos.current.has(p.id));
    if (key === driveBriefKey.current && driveSession.current && !pending().length) return;
    setDriveStatus((s) => ({ ...s, state: 'running', message: '' }));
    try {
      if (key !== driveBriefKey.current || !driveSession.current) {
        const r = await drive.brief(b, { mode, photos: list.length });
        if (driveSession.current?.identifiant !== r.identifiant) {
          drivePhotos.current = new Set();
          driveZipKey.current = '';
        }
        driveSession.current = { identifiant: r.identifiant, jeton: r.jeton };
        driveBriefKey.current = key;
        setDriveStatus((s) => ({ ...s, dossier: r.dossier || s.dossier, zip: false }));
      }
      for (const p of pending()) {
        const nom = String(p.file || '').split('/').pop() || `photo-${p.id}.jpg`;
        await drive.fichier({ ...driveSession.current, dossier: 'photos', nom, blob: p.blob });
        drivePhotos.current.add(p.id);
      }
      setDriveStatus((s) => ({ ...s, state: 'done', message: '' }));
    } catch (e) {
      console.warn('[drive]', e?.message);
      setDriveStatus((s) => ({ ...s, state: 'failed', message: e?.message || '' }));
    }
  }

  // .zip téléchargé : une copie dans « 3-Versions du site » (une seule par modèle et par brief)
  function zipToDrive(blob, model) {
    if (!drive) return;
    syncDrive();
    driveTask.current = driveTask.current
      .catch(() => {})
      .then(async () => {
        const key = JSON.stringify([driveBriefKey.current, model.id, model.archetype, model.seed, model.paletteIndex, model.variants || null]);
        if (!driveSession.current || key === driveZipKey.current) return;
        setDriveStatus((s) => ({ ...s, state: 'running', message: '' }));
        try {
          await drive.fichier({ ...driveSession.current, dossier: 'versions', nom: 'auto', blob });
          driveZipKey.current = key;
          setDriveStatus((s) => ({ ...s, state: 'done', zip: true, message: '' }));
        } catch (e) {
          console.warn('[drive]', e?.message);
          setDriveStatus((s) => ({ ...s, state: 'failed', message: e?.message || '' }));
        }
      });
  }

  function cancel() {
    abortRef.current?.abort();
    setScreen(result ? 'gallery' : 'form');
  }

  function updateModel(m) {
    setResult((r) => ({ ...r, models: r.models.map((x) => (x.id === m.id ? m : x)) }));
  }

  const chosen = result?.models.find((m) => m.id === chosenId) || null;
  const formExtra = { photos, setPhotos, aiAvailable: Boolean(imageGen), driveEnabled: Boolean(drive) };

  return (
    <div className={`ss ss-${screen}`}>
      <Header mode={mode} appName={appName} modeSwitch={modeSwitch} onHome={() => setScreen(result ? 'gallery' : 'form')} />
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
            driveStatus={driveStatus}
            onRetryDrive={() => syncDrive()}
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
            onZip={(blob) => zipToDrive(blob, chosen)}
            driveStatus={driveStatus}
            onRetryDrive={() => syncDrive()}
          />
        )}
      </main>
    </div>
  );
}
