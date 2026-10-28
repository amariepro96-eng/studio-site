'use client';
// Demandes (pages en plus, style…), historique des versions et accès à l'espace
import { useState } from 'react';
import { Section } from './Rubriques.jsx';
import { Zone, Choix, Confirmer, fmtQuand, fmtJour, fmtEuros } from './Champs.jsx';
import { GESTIONS } from '../../../engine/espace.js';
import { copyText } from '../../api.js';

const STATUTS = {
  envoyee: ['Envoyée', 'wait'],
  devis: ['Devis à accepter', 'wait'],
  acceptee: ['En cours', 'ok'],
  refusee: ['Devis refusé', ''],
  livree: ['Terminée', 'ok'],
};

// ---------- Demandes ----------
function LigneDemande({ d, role, owner, nomClient, action, actionAgence, occupe }) {
  const [montant, setMontant] = useState(d.type === 'page' ? '180,00' : '');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [lab, cls] = STATUTS[d.statut] || ['', ''];
  const client = role === 'client';
  const go = async (fn) => {
    setErr('');
    const r = await fn();
    if (r && !r.ok) setErr(r.data?.error || 'L’opération n’a pas abouti. Réessayez.');
  };
  return (
    <li className="esp-dem">
      <div className="esp-dem-tete">
        <b>{d.titre}</b>
        <span className={`tag ${cls}`}>{lab}</span>
      </div>
      {d.texte && <p className="esp-dem-txt">« {d.texte} »</p>}
      <p className="muted small">Envoyée le {fmtQuand(d.envoyee)}</p>
      {d.statut === 'envoyee' && client && <p className="muted small">{owner} vous répond sous 48 h ouvrées, avec un devis si la demande n’est pas comprise dans l’entretien de votre site.</p>}
      {d.statut === 'envoyee' && !client && (
        <div className="esp-dem-rep">
          <label className="esp-euro">
            <span>Devis HT</span>
            <input type="text" inputMode="decimal" maxLength={10} value={montant} onChange={(e) => setMontant(e.target.value)} aria-label="Montant du devis hors taxes" />
            <span>€</span>
          </label>
          <Zone label="Message au client (facultatif)" rows={2} max={600} value={note} onChange={setNote} placeholder="Ce que comprend le devis, le délai…" />
          <div className="row-actions">
            <button type="button" className="btn primary small" disabled={occupe} onClick={() => go(() => actionAgence('devis', { demande: d.id, montant, note }))}>
              Envoyer le devis
            </button>
            <button type="button" className="btn secondary small" disabled={occupe} onClick={() => go(() => actionAgence('devis', { demande: d.id, inclus: true, note }))}>
              Inclus dans l’entretien
            </button>
            <button type="button" className="btn-text small" disabled={occupe} onClick={() => go(() => actionAgence('terminer', { demande: d.id, note }))}>
              Déjà fait
            </button>
          </div>
        </div>
      )}
      {d.statut === 'devis' && (
        <>
          <p>
            Devis : <b>{fmtEuros(d.montant)} HT</b>, envoyé le {fmtQuand(d.devisLe)}.
          </p>
          {d.note && <p className="esp-dem-txt">{d.note}</p>}
          {client ? (
            <div className="row-actions">
              <button type="button" className="btn primary small" disabled={occupe} onClick={() => go(() => action('devis', { demande: d.id, reponse: 'accepter' }))}>
                Accepter le devis
              </button>
              <button type="button" className="btn secondary small" disabled={occupe} onClick={() => go(() => action('devis', { demande: d.id, reponse: 'refuser' }))}>
                Refuser
              </button>
            </div>
          ) : (
            <p className="muted small">En attente de l’accord de {nomClient}.</p>
          )}
        </>
      )}
      {d.statut === 'acceptee' && (
        <>
          <p className="muted small">{d.inclus ? 'Inclus dans l’entretien, sans supplément.' : `Devis de ${fmtEuros(d.montant)} HT accepté le ${fmtQuand(d.accepteeLe)} dans l’espace client : cela vaut accord écrit.`}</p>
          {d.note && <p className="esp-dem-txt">{d.note}</p>}
          {client ? (
            <p className="muted small">{owner} s’en occupe.</p>
          ) : (
            <div className="esp-dem-rep">
              <Zone label="Message au client (facultatif)" rows={2} max={600} value={note} onChange={setNote} placeholder="Ex. : la page est en ligne, dites-moi si un détail vous gêne." />
              <button type="button" className="btn primary small" disabled={occupe} onClick={() => go(() => actionAgence('terminer', { demande: d.id, note }))}>
                Marquer comme terminée
              </button>
            </div>
          )}
        </>
      )}
      {d.statut === 'refusee' && <p className="muted small">Devis refusé le {fmtQuand(d.refuseeLe)}.</p>}
      {d.statut === 'livree' && (
        <>
          <p className="muted small">Terminée le {fmtQuand(d.livreeLe)}.</p>
          {d.reponse && <p className="esp-dem-txt">{d.reponse}</p>}
        </>
      )}
      {err && (
        <p className="q-error" role="alert">
          {err}
        </p>
      )}
    </li>
  );
}

