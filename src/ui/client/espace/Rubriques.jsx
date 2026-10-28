'use client';
// Rubriques modifiables de l'espace client : chacune correspond à ce que le site affiche déjà
import { useState } from 'react';
import { Texte, Zone, DateChamp, Choix, Interrupteur, Confirmer } from './Champs.jsx';
import { FETES, prochaineFete, jourTexte, annonceVisible, prochainAffichage, texteAnnonce, iconeSvg, iconeDe, nouvelId, faqLiees, decaler, PREAVIS_FERMETURE, MAX_PHOTOS, jourValide } from '../../../engine/espace.js';
import { formatPrice } from '../../../engine/util.js';
import { prepareImage } from '../../../ai/images.js';
import { uploadImage } from '../../api.js';

// Dessins maison (chaînes SVG fixes du moteur, jamais du contenu saisi)
const Svg = ({ html, className }) => <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;

export function Section({ titre, intro, children, id }) {
  return (
    <section className="esp-section" aria-labelledby={id}>
      <h2 id={id}>{titre}</h2>
      {intro && <p className="esp-intro">{intro}</p>}
      {children}
    </section>
  );
}

const quandAffiche = (a, jour) => {
  if (annonceVisible(a, jour)) return 'affiché en ce moment';
  const p = prochainAffichage(a, jour);
  return p?.du ? `affiché à partir du ${jourTexte(p.du)}` : 'période terminée';
};

// Bandeau tel qu'il apparaît en haut du site
function Bandeau({ a }) {
  const f = a.type === 'fete' ? FETES.find((x) => x.id === a.fete) : null;
  const style = f ? { background: f.c.band, color: f.c.fg } : undefined;
  return (
    <div className={`esp-bandeau esp-bandeau-${a.type}`} style={style}>
      <Svg html={iconeSvg(iconeDe(a), 18)} />
      <span>{texteAnnonce(a)}</span>
    </div>
  );
}

