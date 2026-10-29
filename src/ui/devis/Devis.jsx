'use client';
// Onglet Devis : liste, fiche d'un devis (envoi, réponses du client) et rédaction
import { useEffect, useMemo, useState } from 'react';
import Document from './Document.jsx';
import { Pastille, Fenetre, ChampEuros, LienCree, fmtJour, fmtQuand } from './commun.jsx';
import { vueDevis, statutDevis } from './vues.js';
import { euros, totaux, lireQuantite, formatQuantite, TAUX_TVA, UNITES, manquesDevis, nettoyerClient, ligneHT } from '../../engine/devis.js';

const CLOS = ['accepte', 'refuse', 'annule'];
const FILTRES = [
  ['tous', 'Tous'],
  ['suivre', 'À suivre'],
  ['brouillons', 'Brouillons'],
  ['acceptes', 'Acceptés'],
  ['clos', 'Refusés, annulés, expirés'],
];
const dansFiltre = (f, d, st) =>
  f === 'tous' ||
  (f === 'suivre' && (['envoye', 'vu', 'modification'].includes(st) || d.aRenvoyer)) ||
  (f === 'brouillons' && st === 'brouillon') ||
  (f === 'acceptes' && st === 'accepte') ||
  (f === 'clos' && ['refuse', 'annule', 'expire'].includes(st));

function estInstallee() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

function CarteInstaller({ aller }) {
  const [voir, setVoir] = useState(false);
  useEffect(() => {
    let ferme = false;
    try {
      ferme = window.localStorage.getItem('dv-installer-ferme') === '1';
    } catch {}
    setVoir(!estInstallee() && !ferme);
  }, []);
  if (!voir) return null;
  return (
    <div className="dv-carte-info">
      <span>
        <strong>Installez l’appli sur votre téléphone</strong> : une icône sur l’écran d’accueil, en plein écran.
      </span>
      <span className="dv-carte-actions">
        <button type="button" className="btn-text small" onClick={() => aller({ onglet: 'reglages', section: 'installer' })}>
          Comment faire
        </button>
        <button
          type="button"
          className="icon-btn small"
          aria-label="Masquer"
          onClick={() => {
            try {
              window.localStorage.setItem('dv-installer-ferme', '1');
            } catch {}
            setVoir(false);
          }}
        >
          ×
        </button>
      </span>
    </div>
  );
}

