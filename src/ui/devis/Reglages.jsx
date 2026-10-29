'use client';
// Onglet Réglages : entreprise (mentions légales), produits et prix, sécurité du compte, installation
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { CodeSecours, ReliePhone } from '../AgencyLogin.jsx';
import ReglagesCalculateur from './ReglagesCalculateur.jsx';
import { Fenetre, ChampEuros, ChampMdp, ChampCode, codeComplet, appelAcces, fmtQuand, fmtJour } from './commun.jsx';
import { euros, FORMES, TAUX_TVA, UNITES, tauxLabel, lireListeProduits, nettoyerEntreprise, PENALITES_DEFAUT, emailOk, NATURES } from '../../engine/devis.js';

const SECTIONS = [
  ['entreprise', 'Entreprise'],
  ['produits', 'Produits et prix'],
  ['securite', 'Sécurité'],
  ['installer', 'Installer l’appli'],
];

// ---------- Entreprise ----------
function Champ({ id, label, aide, children }) {
  return (
    <div className="q-field">
      <label className="q-label" htmlFor={id}>
        {label}
      </label>
      {aide && <p className="q-hint">{aide}</p>}
      {children}
    </div>
  );
}

function Entreprise({ data, agir, garde }) {
  const [e, setE] = useState(() => nettoyerEntreprise(data.entreprise));
  const [modifie, setModifie] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => {
    garde.current = modifie || null;
    return () => {
      garde.current = null;
    };
  }, [modifie, garde]);
  const maj = (patch) => {
    setModifie(true);
    setE((x) => ({ ...x, ...patch }));
  };
  const txt = (k) => ({ id: `dv-e-${k}`, value: e[k] ?? '', onChange: (x) => maj({ [k]: x.target.value }) });
  // IBAN, BIC et e-mail : protégés par le code du téléphone
  const propre = nettoyerEntreprise(e);
  const sensible = ['iban', 'bic', 'email'].some((k) => (propre[k] || '') !== (data.entreprise[k] || ''));
  async function enregistrer() {
    setErr('');
    if (e.email && !emailOk(e.email)) return setErr('L’adresse e-mail n’est pas valide.');
    setBusy(true);
    try {
      const r = await agir({ action: 'entreprise', entreprise: e, ...(sensible ? { code } : {}) });
      setE(nettoyerEntreprise(r.entreprise));
      setModifie(false);
      setCode('');
      garde.current = null;
    } catch (x) {
      setErr(x.message);
      setCode('');
    } finally {
      setBusy(false);
    }
    return undefined;
  }
  const societe = e.forme && !['EI ou micro-entreprise', 'Association'].includes(e.forme);
  return (
    <div className="dv-reglage">
      <p className="muted">Ces informations apparaissent sur vos devis et factures. Les champs marqués * sont obligatoires pour envoyer un devis ou émettre une facture.</p>
      {data.manques.length > 0 && (
        <div className="dv-bandeau attention">
          <strong>À compléter :</strong> {data.manques.join(', ')}.
        </div>
      )}

      <fieldset className="card dv-bloc">
        <legend>Identité</legend>
        <div className="dv-grille">
          <Champ id="dv-e-nom" label="Nom de l’entreprise *">
            <input type="text" {...txt('nom')} autoComplete="organization" />
          </Champ>
          <Champ id="dv-e-forme" label="Forme juridique">
            <select {...txt('forme')}>
              <option value="">Choisir</option>
              {FORMES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Champ>
          <Champ id="dv-e-siret" label="SIRET *" aide="14 chiffres, sur votre extrait Kbis ou avis de situation Insee.">
            <input type="text" inputMode="numeric" {...txt('siret')} />
          </Champ>
          <Champ id="dv-e-rcs" label="RCS ou RM" aide="Ex. RCS Lyon 123 456 789 (si vous êtes immatriculé).">
            <input type="text" {...txt('rcs')} />
          </Champ>
          {societe && (
            <Champ id="dv-e-capital" label="Capital social" aide="Obligatoire pour une société. Ex. 1 000 €">
              <input type="text" {...txt('capital')} />
            </Champ>
          )}
          <Champ id="dv-e-adresse" label="Adresse *">
            <textarea rows={2} {...txt('adresse')} autoComplete="street-address" />
          </Champ>
        </div>
      </fieldset>

      <fieldset className="card dv-bloc">
        <legend>TVA</legend>
        <label className="q-toggle compact">
          <input type="checkbox" checked={e.franchise} onChange={(x) => maj({ franchise: x.target.checked })} />
          <span>
            <span className="q-option-title">TVA non applicable (franchise en base, micro-entreprise)</span>
            <span className="q-option-hint">Les devis et factures sont alors en montants nets, avec la mention « TVA non applicable, article 293 B du CGI ».</span>
          </span>
        </label>
        {!e.franchise && (
          <Champ id="dv-e-tva" label="Numéro de TVA intracommunautaire *" aide="Ex. FR12 345678901">
            <input type="text" {...txt('tva')} autoCapitalize="characters" />
          </Champ>
        )}
        <Champ id="dv-e-nature" label="Ce que vous facturez" aide="Mention ajoutée sur les factures (elle devient obligatoire entre professionnels avec la facturation électronique).">
          <select {...txt('nature')}>
            <option value="">Ne pas l’indiquer</option>
            {Object.entries(NATURES).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Champ>
        {!e.franchise && (
          <label className="q-toggle compact">
            <input type="checkbox" checked={e.tvaDebits} onChange={(x) => maj({ tvaDebits: x.target.checked })} />
            <span>
              <span className="q-option-title">J’ai opté pour le paiement de la TVA d’après les débits</span>
              <span className="q-option-hint">Seulement si vous avez fait ce choix auprès des impôts (prestations de services). Sinon, laissez décoché.</span>
            </span>
          </label>
        )}
      </fieldset>

      <fieldset className="card dv-bloc">
        <legend>Contact</legend>
        <div className="dv-grille">
          <Champ id="dv-e-email" label="E-mail *" aide="Les réponses de vos clients et les alertes arrivent à cette adresse.">
            <input type="email" {...txt('email')} autoCapitalize="none" autoComplete="email" />
          </Champ>
          <Champ id="dv-e-telephone" label="Téléphone">
            <input type="tel" {...txt('telephone')} autoComplete="tel" />
          </Champ>
          <Champ id="dv-e-site" label="Site internet">
            <input type="text" {...txt('site')} autoCapitalize="none" />
          </Champ>
        </div>
      </fieldset>

      <fieldset className="card dv-bloc">
        <legend>Paiement</legend>
        <div className="dv-grille">
          <Champ id="dv-e-iban" label="IBAN" aide="Affiché sur les factures uniquement (jamais sur les devis).">
            <input type="text" {...txt('iban')} autoCapitalize="characters" spellCheck={false} />
          </Champ>
          <Champ id="dv-e-bic" label="BIC">
            <input type="text" {...txt('bic')} autoCapitalize="characters" spellCheck={false} />
          </Champ>
          <Champ id="dv-e-delai" label="Délai de paiement (jours)" aide="Au plus 30 jours après réception, ou 60 jours s’il est convenu avec un client professionnel.">
            <input type="number" min={0} max={120} inputMode="numeric" value={e.delaiPaiementJours} onChange={(x) => maj({ delaiPaiementJours: x.target.value })} id="dv-e-delai" />
          </Champ>
        </div>
      </fieldset>

      <fieldset className="card dv-bloc">
        <legend>Devis</legend>
        <div className="dv-grille">
          <Champ id="dv-e-validite" label="Validité par défaut (jours)">
            <input type="number" min={1} max={365} inputMode="numeric" value={e.validiteJours} onChange={(x) => maj({ validiteJours: x.target.value })} id="dv-e-validite" />
          </Champ>
          <Champ id="dv-e-acompte" label="Acompte par défaut (%)">
            <input type="number" min={0} max={100} inputMode="numeric" value={e.acomptePct} onChange={(x) => maj({ acomptePct: x.target.value })} id="dv-e-acompte" />
          </Champ>
        </div>
        <Champ id="dv-e-conditions" label="Conditions de règlement" aide="Affichées sur les devis et les factures.">
          <textarea rows={2} {...txt('conditions')} />
        </Champ>
        <Champ id="dv-e-penalites" label="Pénalités de retard" aide="Mention obligatoire sur les factures.">
          <textarea rows={3} {...txt('penalites')} />
        </Champ>
        {e.penalites !== PENALITES_DEFAUT && (
          <button type="button" className="btn-text small" onClick={() => maj({ penalites: PENALITES_DEFAUT })}>
            Remettre le texte proposé
          </button>
        )}
        <Champ id="dv-e-mentions" label="Autres mentions" aide="Ex. assurance professionnelle (obligatoire pour les artisans du bâtiment : assureur et zone couverte), carte professionnelle…">
          <textarea rows={3} {...txt('mentions')} />
        </Champ>
      </fieldset>

      <p className="muted small">Les mentions obligatoires dépendent de votre activité : en cas de doute, faites relire un devis et une facture par votre expert-comptable.</p>

      {sensible && (
        <div className="card dv-bloc dv-bloc-actif">
          <p className="small">
            <strong>Vous modifiez l’IBAN, le BIC ou l’e-mail.</strong> Pour les protéger, saisissez le code à 6 chiffres de Google Authenticator. Un e-mail vous confirmera le changement.
          </p>
          <ChampCode id="dv-e-code" value={code} onChange={setCode} autoFocus={false} label="Code à 6 chiffres" />
        </div>
      )}

      <div className="dv-barre-totaux">
        <span className="muted small">{modifie ? 'Modifications non enregistrées' : 'À jour'}</span>
        <button type="button" className="btn primary" onClick={enregistrer} disabled={busy || !modifie || (sensible && !codeComplet(code))}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      {err && (
        <p className="q-error" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}

// ---------- Produits et prix ----------
function FicheProduit({ produit, franchise, onSave, onDelete, onClose }) {
  const [p, setP] = useState(() => ({ nom: '', ref: '', description: '', unite: 'u', prixHT: 0, tva: 2000, categorie: '', ...produit }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go(fn) {
    setBusy(true);
    setErr('');
    try {
      await fn();
      onClose();
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  }
  return (
    <Fenetre titre={produit?.id ? 'Modifier le produit' : 'Nouveau produit'} onClose={onClose}>
      <form
        onSubmit={(x) => {
          x.preventDefault();
          if (!p.nom.trim()) return setErr('Indiquez le nom du produit.');
          return go(() => onSave(p));
        }}
      >
        <Champ id="dv-p-nom" label="Nom *">
          <input type="text" id="dv-p-nom" value={p.nom} onChange={(x) => setP({ ...p, nom: x.target.value })} maxLength={160} autoFocus />
        </Champ>
        <Champ id="dv-p-desc" label="Description" aide="Reprise sur le devis, sous le nom.">
          <textarea id="dv-p-desc" rows={2} value={p.description} onChange={(x) => setP({ ...p, description: x.target.value })} maxLength={600} />
        </Champ>
        <div className="dv-grille">
          <Champ id="dv-p-prix" label={franchise ? 'Prix unitaire' : 'Prix unitaire HT'}>
            <ChampEuros id="dv-p-prix" value={p.prixHT} onChange={(v) => setP({ ...p, prixHT: v })} label="Prix unitaire" suffixe={franchise ? '€' : '€ HT'} />
          </Champ>
          <Champ id="dv-p-unite" label="Unité">
            <select id="dv-p-unite" value={p.unite} onChange={(x) => setP({ ...p, unite: x.target.value })}>
              {UNITES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </Champ>
          {!franchise && (
            <Champ id="dv-p-tva" label="TVA">
              <select id="dv-p-tva" value={p.tva} onChange={(x) => setP({ ...p, tva: Number(x.target.value) })}>
                {TAUX_TVA.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Champ>
          )}
          <Champ id="dv-p-ref" label="Référence">
            <input type="text" id="dv-p-ref" value={p.ref} onChange={(x) => setP({ ...p, ref: x.target.value })} maxLength={40} />
          </Champ>
          <Champ id="dv-p-cat" label="Catégorie" aide="Pour classer la liste (facultatif).">
            <input type="text" id="dv-p-cat" value={p.categorie} onChange={(x) => setP({ ...p, categorie: x.target.value })} maxLength={60} />
          </Champ>
        </div>
        {err && (
          <p className="q-error" role="alert">
            {err}
          </p>
        )}
        <div className="row-actions">
          <button type="submit" className="btn primary" disabled={busy}>
            Enregistrer
          </button>
          {produit?.id && (
            <button type="button" className="btn-text small danger" disabled={busy} onClick={() => go(onDelete)}>
              Supprimer ce produit
            </button>
          )}
        </div>
      </form>
    </Fenetre>
  );
}

function Import({ onImport, onClose, franchise }) {
  const [txt, setTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lu = useMemo(() => lireListeProduits(txt), [txt]);
  return (
    <Fenetre titre="Importer une liste de produits" onClose={onClose} large>
      <p className="muted small">
        Collez votre liste (depuis Excel, un tableur ou un document) : <strong>une ligne par produit</strong>, avec dans l’ordre <code>Nom ; prix {franchise ? '' : 'HT '}; unité ; TVA ; référence</code>. Seuls le nom et le prix sont obligatoires. Depuis un tableur, copiez simplement les colonnes dans cet ordre.
      </p>
      <textarea className="dv-import" rows={8} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={'Pose de carrelage ; 45 ; m² ; 10\nDéplacement ; 35 ; forfait\nMain-d’œuvre ; 52,50 ; h ; 20 ; MO-01'} spellCheck={false} />
      {txt.trim() && (
        <div className="dv-import-apercu">
          <p>
            <strong>
              {lu.produits.length} produit{lu.produits.length > 1 ? 's' : ''} reconnu{lu.produits.length > 1 ? 's' : ''}
            </strong>
            {lu.ignorees.length > 0 && <span className="q-error"> · {lu.ignorees.length} ligne{lu.ignorees.length > 1 ? 's' : ''} ignorée{lu.ignorees.length > 1 ? 's' : ''} (nom ou prix manquant)</span>}
          </p>
          {lu.produits.length > 0 && (
            <ul>
              {lu.produits.slice(0, 6).map((p) => (
                <li key={p.id}>
                  {p.nom} : {euros(p.prixHT)} / {p.unite}
                  {franchise ? '' : ` · TVA ${tauxLabel(p.tva)}`}
                </li>
              ))}
              {lu.produits.length > 6 && <li className="muted">… et {lu.produits.length - 6} autres</li>}
            </ul>
          )}
          {lu.ignorees.length > 0 && (
            <details>
              <summary className="small">Voir les lignes ignorées</summary>
              <ul className="small">
                {lu.ignorees.slice(0, 20).map((l, i) => (
                  <li key={i}>
                    <code>{l}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      {err && <p className="q-error">{err}</p>}
      <div className="row-actions">
        <button
          type="button"
          className="btn primary"
          disabled={busy || !lu.produits.length}
          onClick={async () => {
            setBusy(true);
            setErr('');
            try {
              await onImport(lu.produits);
              onClose();
            } catch (x) {
              setErr(x.message);
              setBusy(false);
            }
          }}
        >
          Ajouter {lu.produits.length || ''} produit{lu.produits.length > 1 ? 's' : ''}
        </button>
      </div>
    </Fenetre>
  );
}

function Produits({ data, agir }) {
  const [q, setQ] = useState('');
  const [fiche, setFiche] = useState(null); // produit ouvert ({} = nouveau)
  const [importer, setImporter] = useState(false);
  const franchise = data.entreprise.franchise;
  const liste = data.produits;
  const c = q.trim().toLowerCase();
  const vus = liste.filter((p) => !c || [p.nom, p.ref, p.categorie, p.description].some((x) => String(x || '').toLowerCase().includes(c)));
  const groupes = useMemo(() => {
    const m = new Map();
    for (const p of [...vus].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))) {
      const k = p.categorie || '';
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(p);
    }
    return [...m.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0], 'fr')));
  }, [vus]);
  const sauver = (produits) => agir({ action: 'produits', produits });
  return (
    <div className="dv-reglage">
      <p className="muted">Votre catalogue : produits, prestations et tarifs. Dans un devis, « + Depuis mes produits » reprend le nom, la description, le prix et la TVA.</p>
      <div className="row-actions">
        <button type="button" className="btn primary" onClick={() => setFiche({})}>
          + Ajouter un produit
        </button>
        <button type="button" className="btn secondary" onClick={() => setImporter(true)}>
          Importer une liste
        </button>
      </div>
      {liste.length > 8 && <input className="dv-recherche" type="search" placeholder="Rechercher un produit" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un produit" />}
      {liste.length ? (
        groupes.map(([cat, items]) => (
          <div key={cat || '-'} className="dv-section">
            {(groupes.length > 1 || cat) && <h2>{cat || 'Sans catégorie'}</h2>}
            <ul className="dv-produits">
              {items.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setFiche(p)}>
                    <span>
                      <strong>{p.nom}</strong>
                      {p.ref && <span className="muted small"> · {p.ref}</span>}
                      {p.description && <span className="dv-choix-desc">{p.description}</span>}
                    </span>
                    <span className="dv-choix-prix">
                      {euros(p.prixHT)}
                      <small>
                        {franchise ? '' : ' HT'} / {p.unite}
                        {franchise ? '' : ` · ${tauxLabel(p.tva)}`}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <div className="dv-vide">
          <p>
            <strong>Aucun produit enregistré.</strong>
          </p>
          <p className="muted">Ajoutez-les un par un, ou importez d’un coup la liste de votre tableur.</p>
        </div>
      )}
      {liste.length > 0 && (
        <p className="muted small">
          {liste.length} produit{liste.length > 1 ? 's' : ''}. Changer un prix ici ne modifie pas les devis déjà faits.
        </p>
      )}
      {fiche && (
        <FicheProduit
          produit={fiche.id ? fiche : null}
          franchise={franchise}
          onClose={() => setFiche(null)}
          onSave={(p) => sauver(fiche.id ? liste.map((x) => (x.id === fiche.id ? { ...p, id: fiche.id } : x)) : [...liste, p])}
          onDelete={() => sauver(liste.filter((x) => x.id !== fiche.id))}
        />
      )}
      {importer && <Import franchise={franchise} onClose={() => setImporter(false)} onImport={(nouveaux) => sauver([...liste, ...nouveaux])} />}
    </div>
  );
}

// ---------- Sécurité ----------
const appelSecu = (body) => api('/api/devis/securite', { method: 'POST', body });

function ChangerMdp({ email, onClose, setToast }) {
  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Fenetre titre="Changer de mot de passe" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr('');
          try {
            const r = await appelSecu({ action: 'mdp', ancien, nouveau, code });
            setToast(r.note);
            onClose(true);
          } catch (x) {
            setErr(x.message);
            setCode('');
          } finally {
            setBusy(false);
          }
        }}
      >
        <input type="email" value={email} autoComplete="username" readOnly hidden />
        <ChampMdp id="dv-m-ancien" label="Mot de passe actuel" value={ancien} onChange={setAncien} />
        <ChampMdp id="dv-m-nouveau" label="Nouveau mot de passe" value={nouveau} onChange={setNouveau} autoComplete="new-password" aide="Au moins 10 caractères. Une phrase facile à retenir fonctionne bien." />
        <ChampCode id="dv-m-code" value={code} onChange={setCode} autoFocus={false} label="Code à 6 chiffres de Google Authenticator" />
        {err && (
          <p className="q-error" role="alert">
            {err}
          </p>
        )}
        <button type="submit" className="btn primary" disabled={busy || !ancien || nouveau.length < 10 || !codeComplet(code)}>
          {busy ? 'Vérification…' : 'Changer le mot de passe'}
        </button>
      </form>
    </Fenetre>
  );
}

function NouveauxSecours({ onClose }) {
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Fenetre titre="Nouveaux codes de secours" onClose={() => onClose(Boolean(codes))}>
      {codes ? (
        <CodeSecours codes={codes} onDone={() => onClose(true)} titre="Vos nouveaux codes de secours" bouton="J’ai noté mes codes" />
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr('');
            try {
              const r = await appelSecu({ action: 'secours', code });
              setCodes(r.codes);
            } catch (x) {
              setErr(x.message);
              setCode('');
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="muted small">Les anciens codes de secours ne fonctionneront plus.</p>
          <ChampCode id="dv-s-code" value={code} onChange={setCode} label="Code à 6 chiffres de Google Authenticator" />
          {err && (
            <p className="q-error" role="alert">
              {err}
            </p>
          )}
          <button type="submit" className="btn primary" disabled={busy || !codeComplet(code)}>
            Créer de nouveaux codes
          </button>
        </form>
      )}
    </Fenetre>
  );
}

function ChangerTelephone({ onClose, setToast }) {
  const [etape, setEtape] = useState('ancien');
  const [code, setCode] = useState('');
  const [secours, setSecours] = useState(false);
  const [tel, setTel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go(body, apres) {
    setBusy(true);
    setErr('');
    try {
      const r = await appelSecu(body);
      setCode('');
      apres(r);
    } catch (x) {
      setErr(x.message);
      setCode('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Fenetre titre="Changer de téléphone" onClose={() => onClose(false)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (etape === 'ancien')
            go({ action: 'telephone.preparer', code }, (r) => {
              setTel(r.telephone);
              setEtape('nouveau');
            });
          else
            go({ action: 'telephone.activer', code }, (r) => {
              setToast(r.note);
              onClose(true);
            });
        }}
      >
        {etape === 'ancien' ? (
          <>
            <p className="muted small">{secours ? 'Étape 1 sur 2 : votre ancien téléphone est perdu ? Saisissez un de vos codes de secours.' : 'Étape 1 sur 2 : saisissez le code affiché maintenant par votre téléphone actuel.'}</p>
            <ChampCode id="dv-t-ancien" value={code} onChange={setCode} secours={secours} label={secours ? 'Code de secours' : 'Code du téléphone actuel'} />
            <button type="button" className="btn-text small" onClick={() => (setSecours((x) => !x), setCode(''), setErr(''))}>
              {secours ? 'J’ai mon téléphone actuel' : 'Téléphone perdu ? Code de secours'}
            </button>
          </>
        ) : (
          <>
            <ReliePhone qr={tel.qr} lien={tel.lien} secret={tel.secret} intro={<p className="muted small">Étape 2 sur 2 : sur le nouveau téléphone.</p>} />
            <ChampCode id="dv-t-nouveau" value={code} onChange={setCode} label="Code affiché par le nouveau téléphone" autoFocus={false} />
          </>
        )}
        {err && (
          <p className="q-error" role="alert">
            {err}
          </p>
        )}
        <button type="submit" className="btn primary" disabled={busy || !codeComplet(code, etape === 'ancien' && secours)}>
          {etape === 'ancien' ? 'Continuer' : 'Relier ce téléphone'}
        </button>
      </form>
      <p className="muted small">Plus de téléphone ni de code de secours ? Demandez à votre prestataire de réinitialiser votre accès : le lien vous sera envoyé par e-mail.</p>
    </Fenetre>
  );
}

function Securite({ data, recharger, setToast }) {
  const c = data.compte;
  const [fenetre, setFenetre] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fermer = (change) => {
    setFenetre(null);
    if (change) recharger();
  };
  async function go(body) {
    setBusy(true);
    setErr('');
    try {
      const r = await appelSecu(body);
      if (r.note) setToast(r.note);
      await recharger();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dv-reglage">
      <div className="card dv-bloc">
        <h2 className="dv-bloc-titre">Connexion</h2>
        <dl className="dv-infos">
          <div>
            <dt>E-mail</dt>
            <dd>{c.email}</dd>
          </div>
          <div>
            <dt>Double authentification</dt>
            <dd>{c.telephoneLe ? `Activée (téléphone relié le ${fmtJour(c.telephoneLe)})` : 'Activée'}</dd>
          </div>
          <div>
            <dt>Codes de secours</dt>
            <dd className={c.secoursRestants <= 2 ? 'attention' : ''}>
              {c.secoursRestants} restant{c.secoursRestants > 1 ? 's' : ''} sur 8
            </dd>
          </div>
        </dl>
        <div className="row-actions">
          <button type="button" className="btn secondary small" onClick={() => setFenetre('mdp')}>
            Changer de mot de passe
          </button>
          <button type="button" className="btn secondary small" onClick={() => setFenetre('tel')}>
            Changer de téléphone
          </button>
          <button type="button" className="btn secondary small" onClick={() => setFenetre('secours')}>
            Nouveaux codes de secours
          </button>
        </div>
      </div>

      <div className="card dv-bloc">
        <h2 className="dv-bloc-titre">Appareils connectés</h2>
        <p className="muted small">Chaque appareil reste connecté 30 jours. Un appareil inconnu ? Déconnectez-le et changez votre mot de passe.</p>
        <ul className="dv-appareils">
          {c.appareils.map((a) => (
            <li key={a.id}>
              <span>
                <strong>{a.nom}</strong>
                {a.actuel && <span className="dv-pastille ton-ok">Cet appareil</span>}
                <span className="muted small">Dernière activité : {fmtQuand(a.vuLe)}</span>
              </span>
              <button type="button" className="btn-text small" disabled={busy} onClick={() => go({ action: 'deconnecter', appareil: a.id })}>
                Déconnecter
              </button>
            </li>
          ))}
        </ul>
        {c.appareils.length > 1 && (
          <button type="button" className="btn secondary small" disabled={busy} onClick={() => go({ action: 'deconnecterAutres' })}>
            Déconnecter tous les autres appareils
          </button>
        )}
        {err && (
          <p className="q-error" role="alert">
            {err}
          </p>
        )}
      </div>

      {c.journal.length > 0 && (
        <details className="card dv-bloc dv-historique">
          <summary>Journal de sécurité</summary>
          <ol>
            {c.journal.map((j, i) => (
              <li key={i}>
                <span>{j.txt}</span>
                <time className="muted">{fmtQuand(j.at)}</time>
              </li>
            ))}
          </ol>
        </details>
      )}

      <button
        type="button"
        className="btn secondary"
        onClick={async () => {
          await appelAcces({ action: 'deconnexion' });
          window.location.assign('/devis');
        }}
      >
        Se déconnecter
      </button>

      {fenetre === 'mdp' && <ChangerMdp email={c.email} onClose={fermer} setToast={setToast} />}
      {fenetre === 'secours' && <NouveauxSecours onClose={fermer} />}
      {fenetre === 'tel' && <ChangerTelephone onClose={fermer} setToast={setToast} />}
    </div>
  );
}

// ---------- Installation ----------
function Installer() {
  const [invite, setInvite] = useState(null);
  const [installee, setInstallee] = useState(false);
  const [systeme, setSysteme] = useState('');
  useEffect(() => {
    const ua = navigator.userAgent || '';
    setSysteme(/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios' : /Android/i.test(ua) ? 'android' : 'ordi');
    try {
      setInstallee(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
    } catch {}
    const avant = (e) => {
      e.preventDefault();
      setInvite(e);
    };
    window.addEventListener('beforeinstallprompt', avant);
    return () => window.removeEventListener('beforeinstallprompt', avant);
  }, []);
  if (installee)
    return (
      <div className="dv-reglage">
        <div className="dv-bandeau ok">L’appli est installée sur cet appareil.</div>
      </div>
    );
  return (
    <div className="dv-reglage">
      <p className="muted">Installée, l’appli s’ouvre depuis une icône « Devis » sur l’écran d’accueil, en plein écran, comme une application. Rien à télécharger depuis l’App Store ou le Play Store.</p>
      {invite && (
        <button
          type="button"
          className="btn primary"
          onClick={async () => {
            invite.prompt();
            await invite.userChoice.catch(() => null);
            setInvite(null);
          }}
        >
          Installer l’appli
        </button>
      )}
      <div className={`card dv-bloc${systeme === 'ios' ? ' dv-bloc-actif' : ''}`}>
        <h2 className="dv-bloc-titre">iPhone ou iPad</h2>
        <ol className="dv-etapes">
          <li>
            Ouvrez cette page dans <strong>Safari</strong>.
          </li>
          <li>
            Touchez le bouton <strong>Partager</strong> (le carré avec une flèche vers le haut).
          </li>
          <li>
            Choisissez <strong>Sur l’écran d’accueil</strong> (faites défiler si besoin), puis <strong>Ajouter</strong>.
          </li>
        </ol>
      </div>
      <div className={`card dv-bloc${systeme === 'android' ? ' dv-bloc-actif' : ''}`}>
        <h2 className="dv-bloc-titre">Android</h2>
        <ol className="dv-etapes">
          <li>
            Ouvrez cette page dans <strong>Chrome</strong>.
          </li>
          <li>
            Touchez le menu <strong>⋮</strong> en haut à droite.
          </li>
          <li>
            Choisissez <strong>Installer l’application</strong> (ou <strong>Ajouter à l’écran d’accueil</strong>), puis confirmez.
          </li>
        </ol>
      </div>
      <p className="muted small">Sur ordinateur, l’appli fonctionne aussi dans le navigateur : ajoutez simplement cette page à vos favoris.</p>
    </div>
  );
}

export default function Reglages(props) {
  const { nav, aller } = props;
  // « Calculateur » seulement si l'agence a activé l'option
  const sections = props.data.calculateur?.actif ? [...SECTIONS.slice(0, 2), ['calculateur', 'Calculateur'], ...SECTIONS.slice(2)] : SECTIONS;
  const sec = sections.some(([id]) => id === nav.section) ? nav.section : 'entreprise';
  return (
    <section className="dv-page">
      <div className="dv-page-tete">
        <h1>Réglages</h1>
      </div>
      <div className="dv-filtres dv-sous-onglets" role="tablist" aria-label="Réglages">
        {sections.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={sec === id} aria-pressed={sec === id} onClick={() => aller({ onglet: 'reglages', section: id }, { remplacer: true })}>
            {label}
            {id === 'entreprise' && props.data.manques.length > 0 && <span className="dv-badge">!</span>}
          </button>
        ))}
      </div>
      {sec === 'entreprise' && <Entreprise {...props} />}
      {sec === 'produits' && <Produits {...props} />}
      {sec === 'calculateur' && <ReglagesCalculateur {...props} />}
      {sec === 'securite' && <Securite {...props} />}
      {sec === 'installer' && <Installer />}
    </section>
  );
}