// ---------- Horaires et contact ----------
export function Horaires({ etat, maj, erreurs, lecture, ctx }) {
  const fermetures = etat.annonces.map((a, i) => ({ a, i })).filter((x) => x.a.type === 'fermeture');
  const liees = faqLiees(etat, ctx.briefAvant);
  const indexFaq = (fid) => etat.faq.findIndex((f) => f.id === fid);
  const set = (k) => (v) =>
    maj((b) => {
      b[k] = v;
    });
  return (
    <>
      <Section id="sec-horaires" titre="Horaires" intro="Une ligne par jour ou par groupe de jours. Ils s’affichent sur la page Contact et en bas des pages.">
        <Zone label="Vos horaires" rows={5} max={600} value={etat.horaires} onChange={set('horaires')} placeholder={'Mardi – samedi : 7 h – 19 h 30\nDimanche : 7 h – 13 h\nFermé le lundi'} disabled={lecture} />
      </Section>

      <Section id="sec-fermetures" titre="Fermetures exceptionnelles" intro={`Congés, jour férié, inventaire : un bandeau s’affiche sur toutes les pages ${PREAVIS_FERMETURE / 7} semaines avant, puis disparaît tout seul après la date de fin.`}>
        {fermetures.length === 0 && <p className="muted small">Aucune fermeture prévue.</p>}
        {fermetures.map(({ a, i }) => (
          <div className="esp-item" key={a.id}>
            <div className="esp-row2">
              <DateChamp
                label="Du"
                value={a.du}
                min={ctx.jour}
                disabled={lecture}
                onChange={(v) =>
                  maj((b) => {
                    b.annonces[i].du = v;
                    if (!b.annonces[i].au || b.annonces[i].au < v) b.annonces[i].au = v;
                  })
                }
              />
              <DateChamp
                label="Au (inclus)"
                value={a.au}
                min={a.du || ctx.jour}
                disabled={lecture}
                onChange={(v) =>
                  maj((b) => {
                    b.annonces[i].au = v;
                  })
                }
              />
            </div>
            {erreurs[`annonces.${i}.dates`] && <p className="q-error">{erreurs[`annonces.${i}.dates`]}</p>}
            <Texte
              label="Précision (facultatif)"
              max={60}
              value={a.message}
              placeholder="Ex. : congés annuels"
              disabled={lecture}
              onChange={(v) =>
                maj((b) => {
                  b.annonces[i].message = v;
                })
              }
            />
            {jourValide(a.du) && jourValide(a.au) && (
              <div className="esp-ex">
                <Bandeau a={a} />
                <span className="muted small">{quandAffiche(a, ctx.jour)}</span>
              </div>
            )}
            <div className="esp-item-actions">
              {jourValide(a.du) && (
                <button type="button" className="btn-text small" onClick={() => ctx.voir('index', a.du)}>
                  Voir dans l’aperçu
                </button>
              )}
              {!lecture && (
                <button
                  type="button"
                  className="btn-text small quiet"
                  onClick={() =>
                    maj((b) => {
                      b.annonces.splice(i, 1);
                    })
                  }
                >
                  Retirer
                </button>
              )}
            </div>
          </div>
        ))}
        {!lecture && (
          <button
            type="button"
            className="btn secondary small"
            onClick={() =>
              maj((b) => {
                b.annonces.push({ id: nouvelId('a'), type: 'fermeture', du: '', au: '', message: '' });
              })
            }
          >
            Ajouter une fermeture
          </button>
        )}
      </Section>

      {liees.length > 0 && (
        <Section id="sec-faq" titre="Votre FAQ en parle aussi" intro="Ces réponses de la page Questions fréquentes citent vos horaires ou vos coordonnées : relisez-les si vous les avez changés.">
          {liees.map((f) => {
            const i = indexFaq(f.id);
            return (
              <Zone
                key={f.id}
                label={f.q}
                rows={3}
                max={800}
                value={f.a}
                erreur={erreurs[`faq.${i}.a`]}
                disabled={lecture}
                onChange={(v) =>
                  maj((b) => {
                    b.faq[i].a = v;
                  })
                }
              />
            );
          })}
        </Section>
      )}

      <Section id="sec-coord" titre="Coordonnées" intro="Partout où le site cite votre ancien numéro, votre ancien e-mail ou votre ancienne adresse, ils sont remplacés.">
        <div className="esp-grid2">
          <Texte label="Téléphone" type="tel" max={40} value={etat.telephone} onChange={set('telephone')} erreur={erreurs.telephone} moitie inputMode="tel" autoComplete="off" disabled={lecture} />
          <Texte label="E-mail" type="email" max={120} value={etat.email} onChange={set('email')} erreur={erreurs.email} moitie autoComplete="off" disabled={lecture} />
          <Texte label="Adresse" max={200} value={etat.adresse} onChange={set('adresse')} disabled={lecture} />
          <Texte label="Instagram" max={200} value={etat.instagram} onChange={set('instagram')} erreur={erreurs.instagram} moitie placeholder="https://www.instagram.com/…" disabled={lecture} />
          <Texte label="Facebook" max={200} value={etat.facebook} onChange={set('facebook')} erreur={erreurs.facebook} moitie placeholder="https://www.facebook.com/…" disabled={lecture} />
        </div>
      </Section>
    </>
  );
}

// ---------- Services, carte, prestations et boutique ----------
function statutPuce(it, produit) {
  if (it.statut === 'rupture') return <span className="tag wait">Rupture</span>;
  if (it.statut === 'indispo') return <span className="tag wait">Indisponible</span>;
  if (it.statut === 'offre') return <span className="tag ok">Offre{jourValide(it.offreFin) ? ` jusqu’au ${jourTexte(it.offreFin)}` : ''}</span>;
  return <span className="tag">{produit ? 'En vente' : 'Disponible'}</span>;
}

