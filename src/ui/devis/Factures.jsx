'use client';
// Onglet Factures : devis acceptés à facturer, factures émises à encaisser, factures payées
import { useMemo, useState } from 'react';
import Document from './Document.jsx';
import { Pastille, Fenetre, ChampEuros, LienCree, fmtJour, fmtQuand } from './commun.jsx';
import { vueFacture, statutFacture } from './vues.js';
import { euros, totaux } from '../../engine/devis.js';

const SECTIONS = [
  ['a_emettre', 'À émettre', 'Devis acceptés : vérifiez, puis émettez la facture (elle reçoit alors son numéro définitif).'],
  ['encaisser', 'À encaisser', 'Factures émises, en attente de paiement.'],
  ['payee', 'Payées', ''],
];
const section = (f, jour) => {
  const st = statutFacture(f, jour);
  return st === 'a_emettre' ? 'a_emettre' : st === 'payee' ? 'payee' : 'encaisser';
};

function Liste({ data, aller }) {
  const [q, setQ] = useState('');
  const [toutesPayees, setToutesPayees] = useState(false);
  const jour = data.jour;
  const tri = useMemo(() => [...data.factures].sort((a, b) => String(b.emiseLe || b.creeLe).localeCompare(String(a.emiseLe || a.creeLe))), [data.factures]);
  const c = q.trim().toLowerCase();
  const liste = tri.filter((f) => !c || [f.numero, f.devisNumero, f.client?.nom, f.objet].some((x) => String(x || '').toLowerCase().includes(c)));
  const aEncaisser = tri.filter((f) => section(f, jour) === 'encaisser');
  const totalDu = aEncaisser.reduce((s, f) => s + vueFacture(f, data.entreprise).reste, 0);
  const enRetard = aEncaisser.filter((f) => statutFacture(f, jour) === 'retard');
  return (
    <section className="dv-page">
      <div className="dv-page-tete">
        <h1>Factures</h1>
      </div>
      {tri.length > 0 && (
        <div className="dv-chiffres">
          <div>
            <span>À encaisser</span>
            <strong>{euros(totalDu)}</strong>
          </div>
          <div className={enRetard.length ? 'attention' : ''}>
            <span>En retard</span>
            <strong>{enRetard.length}</strong>
          </div>
          <div>
            <span>À émettre</span>
            <strong>{tri.filter((f) => f.statut === 'a_emettre').length}</strong>
          </div>
        </div>
      )}
      {tri.length > 4 && <input className="dv-recherche" type="search" placeholder="Rechercher un client, un numéro" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une facture" />}
      {!tri.length && (
        <div className="dv-vide">
          <p>
            <strong>Aucune facture pour le moment.</strong>
          </p>
          <p className="muted">Dès qu’un client accepte un devis (en ligne ou que vous le marquez accepté), sa facture arrive ici, prête à émettre.</p>
          <button type="button" className="btn secondary" onClick={() => aller({ onglet: 'devis' })}>
            Voir mes devis
          </button>
        </div>
      )}
      {SECTIONS.map(([id, titre, aide]) => {
        let items = liste.filter((f) => section(f, jour) === id);
        if (!items.length) return null;
        const total = items.length;
        if (id === 'payee' && !toutesPayees && !c) items = items.slice(0, 10);
        return (
          <div key={id} className="dv-section">
            <h2>
              {titre} <span className="count">{total}</span>
            </h2>
            {aide && <p className="muted small">{aide}</p>}
            <ul className="dv-liste">
              {items.map((f) => {
                const v = vueFacture(f, data.entreprise);
                const st = statutFacture(f, jour);
                return (
                  <li key={f.id}>
                    <button type="button" className="dv-item" onClick={() => aller({ onglet: 'factures', ecran: 'detail', id: f.id })}>
                      <span className="dv-item-haut">
                        <span className="dv-item-num">{f.numero || `Devis ${f.devisNumero}`}</span>
                        <Pastille statut={st} type="facture" />
                      </span>
                      <span className="dv-item-nom">{f.client?.nom}</span>
                      {f.objet && <span className="dv-item-objet">{f.objet}</span>}
                      <span className="dv-item-bas">
                        <span className="muted small">
                          {st === 'payee' ? `Payée le ${fmtJour(f.payeeLe)}` : f.echeance ? `Échéance : ${fmtJour(f.echeance)}` : `Accepté le ${fmtJour(String(f.creeLe).slice(0, 10))}`}
                        </span>
                        <strong>{euros(st === 'payee' ? v.totaux.ttc : v.reste)}</strong>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {id === 'payee' && total > items.length && (
              <button type="button" className="btn-text small" onClick={() => setToutesPayees(true)}>
                Voir les {total} factures payées
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}

function FenetreEmettre({ f, data, agir, onClose, aller }) {
  const t = totaux(f.lignes, { franchise: data.entreprise.franchise, acomptePct: f.acomptePct });
  const [acompte, setAcompte] = useState(0);
  const [datePrestation, setDatePrestation] = useState(data.jour);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (data.manques.length)
    return (
      <Fenetre titre="Émettre la facture" onClose={onClose}>
        <p className="q-error">Complétez d’abord Réglages › Entreprise : {data.manques.join(', ')}. Ces mentions sont obligatoires sur une facture.</p>
        <button type="button" className="btn primary" onClick={() => (onClose(), aller({ onglet: 'reglages', section: 'entreprise' }))}>
          Compléter mon entreprise
        </button>
      </Fenetre>
    );
  async function emettre() {
    setBusy(true);
    setErr('');
    try {
      await agir({ action: 'facture.emettre', id: f.id, acompteVerse: acompte, datePrestation });
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Fenetre titre="Émettre la facture" onClose={onClose}>
      <p>
        La facture reçoit son <strong>numéro définitif</strong> et la date d’aujourd’hui. Ensuite, elle ne peut plus être modifiée ni supprimée (la loi impose une numérotation continue).
      </p>
      <p className="muted small">
        Montant : <strong>{euros(t.ttc)}</strong>
        {data.entreprise.franchise ? '' : ' TTC'}. Échéance de paiement : {data.entreprise.delaiPaiementJours} jours.
      </p>
      <div className="q-field">
        <label className="q-label" htmlFor="dv-date-prestation">
          Date de la prestation ou de la livraison
        </label>
        <p className="q-hint">Le jour où le travail a été fait (ou terminé). Indiquée sur la facture si elle diffère d’aujourd’hui.</p>
        <input id="dv-date-prestation" type="date" value={datePrestation} max={data.jour} onChange={(e) => setDatePrestation(e.target.value)} />
      </div>
      <div className="q-field">
        <label className="q-label" htmlFor="dv-acompte-verse">
          Acompte déjà payé par le client
        </label>
        <p className="q-hint">Il sera déduit du « reste à payer ». Laissez vide s’il n’a rien versé.</p>
        <ChampEuros id="dv-acompte-verse" value={acompte} onChange={setAcompte} label="Acompte déjà payé" suffixe="€" />
        {t.acompte > 0 && acompte !== t.acompte && (
          <button type="button" className="btn-text small" onClick={() => setAcompte(t.acompte)}>
            Indiquer l’acompte demandé dans le devis ({euros(t.acompte)})
          </button>
        )}
      </div>
      {acompte > t.ttc && <p className="q-error">L’acompte dépasse le montant de la facture.</p>}
      {err && (
        <p className="q-error" role="alert">
          {err}
        </p>
      )}
      <div className="row-actions">
        <button type="button" className="btn primary" disabled={busy || acompte > t.ttc} onClick={emettre}>
          {busy ? 'Émission…' : 'Émettre la facture'}
        </button>
        <button type="button" className="btn secondary" onClick={onClose}>
          Plus tard
        </button>
      </div>
    </Fenetre>
  );
}

function FenetreEnvoi({ f, data, agir, onClose }) {
  const [email, setEmail] = useState(f.client?.email || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lien, setLien] = useState(null);
  async function envoyer(action) {
    setBusy(true);
    setErr('');
    try {
      const r = await agir({ action, id: f.id, email: email.trim() });
      if (r.lien) {
        setLien(r.lien);
        if (r.erreurEnvoi) setErr(r.erreurEnvoi);
      } else onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  const sujet = `Facture ${f.numero}`;
  return (
    <Fenetre titre={`Envoyer la facture ${f.numero}`} onClose={onClose}>
      {lien ? (
        <>
          {err && <p className="q-error">{err}</p>}
          <LienCree lien={lien} sujet={sujet} texte={`Bonjour,\n\nVoici notre facture ${f.numero}. Vous pouvez la consulter et l’enregistrer en PDF ici :`} email={email} />
        </>
      ) : (
        <>
          <p className="muted small">Le client reçoit un lien pour consulter la facture et l’enregistrer en PDF.{f.envoyeLe ? ' Le lien envoyé avant ne fonctionnera plus.' : ''}</p>
          {data.mail && (
            <div className="q-field">
              <label className="q-label" htmlFor="dv-f-email">
                E-mail du client
              </label>
              <input id="dv-f-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" />
            </div>
          )}
          {err && (
            <p className="q-error" role="alert">
              {err}
            </p>
          )}
          <div className="row-actions">
            {data.mail && (
              <button type="button" className="btn primary" disabled={busy || !email.trim()} onClick={() => envoyer('facture.envoyer')}>
                {busy ? 'Envoi…' : 'Envoyer par e-mail'}
              </button>
            )}
            <button type="button" className={data.mail ? 'btn secondary' : 'btn primary'} disabled={busy} onClick={() => envoyer('facture.lien')}>
              {data.mail ? 'Créer un lien à envoyer moi-même' : 'Créer le lien à envoyer'}
            </button>
          </div>
        </>
      )}
    </Fenetre>
  );
}

function Detail({ data, agir, aller, id }) {
  const f = data.factures.find((x) => x.id === id);
  const [fenetre, setFenetre] = useState(null);
  const [le, setLe] = useState(data.jour);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!f)
    return (
      <section className="dv-page">
        <button type="button" className="back" onClick={() => aller({ onglet: 'factures' })}>
          Factures
        </button>
        <p>Cette facture n’existe plus.</p>
      </section>
    );
  const st = statutFacture(f, data.jour);
  const doc = vueFacture(f, data.entreprise);
  async function faire(action, extra = {}, apres) {
    setBusy(true);
    setErr('');
    try {
      await agir({ action, id: f.id, ...extra });
      setFenetre(null);
      if (apres) apres();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  const devis = data.devis.find((d) => d.id === f.devisId);
  return (
    <section className="dv-page dv-fiche">
      <button type="button" className="back dv-noprint" onClick={() => aller({ onglet: 'factures' })}>
        Factures
      </button>
      <div className="dv-page-tete dv-noprint">
        <div>
          <h1>{f.numero ? `Facture ${f.numero}` : 'Facture à émettre'}</h1>
          <p className="dv-sous">
            <Pastille statut={st} type="facture" /> {f.client?.nom}
          </p>
        </div>
      </div>

      <div className="dv-bandeaux dv-noprint">
        {st === 'a_emettre' && (
          <div className="dv-bandeau info">
            <strong>Devis {f.devisNumero} accepté.</strong> Vérifiez la facture ci-dessous, puis émettez-la : elle recevra son numéro définitif. Vous pourrez ensuite l’envoyer au client.
          </div>
        )}
        {st === 'retard' && (
          <div className="dv-bandeau ko">
            <strong>Échéance dépassée</strong> depuis le {fmtJour(f.echeance)}. Relancez le client, ou marquez la facture payée si vous avez reçu le règlement.
          </div>
        )}
        {st === 'emise' && <div className="dv-bandeau info">{f.envoyeLe ? `Envoyée le ${fmtQuand(f.envoyeLe)}.` : 'Pas encore envoyée au client.'} À régler avant le {fmtJour(f.echeance)}.</div>}
        {st === 'payee' && <div className="dv-bandeau ok">Payée le {fmtJour(f.payeeLe)}.</div>}
      </div>

      <div className="dv-actions dv-noprint">
        {st === 'a_emettre' && (
          <button type="button" className="btn primary" onClick={() => setFenetre('emettre')}>
            Émettre la facture
          </button>
        )}
        {st !== 'a_emettre' && (
          <button type="button" className={st === 'payee' ? 'btn secondary' : 'btn primary'} onClick={() => setFenetre('envoi')}>
            {f.envoyeLe ? 'Renvoyer au client' : 'Envoyer au client'}
          </button>
        )}
        {['emise', 'retard'].includes(st) && (
          <button type="button" className="btn secondary" onClick={() => setFenetre('payer')}>
            Marquer payée
          </button>
        )}
        <button type="button" className="btn secondary" onClick={() => window.print()}>
          Imprimer / PDF
        </button>
        {st !== 'a_emettre' && (
          <a className="btn secondary" href={`/api/devis/facturx?id=${f.id}`}>
            Télécharger Factur-X
          </a>
        )}
        {devis && (
          <button type="button" className="btn-text small" onClick={() => aller({ onglet: 'devis', ecran: 'detail', id: devis.id })}>
            Voir le devis {devis.numero}
          </button>
        )}
        {st === 'payee' && (
          <button type="button" className="btn-text small" disabled={busy} onClick={() => faire('facture.nonpayee')}>
            Remettre « à encaisser »
          </button>
        )}
        {st === 'a_emettre' && (
          <button type="button" className="btn-text small danger" onClick={() => setFenetre('supprimer')}>
            Supprimer
          </button>
        )}
      </div>
      {err && (
        <p className="q-error dv-noprint" role="alert">
          {err}
        </p>
      )}

      <Document doc={doc} />

      {(f.historique || []).length > 0 && (
        <details className="dv-historique dv-noprint">
          <summary>Historique</summary>
          <ol>
            {[...f.historique].reverse().map((h, i) => (
              <li key={i}>
                <span>{h.txt}</span>
                <time className="muted">{fmtQuand(h.at)}</time>
              </li>
            ))}
          </ol>
        </details>
      )}

      {fenetre === 'emettre' && <FenetreEmettre f={f} data={data} agir={agir} aller={aller} onClose={() => setFenetre(null)} />}
      {fenetre === 'envoi' && <FenetreEnvoi f={f} data={data} agir={agir} onClose={() => setFenetre(null)} />}
      {fenetre === 'payer' && (
        <Fenetre titre="Marquer la facture payée" onClose={() => setFenetre(null)}>
          <div className="q-field">
            <label className="q-label" htmlFor="dv-paye-le">
              Date du paiement
            </label>
            <input id="dv-paye-le" type="date" value={le} min={f.emiseLe} max={data.jour} onChange={(e) => setLe(e.target.value)} />
          </div>
          {err && <p className="q-error">{err}</p>}
          <div className="row-actions">
            <button type="button" className="btn primary" disabled={busy} onClick={() => faire('facture.payer', { le })}>
              Marquer payée
            </button>
          </div>
        </Fenetre>
      )}
      {fenetre === 'supprimer' && (
        <Fenetre titre="Supprimer cette facture à émettre ?" onClose={() => setFenetre(null)}>
          <p>Elle n’a pas encore de numéro : vous pouvez la supprimer (par exemple si le chantier est finalement abandonné). Le devis {f.devisNumero} reste accepté.</p>
          <div className="row-actions">
            <button type="button" className="btn primary danger" disabled={busy} onClick={() => faire('facture.supprimer', {}, () => aller({ onglet: 'factures' }, { remplacer: true }))}>
              Supprimer
            </button>
            <button type="button" className="btn secondary" onClick={() => setFenetre(null)}>
              Garder
            </button>
          </div>
        </Fenetre>
      )}
    </section>
  );
}

export default function Factures(props) {
  if (props.nav.ecran === 'detail') return <Detail {...props} id={props.nav.id} />;
  return <Liste {...props} />;
}
