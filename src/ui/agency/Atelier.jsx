'use client';
// Atelier libre : le bac à sable de l'agence. Chaque essai est un vrai dossier, avec exactement
// le parcours d'un client (questionnaire ou brief, 10 propositions, sélection, page de choix,
// mise en service, mise en ligne, domaine, espace client, appli Devis), jusqu'à la mise en
// ligne sur un de tes domaines de test. Rien ne part dans Google Drive ni dans Suivi clients,
// et supprimer un essai efface aussi son dépôt GitHub et son projet Vercel.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { AgencyBar, Spinner } from '../Chrome.jsx';
import { NewClient, ClientRow, StorageSetup } from './Dashboard.jsx';
import BacASable from './BacASable.jsx';

const ETAPES = [
  'Nouvel essai : questionnaire par lien (tu l’ouvres toi-même) ou brief rempli par toi',
  'Génération des 10 propositions, sélection, page de choix du client',
  'Mise en service puis « Mettre en ligne » : dépôt site-essai-… et projet Vercel créés',
  'Domaine de test : un clic le relie à l’essai et règle la zone OVHcloud',
  'Espace client, appli Devis : à tester comme pour un vrai client',
];

export default function Atelier({ studioName }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    setError('');
    try {
      setData(await api('/api/agence/clients'));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const essais = (data?.clients || []).filter((c) => c.essai && !c.demo);

  return (
    <div className="ss">
      <AgencyBar studioName={studioName} current="atelier" />
      <main className="page">
        <div className="page-head">
          <div>
            <h1>Atelier libre</h1>
            <p className="muted">Ton bac à sable : le même parcours qu’un vrai client, jusqu’à la mise en ligne sur un de tes domaines de test. Rien ne part dans Google Drive ni dans le tableau Suivi clients.</p>
          </div>
          {data?.storage !== 'none' && !creating && (
            <button type="button" className="btn primary" onClick={() => setCreating(true)}>
              Nouvel essai
            </button>
          )}
        </div>
        {error && (
          <div className="alert" role="alert">
            {error}{' '}
            <button type="button" className="btn-text small" onClick={load}>
              Réessayer
            </button>
          </div>
        )}
        {data?.storage === 'none' && <StorageSetup />}
        {creating && <NewClient essai onCancel={() => setCreating(false)} onCreated={(c) => (window.location.href = `/agence/clients/${c.id}`)} />}
        {!data && !error && <Spinner label="Chargement des essais…" />}

        {data && data.storage !== 'none' && (
          <>
            <section className="atelier-essais">
              <h2>Tes essais</h2>
              {essais.length ? (
                <ul className="client-list">
                  {essais.map((c) => (
                    <ClientRow key={c.id} c={c} />
                  ))}
                </ul>
              ) : (
                !creating && (
                  <div className="empty-state compact">
                    <p>Aucun essai pour l’instant. Un essai suit exactement les étapes d’un vrai client :</p>
                    <ol className="how">
                      {ETAPES.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ol>
                    <button type="button" className="btn primary" onClick={() => setCreating(true)}>
                      Créer un essai
                    </button>
                  </div>
                )
              )}
              <p className="muted small">Pour supprimer un essai : ouvre-le, puis « Supprimer l’essai » en bas à droite. Son dépôt GitHub et son projet Vercel partent avec lui.</p>
            </section>

            <section className="atelier-demo">
              <h2>Client de démo</h2>
              <p className="muted small">Un dossier déjà « en ligne », avec son espace client prêt : pour essayer tout de suite l’espace client, l’appli Devis ou le calculateur, sans passer par la génération.</p>
              <BacASable />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
