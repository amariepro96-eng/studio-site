'use client';
// Réglages › Calculateur : les tarifs du calculateur d'estimation (matériaux, taux horaire,
// forfaits, marge, coefficients, options, délais, livraisons), réglés par l'entreprise.
import { useEffect, useState } from 'react';
import { ChampEuros } from './commun.jsx';
import Calculateur from './Calculateur.jsx';
import { TAUX_TVA, nouvelId } from '../../engine/devis.js';
import { LISTE_MODELES, nettoyerCalculateur } from '../../engine/calculateur.js';

function Texte({ id, label, aide, value, onChange, max = 80, large = false }) {
  return (
    <div className={`q-field${large ? ' large' : ''}`}>
      <label className="q-label" htmlFor={id}>
        {label}
      </label>
      {aide && <p className="q-hint">{aide}</p>}
      {large ? <textarea id={id} rows={2} value={value || ''} maxLength={max} onChange={(e) => onChange(e.target.value)} /> : <input id={id} type="text" value={value || ''} maxLength={max} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

function Pourcent({ id, label, aide, value, onChange, min = 0, max = 500 }) {
  return (
    <div className="q-field">
      <label className="q-label" htmlFor={id}>
        {label}
      </label>
      {aide && <p className="q-hint">{aide}</p>}
      <span className="dv-calc-nombre">
        <input id={id} type="number" min={min} max={max} inputMode="numeric" value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span aria-hidden="true">%</span>
      </span>
    </div>
  );
}

// Liste de choix : nom + prix (centimes) ou coefficient (%)
function ListeChoix({ nomListe, choix, onChange, mode = 'prix', suffixe = '€', placeholder = 'Nom' }) {
  const maj = (id, patch) => onChange(choix.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  return (
    <div className="dv-choix-reglage">
      {choix.length > 0 && (
        <ul>
          {choix.map((c, i) => (
            <li key={c.id}>
              <input type="text" aria-label={`${nomListe} ${i + 1} : nom`} value={c.nom} maxLength={80} placeholder={placeholder} onChange={(e) => maj(c.id, { nom: e.target.value })} />
              {mode === 'prix' ? (
                <ChampEuros value={c.v} onChange={(v) => maj(c.id, { v })} label={`${nomListe} ${i + 1} : prix`} suffixe={suffixe} />
              ) : (
                <span className="dv-calc-nombre">
                  <input type="number" min={10} max={1000} inputMode="numeric" aria-label={`${nomListe} ${i + 1} : coefficient`} value={c.v} onChange={(e) => maj(c.id, { v: Number(e.target.value) })} />
                  <span aria-hidden="true">%</span>
                </span>
              )}
              <button type="button" className="icon-btn small" aria-label={`Retirer ${c.nom || 'cette ligne'}`} onClick={() => onChange(choix.filter((x) => x.id !== c.id))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn-text small" onClick={() => onChange([...choix, { id: nouvelId(), nom: '', v: mode === 'prix' ? 0 : 100 }])}>
        + Ajouter
      </button>
    </div>
  );
}

function Bloc({ titre, actif, onActif, aide, children, sansInterrupteur = false }) {
  return (
    <fieldset className="card dv-bloc">
      <legend>{titre}</legend>
      {!sansInterrupteur && (
        <label className="q-toggle compact">
          <input type="checkbox" checked={actif} onChange={(e) => onActif(e.target.checked)} />
          <span>
            <span className="q-option-title">Utiliser dans le calculateur</span>
            {aide && <span className="q-option-hint">{aide}</span>}
          </span>
        </label>
      )}
      {(actif || sansInterrupteur) && children}
    </fieldset>
  );
}

export default function ReglagesCalculateur({ data, agir, garde }) {
  const [c, setC] = useState(() => data.calculateur);
  const [modifie, setModifie] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [essai, setEssai] = useState(false);
  const [modele, setModele] = useState(data.calculateur?.modele || 'impression3d');
  const [confirmer, setConfirmer] = useState(false);
  useEffect(() => {
    garde.current = modifie || null;
    return () => {
      garde.current = null;
    };
  }, [modifie, garde]);
  const franchise = data.entreprise.franchise;
  const set = (k, patch) => {
    setModifie(true);
    setC((x) => ({ ...x, [k]: { ...x[k], ...patch } }));
  };
  const setRacine = (patch) => {
    setModifie(true);
    setC((x) => ({ ...x, ...patch }));
  };
  async function enregistrer() {
    setBusy(true);
    setErr('');
    try {
      const r = await agir({ action: 'calculateur', calculateur: c });
      setC(r.calculateur);
      setModifie(false);
      garde.current = null;
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  async function appliquerModele() {
    setBusy(true);
    setErr('');
    try {
      const r = await agir({ action: 'calculateur.modele', modele });
      setC(r.calculateur);
      setModifie(false);
      setConfirmer(false);
      garde.current = null;
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  if (!c) return null;
  const m = c.matiere;
  const t = c.temps;
  return (
    <div className="dv-reglage">
      <p className="muted">
        Vos tarifs pour le calculateur d’estimation : dans un devis, <strong>+ Calculer</strong> (ou <strong>Calculateur</strong> dans la liste des devis) transforme une estimation en lignes de devis. Les montants sont {franchise ? 'nets (TVA non applicable)' : 'hors taxes'}.
      </p>
      <div className="row-actions">
        <button type="button" className="btn secondary" onClick={() => setEssai(true)}>
          Essayer le calculateur
        </button>
      </div>

      <Bloc titre="Général" sansInterrupteur>
        <div className="dv-grille">
          <Texte id="dv-c-titre" label="Titre du calculateur" value={c.titre} onChange={(v) => setRacine({ titre: v })} />
          {!franchise && (
            <div className="q-field">
              <label className="q-label" htmlFor="dv-c-tva">
                TVA des lignes créées
              </label>
              <select id="dv-c-tva" value={c.tva} onChange={(e) => setRacine({ tva: Number(e.target.value) })}>
                {TAUX_TVA.map((x) => (
                  <option key={x.v} value={x.v}>
                    {x.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Bloc>

      <Bloc titre={`Matière : ${m.titre}`} actif={m.actif} onActif={(v) => set('matiere', { actif: v })} aide="Une quantité saisie × un prix selon le choix (ex. grammes × prix de la bobine)">
        <div className="dv-grille">
          <Texte id="dv-c-m-titre" label="Nom du poste sur le devis" value={m.titre} onChange={(v) => set('matiere', { titre: v })} />
          <Texte id="dv-c-m-champ" label="Quantité demandée" value={m.champ} onChange={(v) => set('matiere', { champ: v })} />
          <Texte id="dv-c-m-unite" label="Unité saisie" aide="Ex. g, m², pers." value={m.unite} max={12} onChange={(v) => set('matiere', { unite: v })} />
          <Texte id="dv-c-m-achat" label="Prix exprimé par" aide="Ex. kg, m², personne" value={m.uniteAchat} max={20} onChange={(v) => set('matiere', { uniteAchat: v })} />
          <div className="q-field">
            <label className="q-label" htmlFor="dv-c-m-facteur">
              1 {m.uniteAchat || '…'} = combien de {m.unite || '…'} ?
            </label>
            <p className="q-hint">Ex. 1 kg = 1 000 g. Mettez 1 si c’est la même unité.</p>
            <input id="dv-c-m-facteur" type="number" min={1} inputMode="numeric" value={m.facteur} onChange={(e) => set('matiere', { facteur: Number(e.target.value) })} />
          </div>
          <Texte id="dv-c-m-liste" label="Nom de la liste" aide="Ex. Matériau, Essence, Menu" value={m.choixTitre} onChange={(v) => set('matiere', { choixTitre: v })} />
        </div>
        <ListeChoix nomListe={m.choixTitre} choix={m.choix} onChange={(choix) => set('matiere', { choix })} suffixe={`€ / ${m.uniteAchat || 'unité'}`} />
        <Texte id="dv-c-m-aide" label="Aide affichée sous la quantité" value={m.aide} max={160} onChange={(v) => set('matiere', { aide: v })} />
        <Texte id="dv-c-m-desc" label="Texte ajouté sur la ligne du devis" value={m.description} max={200} large onChange={(v) => set('matiere', { description: v })} />
      </Bloc>

      <Bloc titre={`Coefficient de matière : ${c.coefMatiere.titre}`} actif={c.coefMatiere.actif} onActif={(v) => set('coefMatiere', { actif: v })} aide="Multiplie la quantité de matière (ex. remplissage, pertes). 100 % = sans changement">
        <Texte id="dv-c-cm-titre" label="Nom" value={c.coefMatiere.titre} onChange={(v) => set('coefMatiere', { titre: v })} />
        <ListeChoix nomListe={c.coefMatiere.titre} mode="coef" choix={c.coefMatiere.choix} onChange={(choix) => set('coefMatiere', { choix })} />
      </Bloc>

      <Bloc titre={`Temps : ${t.titre}`} actif={t.actif} onActif={(v) => set('temps', { actif: v })} aide="Heures × taux horaire, plus vos forfaits, avec votre marge">
        <div className="dv-grille">
          <Texte id="dv-c-t-titre" label="Nom du poste sur le devis" value={t.titre} onChange={(v) => set('temps', { titre: v })} />
          <Texte id="dv-c-t-champ" label="Temps demandé" value={t.champ} onChange={(v) => set('temps', { champ: v })} />
          <Texte id="dv-c-t-unite" label="Unité" value={t.unite} max={12} onChange={(v) => set('temps', { unite: v })} />
          <div className="q-field">
            <label className="q-label" htmlFor="dv-c-t-taux">
              Taux horaire
            </label>
            <ChampEuros id="dv-c-t-taux" value={t.taux} onChange={(v) => set('temps', { taux: v })} label="Taux horaire" suffixe={`€ / ${t.unite || 'h'}`} />
          </div>
          <div className="q-field">
            <label className="q-label" htmlFor="dv-c-t-fc">
              Forfait par commande
            </label>
            <ChampEuros id="dv-c-t-fc" value={t.forfaitCommande} onChange={(v) => set('temps', { forfaitCommande: v })} label="Forfait par commande" suffixe="€" />
          </div>
          {c.pieces.actif && (
            <div className="q-field">
              <label className="q-label" htmlFor="dv-c-t-fp">
                Forfait par pièce
              </label>
              <ChampEuros id="dv-c-t-fp" value={t.forfaitPiece} onChange={(v) => set('temps', { forfaitPiece: v })} label="Forfait par pièce" suffixe="€" />
            </div>
          )}
          <Pourcent id="dv-c-t-marge" label="Marge" aide="Ajoutée au temps et aux forfaits" value={t.marge} onChange={(v) => set('temps', { marge: v })} />
        </div>
        <Texte id="dv-c-t-aide" label="Aide affichée sous le temps" value={t.aide} max={160} onChange={(v) => set('temps', { aide: v })} />
        <Texte id="dv-c-t-desc" label="Texte ajouté sur la ligne du devis" value={t.description} max={200} large onChange={(v) => set('temps', { description: v })} />
      </Bloc>

      <Bloc titre={`Coefficient de temps : ${c.coefTemps.titre}`} actif={c.coefTemps.actif} onActif={(v) => set('coefTemps', { actif: v })} aide="Multiplie le temps (ex. qualité d’impression, difficulté). 100 % = sans changement">
        <Texte id="dv-c-ct-titre" label="Nom" value={c.coefTemps.titre} onChange={(v) => set('coefTemps', { titre: v })} />
        <ListeChoix nomListe={c.coefTemps.titre} mode="coef" choix={c.coefTemps.choix} onChange={(choix) => set('coefTemps', { choix })} />
      </Bloc>

      <Bloc titre="Nombre de pièces" actif={c.pieces.actif} onActif={(v) => set('pieces', { actif: v })} aide="La matière, le temps et le forfait par pièce sont multipliés par ce nombre">
        <Texte id="dv-c-p-champ" label="Libellé" value={c.pieces.champ} onChange={(v) => set('pieces', { champ: v })} />
      </Bloc>

      {[
        ['options', 'Options (cases à cocher)', 'Chaque option cochée ajoute son prix'],
        ['delais', 'Délai', 'Un supplément selon le délai choisi'],
        ['livraison', 'Livraison ou déplacement', 'Un prix selon le mode choisi'],
      ].map(([k, nom, aide]) => (
        <Bloc key={k} titre={`${nom} : ${c[k].titre}`} actif={c[k].actif} onActif={(v) => set(k, { actif: v })} aide={aide}>
          <Texte id={`dv-c-${k}-titre`} label="Nom" value={c[k].titre} onChange={(v) => set(k, { titre: v })} />
          <ListeChoix nomListe={c[k].titre} choix={c[k].choix} onChange={(choix) => set(k, { choix })} />
          <Texte id={`dv-c-${k}-desc`} label="Texte ajouté sur la ligne du devis" value={c[k].description} max={200} large onChange={(v) => set(k, { description: v })} />
        </Bloc>
      ))}

      <Bloc titre="Repartir d’un modèle" sansInterrupteur>
        <p className="muted small">Remplace tous vos réglages du calculateur par ceux d’un modèle, à adapter ensuite.</p>
        <div className="row-actions">
          <select aria-label="Modèle" value={modele} onChange={(e) => setModele(e.target.value)}>
            {LISTE_MODELES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nom}
              </option>
            ))}
          </select>
          {confirmer ? (
            <>
              <button type="button" className="btn primary small danger" disabled={busy} onClick={appliquerModele}>
                Remplacer mes réglages
              </button>
              <button type="button" className="btn-text small" onClick={() => setConfirmer(false)}>
                Annuler
              </button>
            </>
          ) : (
            <button type="button" className="btn secondary small" onClick={() => setConfirmer(true)}>
              Appliquer ce modèle
            </button>
          )}
        </div>
      </Bloc>

      <div className="dv-barre-totaux">
        <span className="muted small">{modifie ? 'Modifications non enregistrées' : 'À jour'}</span>
        <button type="button" className="btn primary" onClick={enregistrer} disabled={busy || !modifie}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      {err && (
        <p className="q-error" role="alert">
          {err}
        </p>
      )}
      {essai && <Calculateur calc={nettoyerCalculateur({ ...c, actif: true })} franchise={franchise} onClose={() => setEssai(false)} />}
    </div>
  );
}
