'use client';
// Google Drive, vu du dossier : ce qui est rangé dans le dossier du client, et l'envoi de ce qui manque
import { useEffect, useState } from 'react';
import { api } from '../api.js';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');
// Un envoi automatique reste « en cours » 5 minutes au plus
const enCours = (d) => Boolean(d.enCours && Date.now() - Date.parse(d.enCours) < 5 * 60_000);

function photosDuClient(rec) {
  const ids = [];
  if (rec.brief?.logo?.id) ids.push(rec.brief.logo.id);
  for (const p of rec.brief?.photos || []) if (p?.id) ids.push(p.id);
  for (const p of rec.aiImages || []) if (p?.id && p.reel) ids.push(p.id);
  return [...new Set(ids)];
}

// « 3 photos et le logo du client rangés », « 2 photos du client rangées », « Logo du client rangé »
function texteImages(rec, rangees, total) {
  if (!total) return 'Aucune photo ni logo du client';
  if (rangees < total) return `Photos et logo du client : ${rangees} sur ${total} rangés`;
  const logo = Boolean(rec.brief?.logo?.id);
  const nb = total - (logo ? 1 : 0);
  const s = nb > 1 ? 's' : '';
  if (!nb) return 'Logo du client rangé';
  return logo ? `${nb} photo${s} et le logo du client rangés` : `${nb} photo${s} du client rangée${s}`;
}

function bilanTexte(b) {
  if (!b) return '';
  const parts = [];
  if (b.brief) parts.push('fiche brief');
  if (b.photos) parts.push(`${b.photos} photo${b.photos > 1 ? 's' : ''}`);
  if (b.site) parts.push(b.site);
  return parts.length ? `Envoyé : ${parts.join(', ')}.` : 'Tout était déjà rangé dans Drive.';
}

export default function DriveAgence({ rec, onRecord }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    let vivant = true;
    api(`/api/agence/clients/${rec.id}/drive`)
      .then((d) => vivant && setStatus(d.status))
      .catch(() => vivant && setStatus(null));
    return () => {
      vivant = false;
    };
  }, [rec.id]);
  if (!status) return null;

  const d = rec.drive || {};
  const photos = photosDuClient(rec);
  const rangees = photos.filter((id) => (d.photos || []).includes(id)).length;
  const briefAJour = Boolean(d.identifiant) && d.briefRev === (rec.briefRev || 0);
  const occupe = busy || enCours(d);
  const aEnvoyer = Boolean(rec.brief?.businessName?.trim());

  async function envoyer() {
    setBusy(true);
    setErr('');
    setNote('');
    try {
      const res = await api(`/api/agence/clients/${rec.id}/drive`, { method: 'POST' });
      if (res.client) onRecord(res.client);
      if (res.erreur) setErr(res.erreur);
      else setNote(bilanTexte(res.bilan));
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card side-card drive-card">
      <h2>Google Drive</h2>
      {!status.configured ? (
        <p className="muted small">Pas branché : ajoute {status.missing.join(' et ')} dans Vercel (document 11, §H.1). En attendant, rien n’est rangé dans ton Drive.</p>
      ) : (
        <>
          <ul className="pub-checks drive-etat">
            <li className={briefAJour ? '' : 'is-wait'}>
              <span>{briefAJour ? `Fiche brief du ${fmt(d.briefAt)}` : d.identifiant ? 'Brief modifié depuis la dernière fiche' : 'Brief pas encore envoyé'}</span>
            </li>
            <li className={photos.length && rangees >= photos.length ? '' : 'is-wait'}>
              <span>{texteImages(rec, rangees, photos.length)}</span>
            </li>
            <li className={d.siteNom ? '' : 'is-wait'}>
              <span>{d.siteNom ? `Site archivé : ${d.siteNom}` : 'Site pas encore archivé'}</span>
            </li>
          </ul>
          {d.identifiant && (
            <p className="muted small">
              Dossier <code>Clients/{d.identifiant}</code>
              {d.dossier && (
                <>
                  {' · '}
                  <a className="btn-text small" href={d.dossier} target="_blank" rel="noopener noreferrer">
                    Ouvrir le dossier
                  </a>
                </>
              )}
            </p>
          )}
          {d.erreur && !err && (
            <p className="q-error" role="alert">
              Envoi du {fmt(d.erreur.at)} en échec : {d.erreur.message}
            </p>
          )}
          {err && (
            <p className="q-error" role="alert">
              {err}
            </p>
          )}
          {note && (
            <p className="side-note" role="status">
              {note}
            </p>
          )}
          <button type="button" className="btn secondary small" onClick={envoyer} disabled={occupe || !aEnvoyer}>
            {occupe ? 'Envoi en cours…' : d.erreur ? 'Réessayer' : 'Envoyer ce qui manque'}
          </button>
          <p className="muted small">Automatique à la réception du questionnaire, à la génération des modèles et à chaque mise en ligne depuis ce dossier.</p>
        </>
      )}
    </section>
  );
}
