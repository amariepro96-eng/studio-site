'use client';
// Facturation d'un client : formule, abonnement mensuel (mois payés), factures ponctuelles.
// Utilisé dans le suivi financier et dans le dossier du client.
import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { FORMULES } from '../../engine/records.js';
import { facturationVide, etatClient, euros, lireEuros, versSaisie, nomMois, moisEntre, moisDe, moisSuivant, moisPrecedent, aujourdhuiParis, nouvelId, dateCourte } from '../../engine/finances.js';

const RACCOURCIS = ['Création du site', 'Acompte création', 'Modification hors forfait', 'Option'];

function choixMois(centre) {
  const out = [];
  let m = centre;
  for (let i = 0; i < 24; i++) m = moisPrecedent(m);
  for (let i = 0; i < 37; i++, m = moisSuivant(m)) out.push(m);
  return out;
}

// Copie de travail : montants saisis en texte, convertis à l'enregistrement
function versBrouillon(f) {
  const x = f || facturationVide();
  return {
    abonnement: { saisie: versSaisie(x.abonnement?.montant), debut: x.abonnement?.debut || '', fin: x.abonnement?.fin || '', payes: [...(x.abonnement?.payes || [])] },
    factures: (x.factures || []).map((fa) => ({ ...fa, saisie: versSaisie(fa.montant) })),
    note: x.note || '',
  };
}
function depuisBrouillon(b) {
  const erreurs = [];
  const montant = lireEuros(b.abonnement.saisie);
  if (montant === null) erreurs.push('Montant de l’abonnement illisible (exemple : 39 ou 39,90).');
  if (montant > 0 && !b.abonnement.debut) erreurs.push('Indique le mois de début de l’abonnement.');
  const factures = b.factures.map((fa) => {
    const m = lireEuros(fa.saisie);
    if (m === null) erreurs.push(`Montant illisible pour « ${fa.libelle || 'facture'} ».`);
    return { id: fa.id, libelle: fa.libelle, montant: m ?? 0, echeance: fa.echeance, payeeLe: fa.payeeLe };
  });
  return { erreurs, facturation: { abonnement: { montant: montant ?? 0, debut: b.abonnement.debut, fin: b.abonnement.fin, payes: b.abonnement.payes }, factures, note: b.note } };
}

