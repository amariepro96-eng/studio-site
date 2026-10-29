'use client';
// Appli Devis & Factures : coquille (connexion, onglets Devis · Factures · Réglages, messages)
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Connexion from './Connexion.jsx';
import { Marque } from './commun.jsx';
import Devis from './Devis.jsx';
import Factures from './Factures.jsx';
import Reglages from './Reglages.jsx';
import { statutDevis, statutFacture } from './vues.js';

const ONGLETS = [
  ['devis', 'Devis'],
  ['factures', 'Factures'],
  ['reglages', 'Réglages'],
];
const DEPART = { onglet: 'devis', ecran: 'liste', id: null };

function Icone({ nom }) {
  const p = {
    accueil: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    site: 'M4 11l8-7 8 7M6 10v9h12v-9M10 19v-6h4v6',
    devis: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
    factures: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
    reglages: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  }[nom];
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={p} />
    </svg>
  );
}

// Compte « site seul » : on va droit à la modification du site. Cet écran n'est que le court
// temps d'ouverture (site en ligne) ou le message d'attente (site pas encore publié).
function AccueilSite({ data, versSite, ouvrir }) {
  if (data.site?.disponible) {
    return (
      <section className="dv-page dv-accueil">
        <p className="muted">Ouverture de la modification de votre site…</p>
        <button type="button" className="btn-text small" onClick={ouvrir} disabled={versSite}>
          {versSite ? 'Ouverture…' : 'Ouvrir maintenant'}
        </button>
      </section>
    );
  }
  return (
    <section className="dv-page dv-accueil">
      <div className="dv-page-tete">
        <h1>Mon espace</h1>
      </div>
      <div className="card dv-accueil-carte">
        <h2>Modification du site</h2>
        <p className="muted">Votre site n’est pas encore en ligne : votre prestataire le publiera bientôt. Vous pourrez alors le modifier ici (horaires, prix, photos, annonces).</p>
      </div>
      <p className="muted small">Votre mot de passe, le code du téléphone et vos appareils : onglet « Mon compte ».</p>
    </section>
  );
}

