'use client';
// Page des propositions : le client découvre la sélection, ouvre chaque site en grand et choisit
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { ClientShell, Spinner } from '../Chrome.jsx';
import { ThumbFrame } from '../Frames.jsx';
import { PreviewModal, archName } from '../App.jsx';
import { renderPage } from '../../engine/render.js';
import { renderImages, renderBrief } from '../../engine/records.js';

function ChooseDialog({ model, kicker, onCancel, onConfirm, busy, error, owner }) {
  const [comment, setComment] = useState('');
  return (
    <div className="sheet-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <form
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="choose-title"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(comment);
        }}
      >
        <p className="sheet-kicker">{kicker}</p>
        <h2 id="choose-title">Vous choisissez le modèle {archName(model)}</h2>
        <div className="q-field">
          <label className="q-label" htmlFor="choice-comment">
            Un commentaire pour {owner} ? <span className="q-req">(facultatif)</span>
          </label>
          <textarea id="choice-comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ex. J’aimerais une couleur plus douce, et ma photo de vitrine en premier." autoFocus />
        </div>
        {error && (
          <p className="q-error" role="alert">
            {error}
          </p>
        )}
        <div className="row-actions">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Envoi…' : 'Confirmer mon choix'}
          </button>
          <button type="button" className="btn-text" onClick={onCancel} disabled={busy}>
            Revenir aux propositions
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ProposalsApp({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [choosing, setChoosing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [chooseError, setChooseError] = useState('');
  const [changing, setChanging] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
    api(`/api/p/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  const client = data?.client;
  const studio = data?.studio;
  const owner = studio?.ownerName || 'Votre interlocuteur';
  const rec = useMemo(() => (client?.ready ? { id, brief: client.brief, aiImages: client.aiImages, stockImages: client.stockImages } : null), [client, id]);
  const brief = useMemo(() => (rec ? renderBrief(rec, origin) : null), [rec, origin]);
  const images = useMemo(() => (rec ? renderImages(rec, origin) : []), [rec, origin]);
  const thumbs = useMemo(() => (client?.ready && origin ? client.models.map((m) => renderPage('index', { brief, content: client.content, model: m, images, mode: 'preview', imageSize: 'thumb' })) : []), [client, brief, images, origin]);

  async function confirm(comment) {
    setBusy(true);
    setChooseError('');
    try {
      const d = await api(`/api/p/${id}`, { method: 'POST', body: { modelId: choosing.model.id, comment } });
      setData((x) => ({ ...x, client: d.client }));
      setChoosing(null);
      setOpen(null);
      setChanging(false);
      window.scrollTo?.(0, 0);
    } catch (e) {
      setChooseError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <ClientShell studio={studio}>
        <section className="public-card">
          <h1>Ce lien ne fonctionne pas</h1>
          <p className="lead">{error}</p>
        </section>
      </ClientShell>
    );
  }
  if (!data) {
    return (
      <ClientShell studio={studio}>
        <Spinner label="Ouverture de vos propositions…" />
      </ClientShell>
    );
  }
  if (!client.ready) {
    return (
      <ClientShell studio={studio}>
        <section className="public-card">
          <h1>Vos propositions arrivent bientôt</h1>
          <p className="lead">{owner} prépare les modèles de site pour {client.name}. Vous recevrez un message dès qu’ils seront prêts.</p>
        </section>
      </ClientShell>
    );
  }

  const chosen = client.chosenModel || null;
  const chosenThumb = chosen && origin ? renderPage('index', { brief, content: client.content, model: chosen, images, mode: 'preview', imageSize: 'thumb' }) : '';
  // Proposition à laquelle appartient le modèle choisi (lui-même ou l'une de ses versions)
  const isChosen = (m) => chosen && (chosen.id === m.id || (chosen.variantOf && (chosen.variantOf === m.id || chosen.variantOf === m.variantOf)));

  if (client.status === 'live') {
    return (
      <ClientShell studio={studio}>
        <section className="public-card done">
          <span className="done-mark" aria-hidden="true">
            ✓
          </span>
          <h1>Votre site est en ligne</h1>
          {client.liveUrl ? (
            <p className="lead">
              Il vous attend à cette adresse :{' '}
              <a href={client.liveUrl} target="_blank" rel="noopener noreferrer">
                {client.liveUrl.replace(/^https?:\/\//, '')}
              </a>
            </p>
          ) : (
            <p className="lead">{owner} vous a envoyé son adresse.</p>
          )}
        </section>
      </ClientShell>
    );
  }

  if (chosen && !changing) {
    return (
      <ClientShell studio={studio}>
        <section className="public-card done">
          <span className="done-mark" aria-hidden="true">
            ✓
          </span>
          <h1>C’est noté : vous avez choisi le modèle {archName(chosen)}</h1>
          <p className="lead">{owner} s’occupe maintenant de tout : finitions, nom de domaine et mise en ligne. Vous recevrez un lien pour vérifier votre site avant sa publication.</p>
          <div className="chosen-preview">
            <ThumbFrame html={chosenThumb} title={`Aperçu ${archName(chosen)}`} />
          </div>
          {client.choice.comment && <blockquote>{client.choice.comment}</blockquote>}
          <ol className="journey">
            <li className="done">Vos réponses</li>
            <li className="done">Les propositions</li>
            <li className="done">Votre choix</li>
            <li className="current">La mise en ligne</li>
          </ol>
          <p>
            Vous hésitez encore ?{' '}
            <button type="button" className="btn-text" onClick={() => setChanging(true)}>
              Revoir les propositions
            </button>
          </p>
        </section>
      </ClientShell>
    );
  }

  return (
    <ClientShell studio={studio}>
      <section className="proposals">
        <div className="proposals-head">
          <h1>Vos propositions de site pour {client.name}</h1>
          {client.message && (
            <figure className="letter">
              <blockquote>{client.message}</blockquote>
              <figcaption>{owner}</figcaption>
            </figure>
          )}
          <p className="muted">Touchez une proposition pour la voir en grand et parcourir toutes ses pages. Chaque proposition existe en 4 versions : passez de l’une à l’autre en haut de l’aperçu.</p>
        </div>
        <div className={`proposal-grid n${client.models.length}`}>
          {client.models.map((m, i) => (
            <article key={m.id} className={`proposal${isChosen(m) ? ' is-chosen' : ''}`}>
              <button type="button" className="model-thumb" onClick={() => setOpen(i)} aria-label={`Voir la proposition ${i + 1} en grand`}>
                <ThumbFrame html={thumbs[i]} title={`Aperçu ${archName(m)}`} />
              </button>
              <div className="proposal-info">
                <div className="model-title">
                  <span className="model-rank">{i + 1}</span>
                  <h2>{archName(m)}</h2>
                </div>
                {m.why && <p>{m.why}</p>}
                <div className="row-actions">
                  <button type="button" className="btn secondary small" onClick={() => setOpen(i)}>
                    Voir en grand
                  </button>
                  <button type="button" className="btn primary small" onClick={() => setChoosing({ model: m, kicker: `Proposition ${i + 1}` })}>
                    {chosen?.id === m.id ? 'Mon choix actuel' : 'Choisir ce modèle'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      {open !== null && (
        <PreviewModal
          models={client.models}
          index={open}
          setIndex={setOpen}
          brief={brief}
          content={client.content}
          images={images}
          onClose={() => setOpen(null)}
          withVersions
          pool={client.bases || []}
          renderAction={(m) => (
            <button type="button" className="btn primary small" onClick={() => setChoosing({ model: m, kicker: `Proposition ${open + 1}` })}>
              {chosen?.id === m.id ? 'Mon choix actuel' : 'Choisir cette version'}
            </button>
          )}
        />
      )}
      {choosing !== null && (
        <ChooseDialog
          model={choosing.model}
          kicker={choosing.kicker}
          owner={owner}
          busy={busy}
          error={chooseError}
          onCancel={() => {
            setChoosing(null);
            setChooseError('');
          }}
          onConfirm={confirm}
        />
      )}
    </ClientShell>
  );
}
