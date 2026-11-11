'use client';
// Bac à sable de l'atelier : un client de démo (site + espace prêts) pour tester les
// fonctionnalités directement, comme sur un vrai dossier. Ses images (le café, le geste du
// barista, le brunch, les pâtisseries…) sont créées ici par l'IA, puis gardées à chaque
// remise à neuf : seules celles qui manquent sont refaites.
import { useEffect, useRef, useState } from 'react';
import { api, uploadImage } from '../api.js';
import { apiImageGen, generateImages } from '../../ai/images.js';

export default function BacASable() {
  const [demo, setDemo] = useState(undefined);
  const [images, setImages] = useState(null); // { faites, total }
  const [iaDispo, setIaDispo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState(null); // { done, total, thumbs }
  const [err, setErr] = useState('');
  const abortRef = useRef(null);

  useEffect(() => {
    api('/api/agence/atelier')
      .then((d) => {
        setDemo(d.demo);
        setImages(d.images || null);
      })
      .catch(() => setDemo(null));
    fetch('/api/status')
      .then((r) => r.json())
      .then((s) => setIaDispo(Boolean(s?.aiImages)))
      .catch(() => setIaDispo(false));
    return () => abortRef.current?.abort();
  }, []);

  // Crée les images manquantes avec Gemini, trois à la fois, puis les range dans le dossier
  async function creerImages(id, { manquantes = [], batch = '' }) {
    if (!manquantes.length) return { ok: true };
    const dispo = iaDispo ?? (await fetch('/api/status').then((r) => r.json()).then((s) => Boolean(s?.aiImages)).catch(() => false));
    // Sans clé Gemini, la démo garde ses illustrations neutres (signalé dans le texte du bloc)
    if (!dispo) return { ok: true, skipped: true };
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const imageGen = apiImageGen();
    setGen({ done: 0, total: manquantes.length, thumbs: [] });
    const genOne = async (p, signal) => {
      const img = await imageGen(p, signal);
      await uploadImage(`/api/agence/clients/${id}/images`, img.blob, { kind: 'ia', alt: p.alt, filename: 'image-ia.jpg', batch, role: p.role, signal });
      return img;
    };
    const { images: faites, errors } = await generateImages(genOne, manquantes, {
      signal: ctl.signal,
      onImage: (list) => setGen((g) => ({ ...g, done: list.length, thumbs: list.map((x) => ({ src: x.thumb, alt: x.alt })) })),
    });
    if (ctl.signal.aborted) return { ok: false, aborted: true };
    try {
      const d = await api('/api/agence/atelier', { method: 'POST', body: { action: 'finaliser', id } });
      if (d.images) setImages(d.images);
    } catch {}
    const error = errors.length ? `${errors.length} image${errors.length > 1 ? 's' : ''} non créée${errors.length > 1 ? 's' : ''} : ${errors[0]?.message || 'erreur inconnue'}` : '';
    setGen((g) => ({ ...g, done: faites.length }));
    return { ok: !errors.length, error };
  }

  async function act(action, extra = {}) {
    setBusy(true);
    setErr('');
    setGen(null);
    try {
      const d = await api('/api/agence/atelier', { method: 'POST', body: { action, ...extra } });
      setDemo(d.demo);
      setImages(d.images ? { faites: d.images.faites, total: d.images.total } : null);
      if (!d.demo) return;
      if (action === 'creer' || action === 'images') {
        const res = await creerImages(d.demo, d.images || {});
        if (res.aborted) return;
        // Tout est prêt : direction le dossier de démo (sinon on reste ici pour voir l'erreur)
        if (res.ok && action === 'creer') window.location.assign(`/agence/clients/${d.demo}`);
        else if (!res.ok) setErr(res.error);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (demo === undefined) return null;
  const incomplet = demo && images && images.faites < images.total;
  const enCours = gen && busy;
  return (
    <div className="bac-sable">
      <div className="bac-sable-txt">
        <strong>Café Lumière</strong> — dossier fictif déjà « en ligne », espace client prêt : active l’appli Devis, le calculateur, la variante « Modifier son site », etc.
        {demo && images && !enCours && (
          <span className="bac-sable-img muted small">
            {' '}
            Images IA du café : {images.faites}/{images.total}
            {images.faites === images.total ? ' (gardées à la remise à neuf)' : ''}.
          </span>
        )}
        {iaDispo === false && <span className="bac-sable-img muted small"> Images IA non configurées (GEMINI_API_KEY) : la démo aura des illustrations neutres.</span>}
      </div>
      <div className="bac-sable-actions">
        {demo ? (
          <>
            <a className="btn primary small" href={`/agence/clients/${demo}`}>
              Ouvrir le client de démo
            </a>
            <button type="button" className="btn secondary small" disabled={busy} onClick={() => act('creer')}>
              {busy && !enCours ? '…' : 'Remettre à neuf'}
            </button>
            {iaDispo && incomplet && !enCours && (
              <button type="button" className="btn secondary small" disabled={busy} onClick={() => act('images', { id: demo })}>
                Compléter les images
              </button>
            )}
            {iaDispo && !incomplet && !enCours && (
              <button type="button" className="btn-text small" disabled={busy} onClick={() => act('images', { id: demo, neuves: true })} title="Refait les 8 images du café avec l’IA">
                Nouvelles images
              </button>
            )}
            <button type="button" className="btn-text small danger" disabled={busy} onClick={() => act('supprimer')}>
              Supprimer
            </button>
          </>
        ) : (
          <button type="button" className="btn primary small" disabled={busy} onClick={() => act('creer')}>
            {busy && !enCours ? 'Création…' : 'Créer un client de démo'}
          </button>
        )}
      </div>
      {gen && (
        <div className="bac-gen" aria-live="polite">
          <p className="small">
            {gen.done < gen.total && busy ? (
              <>
                Création des images du café par l’IA : {gen.done}/{gen.total}… <span className="muted">(environ une minute, garde cette page ouverte)</span>
              </>
            ) : (
              <>Images créées : {gen.done}/{gen.total}</>
            )}
          </p>
          <div className="bac-gen-bar" role="progressbar" aria-valuemin={0} aria-valuemax={gen.total} aria-valuenow={gen.done}>
            <span style={{ width: `${Math.round((gen.done / Math.max(1, gen.total)) * 100)}%` }} />
          </div>
          {gen.thumbs.length > 0 && (
            <ul className="bac-gen-thumbs">
              {gen.thumbs.map((t, i) => (
                <li key={i}>
                  <img src={t.src} alt={t.alt} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {err && (
        <p className="q-error" role="alert">
          {err}
          {demo && (
            <>
              {' '}
              <a href={`/agence/clients/${demo}`}>Ouvrir quand même le client de démo</a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
