// Version de démonstration publiée sur claude.ai : même application,
// mais l'IA passe par le compte Claude de la personne qui ouvre la page.
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../ui/App.jsx';
import { GenerationError } from '../ai/generate.js';
import { buildSinglePrompt } from '../engine/prompts.js';

const MESSAGES = {
  not_granted: 'L’accès à Claude n’a pas été autorisé pour cette page. Autorisez-le pour obtenir des textes rédigés par l’IA.',
  sampling_disabled: 'Claude n’est pas disponible pour ce compte.',
  capability_disabled: 'Claude n’est pas disponible sur cette vue.',
  rate_limited: 'Limite d’utilisation de Claude atteinte. Réessayez un peu plus tard.',
  invalid_json: 'La réponse de l’IA était incomplète. Relancez la génération.',
  refused: 'Claude a refusé cette demande. Reformulez la description de l’activité.',
  session_expired: 'Votre session Claude a expiré : reconnectez-vous puis relancez.',
  empty_completion: 'L’IA n’a rien renvoyé. Relancez la génération.',
  prompt_too_large: 'Le brief est trop long. Raccourcissez la description ou les listes.',
  upstream_error: 'Le service IA a eu un problème passager. Relancez la génération.',
};

function sampleRunner(sample) {
  return async (part, brief, signal) => {
    try {
      return await sample.json(buildSinglePrompt(part, brief), { signal, cache: false });
    } catch (e) {
      const code = e?.code || 'upstream_error';
      throw new GenerationError(MESSAGES[code] || MESSAGES.upstream_error, code);
    }
  };
}

function readMode() {
  try {
    return window.localStorage.getItem('studio-site:mode') === 'agence' ? 'agence' : 'client';
  } catch {
    return 'client';
  }
}

function Shell() {
  const [mode, setMode] = useState(readMode);
  const [ai, setAi] = useState({ state: 'loading', runner: null });
  const [downloads, setDownloads] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = window.claude;
      if (!c || typeof c.use !== 'function') {
        setAi({ state: 'off', runner: null });
        return;
      }
      const [s, d] = await Promise.all([c.use('sample').catch(() => null), c.use('downloads').catch(() => null)]);
      if (!alive) return;
      setDownloads(d);
      setAi(s ? { state: 'on', runner: sampleRunner(s) } : { state: 'off', runner: null });
    })();
    return () => {
      alive = false;
    };
  }, []);

  function switchMode(m) {
    setMode(m);
    try {
      window.localStorage.setItem('studio-site:mode', m);
    } catch {}
  }

  async function saveFile(blob, filename) {
    if (!downloads) throw new Error('Le téléchargement n’est pas disponible dans cette vue. Ouvrez la page dans claude.ai.');
    try {
      await downloads.save({ filename, data: blob });
      return true;
    } catch (e) {
      if (e?.code === 'declined') return false;
      throw new Error('Le téléchargement n’a pas abouti. Réessayez.');
    }
  }

  const banner =
    ai.state === 'loading' ? (
      'Connexion à Claude…'
    ) : ai.state === 'on' ? (
      <>
        <strong>Démo.</strong> Les textes sont rédigés par Claude avec votre compte (une autorisation vous sera demandée). L’application finale utilisera votre propre clé API.
      </>
    ) : (
      <>
        <strong>Démo hors ligne.</strong> Claude n’est pas joignable ici : les modèles utilisent des textes génériques.
      </>
    );

  const modeSwitch = useMemo(
    () => (
      <div className="mode-switch" role="group" aria-label="Choisir le mode">
        <button type="button" aria-pressed={mode === 'client'} onClick={() => switchMode('client')}>
          Mode client
        </button>
        <button type="button" aria-pressed={mode === 'agence'} onClick={() => switchMode('agence')}>
          Mode agence
        </button>
      </div>
    ),
    [mode]
  );

  return <App key={mode} mode={mode} runner={ai.runner} saveFile={saveFile} banner={banner} modeSwitch={modeSwitch} />;
}

createRoot(document.getElementById('root')).render(<Shell />);
