'use client';
// Calculateur d'estimation (impression 3D, menuiserie, traiteur…) : l'artisan saisit la
// matière, le temps, les options ; l'estimation devient des lignes de devis.
import { useMemo, useState } from 'react';
import { Fenetre } from './commun.jsx';
import { euros, tauxLabel } from '../../engine/devis.js';
import { calculer, saisieVide, versLignes } from '../../engine/calculateur.js';

const plus = (v) => (v ? ` (+${euros(v)})` : '');

function Nombre({ id, label, aide, unite, value, onChange }) {
  return (
    <div className="q-field">
      <label className="q-label" htmlFor={id}>
        {label}
      </label>
      {aide && <p className="q-hint">{aide}</p>}
      <span className="dv-calc-nombre">
        <input id={id} type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, ''))} placeholder="0" autoComplete="off" />
        {unite && <span aria-hidden="true">{unite}</span>}
      </span>
    </div>
  );
}

function Liste({ id, label, aide, valeur, onChange, choix, texte }) {
  return (
    <div className="q-field">
      <label className="q-label" htmlFor={id}>
        {label}
      </label>
      {aide && <p className="q-hint">{aide}</p>}
      <select id={id} value={valeur} onChange={(e) => onChange(e.target.value)}>
        {choix.map((c) => (
          <option key={c.id} value={c.id}>
            {texte(c)}
          </option>
        ))}
      </select>
    </div>
  );
}

// calc : configuration ; onAjouter(lignes) facultatif (sans lui : simple essai)
export default function Calculateur({ calc, franchise, onAjouter, libelleAction = 'Ajouter au devis', onClose }) {
  const [s, setS] = useState(() => saisieVide(calc));
  const maj = (patch) => setS((x) => ({ ...x, ...patch }));
  const r = useMemo(() => calculer(calc, s), [calc, s]);
  const tva = franchise ? 0 : Math.round((r.total * calc.tva) / 10000);
  const c = calc;
  return (
    <Fenetre titre={c.titre} onClose={onClose} large="xl">
      <div className="dv-calc">
        <div className="dv-calc-saisie">
          {(c.coefTemps.actif || c.coefMatiere.actif) && (
            <div className="dv-grille">
              {c.coefTemps.actif && c.coefTemps.choix.length > 0 && <Liste id="dv-k-ct" label={c.coefTemps.titre} valeur={s.coefTempsId} onChange={(v) => maj({ coefTempsId: v })} choix={c.coefTemps.choix} texte={(x) => x.nom} />}
              {c.coefMatiere.actif && c.coefMatiere.choix.length > 0 && <Liste id="dv-k-cm" label={c.coefMatiere.titre} valeur={s.coefMatiereId} onChange={(v) => maj({ coefMatiereId: v })} choix={c.coefMatiere.choix} texte={(x) => x.nom} />}
            </div>
          )}
          {c.matiere.actif && <Nombre id="dv-k-q" label={c.matiere.champ} aide={c.matiere.aide} unite={c.matiere.unite} value={s.qte} onChange={(v) => maj({ qte: v })} />}
          {c.temps.actif && <Nombre id="dv-k-h" label={c.temps.champ} aide={c.temps.aide} unite={c.temps.unite} value={s.heures} onChange={(v) => maj({ heures: v })} />}
          {c.pieces.actif && <Nombre id="dv-k-p" label={c.pieces.champ} value={s.pieces} onChange={(v) => maj({ pieces: v })} />}
          {c.matiere.actif && c.matiere.choix.length > 0 && <Liste id="dv-k-m" label={c.matiere.choixTitre} valeur={s.matiereId} onChange={(v) => maj({ matiereId: v })} choix={c.matiere.choix} texte={(x) => `${x.nom} (1 ${c.matiere.uniteAchat} : ${euros(x.v)})`} />}
          {c.options.actif && c.options.choix.length > 0 && (
            <fieldset className="q-field dv-calc-options">
              <legend className="q-label">{c.options.titre}</legend>
              {c.options.description && <p className="q-hint">{c.options.description}</p>}
              <div className="dv-calc-cases">
                {c.options.choix.map((o) => (
                  <label key={o.id} className="q-toggle compact">
                    <input type="checkbox" checked={s.options.includes(o.id)} onChange={(e) => maj({ options: e.target.checked ? [...s.options, o.id] : s.options.filter((x) => x !== o.id) })} />
                    <span>
                      <span className="q-option-title">
                        {o.nom}
                        {plus(o.v)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {(c.delais.actif || c.livraison.actif) && (
            <div className="dv-grille">
              {c.delais.actif && c.delais.choix.length > 0 && <Liste id="dv-k-d" label={c.delais.titre} aide={c.delais.description} valeur={s.delaiId} onChange={(v) => maj({ delaiId: v })} choix={c.delais.choix} texte={(x) => `${x.nom}${plus(x.v)}`} />}
              {c.livraison.actif && c.livraison.choix.length > 0 && <Liste id="dv-k-l" label={c.livraison.titre} aide={c.livraison.description} valeur={s.livraisonId} onChange={(v) => maj({ livraisonId: v })} choix={c.livraison.choix} texte={(x) => `${x.nom}${plus(x.v)}`} />}
            </div>
          )}
        </div>

        <aside className="dv-calc-resultat" aria-live="polite">
          <h3>Estimation</h3>
          <ul>
            {r.postes.map((p) => (
              <li key={p.id}>
                <span>
                  <strong>{p.libelle}</strong>
                  {p.detail && <small>{p.detail}</small>}
                </span>
                <span className="dv-calc-montant">{euros(p.montant)}</span>
              </li>
            ))}
          </ul>
          <div className="dv-calc-total">
            <span>{franchise ? 'Total' : 'Total HT'}</span>
            <strong>{euros(r.total)}</strong>
          </div>
          {!franchise && (
            <p className="dv-calc-ttc">
              TVA {tauxLabel(c.tva)} : {euros(tva)} · <strong>{euros(r.total + tva)} TTC</strong>
            </p>
          )}
          {onAjouter ? (
            <button type="button" className="btn primary block" disabled={r.total <= 0} onClick={() => onAjouter(versLignes(c, r))}>
              {libelleAction}
            </button>
          ) : (
            <p className="muted small">Essai : enregistrez vos tarifs, puis utilisez le calculateur depuis un devis.</p>
          )}
          <p className="muted small">Chaque poste devient une ligne du devis, que vous pouvez encore modifier.</p>
        </aside>
      </div>
    </Fenetre>
  );
}
