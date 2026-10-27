'use client';
import { useState, useRef } from 'react';
import { STEPS, validateStep, validateBrief, EXAMPLES, emptyBrief } from '../engine/questions.js';
import { prepareImage, MAX_PHOTOS } from '../ai/images.js';

// Envoi des photos du client : redimensionnées dans le navigateur, jamais envoyées au serveur
function PhotoField({ f, photos, setPhotos }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const left = MAX_PHOTOS - photos.length;

  async function add(fileList) {
    const files = Array.from(fileList || []).filter((x) => x && x.size);
    if (!files.length) return;
    setError('');
    if (left <= 0) {
      setError(`Vous avez déjà ${MAX_PHOTOS} photos : retirez-en une pour en ajouter une autre.`);
      return;
    }
    setBusy(true);
    const kept = files.slice(0, left);
    const out = [];
    let failed = 0;
    for (const file of kept) {
      if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name)) {
        failed++;
        continue;
      }
      try {
        out.push(await prepareImage(file, { source: 'client', alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }));
      } catch {
        failed++;
      }
    }
    setPhotos((p) => [...p, ...out].slice(0, MAX_PHOTOS));
    const msgs = [];
    if (failed) msgs.push(`${failed} fichier${failed > 1 ? 's n’ont' : ' n’a'} pas pu être lu${failed > 1 ? 's' : ''} : formats acceptés JPEG, PNG ou WebP.`);
    if (files.length > kept.length) msgs.push(`Seules les ${kept.length} premières photos ont été ajoutées (maximum ${MAX_PHOTOS}).`);
    setError(msgs.join(' '));
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function move(i, dir) {
    setPhotos((p) => {
      const n = [...p];
      const j = i + dir;
      if (j < 0 || j >= n.length) return p;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  return (
    <fieldset className="q-field">
      <legend className="q-label">{f.label}</legend>
      <p className="q-hint">{f.hint}</p>
      <label
        className={`dropzone${over ? ' over' : ''}${left <= 0 ? ' full' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
      >
        <input ref={inputRef} id="q-photos" type="file" accept="image/jpeg,image/png,image/webp,image/*" multiple onChange={(e) => add(e.target.files)} disabled={busy || left <= 0} />
        <span className="dropzone-title">{busy ? 'Préparation des photos…' : left <= 0 ? 'Nombre maximum de photos atteint' : 'Ajouter des photos'}</span>
        <span className="dropzone-hint">
          {photos.length} sur {MAX_PHOTOS}. Glissez-les ici ou cliquez pour choisir.
        </span>
      </label>
      {error && <p className="q-error">{error}</p>}
      {photos.length > 0 && (
        <>
          <p className="q-hint">La première photo sert d’image principale. Utilisez les flèches pour changer l’ordre.</p>
          <ul className="photo-grid">
            {photos.map((ph, i) => (
              <li key={ph.id} className="photo">
                <img src={ph.thumb} alt={ph.alt || `Photo ${i + 1}`} />
                {i === 0 && <span className="photo-badge">Principale</span>}
                <div className="photo-actions">
                  <button type="button" className="icon-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Avancer la photo ${i + 1}`}>
                    ←
                  </button>
                  <button type="button" className="icon-btn small" onClick={() => move(i, 1)} disabled={i === photos.length - 1} aria-label={`Reculer la photo ${i + 1}`}>
                    →
                  </button>
                  <button type="button" className="btn-text small" onClick={() => setPhotos((p) => p.filter((x) => x.id !== ph.id))}>
                    Retirer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </fieldset>
  );
}

function ToggleField({ f, brief, set, aiAvailable }) {
  const on = aiAvailable && brief[f.id] !== false;
  return (
    <div className="q-field">
      <label className={`q-toggle${aiAvailable ? '' : ' disabled'}`}>
        <input type="checkbox" checked={on} disabled={!aiAvailable} onChange={(e) => set(f.id, e.target.checked)} />
        <span>
          <span className="q-option-title">{f.label}</span>
          <span className="q-option-hint">{aiAvailable ? f.hint : 'Non disponible ici : il faut une clé Gemini sur le serveur de l’application. Vos photos et des illustrations graphiques seront utilisées.'}</span>
        </span>
      </label>
    </div>
  );
}

export function Field({ f, brief, set, error, extra = {} }) {
  if (f.showIf && !f.showIf(brief)) return null;
  if (f.type === 'photos' && extra.renderPhotos) return extra.renderPhotos(f, error);
  if (f.type === 'photos') return <PhotoField f={f} photos={extra.photos || []} setPhotos={extra.setPhotos || (() => {})} />;
  if (f.type === 'logo') return extra.renderLogo ? extra.renderLogo(f, error) : null;
  if (f.type === 'toggle' && extra.hideUnavailable && !extra.aiAvailable) return null;
  if (f.type === 'toggle') return <ToggleField f={f} brief={brief} set={set} aiAvailable={!!extra.aiAvailable} />;
  const v = brief[f.id];
  const id = `q-${f.id}`;
  const errId = error ? `${id}-err` : undefined;
  const hintId = f.hint ? `${id}-hint` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  const head = (
    <>
      <label className="q-label" htmlFor={id}>
        {f.label}
        {f.required && <span className="q-req"> (obligatoire)</span>}
      </label>
      {f.hint && (
        <p className="q-hint" id={hintId}>
          {f.hint}
        </p>
      )}
    </>
  );
  const err = error ? (
    <p className="q-error" id={errId}>
      {error}
    </p>
  ) : null;
  const cls = `q-field${f.half ? ' half' : ''}${error ? ' has-error' : ''}`;

  switch (f.type) {
    case 'textarea':
      return (
        <div className={cls}>
          {head}
          <textarea id={id} rows={f.rows || 3} value={v} placeholder={f.placeholder} onChange={(e) => set(f.id, e.target.value)} aria-invalid={!!error} aria-describedby={describedBy} />
          {err}
        </div>
      );
    case 'select':
      return (
        <div className={cls}>
          {head}
          <select id={id} value={v} onChange={(e) => set(f.id, e.target.value)} aria-invalid={!!error} aria-describedby={describedBy}>
            <option value="">Choisir…</option>
            {f.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {err}
        </div>
      );
    case 'radio':
      return (
        <fieldset className={cls}>
          <legend className="q-label">{f.label}</legend>
          <div className="q-options">
            {f.options.map((o) => (
              <label key={o.id} className={`q-option${v === o.id ? ' on' : ''}`}>
                <input type="radio" name={f.id} value={o.id} checked={v === o.id} onChange={() => set(f.id, o.id)} />
                <span className="q-option-title">{o.label}</span>
                {o.hint && <span className="q-option-hint">{o.hint}</span>}
              </label>
            ))}
          </div>
          {err}
        </fieldset>
      );
    case 'checks':
      return (
        <fieldset className={cls}>
          <legend className="q-label">{f.label}</legend>
          {f.hint && <p className="q-hint">{f.hint}</p>}
          <div className="q-options">
            {f.options.map((o) => {
              const on = (v || []).includes(o.id);
              return (
                <label key={o.id} className={`q-option${on ? ' on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => set(f.id, on ? v.filter((x) => x !== o.id) : [...(v || []), o.id])} />
                  <span className="q-option-title">{o.label}</span>
                </label>
              );
            })}
          </div>
          {err}
        </fieldset>
      );
    case 'chips': {
      const list = v || [];
      return (
        <fieldset className={cls}>
          <legend className="q-label">{f.label}</legend>
          {f.hint && <p className="q-hint">{f.hint}</p>}
          <div className="q-chips">
            {f.options.map((o) => {
              const on = list.includes(o.id);
              const full = !on && f.max && list.length >= f.max;
              return (
                <button key={o.id} type="button" className="q-chip" aria-pressed={on} disabled={full} onClick={() => set(f.id, on ? list.filter((x) => x !== o.id) : [...list, o.id])}>
                  {o.label}
                </button>
              );
            })}
          </div>
          {err}
        </fieldset>
      );
    }
    case 'color': {
      const valid = /^#?[0-9a-fA-F]{6}$/.test(v || '');
      return (
        <div className={cls}>
          {head}
          <div className="q-color">
            <input type="color" aria-label="Choisir une couleur" value={valid ? (v.startsWith('#') ? v : '#' + v) : '#3f3fd8'} onChange={(e) => set(f.id, e.target.value)} />
            <input id={id} type="text" value={v} placeholder="Ex. #1F5C4A" onChange={(e) => set(f.id, e.target.value.trim())} aria-describedby={describedBy} />
            {v ? (
              <button type="button" className="btn-text" onClick={() => set(f.id, '')}>
                Pas de préférence
              </button>
            ) : (
              <span className="q-hint">Aucune couleur imposée</span>
            )}
          </div>
          {err}
        </div>
      );
    }
    default:
      return (
        <div className={cls}>
          {head}
          <input id={id} type={f.type === 'email' ? 'email' : 'text'} inputMode={f.inputMode} value={v ?? ''} placeholder={f.placeholder} onChange={(e) => set(f.id, e.target.value)} aria-invalid={!!error} aria-describedby={describedBy} autoComplete="off" />
          {err}
        </div>
      );
  }
}

// ----- Mode client : une étape par écran -----
export function ClientStepper({ brief, setBrief, onSubmit, error, initialStep = 0, extra, steps = STEPS, intro, submitLabel = 'Créer mes 10 propositions', onNext, busy = false }) {
  const [step, setStep] = useState(initialStep);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const top = useRef(null);
  const STEPS_ = steps;
  const s = STEPS_[step];
  const last = step === STEPS_.length - 1;
  const set = (k, val) => {
    setBrief((b) => ({ ...b, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const go = (n) => {
    setStep(n);
    setErrors({});
    top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  async function next(e) {
    e.preventDefault();
    if (saving || busy) return;
    const errs = validateStep(s, brief);
    if (Object.keys(errs).length) {
      setErrors(errs);
      document.getElementById(`q-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    if (last) return onSubmit();
    // Sauvegarde à chaque étape (questionnaire envoyé au client)
    if (onNext) {
      setSaving(true);
      const okSave = await onNext(step + 1).catch(() => false);
      setSaving(false);
      if (!okSave) return;
    }
    go(step + 1);
  }
  return (
    <div className="stepper" ref={top}>
      {step === 0 && intro !== undefined && intro}
      {step === 0 && intro === undefined && (
        <div className="welcome">
          <h1>Votre site internet, prêt en quelques minutes</h1>
          <p>Répondez à quelques courtes séries de questions. Nous vous proposons ensuite 10 modèles différents, rédigés pour votre activité.</p>
          <button type="button" className="btn-text" onClick={() => setBrief({ ...EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)] })}>
            Essayer avec un exemple
          </button>
        </div>
      )}
      <div className="progress" aria-label={`Étape ${step + 1} sur ${STEPS_.length}`} style={{ gridTemplateColumns: `repeat(${STEPS_.length}, 1fr)` }}>
        {STEPS_.map((x, i) => (
          <button key={x.id} type="button" className={`progress-step${i === step ? ' current' : ''}${i < step ? ' done' : ''}`} onClick={() => i < step && go(i)} disabled={i > step} aria-current={i === step ? 'step' : undefined}>
            <span className="progress-bar" />
            <span className="progress-label">{x.title}</span>
          </button>
        ))}
      </div>
      <form className="card step-card" onSubmit={next} noValidate>
        <p className="step-count">
          Étape {step + 1} sur {STEPS_.length}
        </p>
        <h2>{s.title}</h2>
        <p className="step-intro">{s.intro}</p>
        {error && <div className="alert">{error}</div>}
        <div className="q-grid">
          {s.fields.map((f) => (
            <Field key={f.id} f={f} brief={brief} set={set} error={errors[f.id]} extra={extra} />
          ))}
        </div>
        <div className="step-nav">
          {step > 0 ? (
            <button type="button" className="btn secondary" onClick={() => go(step - 1)}>
              Retour
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn primary" disabled={saving || busy}>
            {saving ? 'Enregistrement…' : busy ? 'Envoi…' : last ? submitLabel : 'Continuer'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ----- Mode agence : tout le brief sur une page -----
export function AgencyForm({ brief, setBrief, onSubmit, error, extra, steps = STEPS, title = 'Nouveau brief client', intro = 'Remplissez le brief avec votre client ou à partir de vos notes, puis générez les 10 modèles.', submitLabel = 'Générer les 10 modèles', barText = 'Les 10 modèles sont générés en une fois.', onCancel, examples = true, busy = false }) {
  const [errors, setErrors] = useState({});
  const set = (k, val) => {
    setBrief((b) => ({ ...b, [k]: val }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  function submit(e) {
    e.preventDefault();
    const errs = validateBrief(brief, steps);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      document.getElementById(`q-${first}`)?.focus();
      return;
    }
    onSubmit();
  }
  return (
    <form className="agency" onSubmit={submit} noValidate>
      <div className="agency-head">
        <div>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
        <div className="agency-head-actions">
          {onCancel && (
            <button type="button" className="btn secondary" onClick={onCancel}>
              Annuler
            </button>
          )}
          {examples && (
            <>
          <button type="button" className="btn secondary" onClick={() => setBrief({ ...EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)] })}>
            Remplir avec un exemple
          </button>
          <button
            type="button"
            className="btn-text"
            onClick={() => {
              setBrief(emptyBrief());
              setErrors({});
            }}
          >
            Vider le brief
          </button>
            </>
          )}
        </div>
      </div>
      {error && <div className="alert">{error}</div>}
      {steps.map((s) => (
        <section key={s.id} className="card agency-section">
          <div className="agency-section-head">
            <h2>{s.title}</h2>
            <p>{s.intro}</p>
          </div>
          <div className="q-grid">
            {s.fields.map((f) => (
              <Field key={f.id} f={f} brief={brief} set={set} error={errors[f.id]} extra={extra} />
            ))}
          </div>
        </section>
      ))}
      <div className="sticky-bar">
        <p>{Object.keys(errors).filter((k) => errors[k]).length ? 'Certains champs sont à compléter ou à corriger.' : barText}</p>
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Enregistrement…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
