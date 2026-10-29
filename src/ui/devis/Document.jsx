'use client';
// Devis ou facture mis en page comme un document papier (écran et impression)
import { euros, formatQuantite, ligneHT, tauxLabel, dateLongue } from '../../engine/devis.js';

function Lignes({ lignes, franchise }) {
  return (
    <table className="dv-table">
      <thead>
        <tr>
          <th scope="col">Désignation</th>
          <th scope="col" className="num">
            Qté
          </th>
          <th scope="col" className="num">
            Prix unitaire HT
          </th>
          {!franchise && (
            <th scope="col" className="num">
              TVA
            </th>
          )}
          <th scope="col" className="num">
            Total HT
          </th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l, i) => (
          <tr key={l.id || i}>
            <td data-label="Désignation">
              <strong>{l.designation}</strong>
              {l.description && <span className="dv-ligne-desc">{l.description}</span>}
            </td>
            <td className="num" data-label="Quantité">
              {formatQuantite(l.quantite)} {l.unite}
            </td>
            <td className="num" data-label="Prix unitaire HT">
              {euros(l.prixHT)}
            </td>
            {!franchise && (
              <td className="num" data-label="TVA">
                {tauxLabel(l.tva)}
              </td>
            )}
            <td className="num" data-label="Total HT">
              {euros(ligneHT(l))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bloc({ titre, children }) {
  return (
    <div className="dv-doc-bloc">
      <span className="dv-doc-etiquette">{titre}</span>
      {children}
    </div>
  );
}

// doc : { type, numero, date, validite?, echeance?, vendeur, client, objet, lignes, totaux, notes?, mentions,
//         acompteVerse?, reste?, reponse?, statut?, provisoire? }
export default function Document({ doc }) {
  const v = doc.vendeur || {};
  const c = doc.client || {};
  const t = doc.totaux;
  const facture = doc.type === 'facture';
  const franchise = Boolean(t?.franchise);
  return (
    <article className="dv-doc" aria-label={`${facture ? 'Facture' : 'Devis'} ${doc.numero || ''}`}>
      <header className="dv-doc-tete">
        <div className="dv-doc-vendeur">
          <strong className="dv-doc-nom">{v.nom || 'Votre entreprise'}</strong>
          {v.adresse && <span className="dv-pre">{v.adresse}</span>}
          {v.telephone && <span>{v.telephone}</span>}
          {v.email && <span>{v.email}</span>}
          {v.site && <span>{v.site.replace(/^https?:\/\//, '')}</span>}
        </div>
        <div className="dv-doc-titre">
          <span className="dv-doc-type">{facture ? 'Facture' : 'Devis'}</span>
          <strong>{doc.numero || (facture ? 'Numéro attribué à l’émission' : 'Brouillon')}</strong>
          {doc.date && <span>{facture ? 'Émise le' : 'Du'} {dateLongue(doc.date)}</span>}
          {!facture && doc.validite && <span>Valable jusqu’au {dateLongue(doc.validite)}</span>}
          {facture && doc.datePrestation && doc.datePrestation !== doc.date && <span>Prestation ou livraison du {dateLongue(doc.datePrestation)}</span>}
          {facture && doc.echeance && <span>À régler avant le {dateLongue(doc.echeance)}</span>}
          {facture && doc.devisNumero && <span className="muted">Devis {doc.devisNumero}</span>}
        </div>
      </header>

      <div className="dv-doc-parties">
        <Bloc titre="Client">
          <strong>{c.nom || '—'}</strong>
          {c.contact && <span>À l’attention de {c.contact}</span>}
          {c.adresse && <span className="dv-pre">{c.adresse}</span>}
          {c.email && <span>{c.email}</span>}
          {c.telephone && <span>{c.telephone}</span>}
          {c.pro && c.siret && <span>SIRET {c.siret}</span>}
        </Bloc>
        {doc.objet && (
          <Bloc titre="Objet">
            <strong>{doc.objet}</strong>
          </Bloc>
        )}
      </div>

      {doc.lignes?.length ? <Lignes lignes={doc.lignes} franchise={franchise} /> : <p className="muted">Aucune ligne pour le moment.</p>}

      {t && (
        <dl className="dv-totaux">
          <div>
            <dt>Total HT</dt>
            <dd>{euros(t.ht)}</dd>
          </div>
          {t.tvas.map((x) => (
            <div key={x.taux}>
              <dt>
                TVA {tauxLabel(x.taux)}
                <small> sur {euros(x.base)}</small>
              </dt>
              <dd>{euros(x.tva)}</dd>
            </div>
          ))}
          <div className="dv-total-ttc">
            <dt>{franchise ? 'Total' : 'Total TTC'}</dt>
            <dd>{euros(t.ttc)}</dd>
          </div>
          {!facture && t.acompte > 0 && (
            <div>
              <dt>Acompte à la commande ({t.acomptePct} %)</dt>
              <dd>{euros(t.acompte)}</dd>
            </div>
          )}
          {facture && doc.acompteVerse > 0 && (
            <>
              <div>
                <dt>Déjà réglé (acompte)</dt>
                <dd>− {euros(doc.acompteVerse)}</dd>
              </div>
              <div className="dv-total-ttc">
                <dt>Reste à payer</dt>
                <dd>{euros(doc.reste)}</dd>
              </div>
            </>
          )}
        </dl>
      )}

      {doc.notes && (
        <div className="dv-doc-notes">
          <span className="dv-doc-etiquette">Remarques</span>
          <p className="dv-pre">{doc.notes}</p>
        </div>
      )}

      <div className="dv-doc-conditions">
        {!facture && v.conditions && <p className="dv-pre">{v.conditions}</p>}
        {facture && (
          <>
            {v.conditions && <p className="dv-pre">{v.conditions}</p>}
            {v.iban && (
              <p>
                Règlement par virement : IBAN <strong>{v.iban}</strong>
                {v.bic ? ` · BIC ${v.bic}` : ''}
              </p>
            )}
          </>
        )}
      </div>

      {!facture && doc.reponse?.type === 'accepte' && (
        <div className="dv-doc-accord">
          <strong>Bon pour accord</strong>
          <span>
            {doc.reponse.nom}, le {dateLongue(String(doc.reponse.at).slice(0, 10))}
            {doc.reponse.horsLigne ? '' : ' (accord donné en ligne)'}
          </span>
        </div>
      )}
      {facture && doc.statut === 'payee' && doc.payeeLe && <div className="dv-doc-accord">Payée le {dateLongue(doc.payeeLe)}</div>}

      {doc.mentions?.length > 0 && (
        <footer className="dv-doc-pied">
          {doc.mentions.map((m, i) => (
            <p key={i}>{m}</p>
          ))}
        </footer>
      )}
    </article>
  );
}
