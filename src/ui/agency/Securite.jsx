'use client';
// Réglages › Sécurité : double authentification, codes de secours, appareils connectés
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { CodeSecours, ReliePhone } from '../AgencyLogin.jsx';

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

function DemandeCode({ titre, texte, bouton, onValider, onAnnuler, occupe }) {
  const [code, setCode] = useState('');
  return (
    <form
      className="secu-code"
      onSubmit={(e) => {
        e.preventDefault();
        if (/^\d{6}$/.test(code)) onValider(code);
      }}
    >
      <p className="small">
        <strong>{titre}</strong> {texte}
      </p>
      <div className="secu-code-row">
        <input className="code-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" aria-label="Code à 6 chiffres de l’appli" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
        <button type="submit" className="btn primary small" disabled={occupe || !/^\d{6}$/.test(code)}>
          {bouton}
        </button>
        <button type="button" className="btn-text small quiet" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export default function Securite() {
  const [s, setS] = useState(null);
  const [mode, setMode] = useState(null); // codes | telephone | confirmer | tout
  const [codes, setCodes] = useState(null);
  const [act, setAct] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    api('/api/agence/securite')
      .then((d) => setS(d.securite))
      .catch((e) => setErr(e.message));
  }, []);

  async function action(nom, extra = {}) {
    setOccupe(true);
    setErr('');
    setNote('');
    try {
      const d = await api('/api/agence/securite', { method: 'POST', body: { action: nom, ...extra } });
      if (d.securite) setS(d.securite);
      return d;
    } catch (e) {
      setErr(e.message);
      return null;
    } finally {
      setOccupe(false);
    }
  }

  if (!s && !err) return null;

  return (
    <section className="card settings secu" aria-labelledby="secu-titre">
      <h2 id="secu-titre">Sécurité</h2>
      {s && !s.possible && <p className="muted small">La double authentification s’active dès que le stockage des dossiers est branché.</p>}
      {s?.possible && (
        <>
          <ul className="pub-checks">
            <li className={s.actif ? 'is-ok' : 'is-ko'}>
              <span>{s.actif ? `Double authentification active depuis le ${fmt(s.activeLe)} : mot de passe + code de votre téléphone.` : 'Double authentification pas encore active : elle sera demandée à la prochaine connexion.'}</span>
            </li>
            {s.actif && (
              <li className={s.secoursRestants >= 3 ? 'is-ok' : 'is-warn'}>
                <span>
                  {s.secoursRestants} code{s.secoursRestants > 1 ? 's' : ''} de secours sur {s.secoursTotal} encore utilisable{s.secoursRestants > 1 ? 's' : ''}
                  {s.secoursRestants < 3 ? ' : générez-en de nouveaux.' : '.'}
                </span>
              </li>
            )}
          </ul>

          {codes && (
            <div className="secu-panel">
              <CodeSecours codes={codes} titre="Nouveaux codes de secours" bouton="Terminé" onDone={() => setCodes(null)} />
              <p className="muted small">Les anciens codes ne marchent plus.</p>
            </div>
          )}

          {mode === 'codes' && (
            <DemandeCode
              titre="Nouveaux codes de secours."
              texte="Les anciens seront annulés. Saisissez le code affiché par votre appli :"
              bouton="Générer"
              occupe={occupe}
              onAnnuler={() => setMode(null)}
              onValider={async (code) => {
                const d = await action('nouveaux-codes', { code });
                if (d?.codesSecours) {
                  setCodes(d.codesSecours);
                  setMode(null);
                }
              }}
            />
          )}

          {mode === 'telephone' && (
            <DemandeCode
              titre="Changer de téléphone."
              texte="Saisissez d’abord le code affiché par l’appli de votre téléphone actuel :"
              bouton="Continuer"
              occupe={occupe}
              onAnnuler={() => setMode(null)}
              onValider={async (code) => {
                const d = await action('telephone', { code });
                if (d?.qr) {
                  setAct(d);
                  setMode('confirmer');
                }
              }}
            />
          )}

          {mode === 'confirmer' && act && (
            <div className="secu-panel">
              <ReliePhone qr={act.qr} lien={act.lien} secret={act.secret} intro={<p className="small">Sur le <strong>nouveau</strong> téléphone :</p>} />
              <DemandeCode
                titre="Dernière étape."
                texte="Saisissez le code affiché par le nouveau téléphone. L’ancien ne marchera plus et vos autres appareils seront déconnectés."
                bouton="Relier"
                occupe={occupe}
                onAnnuler={() => {
                  setMode(null);
                  setAct(null);
                }}
                onValider={async (code) => {
                  const d = await action('confirmer-telephone', { code });
                  if (d) {
                    setMode(null);
                    setAct(null);
                    setNote('Nouveau téléphone relié. Vos codes de secours restent valables.');
                  }
                }}
              />
            </div>
          )}

          {mode === 'tout' && (
            <p className="small secu-code">
              Déconnecter tous vos autres appareils (ordinateurs, téléphones) ? Celui-ci reste connecté.{' '}
              <button
                type="button"
                className="btn-text small danger"
                disabled={occupe}
                onClick={async () => {
                  const d = await action('deconnecter-tout');
                  if (d) {
                    setMode(null);
                    setNote('Tous les autres appareils sont déconnectés : ils devront saisir le mot de passe et un code.');
                  }
                }}
              >
                Déconnecter
              </button>{' '}
              <button type="button" className="btn-text small" onClick={() => setMode(null)}>
                Annuler
              </button>
            </p>
          )}

          {s.actif && !mode && !codes && (
            <div className="row-actions">
              <button type="button" className="btn secondary small" onClick={() => setMode('codes')}>
                Nouveaux codes de secours
              </button>
              <button type="button" className="btn secondary small" onClick={() => setMode('telephone')}>
                Changer de téléphone
              </button>
              <button type="button" className="btn-text small" onClick={() => setMode('tout')}>
                Déconnecter les autres appareils
              </button>
            </div>
          )}
          <p className="q-hint">Téléphone perdu et plus aucun code de secours : document 10, §Q (variable AGENCY_2FA_RESET dans Vercel).</p>
        </>
      )}
      {note && (
        <p className="side-note" role="status">
          {note}
        </p>
      )}
      {err && (
        <p className="q-error" role="alert">
          {err}
        </p>
      )}
    </section>
  );
}
