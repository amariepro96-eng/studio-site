'use client';
// Contenu d'une explication de problème : ce qui se passe, pourquoi, conséquence, que faire
import { timeAgo } from '../../engine/records.js';

export const NIVEAUX = {
  panne: { court: 'Panne', long: 'Problème' },
  attention: { court: 'À surveiller', long: 'À surveiller' },
  action: { court: 'À traiter', long: 'À traiter' },
  travaux: { court: 'En cours', long: 'Mise en ligne' },
};

export const ETATS = {
  panne: 'Problème',
  attention: 'À surveiller',
  action: 'À traiter',
  travaux: 'Mise en ligne…',
  ok: 'En ligne',
  prepa: 'En préparation',
};

export function depuisTexte(iso) {
  if (!iso) return '';
  const t = timeAgo(iso);
  return t === 'à l’instant' ? 'constaté à l’instant' : `depuis ${t.replace(/^il y a /, '')}`;
}

export function Actions({ actions, onVerifier, verif }) {
  if (!actions?.length) return null;
  return (
    <div className="expl-actions">
      {actions.map((a, i) =>
        a.verifier ? (
          <button key={i} type="button" className="btn secondary small" onClick={onVerifier} disabled={verif}>
            {verif ? 'Vérification…' : a.label}
          </button>
        ) : (
          <a key={i} className={`btn ${i === 0 || (i === 1 && actions[0].verifier) ? 'primary' : 'secondary'} small`} href={a.href} {...(a.externe ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {a.label}
            {a.externe && <span aria-hidden="true"> ↗</span>}
          </a>
        )
      )}
    </div>
  );
}

export default function Explication({ p, onVerifier, verif }) {
  return (
    <div className="expl">
      {p.quoi && (
        <section>
          <h4>Ce qui se passe</h4>
          <p>{p.quoi}</p>
        </section>
      )}
      {p.pourquoi?.length > 0 && (
        <section>
          <h4>{p.pourquoi.length > 1 ? 'Causes les plus probables' : 'Cause'}</h4>
          <ul>
            {p.pourquoi.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      )}
      {p.consequence && (
        <section>
          <h4>Pour le client</h4>
          <p>{p.consequence}</p>
        </section>
      )}
      {p.etapes?.length > 0 && (
        <section>
          <h4>Que faire</h4>
          <ol>
            {p.etapes.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
        </section>
      )}
      {p.dns?.length > 0 && (
        <section>
          <h4>Réglages DNS attendus chez OVHcloud</h4>
          <table className="expl-dns">
            <thead>
              <tr>
                <th scope="col">Type</th>
                <th scope="col">Sous-domaine</th>
                <th scope="col">Cible</th>
                <th scope="col">
                  <span className="sr-only">État</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {p.dns.map((r, i) => (
                <tr key={i}>
                  <td>{r.type}</td>
                  <td>{r.nom || '(vide)'}</td>
                  <td>
                    <code>{r.valeur}</code>
                  </td>
                  <td className={r.ok ? 'ok' : 'ko'}>{r.ok ? 'OK' : 'À régler'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">État relevé lors de la dernière vérification faite depuis le dossier.</p>
        </section>
      )}
      {p.tech?.length > 0 && (
        <details className="expl-tech">
          <summary>Détails techniques</summary>
          <dl>
            {p.tech.map((t, i) => (
              <div key={i}>
                <dt>{t.label}</dt>
                <dd>{t.valeur}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      <Actions actions={p.actions} onVerifier={onVerifier} verif={verif} />
    </div>
  );
}
