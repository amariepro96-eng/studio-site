'use client';
// Photos et logo envoyés au serveur (questionnaire du client ou brief rempli par l'agence)
import { useRef, useState } from 'react';
import { prepareImage, MAX_PHOTOS } from '../ai/images.js';
import { uploadImage } from './api.js';

const isImage = (file) => /^image\//.test(file.type) || /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(file.name);
const altFromName = (name) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 120);

// Logo : on garde la transparence (PNG), 800 px au plus
async function prepareLogo(file) {
  if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && file.size < 1.5 * 1024 * 1024) return file;
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversion impossible'))), 'image/png'));
}

export function RemotePhotoField({ f, photos, setPhotos, uploadUrl, srcOf }) {
  const [busy, setBusy] = useState(0);
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
    const kept = files.slice(0, left);
    const msgs = [];
    let failed = 0;
    setBusy(kept.length);
    for (const file of kept) {
      try {
        if (!isImage(file)) throw new Error('format');
        const img = await prepareImage(file, { source: 'client', alt: altFromName(file.name) });
        const saved = await uploadImage(uploadUrl, img.blob, { kind: 'photo', alt: img.alt, filename: 'photo.jpg' });
        setPhotos((p) => [...p, saved].slice(0, MAX_PHOTOS));
      } catch (e) {
        failed++;
        if (e?.message && e.message !== 'format' && !msgs.includes(e.message)) msgs.push(e.message);
      }
      setBusy((n) => Math.max(0, n - 1));
    }
    if (failed) msgs.unshift(`${failed} photo${failed > 1 ? 's n’ont' : ' n’a'} pas pu être ajoutée${failed > 1 ? 's' : ''} (formats acceptés : JPEG, PNG, WebP).`);
    if (files.length > kept.length) msgs.push(`Seules les ${kept.length} premières photos ont été ajoutées (maximum ${MAX_PHOTOS}).`);
    setError(msgs.join(' '));
    setBusy(0);
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
        <input ref={inputRef} id="q-photos" type="file" accept="image/jpeg,image/png,image/webp,image/*" multiple onChange={(e) => add(e.target.files)} disabled={busy > 0 || left <= 0} />
        <span className="dropzone-title">{busy ? `Envoi en cours… (${busy} restante${busy > 1 ? 's' : ''})` : left <= 0 ? 'Nombre maximum de photos atteint' : 'Ajouter des photos'}</span>
        <span className="dropzone-hint">
          {photos.length} sur {MAX_PHOTOS}. Glissez-les ici ou touchez pour choisir.
        </span>
      </label>
      {error && (
        <p className="q-error" role="alert">
          {error}
        </p>
      )}
      {photos.length > 0 && (
        <>
          <p className="q-hint">La première photo sert d’image principale. Utilisez les flèches pour changer l’ordre.</p>
          <ul className="photo-grid">
            {photos.map((ph, i) => (
              <li key={ph.id} className="photo">
                <img src={srcOf(ph.id)} alt={ph.alt || `Photo ${i + 1}`} loading="lazy" />
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

export function LogoField({ f, logo, setLogo, uploadUrl, srcOf }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  async function pick(file) {
    if (!file) return;
    setError('');
    if (!isImage(file)) {
      setError('Ce fichier n’est pas une image. Formats acceptés : PNG, JPEG, WebP.');
      return;
    }
    setBusy(true);
    try {
      const blob = await prepareLogo(file);
      const type = blob.type || 'image/png';
      const saved = await uploadImage(uploadUrl, blob, { kind: 'logo', alt: 'Logo', filename: type === 'image/png' ? 'logo.png' : 'logo.jpg' });
      setLogo(saved);
    } catch (e) {
      setError(e?.message || 'Le logo n’a pas pu être envoyé.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }
  return (
    <div className="q-field">
      <span className="q-label">{f.label}</span>
      <p className="q-hint">{f.hint}</p>
      {logo ? (
        <div className="logo-row">
          <img className="logo-prev" src={srcOf(logo.id)} alt="Logo envoyé" />
          <label className="btn secondary small file-btn">
            {busy ? 'Envoi…' : 'Remplacer'}
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/*" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} aria-label="Remplacer le logo" />
          </label>
          <button type="button" className="btn-text small" onClick={() => setLogo(null)}>
            Retirer
          </button>
        </div>
      ) : (
        <label className="dropzone small">
          <input ref={inputRef} id="q-logo" type="file" accept="image/png,image/jpeg,image/webp,image/*" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
          <span className="dropzone-title">{busy ? 'Envoi du logo…' : 'Ajouter votre logo'}</span>
          <span className="dropzone-hint">PNG, JPEG ou WebP</span>
        </label>
      )}
      {error && (
        <p className="q-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Champs « photos » et « logo » branchés sur un dossier
export function remoteExtra({ brief, setBrief, uploadUrl, srcOf, aiAvailable, hideUnavailable = false }) {
  return {
    aiAvailable,
    hideUnavailable,
    renderPhotos: (f) => (
      <RemotePhotoField
        key="photos"
        f={f}
        photos={brief.photos || []}
        setPhotos={(fn) => setBrief((b) => ({ ...b, photos: typeof fn === 'function' ? fn(b.photos || []) : fn }))}
        uploadUrl={uploadUrl}
        srcOf={srcOf}
      />
    ),
    renderLogo: (f) => <LogoField key="logo" f={f} logo={brief.logo} setLogo={(logo) => setBrief((b) => ({ ...b, logo }))} uploadUrl={uploadUrl} srcOf={srcOf} />,
  };
}