export default function Facturation({ clientId, nom, formule: formuleInitiale = '', facturation, onSaved, compact = false }) {
  const jour = aujourdhuiParis();
  const mois = moisDe(jour);
  const [b, setB] = useState(() => versBrouillon(facturation));
  const [formule, setFormule] = useState(formuleInitiale);
  const [modifie, setModifie] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [tousLesMois, setTousLesMois] = useState(false);

  const maj = (fn) => {
    setB((x) => fn(structuredClone(x)));
    setModifie(true);
    setNote('');
  };

  const calcul = useMemo(() => {
    const { facturation: f } = depuisBrouillon(b);
    return etatClient(f, jour);
  }, [b, jour]);

  const ab = b.abonnement;
  const montantAb = lireEuros(ab.saisie) || 0;
  const moisDus = ab.debut && montantAb > 0 ? moisEntre(ab.debut, ab.fin && ab.fin < mois ? ab.fin : mois) : [];
  const payes = new Map(ab.payes.map((p) => [p.mois, p.le]));
  const visibles = tousLesMois ? moisDus : moisDus.slice(-12);

  async function enregistrer() {
    const { erreurs, facturation: f } = depuisBrouillon(b);
    if (erreurs.length) return setErr(erreurs[0]);
    setOccupe(true);
    setErr('');
    try {
      const d = await api(`/api/agence/clients/${clientId}/facturation`, { method: 'PUT', body: { facturation: f, formule } });
      setB(versBrouillon(d.facturation));
      setFormule(d.formule);
      setModifie(false);
      setNote('Enregistré.');
      onSaved?.(d.facturation, d.formule);
    } catch (e) {
      setErr(e.message);
    } finally {
      setOccupe(false);
    }
    return undefined;
  }

  const listeMois = choixMois(mois);
  const optionsFormule = formule && !FORMULES.includes(formule) ? [formule, ...FORMULES] : FORMULES;

  return (
    <div className={`factu${compact ? ' compact' : ''}`}>
      <div className="factu-bloc">
        <label className="q-label" htmlFor={`f-formule-${clientId}`}>
          Formule
        </label>
        <select
          id={`f-formule-${clientId}`}
          value={formule}
          onChange={(e) => {
            setFormule(e.target.value);
            setModifie(true);
          }}
        >
          <option value="">Pas encore définie</option>
          {optionsFormule.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="factu-bloc">
        <h3>Abonnement mensuel</h3>
        <div className="factu-ligne3">
          <div>
            <label className="q-label" htmlFor={`f-ab-${clientId}`}>
              Montant HT
            </label>
            <span className="euro-input">
              <input id={`f-ab-${clientId}`} type="text" inputMode="decimal" placeholder="0" value={ab.saisie} aria-invalid={lireEuros(ab.saisie) === null || undefined} onChange={(e) => { const v = e.target.value; maj((x) => ((x.abonnement.saisie = v), x)); }} />
              <span aria-hidden="true">€/mois</span>
            </span>
          </div>
          <div>
            <label className="q-label" htmlFor={`f-deb-${clientId}`}>
              Depuis
            </label>
            <select id={`f-deb-${clientId}`} value={ab.debut} onChange={(e) => { const v = e.target.value; maj((x) => ((x.abonnement.debut = v), x)); }}>
              <option value="">—</option>
              {listeMois.map((m) => (
                <option key={m} value={m}>
                  {nomMois(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="q-label" htmlFor={`f-fin-${clientId}`}>
              Jusqu’à
            </label>
            <select id={`f-fin-${clientId}`} value={ab.fin} onChange={(e) => { const v = e.target.value; maj((x) => ((x.abonnement.fin = v), x)); }}>
              <option value="">Sans fin</option>
              {listeMois
                .filter((m) => !ab.debut || m >= ab.debut)
                .map((m) => (
                  <option key={m} value={m}>
                    {nomMois(m)}
                  </option>
                ))}
            </select>
          </div>
        </div>
        {moisDus.length > 0 && (
          <>
            <p className="q-hint">Touche un mois pour le marquer payé (ou non payé).</p>
            <ul className="mois-grille">
              {visibles.map((m) => {
                const le = payes.get(m);
                const etat = le ? 'paye' : m < mois ? 'retard' : 'attente';
                return (
                  <li key={m}>
                    <button
                      type="button"
                      className={`mois-puce ${etat}`}
                      aria-pressed={Boolean(le)}
                      onClick={() =>
                        maj((x) => {
                          const i = x.abonnement.payes.findIndex((p) => p.mois === m);
                          if (i >= 0) x.abonnement.payes.splice(i, 1);
                          else x.abonnement.payes.push({ mois: m, le: jour });
                          x.abonnement.payes.sort((p, q) => p.mois.localeCompare(q.mois));
                          return x;
                        })
                      }
                    >
                      <span className="mois-nom">{nomMois(m, true)}</span>
                      <span className="mois-etat">{le ? `payé ${dateCourte(le).replace(/ \d{4}$/, '')}` : etat === 'retard' ? 'en retard' : 'à encaisser'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {moisDus.length > 12 && (
              <button type="button" className="btn-text small" onClick={() => setTousLesMois((v) => !v)}>
                {tousLesMois ? 'Afficher les 12 derniers mois' : `Afficher les ${moisDus.length} mois`}
              </button>
            )}
          </>
        )}
      </div>

      <div className="factu-bloc">
        <h3>Factures</h3>
        {b.factures.length > 0 && (
          <ul className="factures">
            {b.factures.map((fa) => {
              const retard = !fa.payeeLe && fa.echeance && fa.echeance < jour;
              return (
                <li key={fa.id} className={fa.payeeLe ? 'payee' : retard ? 'retard' : ''}>
                  <input className="factu-lib" type="text" aria-label="Libellé" value={fa.libelle} onChange={(e) => { const v = e.target.value; maj((x) => ((x.factures.find((y) => y.id === fa.id).libelle = v), x)); }} />
                  <span className="euro-input factu-mon">
                    <input type="text" inputMode="decimal" aria-label="Montant HT" placeholder="0" value={fa.saisie} aria-invalid={lireEuros(fa.saisie) === null || undefined} onChange={(e) => { const v = e.target.value; maj((x) => ((x.factures.find((y) => y.id === fa.id).saisie = v), x)); }} />
                    <span aria-hidden="true">€</span>
                  </span>
                  <label className="factu-date factu-ech">
                    <span>Échéance</span>
                    <input type="date" value={fa.echeance} onChange={(e) => { const v = e.target.value; maj((x) => ((x.factures.find((y) => y.id === fa.id).echeance = v), x)); }} />
                  </label>
                  {fa.payeeLe ? (
                    <label className="factu-date factu-paye">
                      <span>Payée le</span>
                      <input type="date" value={fa.payeeLe} onChange={(e) => { const v = e.target.value; maj((x) => ((x.factures.find((y) => y.id === fa.id).payeeLe = v), x)); }} />
                    </label>
                  ) : (
                    <button type="button" className="btn secondary small factu-paye" onClick={() => maj((x) => ((x.factures.find((y) => y.id === fa.id).payeeLe = jour), x))}>
                      Payée aujourd’hui
                    </button>
                  )}
                  <button type="button" className="icon-btn small factu-del" aria-label={`Supprimer ${fa.libelle}`} onClick={() => maj((x) => ((x.factures = x.factures.filter((y) => y.id !== fa.id)), x))}>
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="row-actions factu-ajout">
          {RACCOURCIS.map((r) => (
            <button key={r} type="button" className="btn secondary small" onClick={() => maj((x) => (x.factures.push({ id: nouvelId(), libelle: r, saisie: '', montant: 0, echeance: jour, payeeLe: '' }), x))}>
              + {r}
            </button>
          ))}
        </div>
      </div>

      <div className="factu-bloc">
        <label className="q-label" htmlFor={`f-note-${clientId}`}>
          Note
        </label>
        <textarea id={`f-note-${clientId}`} rows={2} placeholder="Prélèvement le 5 du mois, remise accordée…" value={b.note} onChange={(e) => { const v = e.target.value; maj((x) => ((x.note = v), x)); }} />
      </div>

      <div className="factu-pied">
        <p className="small">
          {calcul.retard.total > 0 ? (
            <span className="ko">
              {euros(calcul.retard.total)} en retard · {euros(calcul.attente.total)} à encaisser
            </span>
          ) : calcul.attente.total > 0 ? (
            `${euros(calcul.attente.total)} à encaisser, rien en retard`
          ) : (
            `${nom || 'Ce client'} est à jour`
          )}
        </p>
        <div className="row-actions">
          <button type="button" className="btn primary small" onClick={enregistrer} disabled={occupe || !modifie}>
            {occupe ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {note && (
            <span className="side-note" role="status">
              {note}
            </span>
          )}
        </div>
        {err && (
          <p className="q-error" role="alert">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}
