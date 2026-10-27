'use client';
// Questionnaire ouvert par le client avec son lien personnel
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { ClientShell, Spinner } from '../Chrome.jsx';
import { ClientStepper } from '../Questionnaire.jsx';
import { remoteExtra } from '../RemoteMedia.jsx';
import { emptyBrief, remoteSteps } from '../../engine/questions.js';

const STEPS7 = remoteSteps();

function Done({ studio, client, onEdit }) {
  const owner = studio?.ownerName || 'Votre interlocuteur';
  return (
    <section className="public-card done">
      <span className="done-mark" aria-hidden="true">
        ✓
      </span>
      <h1>Merci, vos réponses sont bien arrivées</h1>
      <p className="lead">{owner} prépare maintenant plusieurs propositions de site pour {client.brief?.businessName || client.name}. Vous recevrez un lien pour les découvrir et choisir celle qui vous plaît.</p>
      <ol className="journey">
        <li className="done">Vos réponses</li>
        <li className="current">Les propositions de {owner}</li>
        <li>Votre choix</li>
        <li>La mise en ligne</li>
      </ol>
      {client.editable && (
        <p>
          Un oubli ?{' '}
          <button type="button" className="btn-text" onClick={onEdit}>
            Modifier mes réponses
          </button>
        </p>
      )}
    </section>
  );
}

export default function QuestionnaireApp({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [brief, setBrief] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [sending, setSending] = useState(false);
  const briefRef = useRef(null);
  briefRef.current = brief;
  const revRef = useRef(0);
  revRef.current = data?.client?.briefRev || 0;

  useEffect(() => {
    api(`/api/q/${id}`)
      .then((d) => {
        setData(d);
        setBrief({ ...emptyBrief(), businessName: d.client.name || '', ...(d.client.brief || {}) });
        setEditing(d.client.status === 'sent');
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function persist(body) {
    setSaveError('');
    try {
      const { client } = await api(`/api/q/${id}`, { method: 'PATCH', body: { brief: briefRef.current, briefRev: revRef.current, ...body } });
      revRef.current = client.briefRev || 0;
      setData((d) => ({ ...d, client }));
      return true;
    } catch (e) {
      setSaveError(e.code === 'network' ? 'Enregistrement impossible : vérifiez votre connexion, puis touchez à nouveau « Continuer ».' : e.message);
      return false;
    }
  }

  async function submit() {
    setSending(true);
    const ok = await persist({ submit: true });
    setSending(false);
    if (ok) {
      setEditing(false);
      window.scrollTo?.(0, 0);
    }
  }

  const studio = data?.studio;
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
  if (!data || !brief) {
    return (
      <ClientShell studio={studio}>
        <Spinner label="Ouverture de votre questionnaire…" />
      </ClientShell>
    );
  }

  const { client } = data;
  const owner = studio?.ownerName || 'Votre interlocuteur';
  if (client.proposalsReady) {
    return (
      <ClientShell studio={studio}>
        <section className="public-card">
          <h1>Vos propositions sont prêtes</h1>
          <p className="lead">{owner} a sélectionné plusieurs modèles de site pour {client.brief?.businessName || client.name}.</p>
          <a className="btn primary" href={`/propositions/${id}`}>
            Découvrir mes propositions
          </a>
        </section>
      </ClientShell>
    );
  }
  if (!client.editable) {
    return (
      <ClientShell studio={studio}>
        <Done studio={studio} client={client} />
      </ClientShell>
    );
  }
  if (!editing) {
    return (
      <ClientShell studio={studio}>
        <Done studio={studio} client={client} onEdit={() => setEditing(true)} />
      </ClientShell>
    );
  }

  const intro = (
    <div className="welcome">
      <h1>Votre futur site internet</h1>
      <p>
        {owner} a préparé ces questions pour créer le site de {client.name || 'votre entreprise'}. Comptez une dizaine de minutes. Vos réponses sont enregistrées à chaque étape : vous pouvez vous arrêter et reprendre plus tard avec le même lien.
      </p>
    </div>
  );

  return (
    <ClientShell studio={studio}>
      <ClientStepper
        brief={brief}
        setBrief={setBrief}
        steps={STEPS7}
        intro={intro}
        initialStep={client.status === 'sent' ? Math.min(client.qStep || 0, STEPS7.length - 1) : 0}
        submitLabel={client.status === 'answered' ? 'Enregistrer mes modifications' : 'Envoyer mes réponses'}
        onNext={(next) => persist({ qStep: next })}
        onSubmit={submit}
        busy={sending}
        error={saveError}
        extra={remoteExtra({ brief, setBrief, uploadUrl: `/api/q/${id}/images`, srcOf: (imgId) => `/api/files/${id}/${imgId}`, aiAvailable: client.aiAvailable, hideUnavailable: true })}
      />
    </ClientShell>
  );
}
