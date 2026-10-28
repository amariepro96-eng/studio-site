'use client';
// Pilotage : une tuile par site client, mise à jour toute seule toutes les 30 secondes.
// Une bulle explique chaque problème ; un appui sur la tuile ouvre la fiche du client.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { AgencyBar, Spinner } from '../Chrome.jsx';
import { StorageSetup } from '../agency/Dashboard.jsx';
import Bulle from './Bulle.jsx';
import Fiche from './Fiche.jsx';
import { ETATS, NIVEAUX } from './Explication.jsx';
import { timeAgo } from '../../engine/records.js';
import { euros, nomMois } from '../../engine/finances.js';

const sansProto = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

function secondes(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 5) return 'à l’instant';
  if (s < 60) return `il y a ${s} s`;
  return `il y a ${Math.floor(s / 60)} min`;
}

// Chargement + actualisation automatique tant que la page est visible
function usePilotage() {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [verif, setVerif] = useState(false);
  const [majLe, setMajLe] = useState(0);
  const enVol = useRef(false);
  const majRef = useRef(0);

  const charger = useCallback(async (force = false) => {
    if (enVol.current && !force) return;
    enVol.current = true;
    if (force) setVerif(true);
    try {
      const d = await api('/api/agence/pilotage' + (force ? '?force=1' : ''));
      setData(d);
      setErreur(null);
      majRef.current = Date.now();
      setMajLe(Date.now());
    } catch (e) {
      setErreur(e);
    } finally {
      enVol.current = false;
      setVerif(false);
    }
  }, []);

  useEffect(() => {
    charger();
    const tic = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) charger();
    }, 30_000);
    const retour = () => {
      if (document.visibilityState === 'visible' && Date.now() - majRef.current > 10_000) charger();
    };
    document.addEventListener('visibilitychange', retour);
    window.addEventListener('online', retour);
    return () => {
      clearInterval(tic);
      document.removeEventListener('visibilitychange', retour);
      window.removeEventListener('online', retour);
    };
  }, [charger]);

  return { data, erreur, verif, majLe, charger };
}

function useHorloge(ms = 5000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT((t) => t + 1), ms);
    return () => clearInterval(i);
  }, [ms]);
  return Date.now();
}

function Direct({ majLe, erreur, verif, onVerifier }) {
  const now = useHorloge();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const v = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', v);
    return () => document.removeEventListener('visibilitychange', v);
  }, []);
  const etat = erreur ? 'ko' : !majLe ? 'attente' : visible ? 'on' : 'pause';
  return (
    <div className={`direct direct-${etat}`} role="status" aria-live="polite">
      <span className="direct-point" aria-hidden="true" />
      <span className="direct-texte">
        {erreur ? 'Connexion perdue' : verif ? 'Vérification…' : !majLe ? 'Première vérification…' : `En direct · vérifié ${secondes(now - majLe)}`}
      </span>
      <button type="button" className="btn secondary small" onClick={onVerifier} disabled={verif}>
        Revérifier
      </button>
    </div>
  );
}

function Tuile({ s, onFiche, onBulle }) {
  const pbs = (s.problemes || []).filter((p) => p.niveau !== 'travaux');
  const p = pbs[0];
  const encours = s.problemes?.find((x) => x.niveau === 'travaux');
  const meta = [s.version ? `v${s.version}` : '', s.publieLe ? `publié ${timeAgo(s.publieLe)}` : '', s.mesure?.ok && s.mesure.ms ? `${s.mesure.ms} ms` : ''].filter(Boolean).join(' · ');
  return (
    <li className={`tuile etat-${s.etat}`}>
      <button type="button" className="tuile-main" onClick={(e) => onFiche(s.id, e.currentTarget)}>
        <span className="tuile-haut">
          <span className={`etat-pill etat-${s.etat}`}>{ETATS[s.etat]}</span>
          {s.espace?.demandes > 0 && (
            <span className="tuile-badge" title="Demandes du client">
              {s.espace.demandes} demande{s.espace.demandes > 1 ? 's' : ''}
            </span>
          )}
        </span>
        <span className="tuile-nom">{s.nom}</span>
        <span className="tuile-url">{sansProto(s.domaine || s.url)}</span>
        <span className="tuile-meta">{encours ? encours.resume : meta || ' '}</span>
      </button>
      {p && (
        <button type="button" className={`bulle-declencheur niveau-${p.niveau}`} aria-haspopup="dialog" onClick={(e) => onBulle(s.id, p.id, e.currentTarget)}>
          <span className="bulle-icone" aria-hidden="true">
            {p.niveau === 'action' ? '•' : '!'}
          </span>
          <span className="bulle-declencheur-texte">
            <span>
              <span className="sr-only">{NIVEAUX[p.niveau]?.long} : </span>
              {p.titre}
              {pbs.length > 1 && <span className="bulle-plus"> (+{pbs.length - 1})</span>}
            </span>
            <span className="bulle-voir">Pourquoi et que faire</span>
          </span>
        </button>
      )}
    </li>
  );
}

