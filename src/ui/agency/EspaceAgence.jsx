'use client';
// Espace client, vu du dossier : accès livré avec le site, réglage de départ, suivi et coupure
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import SendBox from './SendBox.jsx';
import { GESTIONS } from '../../engine/espace.js';
import { timeAgo } from '../../engine/records.js';

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');

export function messageLivraison({ nom, siteUrl, lien, owner, domaine }) {
  return `Bonjour,

${siteUrl ? `Le site de ${nom} est en ligne : ${siteUrl}` : `Le site de ${nom} est prêt.`}

Votre espace client vous permet de modifier vous-même vos horaires, vos prix, vos annonces (fermetures, fêtes) et vos photos :
${lien}

Ce lien personnel ouvre votre espace sur l’appareil où vous cliquez. Il ne sert qu’une fois et reste valable 7 jours : ne le transférez pas. Ensuite, cet appareil reste reconnu, sans mot de passe. Pour ajouter votre téléphone ou un autre ordinateur : ouvrez votre espace, puis « Mon accès ».

Pour toute autre modification (une page en plus, un nouveau style), faites une demande depuis votre espace, ou écrivez-moi : je réponds sous 48 h ouvrées, et sous 24 h si le site est inaccessible.
${domaine ? `\nVotre nom de domaine est à votre nom, sur votre compte OVHcloud, avec renouvellement automatique. Gardez bien vos identifiants OVHcloud.\n` : ''}
Merci pour votre confiance,
${owner}`;
}