// ---------- Liste ----------
function Liste({ data, aller }) {
  const [filtre, setFiltre] = useState('tous');
  const [q, setQ] = useState('');
  const jour = data.jour;
  const tous = useMemo(() => [...data.devis].sort((a, b) => String(b.modifieLe || b.creeLe).localeCompare(String(a.modifieLe || a.creeLe))), [data.devis]);
  const cherche = q.trim().toLowerCase();
  const liste = tous.filter((d) => {
    const st = statutDevis(d, jour);
    if (!dansFiltre(filtre, d, st)) return false;
    if (!cherche) return true;
    return [d.numero, d.client?.nom, d.objet].some((x) => String(x || '').toLowerCase().includes(cherche));
  });
  const compte = (f) => tous.filter((d) => dansFiltre(f, d, statutDevis(d, jour))).length;
  return (
    <section className="dv-page">
      <div className="dv-page-tete">
        <h1>Devis</h1>
        <button type="button" className="btn primary" onClick={() => aller({ onglet: 'devis', ecran: 'edition', id: null })}>
          + Nouveau devis
        </button>
      </div>
      {data.manques.length > 0 && (
        <div className="dv-carte-info attention">
          <span>
            Avant d’envoyer vos devis, complétez <strong>Réglages › Entreprise</strong> : {data.manques.join(', ')}.
          </span>
          <button type="button" className="btn-text small" onClick={() => aller({ onglet: 'reglages', section: 'entreprise' })}>
            Compléter
          </button>
        </div>
      )}
      <CarteInstaller aller={aller} />
      {tous.length > 0 && (
        <>
          <div className="dv-filtres" role="group" aria-label="Filtrer les devis">
            {FILTRES.map(([id, label]) => {
              const n = compte(id);
              if (id !== 'tous' && !n) return null;
              return (
                <button key={id} type="button" aria-pressed={filtre === id} onClick={() => setFiltre(id)}>
                  {label} <span className="count">{n}</span>
                </button>
              );
            })}
          </div>
          <input className="dv-recherche" type="search" placeholder="Rechercher un client, un numéro, un objet" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        </>
      )}
      {liste.length ? (
        <ul className="dv-liste">
          {liste.map((d) => {
            const st = statutDevis(d, jour);
            return (
              <li key={d.id}>
                <button type="button" className="dv-item" onClick={() => aller({ onglet: 'devis', ecran: 'detail', id: d.id })}>
                  <span className="dv-item-haut">
                    <span className="dv-item-num">{d.numero}</span>
                    <Pastille statut={st} />
                    {d.aRenvoyer && !CLOS.includes(d.statut) && <span className="dv-pastille ton-attention">À renvoyer</span>}
                  </span>
                  <span className="dv-item-nom">{d.client?.nom || 'Client à indiquer'}</span>
                  {d.objet && <span className="dv-item-objet">{d.objet}</span>}
                  <span className="dv-item-bas">
                    <span className="muted small">{d.envoi ? `Envoyé le ${fmtJour(d.envoi.date)}` : `Créé le ${fmtJour(String(d.creeLe).slice(0, 10))}`}</span>
                    <strong>{euros(vueDevis(d, data.entreprise).totaux.ttc)}</strong>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="dv-vide">
          {tous.length ? (
            <p>Aucun devis ne correspond.</p>
          ) : (
            <>
              <p>
                <strong>Aucun devis pour le moment.</strong>
              </p>
              <p className="muted">Créez votre premier devis : choisissez vos produits et vos prestations, l’appli calcule les totaux et la TVA. {data.produits.length ? '' : 'Astuce : enregistrez d’abord vos produits et vos prix dans Réglages.'}</p>
              {!data.produits.length && (
                <button type="button" className="btn secondary" onClick={() => aller({ onglet: 'reglages', section: 'produits' })}>
                  Enregistrer mes produits et prix
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ---------- Envoi ----------
function FenetreEnvoi({ d, data, agir, onClose, aller }) {
  const [email, setEmail] = useState(d.client?.email || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lien, setLien] = useState(null);
  const manques = manquesDevis(d);
  const sujet = `Devis ${d.numero}${d.objet ? ` : ${d.objet}` : ''}`;
  const texteLien = `Bonjour,\n\nVoici notre devis ${d.numero}${d.objet ? ` pour « ${d.objet} »` : ''}. Vous pouvez le consulter, l’accepter en ligne, demander une modification ou le refuser ici :`;
  async function envoyer(action) {
    setBusy(true);
    setErr('');
    try {
      const r = await agir({ action, id: d.id, email: email.trim(), message: message.trim() });
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
  return (
    <Fenetre titre={d.envoi ? `Renvoyer le devis ${d.numero}` : `Envoyer le devis ${d.numero}`} onClose={onClose}>
      {lien ? (
        <LienCree lien={lien} sujet={sujet} texte={texteLien} email={email} />
      ) : data.manques.length || manques.length ? (
        <>
          <p className="q-error">
            {manques.length ? `Avant l’envoi, ajoutez ${manques.join(', ')}.` : ''} {data.manques.length ? `Complétez Réglages › Entreprise : ${data.manques.join(', ')}. Ces mentions sont obligatoires sur un devis.` : ''}
          </p>
          {data.manques.length > 0 && (
            <button type="button" className="btn primary" onClick={() => (onClose(), aller({ onglet: 'reglages', section: 'entreprise' }))}>
              Compléter mon entreprise
            </button>
          )}
        </>
      ) : (
        <>
          <p className="muted small">
            Le client reçoit un lien vers le devis. Il peut l’<strong>accepter en ligne</strong>, <strong>demander une modification</strong> ou le <strong>refuser</strong> : vous êtes prévenu par e-mail et ici.
            {d.envoi ? ' Le lien envoyé avant ne fonctionnera plus.' : ''}
          </p>
          {data.mail && (
            <>
              <div className="q-field">
                <label className="q-label" htmlFor="dv-envoi-email">
                  E-mail du client
                </label>
                <input id="dv-envoi-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" />
              </div>
              <div className="q-field">
                <label className="q-label" htmlFor="dv-envoi-msg">
                  Message (facultatif)
                </label>
                <p className="q-hint">Sinon : « Voici notre devis {d.numero}… » avec le montant, le lien et la date de validité.</p>
                <textarea id="dv-envoi-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
              </div>
            </>
          )}
          {err && (
            <p className="q-error" role="alert">
              {err}
            </p>
          )}
          <div className="row-actions">
            {data.mail && (
              <button type="button" className="btn primary" disabled={busy || !email.trim()} onClick={() => envoyer('devis.envoyer')}>
                {busy ? 'Envoi…' : 'Envoyer par e-mail'}
              </button>
            )}
            <button type="button" className={data.mail ? 'btn secondary' : 'btn primary'} disabled={busy} onClick={() => envoyer('devis.lien')}>
              {data.mail ? 'Créer un lien à envoyer moi-même' : 'Créer le lien à envoyer'}
            </button>
          </div>
        </>
      )}
    </Fenetre>
  );
}

// ---------- Fiche d'un devis ----------
function Detail({ data, agir, aller, id }) {
  const d = data.devis.find((x) => x.id === id);
  const [fenetre, setFenetre] = useState(null);
  const [nomAccord, setNomAccord] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!d)
    return (
      <section className="dv-page">
        <button type="button" className="back" onClick={() => aller({ onglet: 'devis' })}>
          Devis
        </button>
        <p>Ce devis n’existe plus.</p>
      </section>
    );
  const st = statutDevis(d, data.jour);
  const clos = CLOS.includes(d.statut);
  const doc = vueDevis(d, data.entreprise);
  async function faire(action, extra = {}, apres) {
    setBusy(true);
    setErr('');
    try {
      const r = await agir({ action, id: d.id, ...extra });
      setFenetre(null);
      if (apres) apres(r);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  const r = d.reponse;
  return (
    <section className="dv-page dv-fiche">
      <button type="button" className="back dv-noprint" onClick={() => aller({ onglet: 'devis' })}>
        Devis
      </button>
      <div className="dv-page-tete dv-noprint">
        <div>
          <h1>Devis {d.numero}</h1>
          <p className="dv-sous">
            <Pastille statut={st} /> {d.client?.nom}
            {d.envoi ? ` · version ${d.envoi.version} envoyée le ${fmtJour(d.envoi.date)}` : ''}
          </p>
        </div>
      </div>

      <div className="dv-bandeaux dv-noprint">
        {d.statut === 'modification' && r && (
          <div className="dv-bandeau attention">
            <strong>Le client demande une modification</strong> ({fmtQuand(r.at)})
            <blockquote className="dv-pre">{r.message}</blockquote>
            <span>Modifiez le devis, puis renvoyez-le : le client recevra la nouvelle version.</span>
          </div>
        )}
        {d.statut === 'accepte' && r && (
          <div className="dv-bandeau ok">
            <strong>
              Accepté {r.horsLigne ? 'hors ligne' : 'en ligne'} par {r.nom}
            </strong>
            , le {fmtQuand(r.at)}.
            {r.message && <blockquote className="dv-pre">{r.message}</blockquote>}
            {d.factureId && (
              <button type="button" className="btn primary small" onClick={() => aller({ onglet: 'factures', ecran: 'detail', id: d.factureId })}>
                Voir la facture
              </button>
            )}
          </div>
        )}
        {d.statut === 'refuse' && r && (
          <div className="dv-bandeau ko">
            <strong>Refusé par le client</strong> ({fmtQuand(r.at)})
            {r.message && <blockquote className="dv-pre">{r.message}</blockquote>}
          </div>
        )}
        {d.statut === 'annule' && <div className="dv-bandeau">Devis annulé : le client voit qu’il n’est plus valable.</div>}
        {st === 'expire' && <div className="dv-bandeau attention">Date de validité dépassée : le client ne peut plus l’accepter. Modifiez-le et renvoyez-le, ou dupliquez-le.</div>}
        {d.aRenvoyer && !clos && <div className="dv-bandeau attention">Modifié depuis l’envoi : le client voit encore la version {d.envoi?.version}. Renvoyez-le pour qu’il voie vos changements.</div>}
        {d.statut === 'vu' && d.vuLe && <div className="dv-bandeau info">Consulté par le client le {fmtQuand(d.vuLe)}. En attente de sa réponse.</div>}
        {d.statut === 'envoye' && <div className="dv-bandeau info">Envoyé, pas encore consulté par le client.</div>}
      </div>

      <div className="dv-actions dv-noprint">
        {!clos && (
          <button type="button" className="btn primary" onClick={() => setFenetre('envoi')}>
            {d.envoi ? 'Renvoyer au client' : 'Envoyer au client'}
          </button>
        )}
        {!clos && (
          <button type="button" className="btn secondary" onClick={() => aller({ onglet: 'devis', ecran: 'edition', id: d.id })}>
            Modifier
          </button>
        )}
        <button type="button" className="btn secondary" onClick={() => window.print()}>
          Imprimer / PDF
        </button>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => faire('devis.dupliquer', {}, (x) => aller({ onglet: 'devis', ecran: 'detail', id: x.id }))}>
          Dupliquer
        </button>
        {!clos && (
          <button type="button" className="btn-text small" onClick={() => setFenetre('accord')}>
            Marquer accepté (accord signé ou par téléphone)
          </button>
        )}
        {!clos && d.envoi && (
          <button type="button" className="btn-text small danger" onClick={() => setFenetre('annuler')}>
            Annuler le devis
          </button>
        )}
        {d.statut === 'brouillon' && !d.envoi && (
          <button type="button" className="btn-text small danger" onClick={() => setFenetre('supprimer')}>
            Supprimer le brouillon
          </button>
        )}
      </div>
      {err && (
        <p className="q-error dv-noprint" role="alert">
          {err}
        </p>
      )}

      <Document doc={doc} />

      {(d.historique || []).length > 0 && (
        <details className="dv-historique dv-noprint">
          <summary>Historique</summary>
          <ol>
            {[...d.historique].reverse().map((h, i) => (
              <li key={i}>
                <span>{h.txt}</span>
                <time className="muted">{fmtQuand(h.at)}</time>
              </li>
            ))}
          </ol>
        </details>
      )}

      {fenetre === 'envoi' && <FenetreEnvoi d={d} data={data} agir={agir} aller={aller} onClose={() => setFenetre(null)} />}
      {fenetre === 'accord' && (
        <Fenetre titre="Marquer le devis accepté" onClose={() => setFenetre(null)}>
          <p className="muted small">Le client a signé le devis papier ou vous a donné son accord : la facture correspondante est préparée dans l’onglet Factures.</p>
          <div className="q-field">
            <label className="q-label" htmlFor="dv-accord-nom">
              Nom de la personne qui a donné son accord
            </label>
            <input id="dv-accord-nom" type="text" value={nomAccord} onChange={(e) => setNomAccord(e.target.value)} placeholder={d.client?.nom || ''} />
          </div>
          {err && <p className="q-error">{err}</p>}
          <div className="row-actions">
            <button type="button" className="btn primary" disabled={busy} onClick={() => faire('devis.accepter', { nom: nomAccord || d.client?.nom })}>
              Marquer accepté
            </button>
          </div>
        </Fenetre>
      )}
      {fenetre === 'annuler' && (
        <Fenetre titre="Annuler ce devis ?" onClose={() => setFenetre(null)}>
          <p>Le client ne pourra plus l’accepter : son lien affichera « devis annulé ». Vous pourrez toujours le dupliquer.</p>
          <div className="row-actions">
            <button type="button" className="btn primary danger" disabled={busy} onClick={() => faire('devis.annuler')}>
              Annuler le devis
            </button>
            <button type="button" className="btn secondary" onClick={() => setFenetre(null)}>
              Garder
            </button>
          </div>
        </Fenetre>
      )}
      {fenetre === 'supprimer' && (
        <Fenetre titre="Supprimer ce brouillon ?" onClose={() => setFenetre(null)}>
          <p>Le brouillon {d.numero} sera effacé.</p>
          <div className="row-actions">
            <button type="button" className="btn primary danger" disabled={busy} onClick={() => faire('devis.supprimer', {}, () => aller({ onglet: 'devis' }, { remplacer: true }))}>
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

// ---------- Rédaction ----------
let cle = 0;
const versLigne = (l) => ({ k: ++cle, produitId: l.produitId || '', designation: l.designation || '', description: l.description || '', qte: l.quantite ? formatQuantite(l.quantite).replace(/\s/g, '') : '1', unite: l.unite || 'u', prixHT: l.prixHT || 0, tva: l.tva ?? 2000, detail: Boolean(l.description) });

function ChoixProduits({ produits, onAjout, onClose, aller }) {
  const [q, setQ] = useState('');
  const [ajoutes, setAjoutes] = useState(0);
  const c = q.trim().toLowerCase();
  const liste = produits.filter((p) => !c || [p.nom, p.ref, p.categorie, p.description].some((x) => String(x || '').toLowerCase().includes(c)));
  return (
    <Fenetre titre="Ajouter depuis mes produits" onClose={onClose}>
      {produits.length ? (
        <>
          <input className="dv-recherche" type="search" placeholder="Rechercher un produit, une référence" value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="Rechercher un produit" />
          <ul className="dv-choix">
            {liste.slice(0, 200).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAjout(p);
                    setAjoutes((n) => n + 1);
                  }}
                >
                  <span>
                    <strong>{p.nom}</strong>
                    {p.ref && <span className="muted small"> · {p.ref}</span>}
                    {p.description && <span className="dv-choix-desc">{p.description}</span>}
                  </span>
                  <span className="dv-choix-prix">
                    {euros(p.prixHT)}
                    <small> HT/{p.unite}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!liste.length && <p className="muted">Aucun produit ne correspond.</p>}
          <div className="row-actions dv-choix-pied">
            <span className="muted small">{ajoutes ? `${ajoutes} ligne${ajoutes > 1 ? 's' : ''} ajoutée${ajoutes > 1 ? 's' : ''}` : 'Touchez un produit pour l’ajouter'}</span>
            <button type="button" className="btn primary" onClick={onClose}>
              Terminé
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Vous n’avez pas encore de produits enregistrés.</p>
          <p className="muted small">Enregistrez une fois vos produits, prestations et prix : ensuite, un devis se fait en quelques touches.</p>
          <button type="button" className="btn primary" onClick={() => (onClose(), aller({ onglet: 'reglages', section: 'produits' }))}>
            Enregistrer mes produits
          </button>
        </>
      )}
    </Fenetre>
  );
}

function Editeur({ data, agir, aller, garde, id }) {
  const d = id ? data.devis.find((x) => x.id === id) : null;
  const e = data.entreprise;
  const [client, setClient] = useState(() => nettoyerClient(d?.client));
  const [objet, setObjet] = useState(d?.objet || '');
  const [lignes, setLignes] = useState(() => (d?.lignes || []).map(versLigne));
  const [validite, setValidite] = useState(String(d?.validiteJours ?? e.validiteJours ?? 30));
  const [acompte, setAcompte] = useState(String(d?.acomptePct ?? e.acomptePct ?? 0));
  const [notes, setNotes] = useState(d?.notes || '');
  const [choix, setChoix] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [modifie, setModifie] = useState(false);
  useEffect(() => {
    garde.current = modifie || null;
    return () => {
      garde.current = null;
    };
  }, [modifie, garde]);
  const changer = (fn) => (...args) => {
    setModifie(true);
    fn(...args);
  };

  // Clients déjà rencontrés : remplissage automatique
  const connus = useMemo(() => {
    const m = new Map();
    for (const x of [...data.devis].sort((a, b) => String(a.modifieLe).localeCompare(String(b.modifieLe)))) if (x.client?.nom) m.set(x.client.nom.trim().toLowerCase(), x.client);
    return m;
  }, [data.devis]);
  function setNomClient(nom) {
    const c = connus.get(nom.trim().toLowerCase());
    if (c && !client.email && !client.adresse && !client.telephone) setClient({ ...c, nom });
    else setClient({ ...client, nom });
  }

  const majLigne = (k, patch) => setLignes((ls) => ls.map((l) => (l.k === k ? { ...l, ...patch } : l)));
  const deplacer = (i, sens) =>
    setLignes((ls) => {
      const j = i + sens;
      if (j < 0 || j >= ls.length) return ls;
      const n = [...ls];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const ajouterProduit = (p) => {
    setModifie(true);
    setLignes((ls) => [...ls, versLigne({ produitId: p.id, designation: p.nom, description: p.description, quantite: 1, unite: p.unite, prixHT: p.prixHT, tva: p.tva })]);
  };

  const lignesCalc = lignes.map((l) => ({ ...l, quantite: lireQuantite(l.qte) || 0 }));
  const acomptePct = Math.min(100, Math.max(0, parseInt(acompte, 10) || 0));
  const t = totaux(lignesCalc, { franchise: e.franchise, acomptePct });

  async function enregistrer() {
    setErr('');
    const mauvaise = lignes.findIndex((l) => !lireQuantite(l.qte));
    if (mauvaise >= 0) return setErr(`Quantité invalide à la ligne ${mauvaise + 1} : écrivez par exemple 2 ou 2,5.`);
    const vide = lignes.findIndex((l) => !l.designation.trim());
    if (vide >= 0) return setErr(`Indiquez la désignation de la ligne ${vide + 1}.`);
    if (!client.nom.trim()) return setErr('Indiquez le nom du client.');
    setBusy(true);
    try {
      const r = await agir({
        action: 'devis.enregistrer',
        devis: {
          id: d?.id,
          client,
          objet,
          lignes: lignes.map((l) => ({ produitId: l.produitId, designation: l.designation, description: l.detail ? l.description : '', quantite: lireQuantite(l.qte), unite: l.unite, prixHT: l.prixHT, tva: l.tva })),
          validiteJours: parseInt(validite, 10) || e.validiteJours,
          acomptePct,
          notes,
        },
      });
      setModifie(false);
      garde.current = null;
      aller({ onglet: 'devis', ecran: 'detail', id: r.id }, { remplacer: Boolean(d) });
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  }

  return (
    <section className="dv-page dv-editeur">
      <button type="button" className="back" onClick={() => aller(d ? { onglet: 'devis', ecran: 'detail', id: d.id } : { onglet: 'devis' })}>
        {d ? `Devis ${d.numero}` : 'Devis'}
      </button>
      <div className="dv-page-tete">
        <h1>{d ? `Modifier le devis ${d.numero}` : 'Nouveau devis'}</h1>
      </div>
      {d?.envoi && <p className="note small">Ce devis a déjà été envoyé (version {d.envoi.version}). Vos changements ne seront visibles par le client qu’après l’avoir renvoyé.</p>}

      <fieldset className="card dv-bloc">
        <legend>Client</legend>
        <div className="dv-grille">
          <div className="q-field">
            <label className="q-label" htmlFor="dv-c-nom">
              Nom ou raison sociale *
            </label>
            <input id="dv-c-nom" type="text" list="dv-clients" value={client.nom} onChange={(x) => changer(setNomClient)(x.target.value)} autoComplete="off" />
            <datalist id="dv-clients">
              {[...connus.values()].map((c) => (
                <option key={c.nom} value={c.nom} />
              ))}
            </datalist>
          </div>
          <div className="q-field">
            <label className="q-label" htmlFor="dv-c-contact">
              À l’attention de
            </label>
            <input id="dv-c-contact" type="text" value={client.contact} onChange={(x) => changer(setClient)({ ...client, contact: x.target.value })} placeholder="Facultatif" />
          </div>
          <div className="q-field">
            <label className="q-label" htmlFor="dv-c-email">
              E-mail
            </label>
            <input id="dv-c-email" type="email" value={client.email} onChange={(x) => changer(setClient)({ ...client, email: x.target.value })} autoCapitalize="none" />
          </div>
          <div className="q-field">
            <label className="q-label" htmlFor="dv-c-tel">
              Téléphone
            </label>
            <input id="dv-c-tel" type="tel" value={client.telephone} onChange={(x) => changer(setClient)({ ...client, telephone: x.target.value })} />
          </div>
          <div className="q-field large">
            <label className="q-label" htmlFor="dv-c-adresse">
              Adresse
            </label>
            <textarea id="dv-c-adresse" rows={2} value={client.adresse} onChange={(x) => changer(setClient)({ ...client, adresse: x.target.value })} />
          </div>
        </div>
        <label className="q-toggle compact">
          <input type="checkbox" checked={client.pro} onChange={(x) => changer(setClient)({ ...client, pro: x.target.checked })} />
          <span>
            <span className="q-option-title">Client professionnel</span>
            <span className="q-option-hint">Ajoute son SIRET et les mentions entre professionnels sur la facture.</span>
          </span>
        </label>
        {client.pro && (
          <div className="q-field">
            <label className="q-label" htmlFor="dv-c-siret">
              SIRET ou SIREN du client
            </label>
            <p className="q-hint">Il deviendra obligatoire sur vos factures entre professionnels avec la facturation électronique.</p>
            <input id="dv-c-siret" type="text" inputMode="numeric" value={client.siret} onChange={(x) => changer(setClient)({ ...client, siret: x.target.value })} />
          </div>
        )}
      </fieldset>

      <div className="card dv-bloc">
        <div className="q-field">
          <label className="q-label" htmlFor="dv-objet">
            Objet du devis
          </label>
          <input id="dv-objet" type="text" value={objet} onChange={(x) => changer(setObjet)(x.target.value)} placeholder="Ex. Rénovation de la salle de bain" maxLength={200} />
        </div>
      </div>

      <div className="card dv-bloc">
        <h2 className="dv-bloc-titre">Lignes</h2>
        {lignes.length ? (
          <ol className="dv-lignes">
            {lignes.map((l, i) => (
              <li key={l.k} className="dv-ligne">
                <div className="dv-ligne-tete">
                  <span className="dv-ligne-num">{i + 1}</span>
                  <input type="text" aria-label={`Désignation de la ligne ${i + 1}`} value={l.designation} onChange={(x) => changer(majLigne)(l.k, { designation: x.target.value })} placeholder="Désignation" maxLength={200} />
                  <span className="dv-ligne-outils">
                    <button type="button" className="icon-btn small" aria-label="Monter" disabled={i === 0} onClick={() => changer(deplacer)(i, -1)}>
                      ↑
                    </button>
                    <button type="button" className="icon-btn small" aria-label="Descendre" disabled={i === lignes.length - 1} onClick={() => changer(deplacer)(i, 1)}>
                      ↓
                    </button>
                    <button type="button" className="icon-btn small" aria-label={`Retirer la ligne ${i + 1}`} onClick={() => changer(setLignes)(lignes.filter((x) => x.k !== l.k))}>
                      ×
                    </button>
                  </span>
                </div>
                {l.detail ? (
                  <textarea className="dv-ligne-desc-champ" rows={2} aria-label={`Détail de la ligne ${i + 1}`} value={l.description} onChange={(x) => changer(majLigne)(l.k, { description: x.target.value })} placeholder="Détail (facultatif)" maxLength={600} />
                ) : (
                  <button type="button" className="btn-text small" onClick={() => majLigne(l.k, { detail: true })}>
                    + Ajouter un détail
                  </button>
                )}
                <div className="dv-ligne-chiffres">
                  <label>
                    <span>Quantité</span>
                    <input type="text" inputMode="decimal" value={l.qte} aria-invalid={!lireQuantite(l.qte) || undefined} onChange={(x) => changer(majLigne)(l.k, { qte: x.target.value })} />
                  </label>
                  <label>
                    <span>Unité</span>
                    <select value={l.unite} onChange={(x) => changer(majLigne)(l.k, { unite: x.target.value })}>
                      {UNITES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Prix unitaire</span>
                    <ChampEuros value={l.prixHT} negatif onChange={(v) => changer(majLigne)(l.k, { prixHT: v })} label={`Prix unitaire HT de la ligne ${i + 1}`} />
                  </label>
                  {!e.franchise && (
                    <label>
                      <span>TVA</span>
                      <select value={l.tva} onChange={(x) => changer(majLigne)(l.k, { tva: Number(x.target.value) })}>
                        {TAUX_TVA.map((tx) => (
                          <option key={tx.v} value={tx.v}>
                            {tx.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <span className="dv-ligne-total">
                    <span>Total HT</span>
                    <strong>{euros(ligneHT({ quantite: lireQuantite(l.qte) || 0, prixHT: l.prixHT }))}</strong>
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Ajoutez vos produits et prestations : l’appli calcule les totaux et la TVA.</p>
        )}
        <div className="row-actions">
          <button type="button" className="btn primary" onClick={() => setChoix(true)}>
            + Depuis mes produits
          </button>
          <button type="button" className="btn secondary" onClick={() => changer(setLignes)([...lignes, versLigne({})])}>
            + Ligne libre
          </button>
        </div>
        <p className="muted small">Une remise ? Ajoutez une ligne libre « Remise » avec un prix négatif (ex. -50).</p>
      </div>

      <div className="card dv-bloc">
        <h2 className="dv-bloc-titre">Conditions</h2>
        <div className="dv-grille">
          <div className="q-field">
            <label className="q-label" htmlFor="dv-validite">
              Validité (jours)
            </label>
            <input id="dv-validite" type="number" min={1} max={365} inputMode="numeric" value={validite} onChange={(x) => changer(setValidite)(x.target.value)} />
          </div>
          <div className="q-field">
            <label className="q-label" htmlFor="dv-acompte">
              Acompte à la commande (%)
            </label>
            <input id="dv-acompte" type="number" min={0} max={100} inputMode="numeric" value={acompte} onChange={(x) => changer(setAcompte)(x.target.value)} />
          </div>
        </div>
        <div className="q-field">
          <label className="q-label" htmlFor="dv-notes">
            Remarques pour le client
          </label>
          <textarea id="dv-notes" rows={3} value={notes} onChange={(x) => changer(setNotes)(x.target.value)} placeholder="Ex. Délai d’intervention : 2 semaines après acceptation." maxLength={1500} />
        </div>
      </div>

      <div className="dv-barre-totaux">
        <span className="dv-barre-chiffres">
          <span>
            HT <strong>{euros(t.ht)}</strong>
          </span>
          {!e.franchise && (
            <span>
              TVA <strong>{euros(t.tva)}</strong>
            </span>
          )}
          <span className="dv-barre-ttc">
            {e.franchise ? 'Total' : 'TTC'} <strong>{euros(t.ttc)}</strong>
          </span>
        </span>
        <button type="button" className="btn primary" onClick={enregistrer} disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      {err && (
        <p className="q-error" role="alert">
          {err}
        </p>
      )}

      {choix && <ChoixProduits produits={data.produits} onAjout={ajouterProduit} onClose={() => setChoix(false)} aller={aller} />}
    </section>
  );
}

export default function Devis(props) {
  const { nav } = props;
  if (nav.ecran === 'detail') return <Detail {...props} id={nav.id} />;
  if (nav.ecran === 'edition') return <Editeur key={nav.id || 'nouveau'} {...props} id={nav.id} />;
  return <Liste {...props} />;
}