export default function DevisApp() {
  const [data, setData] = useState(null);
  const [etat, setEtat] = useState('chargement');
  const [erreur, setErreur] = useState('');
  const [nav, setNav] = useState(DEPART);
  const [toast, setToast] = useState(null);
  const garde = useRef(null); // modifications non enregistrées dans l'écran ouvert

  const charger = useCallback(async () => {
    try {
      const d = await api('/api/devis');
      setData(d);
      setEtat('pret');
    } catch (e) {
      if (e.status === 401) setEtat('connexion');
      else {
        setErreur(e.message);
        setEtat('erreur');
      }
    }
  }, []);

  useEffect(() => {
    charger();
    // Retour dans l'appli : un client a peut-être répondu entre-temps
    let derniere = Date.now();
    const retour = () => {
      if (document.visibilityState === 'visible' && Date.now() - derniere > 30_000 && !garde.current) {
        derniere = Date.now();
        charger();
      }
    };
    document.addEventListener('visibilitychange', retour);
    return () => document.removeEventListener('visibilitychange', retour);
  }, [charger]);

  // Navigation avec l'historique (bouton retour d'Android, geste retour)
  useEffect(() => {
    // Rechargement de la page (ou retour dans l'appli) : on revient sur l'écran où l'on était
    const h = window.location.hash.replace('#', '');
    let depart = ['factures', 'reglages'].includes(h) ? { ...DEPART, onglet: h } : DEPART;
    try {
      const avant = window.history.state?.nav;
      if (avant && ['devis', 'factures', 'reglages'].includes(avant.onglet)) depart = avant.ecran === 'edition' ? { ...avant, ecran: avant.id ? 'detail' : 'liste' } : avant;
    } catch {}
    setNav(depart);
    try {
      window.history.replaceState({ nav: depart }, '');
    } catch {}
    const pop = (e) => {
      if (garde.current && !window.confirm('Quitter sans enregistrer vos modifications ?')) {
        try {
          window.history.pushState({ nav: e.state?.navAvant || DEPART }, '');
        } catch {}
        return;
      }
      garde.current = null;
      setNav(e.state?.nav || DEPART);
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);

  const aller = useCallback(
    (suivant, { remplacer = false } = {}) => {
      if (garde.current && !window.confirm('Quitter sans enregistrer vos modifications ?')) return;
      garde.current = null;
      const n = { ...DEPART, ...suivant };
      setNav(n);
      try {
        window.history[remplacer ? 'replaceState' : 'pushState']({ nav: n }, '', n.onglet === 'devis' ? '/devis' : `/devis#${n.onglet}`);
      } catch {}
      window.scrollTo(0, 0);
    },
    []
  );

  // « Mon site » : le compte est déjà connecté, on ouvre la session du site puis on y va.
  const [versSite, setVersSite] = useState(false);
  const ouvrirMonSite = useCallback(async (id) => {
    if (garde.current && !window.confirm('Quitter sans enregistrer vos modifications ?')) return;
    garde.current = null;
    setVersSite(true);
    try {
      const d = await api('/api/devis', { method: 'POST', body: { action: 'site.ouvrir' } });
      window.location.assign('/espace/' + d.id);
    } catch (e) {
      setVersSite(false);
      if (e.status === 401) setEtat('connexion');
      else setToast(e.message || 'Impossible d’ouvrir votre site pour le moment.');
    }
  }, []);

  // Compte « site seul » : on va droit à la modification du site (pas d'écran intermédiaire).
  // L'onglet « Mon compte » reste joignable via /devis#reglages, qui ne redirige pas.
  useEffect(() => {
    if (!data || versSite) return;
    const fact = data.rubriques?.facturation !== false;
    const hash = (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '');
    if (!fact && data.site?.disponible && hash !== 'reglages') ouvrirMonSite(data.site.id);
  }, [data, versSite, ouvrirMonSite]);

  const agir = useCallback(async (body) => {
    try {
      const d = await api('/api/devis', { method: 'POST', body });
      setData(d);
      if (d.note) setToast(d.note);
      return d;
    } catch (e) {
      if (e.status === 401) setEtat('connexion');
      throw e;
    }
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  if (etat === 'connexion') return <Connexion onConnecte={() => (setEtat('chargement'), charger())} />;
  if (etat === 'chargement')
    return (
      <div className="ss dv">
        <main className="login dv-login">
          <Marque />
          <p className="muted">Chargement…</p>
        </main>
      </div>
    );
  if (etat === 'erreur')
    return (
      <div className="ss dv">
        <main className="login dv-login">
          <Marque />
          <div className="alert" role="alert">
            {erreur}{' '}
            <button type="button" className="btn-text small" onClick={charger}>
              Réessayer
            </button>
          </div>
        </main>
      </div>
    );

  const jour = data.jour;
  // Site seul (sans facturation) : ni Devis ni Factures, un accueil avec « Ouvrir mon site » + le compte
  const facturation = data.rubriques?.facturation !== false;
  const nbRepondus = facturation ? data.devis.filter((d) => ['modification'].includes(d.statut)).length : 0;
  const nbAEmettre = facturation ? data.factures.filter((f) => f.statut === 'a_emettre').length + data.factures.filter((f) => statutFacture(f, jour) === 'retard').length : 0;
  const badges = facturation ? { devis: nbRepondus, factures: nbAEmettre, reglages: data.manques.length ? '!' : 0 } : {};
  const onglets = facturation ? ONGLETS : [['reglages', 'Mon compte']];
  const onglet = facturation ? nav.onglet : nav.onglet === 'reglages' ? 'reglages' : 'accueil';
  const siteLanceur = Boolean(data.site?.disponible);
  const props = { data, agir, nav, aller, garde, setToast, recharger: charger };

  return (
    <div className="ss dv dv-app">
      <header className="dv-entete">
        <Marque nom={data.entreprise.nom} titre={facturation ? undefined : 'Espace client'} />
        <nav className="dv-onglets-haut" aria-label="Sections">
          {siteLanceur && (
            <a href={`/espace/${data.site.id}`} className="dv-lien-site" onClick={(e) => { e.preventDefault(); ouvrirMonSite(data.site.id); }}>
              {versSite ? 'Ouverture…' : 'Mon site'}
            </a>
          )}
          {onglets.map(([id, label]) => (
            <a
              key={id}
              href={id === 'devis' ? '/devis' : `/devis#${id}`}
              aria-current={onglet === id ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                aller({ onglet: id });
              }}
            >
              {label}
              {badges[id] ? <span className="dv-badge">{badges[id]}</span> : null}
            </a>
          ))}
        </nav>
      </header>

      <main className="dv-main">
        {onglet === 'accueil' && <AccueilSite data={data} versSite={versSite} ouvrir={() => ouvrirMonSite(data.site?.id)} />}
        {onglet === 'devis' && <Devis {...props} />}
        {onglet === 'factures' && <Factures {...props} />}
        {onglet === 'reglages' && <Reglages {...props} />}
      </main>

      <nav className="dv-onglets-bas" aria-label="Sections">
        {siteLanceur && (
          <a href={`/espace/${data.site.id}`} className="dv-lien-site" onClick={(e) => { e.preventDefault(); ouvrirMonSite(data.site.id); }}>
            <Icone nom="site" />
            <span>{versSite ? 'Ouverture…' : 'Mon site'}</span>
          </a>
        )}
        {onglets.map(([id, label]) => (
          <a
            key={id}
            href={id === 'devis' ? '/devis' : `/devis#${id}`}
            aria-current={onglet === id ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              aller({ onglet: id });
            }}
          >
            <Icone nom={id} />
            <span>{label}</span>
            {badges[id] ? <span className="dv-badge">{badges[id]}</span> : null}
          </a>
        ))}
      </nav>

      {toast && (
        <div className="dv-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export { statutDevis };
