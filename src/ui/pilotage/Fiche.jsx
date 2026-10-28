'use client';
// Fiche rapide d'un client, ouverte depuis sa tuile : état, problèmes expliqués, infos clés,
// et les accès directs (modifier le site, voir le site, dossier, facturation).
import { useRef, useState } from 'react';
import Explication, { NIVEAUX, ETATS, depuisTexte } from './Explication.jsx';
import { useDialogue } from './Bulle.jsx';
import { timeAgo } from '../../engine/records.js';
import { euros } from '../../engine/finances.js';

const sansProto = (u) => String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

function Probleme({ p, ouvert, onToggle, onVerifier, verif }) {
  return (
    <li className={`fiche-pb niveau-${p.niveau}`}>
      <button type="button" className="fiche-pb-tete" aria-expanded={ouvert} onClick={onToggle}>
        <span className={`niveau-pill niveau-${p.niveau}`}>{NIVEAUX[p.niveau]?.court}</span>
        <span className="fiche-pb-titre">
          <strong>{p.titre}</strong>
          <span className="muted small">{p.resume}</span>
          {p.depuis && p.niveau !== 'travaux' && <span className="muted small">{depuisTexte(p.depuis)}</span>}
        </span>
        <span className="fiche-pb-chevron" aria-hidden="true" />
      </button>
      {ouvert && p.niveau !== 'travaux' && <Explication p={p} onVerifier={onVerifier} verif={verif} />}
    </li>
  );
}

export default function Fiche({ site, onClose, onVerifier, verif, problemeOuvert }) {
  const ref = useRef(null);
  const [ouvert, setOuvert] = useState(problemeOuvert || null);
  useDialogue(ref, onClose);
  const e = site.espace;
  const pbs = site.problemes || [];

  let modifier;
  if (!e)
    modifier = {
      href: `/agence/clients/${site.id}`,
      label: 'Ouvrir le dossier',
      note: site.etat === 'prepa' ? 'Le site n’est pas encore en ligne : tout se passe dans le dossier.' : 'L’espace client n’est pas encore créé : dossier › bloc « Espace client ». En attendant, les changements se font depuis le dossier.',
    };
  else if (e.peutModifier)
    modifier = {
      href: `/espace/${site.id}?vue=agence`,
      label: 'Modifier le site',
      primaire: true,
      note: `Réglage du client : « ${e.gestionLabel} »${e.validation ? '. Chacune de tes publications attend sa validation.' : '.'}`,
    };
  else
    modifier = {
      href: `/espace/${site.id}?vue=agence`,
      label: 'Ouvrir son espace (lecture seule)',
      verrou: true,
      note: 'Le client a choisi « Je m’en occupe » : tu vois son espace et réponds à ses demandes, sans modifier ses rubriques. Pour te confier les mises à jour, il choisit « À deux » ou « Mon prestataire s’en occupe » dans son espace (« Qui s’occupe de votre site ? »).',
    };

  return (
    <>
      <div className="feuille-fond" onClick={onClose} aria-hidden="true" />
      <aside ref={ref} className="feuille" role="dialog" aria-modal="true" aria-labelledby="fiche-titre" tabIndex={-1}>
        <div className="feuille-tete">
          <div>
            <span className={`etat-pill etat-${site.etat}`}>{ETATS[site.etat]}</span>
            <h2 id="fiche-titre">{site.nom}</h2>
            {site.url && site.etat !== 'prepa' && (
              <a className="small" href={site.url} target="_blank" rel="noopener noreferrer">
                {sansProto(site.url)} <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
          <button type="button" className="icon-btn" aria-label="Fermer la fiche" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="feuille-corps">
          <div className="fiche-acces">
            <a className={`btn ${modifier.primaire ? 'primary' : 'secondary'} block${modifier.verrou ? ' verrou' : ''}`} href={modifier.href}>
              {modifier.label}
            </a>
            <p className="muted small">{modifier.note}</p>
            <div className="fiche-liens">
              {site.url && site.etat !== 'prepa' && (
                <a className="btn secondary small" href={site.url} target="_blank" rel="noopener noreferrer">
                  Voir le site ↗
                </a>
              )}
              {modifier.href !== `/agence/clients/${site.id}` && (
                <a className="btn secondary small" href={`/agence/clients/${site.id}`}>
                  Dossier complet
                </a>
              )}
              <a className="btn secondary small" href={`/pilotage/finances?client=${site.id}`}>
                Facturation
              </a>
            </div>
          </div>

          {pbs.length > 0 ? (
            <section className="fiche-section">
              <h3>{pbs.length > 1 ? `${pbs.length} points à regarder` : 'Point à regarder'}</h3>
              <ul className="fiche-pbs">
                {pbs.map((p) => (
                  <Probleme key={p.id} p={p} ouvert={ouvert === p.id} onToggle={() => setOuvert((o) => (o === p.id ? null : p.id))} onVerifier={onVerifier} verif={verif} />
                ))}
              </ul>
            </section>
          ) : site.etat === 'ok' ? (
            <p className="fiche-ok">Tout va bien : le site répond{site.mesure?.ms ? ` en ${(site.mesure.ms / 1000).toFixed(1).replace('.', ',')} s` : ''} et la dernière mise en ligne est réussie.</p>
          ) : null}

          <section className="fiche-section">
            <h3>Le site</h3>
            <dl className="fiche-infos">
              {site.etat === 'prepa' ? (
                <>
                  <div>
                    <dt>Étape</dt>
                    <dd>{site.etape}</dd>
                  </div>
                  <div>
                    <dt>{site.tour === 'agence' ? 'À toi' : 'En attente'}</dt>
                    <dd>{site.prochaine}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt>Domaine</dt>
                    <dd>{site.domaine || (site.urlProvisoire ? `Pas encore (adresse provisoire ${sansProto(site.urlProvisoire)})` : sansProto(site.url))}</dd>
                  </div>
                  <div>
                    <dt>Version en ligne</dt>
                    <dd>{site.version ? `v${site.version}${site.publieLe ? `, publiée ${timeAgo(site.publieLe)}` : ''}` : site.projetVercel ? '—' : 'Mise en ligne à la main'}</dd>
                  </div>
                  {site.mesure && (
                    <div>
                      <dt>Dernière vérification</dt>
                      <dd>{site.mesure.ok ? `Répond en ${site.mesure.ms} ms` : 'Ne répond pas normalement'}</dd>
                    </div>
                  )}
                </>
              )}
              <div>
                <dt>Espace client</dt>
                <dd>{e ? `${e.gestionLabel}${e.demandes ? ` · ${e.demandes} demande${e.demandes > 1 ? 's' : ''} à traiter` : ''}` : 'Pas encore créé'}</dd>
              </div>
            </dl>
          </section>

          <section className="fiche-section">
            <h3>Client</h3>
            <dl className="fiche-infos">
              <div>
                <dt>Formule</dt>
                <dd>{site.formule || 'Pas encore définie'}</dd>
              </div>
              <div>
                <dt>Abonnement</dt>
                <dd>{site.finances?.mensuel ? `${euros(site.finances.mensuel)} par mois` : 'Aucun en cours'}</dd>
              </div>
              {site.finances?.retard > 0 && (
                <div className="ko">
                  <dt>En retard</dt>
                  <dd>{euros(site.finances.retard)}</dd>
                </div>
              )}
              {site.contact && (
                <div>
                  <dt>Contact</dt>
                  <dd>{site.contact}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </aside>
    </>
  );
}
