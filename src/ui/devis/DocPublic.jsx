'use client';
// Page du client final : devis ou facture reçus par lien. Pour un devis : accepter, demander une
// modification ou refuser. Le jeton secret est après le « # » (jamais envoyé dans les journaux).
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Document from './Document.jsx';
import { fmtJour, fmtQuand } from './commun.jsx';
import { euros } from '../../engine/devis.js';

function lireHash() {
  const h = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '');
  const m = /^([df])\.([A-Za-z0-9_-]{40,64})$/.exec(h);
  return m ? { type: m[1], jeton: m[2] } : null;
}

function Accepter({ doc, envoyer, busy }) {
  const [nom, setNom] = useState(doc.client?.contact || '');
  const [ok, setOk] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <form
      className="dv-reponse-form"
      onSubmit={(e) => {
        e.preventDefault();
        envoyer('accepter', { nom, message });
      }}
    >
      <div className="q-field">
        <label className="q-label" htmlFor="dv-r-nom">
          Votre nom et prénom
        </label>
        <input id="dv-r-nom" type="text" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" maxLength={120} />
      </div>
      <div className="q-field">
        <label className="q-label" htmlFor="dv-r-msg">
          Un message pour l’entreprise (facultatif)
        </label>
        <textarea id="dv-r-msg" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1500} placeholder="Ex. disponibilités pour l’intervention" />
      </div>
      <label className="q-toggle compact">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>
          <span className="q-option-title">Bon pour accord</span>
          <span className="q-option-hint">
            J’accepte le devis {doc.numero} d’un montant de {euros(doc.totaux.ttc)}
            {doc.totaux.franchise ? '' : ' TTC'}
            {doc.totaux.acompte > 0 ? `, avec un acompte de ${euros(doc.totaux.acompte)} à la commande` : ''}, et les conditions qui y figurent.
          </span>
        </span>
      </label>
      <button type="submit" className="btn primary block" disabled={busy || !ok || nom.trim().length < 2}>
        {busy ? 'Envoi…' : 'Accepter le devis'}
      </button>
    </form>
  );
}

function Modifier({ envoyer, busy }) {
  const [message, setMessage] = useState('');
  return (
    <form
      className="dv-reponse-form"
      onSubmit={(e) => {
        e.preventDefault();
        envoyer('modifier', { message });
      }}
    >
      <div className="q-field">
        <label className="q-label" htmlFor="dv-r-modif">
          Que souhaitez-vous changer ?
        </label>
        <textarea id="dv-r-modif" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1500} autoFocus placeholder="Ex. retirer la ligne 3, ajouter la pose des plinthes…" />
      </div>
      <button type="submit" className="btn primary block" disabled={busy || message.trim().length < 3}>
        {busy ? 'Envoi…' : 'Envoyer ma demande'}
      </button>
    </form>
  );
}

function Refuser({ envoyer, busy }) {
  const [message, setMessage] = useState('');
  return (
    <form
      className="dv-reponse-form"
      onSubmit={(e) => {
        e.preventDefault();
        envoyer('refuser', { message });
      }}
    >
      <div className="q-field">
        <label className="q-label" htmlFor="dv-r-refus">
          La raison, si vous le souhaitez
        </label>
        <textarea id="dv-r-refus" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1500} />
      </div>
      <button type="submit" className="btn secondary block danger" disabled={busy}>
        {busy ? 'Envoi…' : 'Refuser le devis'}
      </button>
    </form>
  );
}

const FAIT = {
  accepte: 'Merci : votre accord a bien été transmis. Vous allez recevoir une confirmation par e-mail.',
  modification: 'Votre demande a bien été transmise. L’entreprise vous enverra un devis mis à jour.',
  refuse: 'Votre réponse a bien été transmise. Merci d’avoir pris le temps de répondre.',
};

