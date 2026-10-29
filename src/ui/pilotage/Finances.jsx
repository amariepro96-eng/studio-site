'use client';
// Suivi financier : ce qui rentre (abonnements, factures), ce qui est en retard, ce que coûte
// l'activité. Les chiffres sont calculés à partir de la facturation saisie dans chaque dossier.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { AgencyBar, Spinner } from '../Chrome.jsx';
import { StorageSetup } from '../agency/Dashboard.jsx';
import Facturation from '../agency/Facturation.jsx';
import { useDialogue } from './Bulle.jsx';
import { euros, nomMois, dateCourte, etatClient } from '../../engine/finances.js';

// Graduations « rondes » de l'axe (en centimes)
function graduations(max) {
  if (max <= 0) return [0, 10000, 20000];
  const brut = max / 100 / 4;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => k >= brut) * 100;
  const out = [];
  for (let v = 0; v <= max + pas * 0.001; v += pas) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + pas);
  return out;
}
const compact = (c) => {
  const v = c / 100;
  return v >= 1000 ? `${(v / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€` : `${Math.round(v)} €`;
};

function Encaissements({ parMois, mois }) {
  const [survol, setSurvol] = useState(null);
  const max = Math.max(0, ...parMois.map((x) => x.montant));
  const ticks = graduations(max);
  const haut = ticks[ticks.length - 1] || 1;
  const total = parMois.reduce((s, x) => s + x.montant, 0);
  return (
    <figure className="graph">
      <figcaption>
        <span className="graph-titre">Encaissé chaque mois</span>
        <span className="muted small">12 derniers mois · {euros(total)} au total</span>
      </figcaption>
      <div className="graph-zone" onMouseLeave={() => setSurvol(null)}>
        <div className="graph-axe" aria-hidden="true">
          {[...ticks].reverse().map((t) => (
            <span key={t} style={{ bottom: `${(t / haut) * 100}%` }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="graph-plot">
          {ticks.map((t) => (
            <span key={t} className="graph-grille" style={{ bottom: `${(t / haut) * 100}%` }} aria-hidden="true" />
          ))}
          <ol className="graph-barres">
            {parMois.map((x, i) => {
              const courant = x.mois === mois;
              const h = (x.montant / haut) * 100;
              return (
                <li key={x.mois} className={courant ? 'courant' : ''}>
                  <button
                    type="button"
                    className="graph-cible"
                    aria-label={`${nomMois(x.mois)} : ${euros(x.montant)}`}
                    onMouseEnter={() => setSurvol(i)}
                    onFocus={() => setSurvol(i)}
                    onBlur={() => setSurvol(null)}
                  >
                    <span className="graph-barre" style={{ height: x.montant ? `max(${h}%, 3px)` : 0 }} />
                    {courant && x.montant > 0 && (
                      <span className="graph-val" style={{ bottom: `calc(${h}% + 4px)` }}>
                        {compact(x.montant)}
                      </span>
                    )}
                  </button>
                  {survol === i && (
                    <span className={`graph-bulle${i > 8 ? ' a-gauche' : ''}`} role="tooltip">
                      <strong>{nomMois(x.mois)}</strong>
                      {euros(x.montant)}
                    </span>
                  )}
                  <span className="graph-mois" aria-hidden="true">
                    {nomMois(x.mois, true).split(' ')[0].replace('.', '')}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <details className="graph-table">
        <summary>Voir les chiffres</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Mois</th>
              <th scope="col">Encaissé</th>
            </tr>
          </thead>
          <tbody>
            {parMois.map((x) => (
              <tr key={x.mois}>
                <td>{nomMois(x.mois)}</td>
                <td>{euros(x.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Lignes({ lignes, vide, onPayer, occupe, retard }) {
  if (!lignes.length) return <p className="empty small">{vide}</p>;
  return (
    <ul className="fin-lignes">
      {lignes.map((l) => {
        const cle = `${l.clientId}:${l.type}:${l.mois || l.id}`;
        return (
          <li key={cle} className={retard ? 'retard' : ''}>
            <span className="fin-ligne-texte">
              <strong>{l.nom}</strong>
              <span className="muted small">
                {l.libelle}
                {l.type === 'facture' && l.echeance ? ` · échéance ${dateCourte(l.echeance)}` : ''}
              </span>
            </span>
            <span className="fin-montant">{euros(l.montant)}</span>
            <button type="button" className="btn secondary small" disabled={occupe === cle} onClick={() => onPayer(l, cle)}>
              {occupe === cle ? '…' : 'Marquer payé'}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FeuilleClient({ client, onClose, onSaved }) {
  const ref = useRef(null);
  useDialogue(ref, onClose);
  return (
    <>
      <div className="feuille-fond" onClick={onClose} aria-hidden="true" />
      <aside ref={ref} className="feuille large" role="dialog" aria-modal="true" aria-labelledby="factu-titre" tabIndex={-1}>
        <div className="feuille-tete">
          <div>
            <p className="muted small">Facturation</p>
            <h2 id="factu-titre">{client.nom}</h2>
            <a className="small" href={`/agence/clients/${client.id}`}>
              Ouvrir le dossier
            </a>
          </div>
          <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="feuille-corps">
          <Facturation clientId={client.id} nom={client.nom} formule={client.formule} facturation={client.facturation} onSaved={onSaved} />
        </div>
      </aside>
    </>
  );
}

export default function Finances({ studioName, clientInitial = '' }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [ouvert, setOuvert] = useState(clientInitial || null);
  const [occupe, setOccupe] = useState('');
  const [note, setNote] = useState('');

  const charger = useCallback(async () => {
    try {
      setData(await api('/api/agence/finances'));
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);

  const r = data?.resume;
  const clients = data?.clients || [];
  const client = ouvert && clients.find((c) => c.id === ouvert);
  const etats = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, etatClient(c.facturation, data?.jour || '')])), [clients, data?.jour]);

  async function payer(l, cle) {
    const c = clients.find((x) => x.id === l.clientId);
    if (!c) return;
    const f = structuredClone(c.facturation);
    if (l.type === 'abonnement') f.abonnement.payes = [...(f.abonnement.payes || []), { mois: l.mois, le: data.jour }];
    else f.factures = f.factures.map((x) => (x.id === l.id ? { ...x, payeeLe: data.jour } : x));
    setOccupe(cle);
    setNote('');
    try {
      await api(`/api/agence/clients/${c.id}/facturation`, { method: 'PUT', body: { facturation: f } });
      setNote(`${l.libelle} de ${c.nom} : payé.`);
      await charger();
    } catch (e) {
      setErr(e.message);
    } finally {
      setOccupe('');
    }
  }

  return (
    <div className="ss pilot-app">
      <AgencyBar studioName={studioName} current="controle" />
      <main className="page fin">
        <a className="back" href="/controle">
          Contrôle
        </a>
        <div className="page-head">
          <div>
            <h1>Suivi financier</h1>
            <p className="muted">{r ? `${nomMois(r.mois).replace(/^./, (x) => x.toUpperCase())} · ${r.abonnes} client${r.abonnes > 1 ? 's' : ''} abonné${r.abonnes > 1 ? 's' : ''}` : 'Calcul en cours…'}</p>
          </div>
        </div>
        {err && (
          <div className="alert" role="alert">
            {err}{' '}
            <button type="button" className="btn-text small" onClick={charger}>
              Réessayer
            </button>
          </div>
        )}
        {note && (
          <p className="side-note" role="status">
            {note}
          </p>
        )}
        {data?.storage === 'none' && <StorageSetup />}
        {!data && !err && <Spinner label="Calcul en cours…" />}

        {r && (
          <>
            <div className="fin-tuiles">
              <div className="fin-tuile hero">
                <span className="chiffre-label">Encaissé en {nomMois(r.mois).split(' ')[0]}</span>
                <span className="fin-hero">{euros(r.encaisseMois)}</span>
                <span className="muted small">{euros(r.encaisseAnnee)} depuis janvier</span>
              </div>
              <div className="fin-tuile">
                <span className="chiffre-label">Abonnements</span>
                <span className="chiffre-val">
                  {euros(r.mrr)}
                  <small>/mois</small>
                </span>
                <span className="muted small">
                  {r.abonnes} abonné{r.abonnes > 1 ? 's' : ''}
                </span>
              </div>
              <div className="fin-tuile">
                <span className="chiffre-label">À encaisser</span>
                <span className="chiffre-val">{euros(r.attente.total)}</span>
                <span className="muted small">ce mois-ci et à venir</span>
              </div>
              <div className={`fin-tuile${r.retard.total ? ' ko' : ''}`}>
                <span className="chiffre-label">En retard</span>
                <span className="chiffre-val">{euros(r.retard.total)}</span>
                <span className="muted small">{r.retard.total ? `${r.retard.clients} client${r.retard.clients > 1 ? 's' : ''}` : 'Personne'}</span>
              </div>
              <div className={`fin-tuile${r.marge < 0 ? ' ko' : ''}`}>
                <span className="chiffre-label">Marge estimée</span>
                <span className="chiffre-val">
                  {euros(r.marge)}
                  <small>/mois</small>
                </span>
                <span className="muted small">
                  abonnements − {euros(r.chargesMensuelles)} de frais fixes ·{' '}
                  <a href="/agence/reglages" className="small">
                    modifier
                  </a>
                </span>
              </div>
            </div>

            <div className="fin-grille">
              <section className="card fin-carte">
                <h2>En retard</h2>
                <Lignes lignes={r.retard.lignes} retard vide="Aucun paiement en retard." onPayer={payer} occupe={occupe} />
              </section>
              <section className="card fin-carte">
                <h2>À encaisser</h2>
                <Lignes lignes={r.attente.lignes} vide="Rien à encaisser pour le moment." onPayer={payer} occupe={occupe} />
              </section>
            </div>

            <section className="card fin-carte">
              <Encaissements parMois={r.parMois} mois={r.mois} />
            </section>

            <section className="card fin-carte">
              <h2>Clients</h2>
              <p className="muted small">Touche un client pour saisir son abonnement, ses factures et ses paiements.</p>
              {clients.length ? (
                <ul className="fin-clients">
                  {clients.map((c) => {
                    const e = etats[c.id];
                    const ab = c.facturation?.abonnement;
                    return (
                      <li key={c.id}>
                        <button type="button" className="fin-client" onClick={() => setOuvert(c.id)}>
                          <span className="fin-client-nom">
                            <strong>{c.nom}</strong>
                            <span className="muted small">{c.formule || 'Formule à définir'}</span>
                          </span>
                          <span className="fin-client-ab">{e?.mensuel ? `${euros(e.mensuel)}/mois` : ab?.montant && ab.debut > (data.jour || '').slice(0, 7) ? `dès ${nomMois(ab.debut, true)}` : '—'}</span>
                          <span className={`fin-client-etat${e?.retard.total ? ' ko' : ''}`}>{e?.retard.total ? `${euros(e.retard.total)} en retard` : e?.attente.total ? `${euros(e.attente.total)} à encaisser` : ab?.montant || c.facturation?.factures?.length ? 'À jour' : 'Rien de saisi'}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="empty small">Aucun dossier client pour l’instant.</p>
              )}
            </section>
          </>
        )}
      </main>
      {client && (
        <FeuilleClient
          key={client.id}
          client={client}
          onClose={() => setOuvert(null)}
          onSaved={() => {
            charger();
          }}
        />
      )}
    </div>
  );
}
