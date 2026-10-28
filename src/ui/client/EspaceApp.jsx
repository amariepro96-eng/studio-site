'use client';
// Espace client : le client modifie son site en ligne (horaires, prix, annonces, photos), voit
// l'aperçu tout de suite, puis publie. Ouvert aussi par l'agence (vue agence) si le client l'a permis.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrandMark, ClientShell, Spinner } from '../Chrome.jsx';
import { DeviceToggle, PageTabs } from '../Frames.jsx';
import { renderPage, sitePages } from '../../engine/render.js';
import { renderImages, renderBrief } from '../../engine/records.js';
import { nettoyer, appliquer, resume, fusion3, memeEtat, aujourdhui, jourTexte, RAISONS_ATTENTE } from '../../engine/espace.js';
import { Horaires, Liste, Annonces, Photos } from './espace/Rubriques.jsx';
import { Demandes, Historique, Acces } from './espace/Suivi.jsx';
import { Confirmer, fmtQuand } from './espace/Champs.jsx';

// Appel à l'API : ne lève pas d'erreur sur un refus, pour lire le message et les champs en cause
async function requete(url, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'same-origin' });
  } catch {
    return { ok: false, status: 0, data: { error: 'Connexion impossible. Vérifiez votre réseau, puis réessayez.', code: 'network' } };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { ok: res.ok && !data?.error, status: res.status, data: data || {} };
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const cleLocale = (id, role) => `espace-brouillon:${id}:${role}`;
function lireLocal(k) {
  try {
    return JSON.parse(window.localStorage.getItem(k) || 'null');
  } catch {
    return null;
  }
}
function ecrireLocal(k, v) {
  try {
    if (v) window.localStorage.setItem(k, JSON.stringify(v));
    else window.localStorage.removeItem(k);
  } catch {}
}

// Rubriques touchées par les changements (point sur l'onglet)
function zonesChangees(a, b) {
  if (!a || !b) return {};
  const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const fer = (e) => e.annonces.filter((x) => x.type === 'fermeture');
  const ann = (e) => e.annonces.filter((x) => x.type !== 'fermeture');
  return {
    horaires: !eq([a.horaires, a.telephone, a.email, a.adresse, a.instagram, a.facebook, a.faq, fer(a)], [b.horaires, b.telephone, b.email, b.adresse, b.instagram, b.facebook, b.faq, fer(b)]),
    offre: !eq(a.services, b.services),
    boutique: !eq(a.produits, b.produits),
    annonces: !eq(ann(a), ann(b)),
    photos: !eq([a.photos, a.ia], [b.photos, b.ia]),
  };
}

// Rubrique où se trouve un champ en erreur
function ongletDe(cle, etat) {
  if (cle.startsWith('services.')) return 'offre';
  if (cle.startsWith('produits.')) return 'boutique';
  if (cle === 'photos') return 'photos';
  const m = cle.match(/^annonces\.(\d+)/);
  if (m) return etat?.annonces?.[Number(m[1])]?.type === 'fermeture' ? 'horaires' : 'annonces';
  return 'horaires';
}

const WIDTHS = { desktop: '100%', tablet: '820px', mobile: '390px' };

// Aperçu : même rendu que le site publié ; la position de lecture est gardée à chaque changement
function ApercuFrame({ html, device, page, onNavigate, title }) {
  const ref = useRef(null);
  const positions = useRef({});
  useEffect(() => {
    function onMsg(e) {
      if (!ref.current || e.source !== ref.current.contentWindow || !e.data) return;
      if (e.data.type === 'site-nav') {
        positions.current[String(e.data.page)] = 0;
        onNavigate?.(String(e.data.page));
      }
      if (e.data.type === 'site-scroll') positions.current[page] = Number(e.data.y) || 0;
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onNavigate, page]);
  const onLoad = () => {
    const y = positions.current[page];
    if (y) ref.current?.contentWindow?.postMessage({ type: 'site-scroll-to', y }, '*');
  };
  return (
    <div className={`device device-${device}`}>
      <iframe ref={ref} title={title} srcDoc={html} sandbox="allow-scripts allow-forms" style={{ width: WIDTHS[device] || '100%' }} onLoad={onLoad} />
    </div>
  );
}

function Contact({ studio }) {
  if (!studio?.phone && !studio?.email) return null;
  return (
    <>
      {' '}
      ({studio.phone && <a href={`tel:${studio.phone.replace(/[^\d+]/g, '')}`}>{studio.phone}</a>}
      {studio.phone && studio.email ? ' · ' : ''}
      {studio.email && <a href={`mailto:${studio.email}`}>{studio.email}</a>})
    </>
  );
}

// ---------- Écrans de connexion ----------
function Connexion({ phase, info, occupe, onOuvrir, onLien, agenceIci, id }) {
  const owner = info.studio?.ownerName || 'votre interlocuteur';
  const nom = info.connexion?.nom;
  if (phase === 'bienvenue') {
    return (
      <ClientShell studio={info.studio}>
        <section className="public-card esp-login">
          <span className="esp-cadenas" aria-hidden="true" />
          <h1>{nom ? `Bienvenue dans l’espace de ${nom}` : 'Bienvenue dans votre espace'}</h1>
          <p className="lead">Ce lien personnel ouvre votre espace sur cet appareil. Il ne servira plus ensuite : cet appareil restera reconnu, sans mot de passe.</p>
          {agenceIci && (
            <div className="alert soft">
              Tu es connecté à l’espace agence : ce lien est celui de ton client. L’ouvrir ici l’empêcherait de s’en servir.{' '}
              <a href={`/espace/${id}?vue=agence`}>Ouvrir la vue agence</a>
            </div>
          )}
          <div className="row-actions">
            <button type="button" className="btn primary" onClick={onOuvrir} disabled={occupe} autoFocus={!agenceIci}>
              {occupe ? 'Ouverture…' : 'Ouvrir mon espace'}
            </button>
          </div>
          <p className="muted small">Sur un ordinateur partagé, déconnectez-vous en partant (rubrique « Mon accès »). Ne transférez pas ce lien : il donne accès à votre site.</p>
        </section>
      </ClientShell>
    );
  }
  if (phase === 'sortie') {
    return (
      <ClientShell studio={info.studio}>
        <section className="public-card esp-login">
          <h1>Vous êtes déconnecté</h1>
          <p className="lead">Cet appareil n’ouvre plus votre espace. Pour revenir, il vous faudra un nouveau lien personnel.</p>
        </section>
      </ClientShell>
    );
  }
  return (
    <ClientShell studio={info.studio}>
      <section className="public-card esp-login">
        <span className="esp-cadenas" aria-hidden="true" />
        <h1>{info.titre || (nom ? `Espace de ${nom}` : 'Votre espace')}</h1>
        <p className="lead">{info.message || 'Votre espace s’ouvre directement sur les appareils déjà reconnus. Sur un nouvel appareil, il faut un lien personnel.'}</p>
        {info.connexion?.mail ? (
          info.envoye ? (
            <p className="side-note" role="status">
              Lien envoyé à {info.envoye}. Ouvrez-le sur cet appareil : il est valable 15 minutes. Pensez à regarder dans les courriers indésirables.
            </p>
          ) : (
            <>
              <p>Recevez un lien de connexion à l’adresse {info.connexion.email}.</p>
              <div className="row-actions">
                <button type="button" className="btn primary" onClick={onLien} disabled={occupe}>
                  {occupe ? 'Envoi…' : 'Recevoir mon lien'}
                </button>
              </div>
            </>
          )
        ) : (
          <p>
            Demandez un nouveau lien à {owner}
            <Contact studio={info.studio} />.
          </p>
        )}
        {info.erreurLien && (
          <p className="q-error" role="alert">
            {info.erreurLien}
          </p>
        )}
      </section>
    </ClientShell>
  );
}

// ---------- Avancement d'une publication ----------
function Progression({ pub, srv, onFermer }) {
  const url = pub.url || srv.site.url;
  if (pub.etape === 'envoi' || pub.etape === 'deploiement') {
    return (
      <div className="esp-prog" role="status">
        <ol className="pub-steps">
          <li className={pub.etape === 'envoi' ? 'run' : 'done'}>
            <span className="ic" aria-hidden="true" />
            <span>Enregistrement de vos changements</span>
          </li>
          <li className={pub.etape === 'deploiement' ? 'run' : ''}>
            <span className="ic" aria-hidden="true" />
            <span>Mise en ligne{pub.v ? ` de la version v${pub.v}` : ''} (1 minute environ)</span>
          </li>
        </ol>
        <p className="muted small">Vous pouvez fermer cette page : la mise en ligne continue.</p>
      </div>
    );
  }
  const textes = {
    enligne: ['ok', `C’est en ligne${pub.v ? ` (version v${pub.v})` : ''}.`, pub.message || 'Si l’ancienne version s’affiche encore, rechargez la page de votre site.'],
    attente: ['wait', 'Vos changements sont enregistrés.', pub.message || 'Ils seront en ligne très bientôt.'],
    propose: ['ok', 'Proposition envoyée.', `${srv.nom} la retrouve dans son espace : elle sera en ligne dès qu’il l’aura validée.`],
    lent: ['wait', 'La mise en ligne prend plus de temps que prévu.', 'Elle continue : rechargez cette page dans quelques minutes.'],
    erreur: ['ko', pub.message || 'La publication n’a pas abouti.', 'Vos changements sont toujours là : corrigez ce qui est signalé, puis réessayez.'],
  };
  const [cls, titre, detail] = textes[pub.etape] || textes.erreur;
  return (
    <div className={`esp-prog fin ${cls}`} role={cls === 'ko' ? 'alert' : 'status'}>
      <div>
        <b>{titre}</b>
        <p className="small">{detail}</p>
      </div>
      <div className="row-actions">
        {pub.etape === 'enligne' && url && (
          <a className="btn secondary small" href={url} target="_blank" rel="noopener noreferrer">
            Voir mon site
          </a>
        )}
        <button type="button" className="btn-text small" onClick={onFermer}>
          OK
        </button>
      </div>
    </div>
  );
}

// ---------- L'espace ----------
export default function EspaceApp({ id, vueAgence = false }) {
  const q = vueAgence ? '?vue=agence' : '';
  const url = `/api/espace/${id}${q}`;
  const [phase, setPhase] = useState('chargement');
  const [info, setInfo] = useState({});
  const [jeton, setJeton] = useState('');
  const [agenceIci, setAgenceIci] = useState(false);
  const [srv, setSrv] = useState(null);
  const [base, setBase] = useState(null);
  const [brouillon, setBrouillon] = useState(null);
  const [repris, setRepris] = useState(false);
  const [onglet, setOnglet] = useState('horaires');
  const [page, setPage] = useState('index');
  const [device, setDevice] = useState('desktop');
  const [jourApercu, setJourApercu] = useState('');
  const [vueMobile, setVueMobile] = useState('edit');
  const [origin, setOrigin] = useState('');
  const [pub, setPub] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [erreursServeur, setErreursServeur] = useState({});
  const [montrer, setMontrer] = useState(false);
  const [voirListe, setVoirListe] = useState(false);
  const [voirProp, setVoirProp] = useState(false);
  const [motif, setMotif] = useState(null);
  const [toutAnnuler, setToutAnnuler] = useState(false);
  const jour = useMemo(() => aujourdhui(), []);
  const vivant = useRef(true);
  const baseRef = useRef(null);
  baseRef.current = base;
  useEffect(
    () => () => {
      vivant.current = false;
    },
    []
  );

  // Données reçues du serveur : le brouillon en cours suit les changements faits ailleurs
  const recevoir = useCallback(
    (e, { reprendre = false, garder = true } = {}) => {
      setSrv(e);
      setBase(e.etat);
      if (reprendre) {
        const loc = lireLocal(cleLocale(id, e.role));
        if (loc?.base && loc?.brouillon && e.peutModifier) {
          const repriseEtat = memeEtat(loc.base, e.etat) ? loc.brouillon : fusion3(loc.base, loc.brouillon, e.etat);
          if (!memeEtat(repriseEtat, e.etat)) {
            setBrouillon(repriseEtat);
            setRepris(true);
            return;
          }
        }
        setBrouillon(e.etat);
        return;
      }
      if (garder) setBrouillon((b) => (b && baseRef.current ? fusion3(baseRef.current, b, e.etat) : e.etat));
      else setBrouillon(e.etat);
    },
    [id]
  );

  const entrer = useCallback(
    (e) => {
      recevoir(e, { reprendre: true });
      setOnglet(e.peutModifier ? 'horaires' : 'demandes');
      setPage(e.peutModifier ? 'contact' : 'index');
      setJourApercu(e.jour);
      setPhase('pret');
    },
    [recevoir]
  );

  useEffect(() => {
    setOrigin(window.location.origin);
    const m = (window.location.hash || '').match(/[#&]a=([A-Za-z0-9_-]{40,64})/);
    const jt = m ? m[1] : '';
    if (jt) {
      setJeton(jt);
      // Le lien disparaît aussitôt de la barre d'adresse et de l'historique
      try {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch {}
    }
    (async () => {
      const r = await requete(url);
      if (r.ok) {
        entrer(r.data.espace);
        return;
      }
      setInfo({ studio: r.data.studio, connexion: r.data.connexion, error: r.data.error, code: r.data.code });
      if (r.status === 401 && !vueAgence) {
        setPhase(jt ? 'bienvenue' : 'connexion');
        if (jt) {
          const a = await requete(`/api/espace/${id}?vue=agence`);
          if (a.ok) setAgenceIci(true);
        }
        return;
      }
      setPhase('erreur');
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Brouillon gardé sur cet appareil : rien n'est perdu si la page se ferme avant de publier
  useEffect(() => {
    if (!srv || !brouillon || !base || !srv.peutModifier) return undefined;
    const t = setTimeout(() => ecrireLocal(cleLocale(id, srv.role), memeEtat(brouillon, base) ? null : { base, brouillon, at: Date.now() }), 400);
    return () => clearTimeout(t);
  }, [brouillon, base, srv, id]);

  useEffect(() => setErreursServeur({}), [brouillon]);

  const sessionExpiree = useCallback(() => {
    setInfo((x) => ({ ...x, titre: 'Votre session a expiré', message: 'Reconnectez-vous : vos changements non publiés sont gardés sur cet appareil.' }));
    setPhase('connexion');
  }, []);

  const action = useCallback(
    async (nom, body = {}) => {
      setOccupe(true);
      const r = await requete(url, { method: 'POST', body: { action: nom, ...body } });
      setOccupe(false);
      if (r.status === 401) {
        sessionExpiree();
        return r;
      }
      if (r.data?.deconnecte) {
        ecrireLocal(cleLocale(id, 'client'), null);
        setPhase('sortie');
        return r;
      }
      if (r.ok && r.data?.espace) recevoir(r.data.espace);
      return r;
    },
    [url, id, recevoir, sessionExpiree]
  );

  const actionAgence = useCallback(
    async (nom, body = {}) => {
      setOccupe(true);
      const r = await requete(`/api/agence/clients/${id}/espace`, { method: 'POST', body: { action: nom, ...body } });
      if (r.ok) {
        const v = await requete(url);
        if (v.ok) recevoir(v.data.espace);
      }
      setOccupe(false);
      return r;
    },
    [id, url, recevoir]
  );

  async function ouvrir() {
    setOccupe(true);
    const r = await requete(url, { method: 'POST', body: { action: 'ouvrir', jeton } });
    setOccupe(false);
    setJeton('');
    if (r.ok) {
      entrer(r.data.espace);
      return;
    }
    setInfo((x) => ({ ...x, connexion: r.data.connexion || x.connexion, studio: r.data.studio || x.studio, titre: r.data.error || 'Ce lien ne fonctionne pas', message: 'Un lien personnel ne sert qu’une fois. Si vous l’avez déjà ouvert sur un autre appareil, votre espace s’ouvre directement là-bas.' }));
    setPhase('connexion');
  }

  async function demanderLien() {
    setOccupe(true);
    const r = await requete(url, { method: 'POST', body: { action: 'lienEmail' } });
    setOccupe(false);
    setInfo((x) => ({ ...x, envoye: r.ok ? r.data.email : '', erreurLien: r.ok ? '' : r.data.error }));
  }

  // ---------- Brouillon, contrôles et aperçu ----------
  const boutique = Boolean(srv?.boutique);
  const controle = useMemo(() => (brouillon ? nettoyer(brouillon, { jour, boutique }) : { etat: null, erreurs: {} }), [brouillon, jour, boutique]);
  const propre = controle.etat;
  const erreurs = useMemo(() => ({ ...controle.erreurs, ...erreursServeur }), [controle.erreurs, erreursServeur]);
  const nbErreurs = Object.keys(erreurs).length;
  const changements = useMemo(() => (base && propre ? resume(base, propre) : []), [base, propre]);
  const zones = useMemo(() => zonesChangees(base, propre), [base, propre]);

  // L'aperçu suit la saisie avec un court délai, pour ne pas recharger à chaque lettre
  const [apercuEtat, setApercuEtat] = useState(null);
  useEffect(() => {
    if (!propre) return undefined;
    if (!apercuEtat) {
      setApercuEtat(propre);
      return undefined;
    }
    const t = setTimeout(() => setApercuEtat(propre), 350);
    return () => clearTimeout(t);
  }, [propre]); // eslint-disable-line react-hooks/exhaustive-deps

  const etatVu = voirProp && srv?.proposition ? srv.proposition.etat : apercuEtat;
  const apercu = useMemo(() => {
    if (!srv || !etatVu || !origin) return null;
    const a = appliquer(srv.dossier, etatVu);
    const rec = { id, brief: a.brief, aiImages: a.aiImages, stockImages: srv.dossier.stockImages };
    return { brief: renderBrief(rec, origin, srv.dossier.hosting), content: a.content, images: renderImages(rec, origin) };
  }, [srv, etatVu, origin, id]);
  const pages = useMemo(() => (apercu ? [...sitePages(apercu.brief, apercu.content), { slug: 'mentions-legales', label: 'Mentions légales' }] : []), [apercu]);
  const pageVue = pages.some((p) => p.slug === page) ? page : 'index';
  const html = useMemo(() => (apercu && srv?.dossier?.model ? renderPage(pageVue, { ...apercu, model: srv.dossier.model, mode: 'preview', jour: jourApercu || jour }) : ''), [apercu, srv, pageVue, jourApercu, jour]);

  const maj = useCallback((fn) => {
    setBrouillon((b) => {
      const n = structuredClone(b);
      fn(n);
      return n;
    });
  }, []);

  const ouvrirOnglet = useCallback(
    (o) => {
      setOnglet(o);
      const cible = { horaires: 'contact', offre: pages.some((p) => p.slug === 'services') ? 'services' : 'index', boutique: 'boutique', annonces: 'index', photos: 'index' }[o];
      if (cible) setPage(cible);
      setVoirListe(false);
    },
    [pages]
  );

  const voir = useCallback((p, j) => {
    setPage(p);
    if (j) setJourApercu(j);
    setVueMobile('apercu');
  }, []);

  function montrerErreurs() {
    setMontrer(true);
    const premiere = Object.keys(erreurs)[0];
    if (premiere) ouvrirOnglet(ongletDe(premiere, brouillon));
    setVueMobile('edit');
  }

  // ---------- Publication ----------
  const apresPublication = useCallback(
    (d) => {
      ecrireLocal(cleLocale(id, d.espace.role), null);
      setRepris(false);
      setMontrer(false);
      recevoir(d.espace, { garder: false });
      if (d.proposition) return setPub({ etape: 'propose' });
      if (d.miseEnLigne === 'QUEUED') {
        setPub({ etape: 'deploiement', v: d.version });
        suivre(d.version);
      } else if (d.miseEnLigne === 'READY') setPub({ etape: 'enligne', v: d.version, message: d.message });
      else setPub({ etape: 'attente', v: d.version, message: d.message });
      return undefined;
    },
    [id, recevoir] // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function suivre(v) {
    for (let n = 0; n < 60 && vivant.current; n++) {
      await pause(n < 6 ? 3000 : 5000);
      const r = await requete(url, { method: 'POST', body: { action: 'suivre' } });
      const etat = r.data?.etat;
      if (etat === 'READY') {
        setPub({ etape: 'enligne', v, url: r.data.url });
        const g = await requete(url);
        if (g.ok) recevoir(g.data.espace);
        return;
      }
      if (['ERROR', 'CANCELED', 'BLOCKED'].includes(etat)) return setPub({ etape: 'erreur', message: r.data.message });
      if (etat === 'ATTENTE') return setPub({ etape: 'attente', v });
    }
    if (vivant.current) setPub({ etape: 'lent', v });
  }

  async function envoyer(nom, body) {
    setPub({ etape: 'envoi' });
    setErreursServeur({});
    const r = await requete(url, { method: 'POST', body: { action: nom, ...body } });
    if (r.status === 401) {
      setPub(null);
      return sessionExpiree();
    }
    if (r.status === 422) {
      setErreursServeur(r.data.erreurs || {});
      setMontrer(true);
      return setPub({ etape: 'erreur', message: r.data.error });
    }
    if (!r.ok) {
      if (r.data?.espace) recevoir(r.data.espace, { garder: r.data.code !== 'rien' });
      return setPub({ etape: 'erreur', message: r.data?.error || 'La publication n’a pas abouti. Réessayez.' });
    }
    apresPublication(r.data);
    return undefined;
  }

  const publier = () => envoyer('publier', { etat: brouillon, base });
  const annulerVersion = () => envoyer('annuler', {});
  const validerProposition = () => {
    setVoirProp(false);
    envoyer('proposition', { reponse: 'valider' });
  };
  async function refuserProposition() {
    const r = await action('proposition', { reponse: 'refuser', motif: motif || '' });
    if (r.ok) {
      setMotif(null);
      setVoirProp(false);
    }
  }

  useEffect(() => {
    if (pub?.etape !== 'confirmer') return undefined;
    const k = (e) => e.key === 'Escape' && setPub(null);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [pub]);

  // ---------- Écrans ----------
  if (phase === 'chargement') {
    return (
      <ClientShell studio={info.studio}>
        <Spinner label="Ouverture de votre espace…" />
      </ClientShell>
    );
  }
  if (['bienvenue', 'connexion', 'sortie'].includes(phase)) return <Connexion phase={phase} info={info} occupe={occupe} onOuvrir={ouvrir} onLien={demanderLien} agenceIci={agenceIci} id={id} />;
  if (phase === 'erreur' || !srv || !brouillon) {
    return (
      <ClientShell studio={info.studio}>
        <section className="public-card esp-login">
          <h1>{vueAgence && info.code === 'connexion' ? 'Session agence expirée' : 'Espace indisponible'}</h1>
          <p className="lead">{vueAgence && info.code === 'connexion' ? 'Reconnecte-toi à l’espace agence, puis rouvre l’espace du client depuis son dossier.' : info.error || 'Cet espace ne s’ouvre pas pour le moment.'}</p>
          {vueAgence && (
            <p>
              <a href="/agence">Aller à l’espace agence</a>
            </p>
          )}
        </section>
      </ClientShell>
    );
  }

  const client = srv.role === 'client';
  const owner = srv.studio.ownerName;
  const lecture = !srv.peutModifier;
  const propose = !client && srv.validation;
  const limite = srv.publicationsDuJour >= srv.limite;
  const erreursVues = montrer ? erreurs : {};
  const ctx = { jour, briefAvant: srv.dossier.brief, voir, ouvrir: ouvrirOnglet, id, q, src: (imgId) => `${origin}/api/files/${id}/${imgId}` };
  const label = srv.servicesLabel;
  const motsOffre = {
    titre: label,
    intro: label === 'La carte' ? 'Les produits de votre carte : prix, description, disponibilité. Une offre s’arrête toute seule à sa date de fin.' : 'Prix, descriptions et disponibilité. Une offre s’arrête toute seule à sa date de fin.',
    ajouter: label === 'La carte' ? 'Ajouter à la carte' : label === 'Prestations' ? 'Ajouter une prestation' : 'Ajouter un service',
    vide: 'La liste est vide pour le moment.',
    sansNom: 'Sans nom',
  };
  const motsBoutique = { titre: 'Boutique', intro: 'Mettez un produit en rupture de stock ou en offre en un geste. Une offre s’arrête toute seule à sa date de fin.', ajouter: 'Ajouter un produit', vide: 'Aucun produit pour le moment.', sansNom: 'Nouveau produit' };
  const devisAttente = srv.demandes.filter((d) => (client ? d.statut === 'devis' : ['envoyee', 'acceptee'].includes(d.statut))).length;
  const ONGLETS = [
    { id: 'horaires', label: 'Horaires et contact' },
    ...(brouillon.services.length || !boutique ? [{ id: 'offre', label }] : []),
    ...(boutique ? [{ id: 'boutique', label: 'Boutique' }] : []),
    { id: 'annonces', label: 'Annonces et fêtes' },
    { id: 'photos', label: 'Photos' },
    { id: 'demandes', label: 'Demandes', badge: devisAttente },
    { id: 'historique', label: 'Historique' },
    { id: 'acces', label: client ? 'Mon accès' : 'Accès du client' },
  ];
  const props = { etat: brouillon, maj, erreurs: erreursVues, lecture, ctx };
  let panneau;
  switch (onglet) {
    case 'offre':
      panneau = <Liste {...props} cle="services" mots={motsOffre} />;
      break;
    case 'boutique':
      panneau = <Liste {...props} cle="produits" mots={motsBoutique} />;
      break;
    case 'annonces':
      panneau = <Annonces {...props} />;
      break;
    case 'photos':
      panneau = <Photos {...props} />;
      break;
    case 'demandes':
      panneau = <Demandes srv={srv} action={action} actionAgence={actionAgence} occupe={occupe} />;
      break;
    case 'historique':
      panneau = <Historique srv={srv} onAnnuler={annulerVersion} occupe={occupe || Boolean(pub && !['enligne', 'erreur', 'attente', 'propose', 'lent'].includes(pub.etape))} aDesChangements={changements.length > 0} />;
      break;
    case 'acces':
      panneau = <Acces srv={srv} action={action} occupe={occupe} onDeconnexion={() => action('deconnexion')} />;
      break;
    default:
      panneau = <Horaires {...props} />;
  }
  const enCours = pub && ['envoi', 'deploiement'].includes(pub.etape);
  const etatSite = enCours ? ['wait', 'Mise en ligne…'] : srv.aPublier ? ['wait', 'Changements en attente'] : srv.site.version ? ['ok', `En ligne · v${srv.site.version}`] : srv.site.url ? ['ok', 'En ligne'] : ['', 'Pas encore en ligne'];
  const raison = srv.aPublier ? (client ? RAISONS_ATTENTE[srv.aPublier.raison] || 'Ils seront en ligne très bientôt.' : `Raison : ${srv.aPublier.raison || 'en cours'}. Publie depuis le dossier du client (« Publier une nouvelle version »).`) : '';

  return (
    <div className={`ss esp role-${srv.role}`}>
      <header className="esp-top">
        <span className="brand">
          <BrandMark />
          <span className="esp-top-studio">{srv.studio.studioName}</span>
        </span>
        <div className="esp-top-site">
          <span className="esp-top-nom">{srv.nom}</span>
          <span className={`tag ${etatSite[0]}`}>{etatSite[1]}</span>
        </div>
        <div className="esp-top-actions">
          {!client && <span className="tag wait">Vue agence</span>}
          {srv.site.url && (
            <a className="btn-text small" href={srv.site.url} target="_blank" rel="noopener noreferrer">
              {client ? 'Voir mon site' : 'Voir le site'}
            </a>
          )}
          {!client && (
            <a className="btn-text small" href={`/agence/clients/${id}`}>
              Retour au dossier
            </a>
          )}
          {!client && (
            <a className="btn-text small" href="/pilotage">
              Pilotage
            </a>
          )}
        </div>
      </header>

      <div className="esp-seg-mobile">
        <div className="seg" role="group" aria-label="Affichage">
          <button type="button" aria-pressed={vueMobile === 'edit'} onClick={() => setVueMobile('edit')}>
            Modifier
          </button>
          <button type="button" aria-pressed={vueMobile === 'apercu'} onClick={() => setVueMobile('apercu')}>
            Aperçu{changements.length ? ` (${changements.length})` : ''}
          </button>
        </div>
      </div>

      <div className={`esp-grid vue-${vueMobile}`}>
        <section className="esp-edit" aria-label="Modifier le site">
          {srv.proposition && (
            <div className="esp-banniere prop">
              <div>
                <b>{client ? `${owner} vous propose des changements` : `Ta proposition attend la validation de ${srv.nom}`}</b>
                <span className="muted small"> · {fmtQuand(srv.proposition.at)}</span>
              </div>
              <ul>
                {srv.proposition.resume.slice(0, 5).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
                {srv.proposition.resume.length > 5 && <li>et {srv.proposition.resume.length - 5} autres</li>}
              </ul>
              <div className="row-actions">
                <button type="button" className="btn secondary small" aria-pressed={voirProp} onClick={() => setVoirProp((v) => !v)}>
                  {voirProp ? 'Revenir à l’aperçu habituel' : 'Voir dans l’aperçu'}
                </button>
                {client ? (
                  <>
                    <button type="button" className="btn primary small" onClick={validerProposition} disabled={occupe || enCours || limite}>
                      Valider et publier
                    </button>
                    {motif === null ? (
                      <button type="button" className="btn-text small" onClick={() => setMotif('')}>
                        Refuser
                      </button>
                    ) : null}
                  </>
                ) : (
                  <button type="button" className="btn-text small" onClick={() => action('retirerProposition')} disabled={occupe}>
                    Retirer la proposition
                  </button>
                )}
              </div>
              {client && motif !== null && (
                <div className="esp-refus">
                  <label className="q-label" htmlFor="motif">
                    Un mot pour {owner} ? (facultatif)
                  </label>
                  <textarea id="motif" rows={2} maxLength={300} value={motif} onChange={(e) => setMotif(e.target.value)} />
                  <div className="row-actions">
                    <button type="button" className="btn secondary small" onClick={refuserProposition} disabled={occupe}>
                      Refuser la proposition
                    </button>
                    <button type="button" className="btn-text small" onClick={() => setMotif(null)}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {srv.aPublier && !enCours && (
            <div className="esp-banniere wait">
              <b>Vos derniers changements sont enregistrés, pas encore en ligne.</b> <span className="small">{raison}</span>
            </div>
          )}
          {repris && (
            <div className="esp-banniere">
              <span>Vos changements non publiés ont été repris.</span>{' '}
              <button
                type="button"
                className="btn-text small"
                onClick={() => {
                  setBrouillon(base);
                  setRepris(false);
                }}
              >
                Les abandonner
              </button>
            </div>
          )}
          {lecture && (
            <div className="esp-banniere">
              {client ? (
                <>
                  {owner} s’occupe des mises à jour de votre site. Pour un changement, faites une{' '}
                  <button type="button" className="btn-text small" onClick={() => ouvrirOnglet('demandes')}>
                    demande
                  </button>
                  . Ce réglage se change dans{' '}
                  <button type="button" className="btn-text small" onClick={() => ouvrirOnglet('acces')}>
                    Mon accès
                  </button>
                  .
                </>
              ) : (
                <>{srv.nom} gère seul son site : ses rubriques sont en lecture seule. Tu peux répondre à ses demandes.</>
              )}
            </div>
          )}

          <nav className="esp-tabs" aria-label="Rubriques de l’espace">
            {ONGLETS.map((o) => (
              <button key={o.id} type="button" aria-current={onglet === o.id ? 'page' : undefined} onClick={() => ouvrirOnglet(o.id)}>
                {o.label}
                {zones[o.id] && <span className="esp-point" title="Modifié, pas encore publié" />}
                {o.badge ? <span className="esp-badge">{o.badge}</span> : null}
              </button>
            ))}
          </nav>
          <div className="esp-panel">{panneau}</div>

          {srv.peutModifier && (
            <div className="esp-bar" role="region" aria-label="Publication">
              {pub && pub.etape !== 'confirmer' ? (
                <Progression pub={pub} srv={srv} onFermer={() => setPub(null)} />
              ) : changements.length ? (
                <>
                  <div className="esp-bar-ligne">
                    <div className="esp-bar-txt">
                      {nbErreurs && montrer ? (
                        <button type="button" className="btn-text small danger" onClick={montrerErreurs}>
                          {nbErreurs} information{nbErreurs > 1 ? 's' : ''} à corriger
                        </button>
                      ) : (
                        <span>
                          <b>{changements.length}</b> changement{changements.length > 1 ? 's' : ''} pas encore publié{changements.length > 1 ? 's' : ''}
                        </span>
                      )}
                      <button type="button" className="btn-text small" aria-expanded={voirListe} onClick={() => setVoirListe((v) => !v)}>
                        {voirListe ? 'Masquer' : 'Voir'}
                      </button>
                    </div>
                    <div className="esp-bar-actions">
                      <Confirmer
                        label="Tout annuler"
                        question="Annuler tous vos changements ?"
                        oui="Tout annuler"
                        className="btn-text small quiet"
                        ouvert={toutAnnuler}
                        setOuvert={setToutAnnuler}
                        onConfirm={() => {
                          setBrouillon(base);
                          setRepris(false);
                          setMontrer(false);
                        }}
                      />
                      <button type="button" className="btn primary" onClick={() => (nbErreurs ? montrerErreurs() : setPub({ etape: 'confirmer' }))} disabled={limite && !propose}>
                        {propose ? 'Envoyer pour validation' : 'Publier'}
                      </button>
                    </div>
                  </div>
                  {voirListe && (
                    <ul className="esp-bar-liste">
                      {changements.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  )}
                  {limite && !propose && <p className="q-hint">Limite de {srv.limite} publications aujourd’hui atteinte : vos changements restent prêts pour demain.</p>}
                </>
              ) : (
                <p className="muted small esp-bar-vide">Aucun changement en cours. Modifiez une rubrique : l’aperçu se met à jour tout de suite.</p>
              )}
            </div>
          )}
        </section>

        <section className="esp-apercu" aria-label="Aperçu du site">
          <div className="toolbar">
            <PageTabs pages={pages} value={pageVue} onChange={setPage} />
            <div className="toolbar-right">
              <label className="esp-jour">
                <span>Voir au</span>
                <input type="date" value={jourApercu} onChange={(e) => setJourApercu(e.target.value || jour)} />
              </label>
              <DeviceToggle value={device} onChange={setDevice} />
            </div>
          </div>
          <p className="esp-apercu-note">
            {voirProp && srv.proposition ? `Aperçu de la proposition de ${client ? owner : 'l’agence'}` : changements.length ? 'Aperçu avec vos changements, pas encore publiés' : 'Votre site tel qu’il est en ligne'}
            {jourApercu && jourApercu !== jour ? ` · tel qu’il s’affichera le ${jourTexte(jourApercu, { semaine: true, annee: true })}` : ''}
            {jourApercu && jourApercu !== jour && (
              <>
                {' '}
                <button type="button" className="btn-text small" onClick={() => setJourApercu(jour)}>
                  Revenir à aujourd’hui
                </button>
              </>
            )}
          </p>
          <div className="stage">{html && <ApercuFrame html={html} device={device} page={pageVue} onNavigate={setPage} title={`Aperçu du site ${srv.nom}`} />}</div>
        </section>
      </div>

      {pub?.etape === 'confirmer' && (
        <div className="sheet-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && setPub(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="pub-titre">
            <p className="sheet-kicker">{srv.nom}</p>
            <h2 id="pub-titre">{propose ? 'Envoyer pour validation' : 'Publier sur votre site'}</h2>
            <ul className="esp-sheet-liste">
              {changements.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            <p className="muted small">{propose ? `${srv.nom} reçoit ta proposition dans son espace et la valide avant la mise en ligne.` : 'Votre site est mis à jour en 1 minute environ. Chaque version est gardée dans l’historique : vous pourrez revenir en arrière.'}</p>
            <div className="row-actions">
              <button type="button" className="btn primary" onClick={publier} autoFocus>
                {propose ? 'Envoyer' : 'Publier maintenant'}
              </button>
              <button type="button" className="btn-text" onClick={() => setPub(null)}>
                Revenir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