function ModuleFinances({ f }) {
  if (!f) return null;
  const vide = !f.mrr && !f.encaisseMois && !f.attente && !f.retard && !f.charges;
  return (
    <a className="module module-fin" href="/pilotage/finances">
      <span className="module-tete">
        <span className="module-titre">Suivi financier</span>
        <span className="module-lien" aria-hidden="true">
          Ouvrir →
        </span>
      </span>
      {vide ? (
        <span className="module-vide">Renseigne les abonnements et factures de tes clients pour voir ici ce qui rentre chaque mois.</span>
      ) : (
        <span className="module-chiffres">
          <span className="chiffre">
            <span className="chiffre-label">Encaissé en {nomMois(f.mois).split(' ')[0]}</span>
            <span className="chiffre-val">{euros(f.encaisseMois)}</span>
          </span>
          <span className="chiffre">
            <span className="chiffre-label">Abonnements</span>
            <span className="chiffre-val">
              {euros(f.mrr)}
              <small>/mois</small>
            </span>
          </span>
          <span className={`chiffre${f.retard ? ' ko' : ''}`}>
            <span className="chiffre-label">En retard</span>
            <span className="chiffre-val">{f.retard ? euros(f.retard) : '0 €'}</span>
            {f.retard > 0 && <span className="chiffre-sous">{f.retardClients} client{f.retardClients > 1 ? 's' : ''}</span>}
          </span>
          <span className={`chiffre${f.marge < 0 ? ' ko' : ''}`}>
            <span className="chiffre-label">Marge estimée</span>
            <span className="chiffre-val">
              {euros(f.marge)}
              <small>/mois</small>
            </span>
          </span>
        </span>
      )}
    </a>
  );
}

