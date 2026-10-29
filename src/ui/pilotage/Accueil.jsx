'use client';
// Accueil : d'un coup d'œil, l'état des sites des clients (module « Statuts clients ») et le
// côté financier (frais fixes, bénéfice, point mort). Chaque module mène au détail.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { AgencyBar, Spinner } from '../Chrome.jsx';
import { StorageSetup } from '../agency/Dashboard.jsx';
import { usePilotage, useHorloge, secondes } from './Pilotage.jsx';
import { ETATS } from './Explication.jsx';
import { euros, nomMois } from '../../engine/finances.js';

const majuscule = (t) => String(t || '').replace(/^./, (x) => x.toUpperCase());
const pluriel = (n, mot, motPluriel = mot + 's') => `${n} ${n > 1 ? motPluriel : mot}`;

function dateDuJour() {
  try {
    return majuscule(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date()));
  } catch {
    return '';
  }
}

// ---------- Module « Statuts clients » ----------
const COMPTEURS = [
  ['panne', 'Problème'],
  ['attention', 'À surveiller'],
  ['action', 'À traiter'],
  ['ok', 'En ligne'],
  ['prepa', 'En préparation'],
];

function phraseStatuts(r) {
  if (!r) return '';
  if (!r.total) return 'Aucun client pour l’instant.';
  if (!r.enLigne) return `Aucun site en ligne pour l’instant · ${pluriel(r.prepa, 'dossier')} en préparation.`;
  const parts = [];
  if (r.panne) parts.push(`${r.panne} en panne`);
  if (r.attention) parts.push(`${r.attention} à surveiller`);
  if (r.action) parts.push(`${r.action} à traiter`);
  if (r.travaux) parts.push(`${r.travaux} en cours de mise en ligne`);
  const total = `${pluriel(r.enLigne, 'site')} en ligne`;
  return parts.length ? `${total} : ${parts.join(', ')}.` : `${total}, tout va bien.`;
}