export default function DocPublic({ w }) {
  const [etat, setEtat] = useState('chargement');
  const [doc, setDoc] = useState(null);
  const [cle, setCle] = useState(null);
  const [erreur, setErreur] = useState('');
  const [choix, setChoix] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fait, setFait] = useState('');
  const [errAction, setErrAction] = useState('');

  useEffect(() => {
    const k = lireHash();
    if (!k) {
      setErreur('Ce lien est incomplet : ouvrez-le directement depuis l’e-mail ou le message reçu, sans le modifier.');
      setEtat('erreur');
      return;
    }
    setCle(k);
    api('/api/d', { method: 'POST', body: { w, ...k, action: 'voir' } })
      .then((r) => {
        setDoc(r.doc);
        setEtat('pret');
        document.title = `${r.doc.type === 'facture' ? 'Facture' : 'Devis'} ${r.doc.numero} · ${r.doc.vendeur?.nom || ''}`;
      })
      .catch((e) => {
        setErreur(e.message);
        setEtat('erreur');
      });
  }, [w]);

  async function envoyer(action, extra) {
    setBusy(true);
    setErrAction('');
    try {
      const r = await api('/api/d', { method: 'POST', body: { w, ...cle, action, ...extra } });
      setDoc(r.doc);
      setChoix(null);
      setFait(r.deja ? 'Ce devis a déjà reçu une réponse.' : FAIT[r.fait] || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setErrAction(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (etat !== 'pret')
    return (
      <div className="ss dv dv-public">
        <main className="login dv-login">
          {etat === 'chargement' ? (
            <p className="muted">Chargement du document…</p>
          ) : (
            <div className="alert" role="alert">
              {erreur}
            </div>
          )}
        </main>
      </div>
    );

  const devis = doc.type === 'devis';
  const st = doc.statut;
  const enAttente = devis && ['envoye', 'vu', 'modification', 'expire'].includes(st);
  const r = doc.reponse;
  return (
    <div className="ss dv dv-public">
      <header className="dv-public-tete dv-noprint">
        <span>
          <strong>{doc.vendeur?.nom}</strong>
          <span className="muted small">
            {devis ? 'vous a adressé un devis' : 'vous a adressé une facture'}
          </span>
        </span>
        <button type="button" className="btn secondary small" onClick={() => window.print()}>
          Imprimer / PDF
        </button>
      </header>

      <main className="dv-public-main">
        <div className="dv-bandeaux dv-noprint">
          {fait && (
            <div className="dv-bandeau ok" role="status">
              {fait}
            </div>
          )}
          {devis && st === 'accepte' && !fait && r && (
            <div className="dv-bandeau ok">
              Devis accepté par {r.nom} le {fmtQuand(r.at)}.
            </div>
          )}
          {devis && st === 'refuse' && !fait && <div className="dv-bandeau">Vous avez refusé ce devis le {fmtQuand(r?.at)}.</div>}
          {devis && st === 'annule' && <div className="dv-bandeau attention">Ce devis a été annulé par l’entreprise : il n’est plus valable.</div>}
          {devis && st === 'modification' && !fait && r && (
            <div className="dv-bandeau info">
              Vous avez demandé une modification le {fmtQuand(r.at)}. L’entreprise va vous envoyer une nouvelle version. Vous pouvez aussi accepter ce devis tel quel.
            </div>
          )}
          {devis && st === 'expire' && <div className="dv-bandeau attention">Ce devis a dépassé sa date de validité ({fmtJour(doc.validite)}). Demandez une modification pour en recevoir un nouveau.</div>}
          {!devis && st === 'payee' && <div className="dv-bandeau ok">Facture réglée{doc.payeeLe ? ` le ${fmtJour(doc.payeeLe)}` : ''}. Merci.</div>}
          {!devis && st !== 'payee' && doc.echeance && (
            <div className={`dv-bandeau ${st === 'retard' ? 'attention' : 'info'}`}>
              Montant à régler : <strong>{euros(doc.reste)}</strong>, avant le {fmtJour(doc.echeance)}.
            </div>
          )}
        </div>

        {enAttente && (
          <section className="dv-reponse dv-noprint" aria-label="Votre réponse">
            <h2>Votre réponse</h2>
            <p className="muted small">Le devis complet est juste en dessous. Vous pouvez aussi l’imprimer ou l’enregistrer en PDF avant de répondre.</p>
            <div className="dv-reponse-choix" role="group">
              {st !== 'expire' && (
                <button type="button" className={choix === 'accepter' ? 'btn primary' : 'btn secondary'} aria-pressed={choix === 'accepter'} onClick={() => setChoix('accepter')}>
                  Accepter
                </button>
              )}
              {st !== 'modification' && (
                <button type="button" className={choix === 'modifier' ? 'btn primary' : 'btn secondary'} aria-pressed={choix === 'modifier'} onClick={() => setChoix('modifier')}>
                  Demander une modification
                </button>
              )}
              <button type="button" className={choix === 'refuser' ? 'btn primary' : 'btn secondary'} aria-pressed={choix === 'refuser'} onClick={() => setChoix('refuser')}>
                Refuser
              </button>
            </div>
            {choix === 'accepter' && <Accepter doc={doc} envoyer={envoyer} busy={busy} />}
            {choix === 'modifier' && <Modifier envoyer={envoyer} busy={busy} />}
            {choix === 'refuser' && <Refuser envoyer={envoyer} busy={busy} />}
            {errAction && (
              <p className="q-error" role="alert">
                {errAction}
              </p>
            )}
          </section>
        )}

        <Document doc={doc} />

        <p className="muted small dv-public-pied dv-noprint">Ce lien vous est personnel : ne le partagez pas. Une question ? Contactez directement {doc.vendeur?.nom}{doc.vendeur?.telephone ? ` au ${doc.vendeur.telephone}` : ''}{doc.vendeur?.email ? ` ou à ${doc.vendeur.email}` : ''}.</p>
      </main>
    </div>
  );
}