function Journal({ journal, onOuvrir, id = 'journal-titre' }) {
  return (
    <section className="module module-journal" aria-labelledby={id}>
      <span className="module-tete">
        <span className="module-titre" id={id}>
          Activité récente
        </span>
      </span>
      {journal?.length ? (
        <ol className="journal">
          {journal.slice(0, 6).map((j, i) => (
            <li key={i} className={`j-${j.type} niveau-${j.niveau}`}>
              <button type="button" className="journal-ligne" onClick={() => onOuvrir(j.clientId)}>
                <span className="journal-point" aria-hidden="true" />
                <span>
                  <strong>{j.nom}</strong> · {j.type === 'resolu' ? 'réglé : ' : ''}
                  {j.titre}
                </span>
                <time className="muted" dateTime={j.at}>
                  {timeAgo(j.at)}
                </time>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="module-vide">Les problèmes qui apparaissent ou se règlent s’afficheront ici.</p>
      )}
    </section>
  );
}

export default function Pilotage({ studioName }) {
  const { data, erreur, verif, majLe, charger } = usePilotage();
  const [fiche, setFiche] = useState(null); // { id, ancre, probleme }
  const [bulle, setBulle] = useState(null); // { id, probleme, ancre }
  const [toast, setToast] = useState(null);
  const [filtre, setFiltre] = useState('tous');
  const vusRef = useRef(null);

  const sites = data?.sites || [];
  const enLigne = sites.filter((s) => s.etat !== 'prepa');
  const prepa = sites.filter((s) => s.etat === 'prepa');
  const r = data?.resume;
  const aRegarder = enLigne.filter((s) => ['panne', 'attention', 'action'].includes(s.etat));
  const affiches = filtre === 'regarder' ? aRegarder : enLigne;

  // Nouvelle panne depuis la vérification précédente : petit message, titre de l'onglet, pastille de l'appli
  useEffect(() => {
    if (!data?.sites) return;
    const pannes = new Map();
    for (const s of data.sites) for (const p of s.problemes || []) if (p.niveau === 'panne') pannes.set(`${s.id}:${p.id}`, { s, p });
    if (vusRef.current) {
      const nouvelles = [...pannes.entries()].filter(([k]) => !vusRef.current.has(k));
      if (nouvelles.length) {
        const [, { s, p }] = nouvelles[0];
        setToast({ id: s.id, probleme: p.id, texte: `${s.nom} : ${p.titre}`, plus: nouvelles.length - 1 });
      }
    }
    vusRef.current = new Set(pannes.keys());
    const n = data.resume?.panne || 0;
    document.title = `${n ? `(${n}) ` : ''}Pilotage — ${studioName}`;
    try {
      if ('setAppBadge' in navigator) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
    } catch {}
  }, [data, studioName]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 12_000);
    return () => clearTimeout(t);
  }, [toast]);

  const siteDe = useCallback((id) => sites.find((s) => s.id === id), [sites]);
  const ouvrirFiche = (id, ancre, probleme = null) => {
    setBulle(null);
    setFiche({ id, ancre, probleme });
  };
  const verifier = () => charger(true);

  const phrase = useMemo(() => {
    if (!r) return 'Vérification de vos sites…';
    if (!r.enLigne) return r.prepa ? `Aucun site en ligne pour l’instant · ${r.prepa} en préparation.` : 'Aucun site client pour l’instant.';
    const parts = [];
    if (r.panne) parts.push(`${r.panne} en panne`);
    if (r.attention) parts.push(`${r.attention} à surveiller`);
    if (r.action) parts.push(`${r.action} à traiter`);
    if (r.travaux) parts.push(`${r.travaux} en cours de mise en ligne`);
    return parts.length ? `${r.enLigne} site${r.enLigne > 1 ? 's' : ''} en ligne : ${parts.join(', ')}.` : `${r.enLigne} site${r.enLigne > 1 ? 's' : ''} en ligne, tout va bien.`;
  }, [r]);

  const sessionPerdue = erreur?.status === 401;
  const siteFiche = fiche && siteDe(fiche.id);
  const siteBulle = bulle && siteDe(bulle.id);

  return (
    <div className="ss pilot-app">
      <AgencyBar studioName={studioName} current="pilotage" />
      <main className="page pilot">
        <div className="pilot-head">
          <div>
            <h1>Pilotage</h1>
            <p className="muted">{phrase}</p>
          </div>
          {data?.storage !== 'none' && <Direct majLe={majLe} erreur={erreur} verif={verif} onVerifier={verifier} />}
        </div>

        {sessionPerdue && (
          <div className="alert" role="alert">
            Session expirée : reconnectez-vous.{' '}
            <button type="button" className="btn-text small" onClick={() => window.location.reload()}>
              Se reconnecter
            </button>
          </div>
        )}
        {erreur && !sessionPerdue && data && <div className="alert soft">Dernière vérification impossible ({erreur.message}) : les informations affichées datent de {secondes(Date.now() - majLe).replace('il y a ', '')}.</div>}
        {erreur && !sessionPerdue && !data && (
          <div className="alert" role="alert">
            {erreur.message}{' '}
            <button type="button" className="btn-text small" onClick={() => charger()}>
              Réessayer
            </button>
          </div>
        )}
        {data?.storage === 'none' && <StorageSetup />}
        {data?.alerte && (
          <div className={`pilot-alerte niveau-${data.alerte.niveau}`} role="alert">
            <strong>{data.alerte.titre}</strong>
            <span>{data.alerte.texte}</span>
          </div>
        )}
        {!data && !erreur && <Spinner label="Vérification de vos sites…" />}

        {data && data.storage !== 'none' && (
          <>
            <div className="pilot-modules">
              <ModuleFinances f={data.finances} />
              <div className="journal-haut">
                <Journal journal={data.journal} onOuvrir={(id) => siteDe(id) && ouvrirFiche(id, null)} />
              </div>
            </div>

            <section className="pilot-section" aria-labelledby="sites-titre">
              <div className="pilot-section-tete">
                <h2 id="sites-titre">Sites en ligne</h2>
                {enLigne.length > 0 && (
                  <div className="seg" role="group" aria-label="Filtrer les sites">
                    <button type="button" aria-pressed={filtre === 'tous'} onClick={() => setFiltre('tous')}>
                      Tous <span className="count">{enLigne.length}</span>
                    </button>
                    <button type="button" aria-pressed={filtre === 'regarder'} onClick={() => setFiltre('regarder')}>
                      À regarder <span className="count">{aRegarder.length}</span>
                    </button>
                  </div>
                )}
              </div>
              {affiches.length ? (
                <ul className="tuiles">
                  {affiches.map((s) => (
                    <Tuile key={s.id} s={s} onFiche={(id, ancre) => ouvrirFiche(id, ancre)} onBulle={(id, probleme, ancre) => setBulle({ id, probleme, ancre })} />
                  ))}
                </ul>
              ) : (
                <p className="empty">{enLigne.length ? 'Rien à regarder : tous les sites vont bien.' : 'Aucun site en ligne pour l’instant. Ils apparaissent ici dès leur mise en ligne.'}</p>
              )}
            </section>

            {prepa.length > 0 && (
              <section className="pilot-section" aria-labelledby="prepa-titre">
                <h2 id="prepa-titre">En préparation</h2>
                <ul className="prepa-liste">
                  {prepa.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="prepa-ligne" onClick={(e) => ouvrirFiche(s.id, e.currentTarget)}>
                        <strong>{s.nom}</strong>
                        <span className="muted">{s.etape}</span>
                        <span className={`prepa-tour tour-${s.tour || 'aucun'}`}>{s.tour === 'agence' ? `À toi : ${s.prochaine}` : s.prochaine}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="journal-bas pilot-section">
              <Journal id="journal-titre-bas" journal={data.journal} onOuvrir={(id) => siteDe(id) && ouvrirFiche(id, null)} />
            </div>
            <p className="pilot-pied muted small">
              Vérification toutes les {data.intervalle || 30} secondes tant que cette page est ouverte, et toutes les {data.surveillance?.intervalle || 5} minutes quand elle est fermée
              {data.surveillance?.derniereLe ? ` (dernière ${timeAgo(data.surveillance.derniereLe)})` : ''}.{' '}
              {data.surveillance?.pret ? (
                <>Alertes par e-mail envoyées à {data.surveillance.email}.</>
              ) : (
                <>
                  Alertes par e-mail désactivées ou incomplètes : <a href="/agence/reglages">Réglages › Alertes par e-mail</a>.
                </>
              )}
            </p>
          </>
        )}
      </main>

      {toast && (
        <div className="pilot-toast" role="alert">
          <span>
            <strong>Nouveau problème</strong> {toast.texte}
            {toast.plus > 0 ? ` (et ${toast.plus} autre${toast.plus > 1 ? 's' : ''})` : ''}
          </span>
          <button
            type="button"
            className="btn-text small invert"
            onClick={() => {
              const t = toast;
              setToast(null);
              if (siteDe(t.id)) ouvrirFiche(t.id, null, t.probleme);
            }}
          >
            Voir
          </button>
          <button type="button" className="icon-btn small" aria-label="Fermer" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}

      {siteBulle && (
        <Bulle
          site={siteBulle}
          probleme={siteBulle.problemes.find((p) => p.id === bulle.probleme) || null}
          ancre={bulle.ancre}
          onClose={() => setBulle(null)}
          onVerifier={verifier}
          verif={verif}
          onFiche={() => ouvrirFiche(bulle.id, bulle.ancre, bulle.probleme)}
        />
      )}
      {siteFiche && <Fiche key={fiche.id} site={siteFiche} problemeOuvert={fiche.probleme} onClose={() => setFiche(null)} onVerifier={verifier} verif={verif} />}
    </div>
  );
}