function ModuleStatuts({ data, erreur, majLe, verif, onVerifier }) {
  const now = useHorloge(10_000);
  const r = data?.resume;
  const sites = data?.sites || [];
  const aRegarder = sites.filter((s) => ['panne', 'attention', 'action'].includes(s.etat));
  const compte = (etat) => (etat === 'ok' ? (r?.ok || 0) + (r?.travaux || 0) : r?.[etat] || 0);
  const MAX = 5;
  return (
    <section className="module accueil-module accueil-statuts" aria-labelledby="statuts-titre">
      <div className="module-tete">
        <h2 className="module-titre" id="statuts-titre">
          Statuts clients
        </h2>
        <a className="module-lien" href="/controle">
          Ouvrir Contrôle →
        </a>
      </div>

      {!data && !erreur && <Spinner label="Vérification des sites…" />}
      {erreur && !data && <p className="module-vide">{erreur.status === 401 ? 'Session expirée : recharge la page pour te reconnecter.' : erreur.message}</p>}

      {r && (
        <>
          <p className={`accueil-phrase${r.panne ? ' ko' : ''}`}>{phraseStatuts(r)}</p>
          {r.total > 0 && (
            <ul className="compteurs" aria-label="Nombre de clients par statut">
              {COMPTEURS.map(([etat, label]) => {
                const n = compte(etat);
                return (
                  <li key={etat} className={`compteur etat-${etat}${n ? '' : ' zero'}`}>
                    <span className="compteur-n">{n}</span>
                    <span className="compteur-label">{label}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {aRegarder.length > 0 ? (
            <ul className="accueil-liste" aria-label="Sites à regarder">
              {aRegarder.slice(0, MAX).map((s) => {
                const p = (s.problemes || []).find((x) => x.niveau !== 'travaux');
                return (
                  <li key={s.id}>
                    <a className="accueil-ligne" href={`/controle?site=${encodeURIComponent(s.id)}`}>
                      <span className={`etat-pill etat-${s.etat}`}>{ETATS[s.etat]}</span>
                      <span className="accueil-ligne-texte">
                        <strong>{s.nom}</strong>
                        {p && <span className="muted">{p.titre}</span>}
                      </span>
                      <span className="accueil-chevron" aria-hidden="true">
                        ›
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            r.enLigne > 0 && <p className="accueil-ok">Rien à regarder : tous les sites répondent.</p>
          )}
          {aRegarder.length > MAX && (
            <p className="small muted">
              Et {pluriel(aRegarder.length - MAX, 'autre site', 'autres sites')} dans <a href="/controle">Contrôle</a>.
            </p>
          )}
          {!r.total && (
            <p className="module-vide">
              Crée le dossier de ton premier client dans <a href="/agence">Clients</a> : il apparaîtra ici.
            </p>
          )}
          <div className="accueil-pied">
            <span className={`accueil-direct${erreur ? ' ko' : ''}`} role="status">
              {erreur ? 'Connexion perdue' : verif ? 'Vérification…' : majLe ? `Vérifié ${secondes(now - majLe)}` : ''}
            </span>
            <button type="button" className="btn-text small" onClick={onVerifier} disabled={verif}>
              Revérifier
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------- Module « Finances » ----------
function BeneficeCellule({ v }) {
  return <td className={`num ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}`}>{euros(v, { signe: true })}</td>;
}

function PointMortCellule({ c }) {
  const pm = c.pointMort || {};
  if (pm.etat === 'sans') return <td className="pm">—</td>;
  if (pm.etat === 'atteint') {
    const jour = Number(String(pm.le).slice(8, 10));
    return (
      <td className="pm pm-ok">
        <span className="pm-etat">Atteint</span> <span className="pm-detail">le {jour === 1 ? '1er' : jour}</span>
      </td>
    );
  }
  return (
    <td className={`pm ${pm.etat === 'en-cours' ? 'pm-encours' : 'pm-ko'}`}>
      <span className="pm-etat">{pm.etat === 'en-cours' ? 'Pas encore' : 'Non atteint'}</span> <span className="pm-detail">{pm.etat === 'en-cours' ? 'reste' : 'manque'} {euros(pm.manque)}</span>
    </td>
  );
}

function phraseRecurrent(rec) {
  if (!rec || rec.fraisFixes <= 0) return null;
  const ab = `${euros(rec.abonnements)} par mois`;
  if (!rec.abonnes) return { ok: false, texte: `Aucun abonnement en cours : il faut ${euros(rec.fraisFixes)} d’abonnements par mois pour couvrir tes frais fixes sans compter sur les créations de sites.` };
  if (rec.ecart >= 0)
    return { ok: true, texte: `Tes abonnements (${ab}) couvrent tes frais fixes : il reste ${euros(rec.ecart)} chaque mois, avant même les créations de sites.` };
  return {
    ok: false,
    texte: `Tes abonnements (${ab}) couvrent ${rec.couverture} % de tes frais fixes. Il manque ${euros(-rec.ecart)} par mois, soit ${pluriel(rec.manquants, 'abonnement')} de plus au prix moyen de ${euros(rec.moyen)}.`,
  };
}

function ModuleFinances({ fin, erreur, onRecharger }) {
  const r = fin?.resume;
  const t = r?.tableau || [];
  const rec = r?.recurrent;
  const vide = r && !r.chargesMensuelles && !r.mrr && t.every((c) => !c.encaisse);
  const phrase = phraseRecurrent(rec);
  return (
    <section className="module accueil-module accueil-fin" aria-labelledby="fin-titre">
      <div className="module-tete">
        <h2 className="module-titre" id="fin-titre">
          Finances
        </h2>
        <a className="module-lien" href="/controle/finances">
          Suivi financier →
        </a>
      </div>

      {!fin && !erreur && <Spinner label="Calcul en cours…" />}
      {erreur && (
        <p className="module-vide">
          {erreur.message}{' '}
          <button type="button" className="btn-text small" onClick={onRecharger}>
            Réessayer
          </button>
        </p>
      )}

      {vide && (
        <p className="module-vide">
          Saisis tes <a href="/agence/reglages#frais-fixes">frais fixes mensuels</a> dans Réglages, puis la facturation de tes clients dans le{' '}
          <a href="/controle/finances">suivi financier</a> : ton bénéfice et ton point mort s’afficheront ici.
        </p>
      )}

      {r && !vide && (
        <>
          <div className="fin-table-cadre">
            <table className="fin-table">
              <caption className="sr-only">Encaissé, frais fixes, bénéfice et point mort des trois derniers mois</caption>
              <thead>
                <tr>
                  <td />
                  {t.map((c) => (
                    <th key={c.mois} scope="col" className={c.enCours ? 'en-cours' : undefined}>
                      {majuscule(nomMois(c.mois).split(' ')[0])}
                      {c.enCours && <small>en cours</small>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Encaissé HT</th>
                  {t.map((c) => (
                    <td key={c.mois} className="num">
                      {euros(c.encaisse)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">Frais fixes mensuels</th>
                  {t.map((c) => (
                    <td key={c.mois} className="num">
                      {euros(c.fraisFixes)}
                    </td>
                  ))}
                </tr>
                <tr className="ligne-benefice">
                  <th scope="row">Bénéfice</th>
                  {t.map((c) => (
                    <BeneficeCellule key={c.mois} v={c.benefice} />
                  ))}
                </tr>
                <tr className="ligne-pm">
                  <th scope="row">Point mort</th>
                  {t.map((c) => (
                    <PointMortCellule key={c.mois} c={c} />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {phrase ? (
            <p className={`accueil-recurrent${phrase.ok ? ' ok' : ''}`}>{phrase.texte}</p>
          ) : (
            <p className="accueil-recurrent">
              Aucun frais fixe enregistré : ajoute-les dans <a href="/agence/reglages#frais-fixes">Réglages</a> pour calculer ton vrai bénéfice et ton point mort.
            </p>
          )}

          <div className="accueil-actions">
            <a className="btn secondary small" href="/agence/reglages#frais-fixes">
              Modifier les frais fixes
            </a>
            <a className="btn secondary small" href="/controle/finances">
              Voir le détail
            </a>
          </div>
          <p className="accueil-note small muted">
            Bénéfice = encaissé HT − frais fixes, avant impôts et cotisations. Point mort : le jour du mois où ce que tu as encaissé couvre tes frais fixes.
          </p>
        </>
      )}
    </section>
  );
}

// ---------- Page ----------
function useFinances() {
  const [fin, setFin] = useState(null);
  const [erreur, setErreur] = useState(null);
  const charger = useCallback(async () => {
    try {
      setFin(await api('/api/agence/finances'));
      setErreur(null);
    } catch (e) {
      setErreur(e);
    }
  }, []);
  useEffect(() => {
    charger();
    // Retour sur l'Accueil (après un paiement noté ou un réglage modifié) : chiffres à jour
    const retour = () => document.visibilityState === 'visible' && charger();
    document.addEventListener('visibilitychange', retour);
    window.addEventListener('pageshow', retour);
    return () => {
      document.removeEventListener('visibilitychange', retour);
      window.removeEventListener('pageshow', retour);
    };
  }, [charger]);
  return { fin, erreur, charger };
}

export default function Accueil({ studioName, ownerName }) {
  const statuts = usePilotage(60_000);
  const finances = useFinances();
  const aujourdhui = useMemo(dateDuJour, []);
  const n = statuts.data?.resume?.panne || 0;

  useEffect(() => {
    document.title = `${n ? `(${n}) ` : ''}Accueil — ${studioName}`;
    try {
      if ('setAppBadge' in navigator) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
    } catch {}
  }, [n, studioName]);

  const sansStockage = statuts.data?.storage === 'none' || finances.fin?.storage === 'none';

  return (
    <div className="ss pilot-app">
      <AgencyBar studioName={studioName} current="accueil" />
      <main className="page accueil">
        <div className="pilot-head">
          <div>
            <h1>{ownerName ? `Bonjour ${ownerName}` : 'Accueil'}</h1>
            <p className="muted">{aujourdhui}</p>
          </div>
        </div>
        {sansStockage ? (
          <StorageSetup />
        ) : (
          <div className="accueil-grille">
            <ModuleStatuts data={statuts.data} erreur={statuts.erreur} majLe={statuts.majLe} verif={statuts.verif} onVerifier={() => statuts.charger(true)} />
            <ModuleFinances fin={finances.fin} erreur={finances.erreur} onRecharger={finances.charger} />
          </div>
        )}
      </main>
    </div>
  );
}