export function Liste({ etat, maj, erreurs, lecture, ctx, cle, mots }) {
  const liste = etat[cle] || [];
  const produit = cle === 'produits';
  const [ouvert, setOuvert] = useState(null);
  const [retrait, setRetrait] = useState(null);
  const categories = produit ? [...new Set(liste.map((p) => p.categorie).filter(Boolean))] : [];
  const champ = (i, k) => (v) =>
    maj((b) => {
      b[cle][i][k] = v;
    });
  const deplacer = (i, d) =>
    maj((b) => {
      const l = b[cle];
      [l[i + d], l[i]] = [l[i], l[i + d]];
    });
  return (
    <Section id={`sec-${cle}`} titre={mots.titre} intro={mots.intro}>
      {liste.length === 0 && <p className="muted small">{mots.vide}</p>}
      <ul className="esp-liste">
        {liste.map((it, i) => {
          const err = (k) => erreurs[`${cle}.${i}.${k}`];
          const enErreur = Object.keys(erreurs).some((k) => k.startsWith(`${cle}.${i}.`));
          const open = ouvert === it.id || enErreur;
          const prix = it.statut === 'offre' && it.offrePrix ? `${formatPrice(it.offrePrix)} au lieu de ${formatPrice(it.prix) || '…'}` : formatPrice(it.prix);
          return (
            <li key={it.id} className={`esp-ligne${open ? ' open' : ''}${enErreur ? ' err' : ''}`}>
              <button type="button" className="esp-ligne-tete" aria-expanded={open} onClick={() => setOuvert(open && !enErreur ? null : it.id)}>
                <span className="esp-ligne-txt">
                  <span className="esp-ligne-nom">{it.nom || mots.sansNom}</span>
                  {(prix || produit) && <span className="esp-ligne-prix">{prix || 'Prix sur demande'}</span>}
                </span>
                {statutPuce(it, produit)}
                <span className="esp-chevron" aria-hidden="true" />
              </button>
              {open && (
                <div className="esp-ligne-corps">
                  <div className="esp-grid2">
                    <Texte label="Nom" max={80} value={it.nom} onChange={champ(i, 'nom')} erreur={err('nom')} disabled={lecture} />
                    <Texte label={produit ? 'Prix (€)' : 'Prix'} max={produit ? 20 : 40} value={it.prix} onChange={champ(i, 'prix')} erreur={err('prix')} placeholder={produit ? 'Ex. : 4,50' : 'Ex. : 45 € ou à partir de 30 €'} moitie inputMode={produit ? 'decimal' : undefined} disabled={lecture} />
                    {produit && (
                      <>
                        <Texte label="Rayon" max={40} value={it.categorie} onChange={champ(i, 'categorie')} moitie placeholder={categories[0] ? `Ex. : ${categories[0]}` : 'Ex. : Pains'} disabled={lecture} />
                        <Texte label="Étiquette (facultatif)" max={24} value={it.etiquette} onChange={champ(i, 'etiquette')} moitie placeholder="Ex. : Nouveau" disabled={lecture} />
                      </>
                    )}
                  </div>
                  <Zone label="Description" rows={2} max={500} value={it.description} onChange={champ(i, 'description')} disabled={lecture} />
                  <Choix
                    legende="Sur le site"
                    options={produit ? [{ id: '', label: 'En vente' }, { id: 'rupture', label: 'Rupture de stock' }, { id: 'offre', label: 'En offre' }] : [{ id: '', label: 'Disponible' }, { id: 'indispo', label: 'Momentanément indisponible' }, { id: 'offre', label: 'En offre' }]}
                    value={it.statut || ''}
                    disabled={lecture}
                    onChange={(v) =>
                      maj((b) => {
                        const x = b[cle][i];
                        x.statut = v;
                        if (v === 'offre' && !x.offreFin) x.offreFin = decaler(ctx.jour, 7);
                      })
                    }
                  />
                  {it.statut === 'offre' && (
                    <div className="esp-row2">
                      <Texte label="Prix pendant l’offre" max={produit ? 20 : 40} value={it.offrePrix} onChange={champ(i, 'offrePrix')} erreur={err('offrePrix')} placeholder="Ex. : 3,90" moitie inputMode="decimal" disabled={lecture} />
                      <DateChamp label="Jusqu’au (inclus)" value={it.offreFin} min={ctx.jour} onChange={champ(i, 'offreFin')} erreur={err('offreFin')} disabled={lecture} />
                    </div>
                  )}
                  <p className="q-hint">
                    {it.statut === 'offre'
                      ? 'Le prix habituel apparaît barré à côté du prix de l’offre. Après la date de fin, le prix habituel revient tout seul.'
                      : it.statut === 'rupture'
                        ? 'Le site affiche « Rupture de stock » et le bouton Ajouter est désactivé. Remettez « En vente » dès qu’il revient.'
                        : it.statut === 'indispo'
                          ? 'Le site affiche « Momentanément indisponible » à côté du nom.'
                          : ''}
                  </p>
                  {!lecture && (
                    <div className="esp-item-actions">
                      <button type="button" className="icon-btn small" aria-label={`Monter « ${it.nom || mots.sansNom} »`} disabled={i === 0} onClick={() => deplacer(i, -1)}>
                        ↑
                      </button>
                      <button type="button" className="icon-btn small" aria-label={`Descendre « ${it.nom || mots.sansNom} »`} disabled={i === liste.length - 1} onClick={() => deplacer(i, 1)}>
                        ↓
                      </button>
                      <Confirmer
                        label="Retirer du site"
                        question={`Retirer « ${it.nom || mots.sansNom} » ?`}
                        oui="Retirer"
                        className="btn-text small quiet"
                        ouvert={retrait === it.id}
                        setOuvert={(o) => setRetrait(o ? it.id : null)}
                        onConfirm={() =>
                          maj((b) => {
                            b[cle].splice(i, 1);
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!lecture && (
        <button
          type="button"
          className="btn secondary small"
          onClick={() => {
            const nid = nouvelId(produit ? 'p' : 's');
            maj((b) => {
              b[cle].push({ id: nid, nom: '', description: '', prix: '', statut: '', offrePrix: '', offreFin: '', ...(produit ? { categorie: categories[0] || '', etiquette: '' } : {}) });
            });
            setOuvert(nid);
          }}
        >
          {mots.ajouter}
        </button>
      )}
    </Section>
  );
}

// ---------- Annonces et fêtes ----------
function periodeFete(f, a, jour) {
  const an = (d) => (d ? Number(d.slice(0, 4)) : '');
  if (a) {
    const p = `du ${jourTexte(a.du)} au ${jourTexte(a.au)}`;
    if (a.annuel === false) return `Cette année seulement, ${p}`;
    return f.mobile ? `Chaque année, selon le calendrier (en ${an(a.au)} : ${p})` : `Chaque année, ${p}`;
  }
  const n = prochaineFete(f, jour);
  return n ? `Habituellement du ${jourTexte(n.du)} au ${jourTexte(n.au)}` : '';
}

export function Annonces({ etat, maj, erreurs, lecture, ctx }) {
  const aujourd = etat.annonces.filter((a) => jourValide(a.du) && jourValide(a.au) && texteAnnonce(a).trim() && annonceVisible(a, ctx.jour));
  const infos = etat.annonces.map((a, i) => ({ a, i })).filter((x) => x.a.type === 'info');
  const dates = (a, i, { min = ctx.jour } = {}) => (
    <>
      <div className="esp-row2">
        <DateChamp
          label="Du"
          value={a.du}
          min={a.type === 'fete' && a.annuel !== false ? undefined : min}
          disabled={lecture}
          onChange={(v) =>
            maj((b) => {
              b.annonces[i].du = v;
              if (!b.annonces[i].au || b.annonces[i].au < v) b.annonces[i].au = v;
            })
          }
        />
        <DateChamp
          label="Au (inclus)"
          value={a.au}
          min={a.du || min}
          disabled={lecture}
          onChange={(v) =>
            maj((b) => {
              b.annonces[i].au = v;
            })
          }
        />
      </div>
      {erreurs[`annonces.${i}.dates`] && <p className="q-error">{erreurs[`annonces.${i}.dates`]}</p>}
    </>
  );
  return (
    <>
      <Section id="sec-auj" titre="Sur votre site aujourd’hui">
        {aujourd.length ? (
          <div className="esp-bandeaux">
            {aujourd.map((a) => (
              <Bandeau key={a.id} a={a} />
            ))}
          </div>
        ) : (
          <p className="muted small">Aucun bandeau aujourd’hui : votre site a son allure habituelle.</p>
        )}
      </Section>

      <Section id="sec-fetes" titre="Fêtes et temps forts" intro="Choisissez vos fêtes une fois pour toutes : chaque bandeau s’allume et s’éteint tout seul aux dates prévues. Les couleurs et la mise en page de votre site ne changent pas.">
        <ul className="esp-fetes">
          {FETES.map((f) => {
            const i = etat.annonces.findIndex((a) => a.type === 'fete' && a.fete === f.id);
            const a = i >= 0 ? etat.annonces[i] : null;
            return (
              <li key={f.id} className={a ? 'on' : ''}>
                <div className="esp-fete-tete">
                  <span className="esp-fete-ico" style={{ background: f.c.band, color: f.c.motif }}>
                    <Svg html={iconeSvg(f.icone, 18)} />
                  </span>
                  <span className="esp-fete-nom">
                    <b>{f.nom}</b>
                    <small>{periodeFete(f, a, ctx.jour)}</small>
                  </span>
                  <Interrupteur
                    label={f.nom}
                    cache
                    checked={!!a}
                    disabled={lecture}
                    onChange={(on) =>
                      maj((b) => {
                        if (on) {
                          const p = prochaineFete(f, ctx.jour);
                          b.annonces.push({ id: nouvelId('a'), type: 'fete', fete: f.id, annuel: true, du: p.du, au: p.au, message: f.message });
                        } else b.annonces = b.annonces.filter((x) => !(x.type === 'fete' && x.fete === f.id));
                      })
                    }
                  />
                </div>
                {a && (
                  <div className="esp-fete-corps">
                    <Texte
                      label="Message du bandeau"
                      max={120}
                      value={a.message}
                      erreur={erreurs[`annonces.${i}.message`]}
                      disabled={lecture}
                      onChange={(v) =>
                        maj((b) => {
                          b.annonces[i].message = v;
                        })
                      }
                    />
                    {dates(a, i)}
                    <label className="q-toggle compact">
                      <input
                        type="checkbox"
                        checked={a.annuel !== false}
                        disabled={lecture}
                        onChange={(e) =>
                          maj((b) => {
                            b.annonces[i].annuel = e.target.checked;
                          })
                        }
                      />
                      <span>
                        <span className="q-option-title">Revenir chaque année</span>
                        {f.mobile && <span className="q-option-hint">Les dates suivent le calendrier de {f.nom.toLowerCase().startsWith('fête') ? 'la ' : ''}{f.nom} chaque année.</span>}
                      </span>
                    </label>
                    <div className="esp-item-actions">
                      <button type="button" className="btn-text small" onClick={() => ctx.voir('index', annonceVisible(a, ctx.jour) ? ctx.jour : prochainAffichage(a, ctx.jour)?.du || a.du)}>
                        Voir dans l’aperçu
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section id="sec-infos" titre="Autres annonces" intro="Une information à mettre en avant quelques jours : nouveauté, événement, horaires d’été…">
        {infos.map(({ a, i }) => (
          <div className="esp-item" key={a.id}>
            <Texte
              label="Message du bandeau"
              max={120}
              value={a.message}
              erreur={erreurs[`annonces.${i}.message`]}
              placeholder="Ex. : Nouveau : le pain au levain, tous les samedis"
              disabled={lecture}
              onChange={(v) =>
                maj((b) => {
                  b.annonces[i].message = v;
                })
              }
            />
            {dates(a, i)}
            <div className="esp-item-actions">
              {jourValide(a.du) && (
                <button type="button" className="btn-text small" onClick={() => ctx.voir('index', a.du < ctx.jour ? ctx.jour : a.du)}>
                  Voir dans l’aperçu
                </button>
              )}
              {!lecture && (
                <button
                  type="button"
                  className="btn-text small quiet"
                  onClick={() =>
                    maj((b) => {
                      b.annonces.splice(i, 1);
                    })
                  }
                >
                  Retirer
                </button>
              )}
            </div>
          </div>
        ))}
        {!lecture && (
          <button
            type="button"
            className="btn secondary small"
            onClick={() =>
              maj((b) => {
                b.annonces.push({ id: nouvelId('a'), type: 'info', du: ctx.jour, au: decaler(ctx.jour, 14), message: '' });
              })
            }
          >
            Ajouter une annonce
          </button>
        )}
        <p className="muted small esp-renvoi">
          Les fermetures exceptionnelles se règlent dans{' '}
          <button type="button" className="btn-text small" onClick={() => ctx.ouvrir('horaires')}>
            Horaires et contact
          </button>
          .
        </p>
      </Section>
    </>
  );
}

// ---------- Photos ----------
const FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function Photos({ etat, maj, erreurs, lecture, ctx }) {
  const [envoi, setEnvoi] = useState(null);
  const [retrait, setRetrait] = useState(null);
  const items = [...etat.photos.map((p, i) => ({ p, i, type: 'photo' })), ...etat.ia.map((p, i) => ({ p, i, type: 'ia' }))];
  const illustrations = etat.ia.filter((p) => !p.reel).length;
  const plein = !illustrations && etat.photos.length >= MAX_PHOTOS;

  async function choisir(file, cible) {
    if (!file) return;
    if (!(FORMATS.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))) {
      setEnvoi({ erreur: 'Format non accepté : choisissez une photo JPEG, PNG ou WebP.' });
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setEnvoi({ erreur: 'Photo trop lourde (plus de 30 Mo) : choisissez-en une autre.' });
      return;
    }
    setEnvoi({ cours: 'Préparation de la photo…' });
    try {
      let prep;
      try {
        prep = await prepareImage(file);
      } catch {
        throw new Error('Cette photo n’a pas pu être lue. Essayez-en une autre (JPEG ou PNG).');
      }
      setEnvoi({ cours: 'Envoi de la photo…' });
      const img = await uploadImage(`/api/espace/${ctx.id}/images${ctx.q}`, prep.blob, { filename: 'photo.jpg' });
      maj((b) => {
        const neuve = { id: img.id, ext: img.ext, alt: '' };
        if (cible.type === 'photo') b.photos[cible.i] = neuve;
        else if (cible.type === 'ia') b.ia[cible.i] = { ...neuve, reel: true };
        else {
          const k = b.ia.findIndex((x) => !x.reel);
          if (k >= 0) b.ia[k] = { ...neuve, reel: true };
          else b.photos.push(neuve);
        }
      });
      const petite = Math.max(prep.width, prep.height) < 1000;
      setEnvoi({ ok: `Photo prête (${prep.width} × ${prep.height} px). Ajoutez une courte description, puis publiez pour la mettre en ligne.${petite ? ' Elle est petite : elle peut paraître floue en grand.' : ''}` });
    } catch (e) {
      setEnvoi({ erreur: e?.message || 'L’envoi n’a pas abouti. Réessayez.' });
    }
  }

  const fichier = (cible, label, cls = 'btn secondary small') => (
    <label className={`${cls} file-btn${envoi?.cours ? ' disabled' : ''}`}>
      {label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        disabled={!!envoi?.cours}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          choisir(f, cible);
        }}
      />
    </label>
  );

  return (
    <Section id="sec-photos" titre="Photos" intro="Remplacez une image depuis votre téléphone ou votre ordinateur. Elle est recadrée, allégée et débarrassée de sa localisation avant l’envoi.">
      <ul className="esp-photos">
        {items.map(({ p, i, type }, n) => {
          const illus = type === 'ia' && !p.reel;
          return (
            <li key={p.id}>
              <div className="esp-photo-img">
                <img src={ctx.src(p.id)} alt="" loading="lazy" />
                <span className={`esp-photo-badge${illus ? ' illus' : ''}`}>{illus ? 'Illustration' : 'Votre photo'}</span>
                <span className="esp-photo-num" aria-hidden="true">
                  {n + 1}
                </span>
              </div>
              <Texte
                label={`Description de l’image ${n + 1}`}
                max={160}
                value={p.alt}
                placeholder={illus ? 'Image d’ambiance' : 'Ex. : la vitrine au petit matin'}
                disabled={lecture}
                onChange={(v) =>
                  maj((b) => {
                    b[type === 'ia' ? 'ia' : 'photos'][i].alt = v;
                  })
                }
              />
              {!lecture && (
                <div className="esp-item-actions">
                  {fichier({ type, i }, illus ? 'Mettre ma photo' : 'Remplacer')}
                  {type === 'photo' && (
                    <Confirmer
                      label="Retirer"
                      question="Retirer cette photo ?"
                      oui="Retirer"
                      className="btn-text small quiet"
                      ouvert={retrait === p.id}
                      setOuvert={(o) => setRetrait(o ? p.id : null)}
                      onConfirm={() =>
                        maj((b) => {
                          b.photos.splice(i, 1);
                        })
                      }
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!lecture && (
        <div className="esp-ajout-photo">
          {!plein && fichier({ type: 'nouvelle' }, 'Ajouter une photo', 'btn primary small')}
          <p className="q-hint">
            {illustrations
              ? `Une nouvelle photo prend la place de la première image d’illustration : la mise en page ne bouge pas. ${illustrations > 1 ? `Il reste ${illustrations} illustrations.` : 'C’est la dernière illustration.'}`
              : plein
                ? `${MAX_PHOTOS} photos au maximum : remplacez-en une, ou retirez-en une pour en ajouter une autre.`
                : `${etat.photos.length} photo${etat.photos.length > 1 ? 's' : ''} sur ${MAX_PHOTOS}.`}
          </p>
        </div>
      )}
      {envoi?.cours && (
        <p className="esp-envoi" role="status">
          <span className="gen-dot" aria-hidden="true" /> {envoi.cours}
        </p>
      )}
      {envoi?.ok && (
        <p className="side-note" role="status">
          {envoi.ok}
        </p>
      )}
      {(envoi?.erreur || erreurs.photos) && (
        <p className="q-error" role="alert">
          {envoi?.erreur || erreurs.photos}
        </p>
      )}
    </Section>
  );
}