export default function EspaceAgence({ rec, onRecord, settings }) {
  const e = rec.espace || {};
  const owner = settings?.ownerName || 'Alexandre';
  const nom = rec.brief?.businessName || rec.name;
  const siteUrl = rec.liveUrl || rec.publication?.url || '';
  const domaine = Boolean(rec.publication?.domain || rec.brief?.domain);
  const contactEmail = isEmail(rec.contact) ? rec.contact.trim() : isEmail(rec.brief?.email) ? rec.brief.email.trim() : '';
  const [email, setEmail] = useState(e.email || contactEmail);
  const [gestion, setGestion] = useState(e.gestion || 'client');
  const [lien, setLien] = useState(null);
  const [mail, setMail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [couper, setCouper] = useState(false);
  const [refaire, setRefaire] = useState(false);
  useEffect(() => setEmail(rec.espace?.email || contactEmail), [rec.espace?.email]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api(`/api/agence/clients/${rec.id}/espace`, { method: 'POST', body: { action: 'statut' } })
      .then((d) => setMail(d.mail))
      .catch(() => setMail({ configured: false, missing: [] }));
  }, [rec.id]);

  async function appel(action, body = {}) {
    setBusy(true);
    setErr('');
    setNote('');
    try {
      const d = await api(`/api/agence/clients/${rec.id}/espace`, { method: 'POST', body: { action, ...body } });
      if (d.client) onRecord(d.client);
      return d;
    } catch (x) {
      setErr(x.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  const reglages = { email: email.trim(), ...(e.ouvertLe ? {} : { gestion }) };
  async function preparer() {
    if (email.trim() && !isEmail(email)) return setErr('Adresse e-mail du client invalide.');
    const d = await appel('inviter', reglages);
    if (d?.lien) {
      setLien(d.lien);
      setRefaire(false);
    }
    return undefined;
  }
  async function envoyerMail() {
    if (!isEmail(email)) return setErr('Indique l’adresse e-mail du client.');
    const d = await appel('envoyer', { ...reglages, sujet: 'Votre site est en ligne', message: messageLivraison({ nom, siteUrl, lien: '{lien}', owner, domaine }) });
    if (d?.envoye) {
      setLien(null);
      setRefaire(false);
      setNote(`Accès envoyé à ${email.trim()}. Le lien est valable 7 jours.`);
    }
    return undefined;
  }

  const invitation = e.invitation;
  const invitationValable = invitation && !invitation.utiliseeLe && new Date(invitation.exp) > new Date();
  const appareils = e.appareils || [];
  const dernier = appareils.map((a) => a.vuLe).sort().pop();
  const demandes = (e.demandes || []).filter((d) => ['envoyee', 'acceptee'].includes(d.statut)).length;
  const devis = (e.demandes || []).filter((d) => d.statut === 'devis').length;
  const premiereFois = !e.creeLe || (!invitation && !e.ouvertLe);
  const afficherFormulaire = premiereFois || refaire;

  return (
    <div className="side-block esp-agence">
      <h3>Espace client</h3>
      {!rec.publication?.repo && <p className="muted small">Le client modifie lui-même ses horaires, prix, annonces et photos. Ses changements partent en ligne seuls une fois le site publié avec « Mettre en ligne ».</p>}

      {e.ouvertLe ? (
        <ul className="pub-checks">
          <li className="is-ok">
            <span>
              Ouvert par le client {timeAgo(e.ouvertLe)} · {appareils.length} appareil{appareils.length > 1 ? 's' : ''}
              {dernier ? `, dernière visite ${timeAgo(dernier)}` : ''}
            </span>
          </li>
          <li className="is-ok">
            <span>
              Réglage : « {GESTIONS[e.gestion || 'client'].titre} »{e.validation ? ', avec validation de tes publications' : ''}
            </span>
          </li>
        </ul>
      ) : invitation ? (
        <p className="small">{invitationValable ? `Invitation créée le ${fmt(invitation.creeLe)}, valable jusqu’au ${fmt(invitation.exp)}. Pas encore ouverte.` : `L’invitation du ${fmt(invitation.creeLe)} a expiré sans être ouverte.`}</p>
      ) : null}

      {e.aPublier && (
        <p className="note small">
          Changements de l’espace client pas encore en ligne ({e.aPublier.raison || 'en cours'}). Ils partent avec « Publier une nouvelle version ».
        </p>
      )}
      {e.proposition && <p className="note small">Ta proposition du {fmt(e.proposition.at)} attend la validation du client.</p>}
      {(demandes > 0 || devis > 0) && (
        <p className="note small">
          {demandes > 0 ? `${demandes} demande${demandes > 1 ? 's' : ''} à traiter` : ''}
          {demandes > 0 && devis > 0 ? ' · ' : ''}
          {devis > 0 ? `${devis} devis en attente du client` : ''}
        </p>
      )}

      {afficherFormulaire && (
        <div className="esp-agence-form">
          <div className="q-field">
            <label className="q-label" htmlFor="esp-email">
              E-mail du client
            </label>
            <p className="q-hint">Pour lui envoyer un lien de connexion s’il change d’appareil. Jamais affiché sur le site.</p>
            <input id="esp-email" type="email" value={email} onChange={(x) => setEmail(x.target.value)} placeholder="client@exemple.fr" />
          </div>
          {!e.ouvertLe && (
            <fieldset className="q-field esp-agence-gestion">
              <legend className="q-label">Ce qui a été convenu avec le client</legend>
              {Object.entries(GESTIONS).map(([k, g]) => (
                <label key={k} className="q-toggle compact">
                  <input type="radio" name="esp-gestion" checked={gestion === k} onChange={() => setGestion(k)} />
                  <span>
                    <span className="q-option-title">{g.titre}</span>
                    <span className="q-option-hint">{g.texte(owner)}</span>
                  </span>
                </label>
              ))}
              <p className="q-hint">Le client pourra changer ce réglage depuis son espace.</p>
            </fieldset>
          )}
          <div className="row-actions">
            <button type="button" className="btn primary small" onClick={preparer} disabled={busy}>
              Préparer le message de livraison
            </button>
            {mail?.configured && (
              <button type="button" className="btn secondary small" onClick={envoyerMail} disabled={busy}>
                Envoyer par e-mail
              </button>
            )}
          </div>
          {mail && !mail.configured && <p className="muted small">Envoi direct par e-mail : ajoute BREVO_API_KEY et EMAIL_FROM dans Vercel. En attendant, copie le message.</p>}
        </div>
      )}

      {lien && (
        <div className="esp-agence-lien">
          <p className="note small">Lien personnel du client, montré une seule fois. Ne l’ouvre pas toi-même : il ne sert qu’une fois.</p>
          <SendBox link={lien} text={messageLivraison({ nom, siteUrl, lien, owner, domaine })} contact={email || rec.contact} subject="Votre site est en ligne" linkLabel="Lien personnel du client" note="Envoie ce message au client (e-mail ou SMS). Le lien est valable 7 jours et ne sert qu’une fois." />
        </div>
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

      <div className="side-row">
        {e.creeLe && (
          <a className="btn-text small" href={`/espace/${rec.id}?vue=agence`} target="_blank" rel="noopener noreferrer">
            Ouvrir l’espace (vue agence)
          </a>
        )}
        {!afficherFormulaire && (
          <button type="button" className="btn-text small" onClick={() => setRefaire(true)}>
            {invitationValable ? 'Nouveau lien d’invitation' : 'Nouveau lien d’accès'}
          </button>
        )}
      </div>
      {refaire && invitationValable && <p className="muted small">Un nouveau lien remplace l’invitation précédente, qui ne marchera plus.</p>}
      {(appareils.length > 0 || invitationValable) &&
        (couper ? (
          <p className="small">
            Déconnecter tous les appareils du client et annuler ses liens ?{' '}
            <button
              type="button"
              className="btn-text small danger"
              onClick={async () => {
                setCouper(false);
                const d = await appel('couper');
                if (d) setNote('Accès coupés : le client devra recevoir un nouveau lien.');
              }}
            >
              Couper
            </button>{' '}
            <button type="button" className="btn-text small" onClick={() => setCouper(false)}>
              Annuler
            </button>
          </p>
        ) : (
          <button type="button" className="btn-text small quiet" onClick={() => setCouper(true)}>
            Couper l’accès du client
          </button>
        ))}
    </div>
  );
}