export function Demandes({ srv, action, actionAgence, occupe }) {
  const client = srv.role === 'client';
  const owner = srv.studio.ownerName;
  const pages = srv.pagesPossibles || [];
  const [type, setType] = useState('page');
  const [page, setPage] = useState(pages[0]?.id || 'autre');
  const [texte, setTexte] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  async function envoyer(e) {
    e.preventDefault();
    setErr('');
    setNote('');
    const r = await action('demande', { type, page, texte });
    if (!r.ok) {
      setErr(r.data?.error || 'La demande n’est pas partie. Réessayez.');
      return;
    }
    setTexte('');
    setNote(`Demande envoyée. ${owner} vous répond sous 48 h ouvrées.`);
  }
  return (
    <>
      <Section id="sec-demandes" titre="Demandes" intro={client ? `Une page en plus, un nouveau style, autre chose : écrivez-le ici. Votre demande, le devis de ${owner} et votre accord restent dans votre espace.` : 'Ce que le client demande, avec ton devis et son accord écrit.'}>
        {client && (
          <form className="esp-item esp-form-dem" onSubmit={envoyer}>
            <h3>Demander un changement</h3>
            <Choix
              legende="Votre demande"
              value={type}
              onChange={setType}
              options={[
                { id: 'page', label: 'Ajouter une page' },
                { id: 'style', label: 'Changer le style' },
                { id: 'autre', label: 'Autre chose' },
              ]}
            />
            {type === 'page' && (
              <div className="q-field">
                <label className="q-label" htmlFor="dem-page">
                  Quelle page ?
                </label>
                <select id="dem-page" value={page} onChange={(e) => setPage(e.target.value)}>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="q-hint">Elle sera créée dans le style de votre site et ajoutée au menu de toutes les pages.</p>
              </div>
            )}
            <Zone label={type === 'page' && page !== 'autre' ? 'Précisions (facultatif)' : 'Décrivez ce que vous souhaitez'} rows={3} max={800} value={texte} onChange={setTexte} />
            {err && (
              <p className="q-error" role="alert">
                {err}
              </p>
            )}
            {note && (
              <p className="side-note" role="status">
                {note}
              </p>
            )}
            <div>
              <button type="submit" className="btn primary small" disabled={occupe}>
                Envoyer la demande
              </button>
            </div>
          </form>
        )}
      </Section>
      <Section id="sec-mes-demandes" titre={client ? 'Mes demandes' : 'Demandes reçues'}>
        {srv.demandes.length === 0 ? (
          <p className="muted small">{client ? 'Aucune demande pour le moment.' : 'Aucune demande du client pour le moment.'}</p>
        ) : (
          <ul className="esp-dems">
            {srv.demandes.map((d) => (
              <LigneDemande key={d.id} d={d} role={srv.role} owner={owner} nomClient={srv.nom} action={action} actionAgence={actionAgence} occupe={occupe} />
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

// ---------- Historique ----------
export function Historique({ srv, onAnnuler, occupe, aDesChangements }) {
  const [confirme, setConfirme] = useState(false);
  const client = srv.role === 'client';
  const owner = srv.studio.ownerName;
  const qui = (p) => (p === 'client' ? (client ? 'vous' : srv.nom) : client ? owner : 'toi');
  const vivantes = srv.versions.filter((v) => !v.annulee);
  const courante = vivantes[0];
  const precedente = vivantes[1];
  const limite = srv.publicationsDuJour >= srv.limite;
  return (
    <Section id="sec-historique" titre="Historique" intro={client ? 'Chaque publication est gardée, avec qui l’a faite. Vous pouvez remettre la version précédente à tout moment.' : 'Chaque publication, avec son auteur.'}>
      <ul className="esp-histo">
        {srv.versions.map((v) => {
          const reste = v.resume.length - 4;
          return (
            <li key={`${v.v}-${v.at}`} className={v.annulee ? 'annulee' : ''}>
              <span className="esp-histo-v">v{v.v}</span>
              <div>
                <div className="esp-histo-quand">
                  <span>
                    {v.v === 1 && v.resume[0] === 'Site livré' ? 'Site livré' : 'Publiée'} le {fmtQuand(v.at)}
                    {v.v === 1 && v.resume[0] === 'Site livré' ? '' : ` par ${qui(v.par)}`}
                    {v.validePar ? `, validée par ${qui(v.validePar)}` : ''}
                  </span>
                  {courante && v === courante && !srv.aPublier && <span className="tag ok">En ligne</span>}
                  {courante && v === courante && srv.aPublier && <span className="tag wait">En attente de mise en ligne</span>}
                  {v.annulee && <span className="tag">Retirée</span>}
                </div>
                {!(v.v === 1 && v.resume[0] === 'Site livré') && (
                  <ul className="esp-histo-resume">
                    {v.resume.slice(0, 4).map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                    {reste > 0 && <li>et {reste} autre{reste > 1 ? 's' : ''} changement{reste > 1 ? 's' : ''}</li>}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {srv.peutModifier && (
        <div className="esp-histo-undo">
          <Confirmer
            label="Remettre la version précédente"
            question={precedente ? `Remettre la v${precedente.v} en ligne ?${aDesChangements ? ' Vos changements non publiés seront perdus.' : ''}` : ''}
            oui="Remettre"
            className="btn secondary small"
            ouvert={confirme}
            setOuvert={setConfirme}
            disabled={!precedente || occupe || limite}
            onConfirm={onAnnuler}
          />
          <p className="q-hint">{!precedente ? 'Disponible après votre première publication.' : limite ? `Limite de ${srv.limite} publications aujourd’hui atteinte.` : `Publications aujourd’hui : ${srv.publicationsDuJour} sur ${srv.limite}.`}</p>
        </div>
      )}
    </Section>
  );
}

// ---------- Mon accès ----------
export function Acces({ srv, action, occupe, onDeconnexion }) {
  const client = srv.role === 'client';
  const owner = srv.studio.ownerName;
  const [lien, setLien] = useState(null);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [retrait, setRetrait] = useState(null);
  async function changer(gestion, validation) {
    setErr('');
    const r = await action('gestion', { gestion, validation });
    if (!r.ok) setErr(r.data?.error || 'Le réglage n’a pas été changé. Réessayez.');
    else setNote(gestion === 'client' ? `${owner} n’a plus accès à vos rubriques.` : gestion === 'prestataire' ? `${owner} fait maintenant vos mises à jour.` : `${owner} peut maintenant faire vos mises à jour.`);
  }
  async function nouvelAppareil() {
    setErr('');
    const r = await action('appareil', {});
    if (!r.ok) setErr(r.data?.error || 'Le lien n’a pas pu être créé.');
    else setLien(r.data);
  }
  async function copier() {
    const ok = await copyText(lien.lien);
    setNote(ok ? 'Lien copié.' : 'Copie impossible : sélectionnez le lien à la main.');
  }
  return (
    <>
      <Section id="sec-gestion" titre={client ? 'Qui s’occupe de votre site ?' : 'Réglage choisi par le client'} intro={client ? 'Le site et le nom de domaine restent à vous quel que soit votre choix. Vous pouvez changer d’avis à tout moment.' : 'Seul le client peut changer ce réglage, depuis son espace.'}>
        {client ? (
          <>
            <div className="esp-gestion" role="radiogroup" aria-label="Qui s’occupe du site">
              {Object.entries(GESTIONS).map(([k, g]) => (
                <label key={k} className={srv.gestion === k ? 'on' : ''}>
                  <input type="radio" name="gestion" value={k} checked={srv.gestion === k} disabled={occupe} onChange={() => changer(k, k === 'client' ? false : srv.validation)} />
                  <span>
                    <b>{g.titre}</b>
                    <small>{g.texte(owner)}</small>
                  </span>
                </label>
              ))}
            </div>
            {srv.gestion !== 'client' && (
              <label className="q-toggle compact">
                <input type="checkbox" checked={srv.validation} disabled={occupe} onChange={(e) => changer(srv.gestion, e.target.checked)} />
                <span>
                  <span className="q-option-title">Me demander de valider chaque publication de {owner}</span>
                  <span className="q-option-hint">Ses changements vous attendent dans votre espace : vous les regardez, puis vous validez ou refusez.</span>
                </span>
              </label>
            )}
          </>
        ) : (
          <p className="esp-avis">
            <b>{GESTIONS[srv.gestion].titre}</b>
            {srv.validation ? ' · le client valide chacune de tes publications' : ''}. {srv.gestion === 'client' ? 'Tu peux répondre à ses demandes ; ses rubriques sont en lecture seule.' : 'Tu peux modifier son site depuis cet espace.'}
          </p>
        )}
      </Section>

      <Section id="sec-appareils" titre={client ? 'Vos appareils' : 'Appareils du client'} intro={client ? 'Les appareils où votre espace s’ouvre sans lien. Retirez celui que vous n’utilisez plus, ou qui a été perdu.' : ''}>
        {srv.appareils.length === 0 ? (
          <p className="muted small">Aucun appareil connecté.</p>
        ) : (
          <ul className="esp-appareils">
            {srv.appareils.map((a) => (
              <li key={a.id}>
                <span>
                  <b>{a.nom}</b>
                  {a.actuel && <span className="tag ok">Cet appareil</span>}
                  <small>
                    Ajouté le {fmtJour(a.creeLe)} · dernière visite le {fmtJour(a.vuLe)}
                  </small>
                </span>
                {client && !a.actuel && (
                  <Confirmer label="Retirer" question={`Retirer ${a.nom} ?`} oui="Retirer" className="btn-text small quiet" ouvert={retrait === a.id} setOuvert={(o) => setRetrait(o ? a.id : null)} onConfirm={() => action('retirerAppareil', { appareil: a.id })} />
                )}
              </li>
            ))}
          </ul>
        )}
        {client && (
          <div className="esp-item">
            <h3>Ouvrir votre espace sur un autre appareil</h3>
            {lien ? (
              <>
                <div className="linkline">
                  <input type="text" readOnly value={lien.lien} aria-label="Lien pour un autre appareil" onFocus={(e) => e.target.select()} />
                  <button type="button" className="btn secondary small" onClick={copier}>
                    Copier
                  </button>
                </div>
                <p className="q-hint">Envoyez-vous ce lien (SMS, e-mail) et ouvrez-le sur l’autre appareil. Il ne sert qu’une fois et expire à {new Date(lien.exp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Ne le donnez à personne.</p>
              </>
            ) : (
              <>
                <p className="q-hint">Un lien personnel, valable 15 minutes, à ouvrir sur votre téléphone ou un autre ordinateur.</p>
                <div>
                  <button type="button" className="btn secondary small" onClick={nouvelAppareil} disabled={occupe}>
                    Créer le lien
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {client && (
          <p className="muted small">
            {srv.mail && srv.email ? `Appareil perdu ou changé ? Depuis la page de connexion, demandez un lien : il part à ${srv.email}.` : `Appareil perdu ou changé ? Demandez un nouveau lien à ${owner}.`}
          </p>
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
      </Section>

      <Section id="sec-journal" titre="Journal des accès">
        <ul className="esp-journal">
          {srv.journal.map((j, i) => (
            <li key={i}>
              <time dateTime={j.at}>{fmtQuand(j.at)}</time>
              <span>{j.txt}</span>
            </li>
          ))}
        </ul>
      </Section>

      {client && (
        <div className="esp-deco">
          <button type="button" className="btn secondary small" onClick={onDeconnexion} disabled={occupe}>
            Se déconnecter de cet appareil
          </button>
          <p className="q-hint">Sur un ordinateur partagé, déconnectez-vous en partant.</p>
        </div>
      )}
    </>
  );
}
