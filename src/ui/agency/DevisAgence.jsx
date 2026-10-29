'use client';
// Option « Appli Devis & Factures » vue du dossier : activation, invitation, suivi, coupure.
// L'agence ne voit ni les devis, ni les factures, ni les prix du client : seulement l'état de son accès.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import SendBox from './SendBox.jsx';
import { messageInvitation } from '../../engine/devis.js';
import { timeAgo } from '../../engine/records.js';
import { SuppressionDevis } from './ComptesDevis.jsx';
import { LISTE_MODELES } from '../../engine/calculateur.js';

const nomModele = (id) => LISTE_MODELES.find((m) => m.id === id)?.nom || id;

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');

export default function DevisAgence({ rec, onRecord, settings }) {
  const owner = settings?.ownerName || 'Alexandre';
  const nom = rec.brief?.businessName || rec.name;
  const contactEmail = isEmail(rec.brief?.email) ? rec.brief.email.trim() : isEmail(rec.contact) ? rec.contact.trim() : '';
  const [etat, setEtat] = useState(null);
  const [email, setEmail] = useState(contactEmail);
  const [lien, setLien] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [confirmer, setConfirmer] = useState(null); // 'couper' | 'reinitialiser' | 'supprimer'
  const [ouvert, setOuvert] = useState(false);
  const [modele, setModele] = useState('impression3d');

  async function appel(action, body = {}) {
    setBusy(true);
    setErr('');
    setNote('');
    try {
      const d = await api(`/api/agence/clients/${rec.id}/devis`, { method: 'POST', body: { action, ...body } });
      if (d.client) onRecord(d.client);
      if (d.appli !== undefined) setEtat((x) => ({ ...(x || {}), appli: d.appli }));
      return d;
    } catch (x) {
      setErr(x.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    api(`/api/agence/clients/${rec.id}/devis`, { method: 'POST', body: { action: 'statut' } })
      .then((d) => {
        setEtat(d);
        if (d.appli?.emailPropose) setEmail(d.appli.emailPropose);
      })
      .catch(() => setEtat({ appli: null, mail: false, option: rec.brief?.optionDevis || '' }));
  }, [rec.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!etat) return null;
  const a = etat.appli;
  const demande = (rec.brief?.optionDevis || etat.option) === 'oui';
  // Rien d'activé et option pas demandée : une ligne discrète suffit
  if (!a && !demande && !ouvert)
    return (
      <section className="card side-card dv-agence">
        <h2>Appli Devis & Factures</h2>
        <p className="muted small">Option non demandée. Le client peut créer ses devis, les envoyer, les faire accepter en ligne et les transformer en factures.</p>
        <button type="button" className="btn-text small" onClick={() => setOuvert(true)}>
          Proposer ou activer l’option
        </button>
        {note && (
          <p className="side-note" role="status">
            {note}
          </p>
        )}
      </section>
    );

  async function preparer() {
    if (email.trim() && !isEmail(email)) return setErr('Adresse e-mail du client invalide.');
    const d = await appel('inviter', { email: email.trim() });
    if (d?.lien) {
      setLien(d.lien);
      setOuvert(false);
    }
    return undefined;
  }
  async function envoyer() {
    if (!isEmail(email)) return setErr('Indique l’adresse e-mail du client.');
    const d = await appel('envoyer', { email: email.trim(), message: messageInvitation({ nom, lien: '{lien}', owner }) });
    if (d?.envoye) {
      setLien(null);
      setOuvert(false);
      setNote(`Invitation envoyée à ${email.trim()}. Le lien est valable 7 jours.`);
    }
    return undefined;
  }

  const inv = a?.invitation;
  const invValable = inv && !inv.utiliseeLe && new Date(inv.exp) > new Date();
  const compteFait = a?.compte?.deuxFacteurs;
  const proprietaire = a?.proprietaire || '';
  // Espace déjà utilisé par le client : le lien ne part qu'à l'adresse de son compte, jamais affiché ici
  const peutInviter = !compteFait && !proprietaire;
  async function renvoyerAuProprietaire() {
    const d = await appel('envoyer', {});
    if (d?.envoye) setNote(`Nouveau lien envoyé à l’adresse de son compte (${proprietaire}), valable 7 jours.`);
  }

  return (
    <section className="card side-card dv-agence">
      <h2>Appli Devis & Factures</h2>
      {demande && !a && <p className="note small">Option demandée dans le questionnaire.</p>}
      {!a && <p className="muted small">Une appli séparée du site, installable sur iPhone et Android : le client crée ses devis depuis ses produits et ses prix, ses clients les acceptent en ligne, et chaque devis accepté devient une facture. Tu ne verras pas ses devis ni ses chiffres.</p>}

      {a && (
        <ul className="pub-checks">
          <li className={a.actif ? 'is-ok' : 'is-ko'}>
            <span>{a.actif ? `Activée ${timeAgo(a.creeLe)}` : 'Accès suspendu'}</span>
          </li>
          {compteFait ? (
            <li className="is-ok">
              <span>
                Compte créé {timeAgo(a.compte.creeLe)} ({a.compte.email}), double authentification active
                {a.dernierVu ? ` · dernière visite ${timeAgo(a.dernierVu)}` : ''}
              </span>
            </li>
          ) : inv ? (
            <li className={invValable ? '' : 'is-ko'}>
              <span>{inv.utiliseeLe ? `Lien ouvert ${timeAgo(inv.utiliseeLe)}, compte pas encore terminé` : invValable ? `Invitation valable jusqu’au ${fmt(inv.exp)}, pas encore ouverte` : `Invitation du ${fmt(inv.creeLe)} expirée`}</span>
            </li>
          ) : null}
          {compteFait && (
            <li className="is-ok">
              <span>
                {a.nbProduits} produit{a.nbProduits > 1 ? 's' : ''} · {a.nbDevis} devis · {a.nbFactures} facture{a.nbFactures > 1 ? 's' : ''} émise{a.nbFactures > 1 ? 's' : ''}
              </span>
            </li>
          )}
        </ul>
      )}

      {a && (
        <div className="dv-ag-calc">
          <span className="q-label">Calculateur d’estimation</span>
          {a.calculateur?.actif ? (
            <p className="small">
              Activé (modèle de départ : {nomModele(a.calculateur.modele)}). Le client règle ses tarifs dans son appli, Réglages › Calculateur.{' '}
              <button type="button" className="btn-text small quiet" disabled={busy} onClick={async () => (await appel('calculateur', { actif: false })) && setNote('Calculateur désactivé : ses réglages sont gardés.')}>
                Désactiver
              </button>
            </p>
          ) : (
            <>
              <p className="q-hint">En option : le client calcule ses prix (ex. impression 3D : matière, temps machine, finitions, délai, expédition) et transforme le résultat en lignes de devis. Il règle lui-même ses tarifs.</p>
              <div className="row-actions">
                {!a.calculateur && (
                  <select aria-label="Modèle de départ" value={modele} onChange={(e) => setModele(e.target.value)}>
                    {LISTE_MODELES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nom}
                      </option>
                    ))}
                  </select>
                )}
                <button type="button" className="btn secondary small" disabled={busy} onClick={async () => (await appel('calculateur', { actif: true, modele })) && setNote('Calculateur activé : il apparaît dans son appli.')}>
                  {a.calculateur ? 'Réactiver le calculateur' : 'Activer le calculateur'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {peutInviter && (!a || !invValable || ouvert) && (
        <div className="esp-agence-form">
          <div className="q-field">
            <label className="q-label" htmlFor="dv-ag-email">
              E-mail du client
            </label>
            <p className="q-hint">Proposé pour son compte. Il pourra en choisir un autre.</p>
            <input id="dv-ag-email" type="email" value={email} onChange={(x) => setEmail(x.target.value)} placeholder="client@exemple.fr" />
          </div>
          <div className="row-actions">
            <button type="button" className="btn primary small" onClick={preparer} disabled={busy}>
              {a ? 'Nouveau lien d’invitation' : 'Activer et préparer l’invitation'}
            </button>
            {etat.mail && (
              <button type="button" className="btn secondary small" onClick={envoyer} disabled={busy}>
                {a ? 'Renvoyer par e-mail' : 'Activer et envoyer par e-mail'}
              </button>
            )}
          </div>
          {a && invValable && <p className="muted small">Un nouveau lien remplace le précédent, qui ne marchera plus.</p>}
        </div>
      )}
      {!compteFait && proprietaire && (
        <div className="esp-agence-form">
          <p className="muted small">
            Son compte a été réinitialisé : le lien pour le recréer part uniquement à l’adresse de son compte ({proprietaire}), jamais affiché ici, pour que personne d’autre ne puisse ouvrir ses devis et ses factures.
          </p>
          {etat.mail ? (
            <button type="button" className="btn secondary small" disabled={busy} onClick={renvoyerAuProprietaire}>
              Renvoyer le lien à {proprietaire}
            </button>
          ) : (
            <p className="q-error">Envoi d’e-mails pas branché (Brevo, document 17) : impossible d’envoyer le lien.</p>
          )}
        </div>
      )}
      {peutInviter && a && invValable && !ouvert && !lien && (
        <button type="button" className="btn-text small" onClick={() => setOuvert(true)}>
          Nouveau lien d’invitation
        </button>
      )}

      {lien && (
        <div className="esp-agence-lien">
          <p className="note small">Lien personnel du client, montré une seule fois. Ne l’ouvre pas toi-même : il ne sert qu’une fois.</p>
          <SendBox link={lien} text={messageInvitation({ nom, lien, owner })} contact={email || rec.contact} subject="Votre appli Devis & Factures" linkLabel="Lien d’invitation du client" note="Envoie ce message au client (e-mail ou SMS). Le lien est valable 7 jours et ne sert qu’une fois." />
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

      {a && (
        <div className="side-row">
          {confirmer === 'couper' ? (
            <p className="small">
              Suspendre l’appli ? Le client est déconnecté partout ; ses données sont gardées et ses clients ne peuvent plus ouvrir leurs liens.{' '}
              <button
                type="button"
                className="btn-text small danger"
                onClick={async () => {
                  setConfirmer(null);
                  if (await appel('couper')) setNote('Accès suspendu.');
                }}
              >
                Suspendre
              </button>{' '}
              <button type="button" className="btn-text small" onClick={() => setConfirmer(null)}>
                Annuler
              </button>
            </p>
          ) : confirmer === 'reinitialiser' ? (
            <p className="small">
              Réinitialiser son compte ? À faire seulement s’il a perdu à la fois son mot de passe et son téléphone (sans code de secours), après avoir vérifié par téléphone que c’est bien lui. Ses devis, factures et produits sont gardés. Le lien pour recréer son accès part par e-mail à l’adresse de son compte ({a.compte?.email}).{' '}
              <button
                type="button"
                className="btn-text small danger"
                onClick={async () => {
                  setConfirmer(null);
                  const d = await appel('reinitialiser');
                  if (d?.envoye) setNote(`Compte réinitialisé : lien envoyé à ${d.appli?.proprietaire || 'l’adresse de son compte'}, valable 7 jours.`);
                }}
              >
                Réinitialiser
              </button>{' '}
              <button type="button" className="btn-text small" onClick={() => setConfirmer(null)}>
                Annuler
              </button>
            </p>
          ) : confirmer === 'supprimer' ? (
            <SuppressionDevis
              nom={nom}
              appli={a}
              busy={busy}
              onCancel={() => setConfirmer(null)}
              onConfirm={async () => {
                const d = await appel('supprimer', { confirme: true });
                if (d?.supprime) {
                  setConfirmer(null);
                  setLien(null);
                  setOuvert(false);
                  setEtat((x) => ({ ...(x || {}), appli: null }));
                  setNote('Appli Devis & Factures supprimée.');
                }
              }}
            />
          ) : (
            <>
              {a.actif ? (
                <button type="button" className="btn-text small quiet" onClick={() => setConfirmer('couper')}>
                  Suspendre l’accès
                </button>
              ) : (
                <button type="button" className="btn-text small" disabled={busy} onClick={async () => (await appel('retablir')) && setNote('Accès rétabli.')}>
                  Rétablir l’accès
                </button>
              )}
              {a.compte && (
                <button type="button" className="btn-text small quiet" onClick={() => setConfirmer('reinitialiser')}>
                  Réinitialiser son compte
                </button>
              )}
              <button type="button" className="btn-text small quiet danger" onClick={() => setConfirmer('supprimer')}>
                Supprimer l’appli
              </button>
            </>
          )}
        </div>
      )}
      {a && (
        <a className="btn-text small quiet" href="/agence/devis">
          Tous les comptes Devis & Factures
        </a>
      )}
    </section>
  );
}
