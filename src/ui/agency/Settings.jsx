'use client';
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { AgencyBar, Spinner } from '../Chrome.jsx';
import { StorageSetup } from './Dashboard.jsx';
import Securite from './Securite.jsx';
import Alertes from './Alertes.jsx';
import { lireEuros, versSaisie, euros, nouvelId } from '../../engine/finances.js';

const FIELDS = [
  { id: 'studioName', label: 'Nom affiché aux clients', hint: 'En haut du questionnaire et de la page de propositions.' },
  { id: 'ownerName', label: 'Votre prénom', hint: 'Signature des messages : « Alexandre prépare vos propositions ».' },
  { id: 'email', label: 'E-mail de contact', hint: 'Affiché en bas des pages client. Reçoit aussi les alertes des espaces clients (demandes, publications), si Brevo est branché.' },
  { id: 'phone', label: 'Téléphone de contact', hint: 'Affiché en bas des pages client. Facultatif.' },
  { id: 'hosting', label: 'Hébergeur des sites (mentions légales)', hint: 'Repris automatiquement dans la page « Mentions légales » de chaque site. Vérifiez l’adresse sur vercel.com/legal.', long: true },
];

export default function Settings({ studioName }) {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState(null);
  const [pub, setPub] = useState(null);
  const [services, setServices] = useState(null);
  const [emailEnregistre, setEmailEnregistre] = useState('');
  useEffect(() => {
    api('/api/agence/settings')
      .then((d) => {
        setS(d.settings);
        setEmailEnregistre(d.settings?.email || '');
        setPub(d.publication || null);
        setServices(d.services || null);
      })
      .catch((e) => setError(e.message));
    api('/api/agence/clients')
      .then((d) => setStorage(d.storage))
      .catch(() => {});
  }, []);
  // Arrivée depuis l'Accueil (« Modifier les frais fixes ») : aller directement au bloc
  const pret = Boolean(s);
  useEffect(() => {
    if (!pret || window.location.hash !== '#frais-fixes') return;
    document.getElementById('frais-fixes')?.scrollIntoView({ block: 'start' });
  }, [pret]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNote('');
    try {
      const d = await api('/api/agence/settings', { method: 'PUT', body: { settings: s } });
      setS(d.settings);
      setEmailEnregistre(d.settings?.email || '');
      setPub(d.publication || null);
      setServices(d.services || null);
      setNote('Réglages enregistrés.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ss">
      <AgencyBar studioName={studioName} current="reglages" />
      <main className="page page-narrow">
        <div className="page-head">
          <div>
            <h1>Réglages</h1>
            <p className="muted">Ce que vos clients voient sur leurs pages, et ce qui remplit les mentions légales.</p>
          </div>
        </div>
        {storage === 'none' && <StorageSetup />}
        {!s && !error && <Spinner />}
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        {s && storage !== 'none' && (
          <form className="card settings" onSubmit={submit}>
            {FIELDS.map((f) => (
              <div key={f.id} className="q-field">
                <label className="q-label" htmlFor={`s-${f.id}`}>
                  {f.label}
                </label>
                <p className="q-hint">{f.hint}</p>
                {f.long ? (
                  <textarea id={`s-${f.id}`} rows={2} value={s[f.id] || ''} onChange={(e) => setS({ ...s, [f.id]: e.target.value })} />
                ) : (
                  <input id={`s-${f.id}`} type="text" value={s[f.id] || ''} onChange={(e) => setS({ ...s, [f.id]: e.target.value })} />
                )}
              </div>
            ))}
            <Charges value={s.charges || []} onChange={(charges) => setS({ ...s, charges })} />
            {pub && <PublishSettings pub={pub} value={!!s.autoPublish} onChange={(v) => setS({ ...s, autoPublish: v })} />}
            {services && <Services services={services} />}
            <Alertes value={s.alertesEmail !== false} onChange={(v) => setS({ ...s, alertesEmail: v })} emailEnregistre={/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailEnregistre.trim()) ? emailEnregistre.trim() : ''} />
            <div className="form-actions">
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              {note && (
                <span className="side-note" role="status">
                  {note}
                </span>
              )}
            </div>
          </form>
        )}
        {s && storage !== 'none' && <Securite />}
        {s && storage !== 'none' && (
          <section className="card settings cd-reglage" aria-labelledby="cd-titre">
            <h2 id="cd-titre">Comptes Devis & Factures</h2>
            <p className="muted small">Les comptes de l’appli Devis & Factures de tes clients : état de chaque accès, suspension, réinitialisation, suppression. Les mots de passe ne sont jamais visibles.</p>
            <a className="btn secondary" href="/agence/devis">
              Gérer les comptes
            </a>
          </section>
        )}
      </main>
    </div>
  );
}

// Google Drive et e-mails : branchés ou non (variables Vercel)
function Services({ services }) {
  const ligne = (st, nom, ok) => (
    <li className={st.configured ? 'is-ok' : 'is-wait'}>
      <span>
        {nom} : {st.configured ? ok : (
          <>
            pas branché, il manque {st.missing.map((m, i) => (
              <span key={m}>
                {i > 0 && ' et '}
                <code>{m}</code>
              </span>
            ))}
          </>
        )}
      </span>
    </li>
  );
  return (
    <div className="q-field pub-settings">
      <span className="q-label">Services branchés</span>
      <ul className="pub-checks">
        {ligne(services.drive, 'Google Drive', 'fiche brief, photos et versions rangées dans le dossier du client')}
        {ligne(services.mail, 'E-mails de l’espace client (Brevo)', `envoyés depuis ${services.mail.from}`)}
        {services.ovh && ligne(services.ovh, 'Zone DNS OVHcloud', 'Studio Site règle les entrées A et www du domaine de tes clients, après ton clic')}
      </ul>
      <p className="q-hint">Facultatifs. Sans Google Drive, rien n’arrive tout seul dans le tableau Suivi clients ; sans Brevo, tu copies toi-même les messages de l’espace client ; sans la clé OVHcloud, tu saisis toi-même les entrées DNS (documents 13, §J et 14, §F).</p>
    </div>
  );
}

// Mise en ligne automatique : état des deux clés et interrupteur général
function PublishSettings({ pub, value, onChange }) {
  const key = (name) => !pub.missing.includes(name);
  return (
    <div className="q-field pub-settings">
      <span className="q-label">Mise en ligne automatique</span>
      <p className="q-hint">
        Depuis le dossier d’un client, un clic crée le dépôt privé dans l’organisation GitHub <strong>{pub.org}</strong>, crée le projet Vercel et met le site en ligne. Rien ne part sans ton clic.
      </p>
      <ul className="pub-keys">
        <li className={key('GITHUB_PUBLISH_TOKEN') ? 'is-ok' : 'is-ko'}>
          <span>
            Clé GitHub <code>GITHUB_PUBLISH_TOKEN</code> : {key('GITHUB_PUBLISH_TOKEN') ? 'présente' : 'manquante'}
          </span>
        </li>
        <li className={key('VERCEL_PUBLISH_TOKEN') ? 'is-ok' : 'is-ko'}>
          <span>
            Clé Vercel <code>VERCEL_PUBLISH_TOKEN</code> : {key('VERCEL_PUBLISH_TOKEN') ? 'présente' : 'manquante'}
          </span>
        </li>
      </ul>
      {!pub.configured && <p className="q-hint">Ajoute les clés manquantes dans Vercel › Settings › Environment Variables, puis redéploie sans le cache (document 13, §J).</p>}
      <label className="q-toggle compact">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        <span>
          <span className="q-option-title">Autoriser la mise en ligne automatique</span>
          <span className="q-option-hint">Décoche puis enregistre pour tout couper d’un coup : plus aucun dossier ne peut publier.</span>
        </span>
      </label>
    </div>
  );
}

// Frais fixes mensuels de l'agence : l'Accueil en tire le bénéfice et le point mort,
// le suivi financier les déduit des abonnements (marge estimée)
const EXEMPLES = ['Vercel Pro', 'Abonnement Claude', 'Images Gemini', 'Brevo', 'Google Workspace'];
function Charges({ value, onChange }) {
  const [lignes, setLignes] = useState(() => value.map((c) => ({ id: c.id, libelle: c.libelle, saisie: versSaisie(c.montant) })));
  const [erreurs, setErreurs] = useState({});
  function maj(next) {
    setLignes(next);
    const errs = {};
    const out = [];
    for (const l of next) {
      const m = lireEuros(l.saisie);
      if (m === null) errs[l.id] = true;
      if (l.libelle.trim()) out.push({ id: l.id, libelle: l.libelle, montant: m ?? 0 });
    }
    setErreurs(errs);
    onChange(out);
  }
  const total = value.reduce((t, c) => t + (c.montant || 0), 0);
  return (
    <div className="q-field charges" id="frais-fixes">
      <span className="q-label">Frais fixes mensuels</span>
      <p className="q-hint">Ce que l’activité te coûte chaque mois, hors taxes (hébergement, abonnements, outils). L’Accueil s’en sert pour calculer ton bénéfice et ton point mort.</p>
      {lignes.length > 0 && (
        <ul className="charges-list">
          {lignes.map((l, i) => (
            <li key={l.id}>
              <input type="text" aria-label="Libellé du frais fixe" placeholder={EXEMPLES[i % EXEMPLES.length]} value={l.libelle} onChange={(e) => maj(lignes.map((x) => (x.id === l.id ? { ...x, libelle: e.target.value } : x)))} />
              <span className="euro-input">
                <input type="text" inputMode="decimal" aria-label="Montant par mois en euros" placeholder="0" value={l.saisie} aria-invalid={erreurs[l.id] || undefined} onChange={(e) => maj(lignes.map((x) => (x.id === l.id ? { ...x, saisie: e.target.value } : x)))} />
                <span aria-hidden="true">€/mois</span>
              </span>
              <button type="button" className="icon-btn small" aria-label={`Retirer ${l.libelle || 'ce frais fixe'}`} onClick={() => maj(lignes.filter((x) => x.id !== l.id))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {Object.keys(erreurs).length > 0 && <p className="q-error">Montant illisible : écris par exemple 20 ou 19,90.</p>}
      <div className="row-actions">
        <button type="button" className="btn secondary small" onClick={() => maj([...lignes, { id: nouvelId(), libelle: '', saisie: '' }])}>
          Ajouter un frais fixe
        </button>
        {total > 0 && <span className="muted small">Total : {euros(total)} par mois</span>}
      </div>
    </div>
  );
}
