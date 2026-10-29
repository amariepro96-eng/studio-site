'use client';
import { useEffect, useState } from 'react';
import App from './App.jsx';
import { AgencyBar } from './Chrome.jsx';
import BacASable from './agency/BacASable.jsx';
import { apiRunner, apiImages } from '../ai/generate.js';
import { apiImageGen } from '../ai/images.js';

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Studio Site';

export default function NextShell({ mode, studioName }) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ ai: false, images: false }));
  }, []);
  if (!status) {
    return (
      <div className="ss">
        {mode === 'agence' && <AgencyBar studioName={studioName || APP_NAME} current="atelier" />}
        <div className="boot" aria-busy="true" />
      </div>
    );
  }
  const aiWarn = !status.ai ? (
    <p className="bac-warn">
      <strong>Mode démo.</strong> Aucune clé API n’est configurée : les modèles utiliseront des textes génériques. Ajoutez <code>ANTHROPIC_API_KEY</code> dans les réglages Vercel pour des textes rédigés par l’IA.
    </p>
  ) : null;
  const banner = mode === 'agence' ? (
    <>
      {aiWarn}
      <BacASable />
    </>
  ) : null;
  const header = mode === 'agence' ? <AgencyBar studioName={studioName || APP_NAME} current="atelier" /> : undefined;
  return <App mode={mode} appName={APP_NAME} header={header} runner={status.ai ? apiRunner() : null} imagesFn={status.images ? apiImages() : null} imageGen={status.aiImages ? apiImageGen() : null} saveFile={saveBlob} banner={banner} />;
}
