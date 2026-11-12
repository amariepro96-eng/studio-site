'use client';
// Onglet « Mise en page et textes » : les sections de chaque page, comme dans l'éditeur d'une boutique en ligne.
// À gauche la liste (glisser pour réordonner, œil pour masquer, + pour ajouter), un clic ouvre les réglages ;
// l'aperçu à droite se met à jour tout de suite. Rien n'est en ligne avant « Publier ».
import { useEffect, useState } from 'react';
import { Texte, Zone, Confirmer } from './Champs.jsx';
import { Section } from './Rubriques.jsx';
import { MODULES, TEXTES, LISTES, NOMS_HEROS, BLOC_SITE, nomModule, textesDuModule, listeDuModule, photosDuModule, modulesAjoutables, blocsDePage } from '../../../engine/edition.js';
import { nouvelId, MAX_PHOTOS } from '../../../engine/espace.js';
import { prepareImage } from '../../../ai/images.js';
import { uploadImage } from '../../api.js';

const FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// ---------- Champs de texte d'une section ----------
function ChampsTextes({ cles, etat, maj, lecture, boutique }) {
  const liste = cles.filter((k) => TEXTES[k] && (!TEXTES[k].boutique || boutique) && etat.textes);
  if (!liste.length) return null;
  return (
    <div className="ed-champs">
      {liste.map((k) => {
        const d = TEXTES[k];
        const props = {
          key: k,
          label: d.label,
          aide: d.aide,
          max: d.max,
          value: etat.textes[k],
          disabled: lecture,
          placeholder: k === 'heroBouton' ? 'Automatique' : k === 'reviewsTitle' ? 'Ils nous font confiance' : undefined,
          onChange: (v) =>
            maj((b) => {
              b.textes[k] = v;
            }),
        };
        return d.lignes > 1 ? <Zone {...props} rows={Math.min(d.lignes, 8)} /> : <Texte {...props} />;
      })}
    </div>
  );
}

// Points forts, valeurs, étapes : titre + texte, on ajoute ou retire des lignes
function ChampsListe({ cle, etat, maj, lecture, erreurs }) {
  const d = LISTES[cle];
  const items = etat.listes?.[cle];
  if (!d || !items) return null;
  return (
    <fieldset className="ed-liste">
      <legend>{d.label}</legend>
      {items.map((it, i) => (
        <div key={it.id} className="ed-liste-item">
          <Texte
            label={`${d.label.replace(/s$/, '')} ${i + 1} : titre`}
            max={120}
            value={it.titre}
            erreur={erreurs[`listes.${cle}.${i}.titre`]}
            disabled={lecture}
            onChange={(v) =>
              maj((b) => {
                b.listes[cle][i].titre = v;
              })
            }
          />
          <Zone
            label="Texte"
            rows={2}
            max={400}
            value={it.texte}
            disabled={lecture}
            onChange={(v) =>
              maj((b) => {
                b.listes[cle][i].texte = v;
              })
            }
          />
          {!lecture && (
            <button
              type="button"
              className="btn-text small quiet"
              onClick={() =>
                maj((b) => {
                  b.listes[cle].splice(i, 1);
                })
              }
            >
              Retirer cette ligne
            </button>
          )}
        </div>
      ))}
      {!lecture && items.length < d.max && (
        <button
          type="button"
          className="btn secondary small"
          onClick={() =>
            maj((b) => {
              b.listes[cle].push({ id: nouvelId(cle.slice(0, 2) + 'n'), titre: '', texte: '' });
            })
          }
        >
          {d.ajout}
        </button>
      )}
    </fieldset>
  );
}

// ---------- Photos imposées à un emplacement ----------
function ChampPhotos({ cle, n, etat, maj, lecture, images, onChoisir }) {
  const choix = etat.edition?.photos?.[cle] || [];
  const parId = new Map(images.map((im) => [im.id, im]));
  const vues = choix.map((id) => parId.get(id)).filter(Boolean);
  return (
    <div className="ed-photos">
      <p className="q-label">{n > 1 ? `Photos (${n} au plus)` : 'Photo'}</p>
      {vues.length ? (
        <ul className="ed-vignettes">
          {vues.map((im, i) => (
            <li key={im.id}>
              <img src={im.thumb || im.url} alt="" loading="lazy" />
              {n > 1 && <span className="ed-num">{i + 1}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="q-hint">Choisie automatiquement parmi les photos du site.</p>
      )}
      {!lecture && (
        <div className="row-actions">
          <button type="button" className="btn secondary small" onClick={() => onChoisir({ cle, n })}>
            {vues.length ? 'Changer' : n > 1 ? 'Choisir les photos' : 'Choisir la photo'}
          </button>
          {vues.length > 0 && (
            <button
              type="button"
              className="btn-text small quiet"
              onClick={() =>
                maj((b) => {
                  delete b.edition.photos[cle];
                })
              }
            >
              Revenir au choix automatique
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Fenêtre de choix des photos : un clic ajoute, un second retire ; l'ordre des clics est l'ordre sur le site
function ChoixPhotos({ demande, etat, maj, images, ctx, onFermer }) {
  const [choix, setChoix] = useState(etat.edition?.photos?.[demande.cle] || []);
  const [envoi, setEnvoi] = useState(null);
  const plein = etat.photos.length >= MAX_PHOTOS;
  const basculer = (id) =>
    setChoix((c) => {
      if (c.includes(id)) return c.filter((x) => x !== id);
      if (demande.n === 1) return [id];
      return c.length >= demande.n ? c : [...c, id];
    });
  async function ajouter(file) {
    if (!file) return;
    if (!(FORMATS.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))) return setEnvoi({ erreur: 'Format non accepté : choisissez une photo JPEG, PNG ou WebP.' });
    if (file.size > 30 * 1024 * 1024) return setEnvoi({ erreur: 'Photo trop lourde (plus de 30 Mo) : choisissez-en une autre.' });
    setEnvoi({ cours: 'Envoi de la photo…' });
    try {
      const prep = await prepareImage(file);
      const img = await uploadImage(`/api/espace/${ctx.id}/images${ctx.q}`, prep.blob, { filename: 'photo.jpg' });
      maj((b) => {
        b.photos.push({ id: img.id, ext: img.ext, alt: '' });
      });
      setChoix((c) => (demande.n === 1 ? [img.id] : c.length >= demande.n ? c : [...c, img.id]));
      setEnvoi({ ok: 'Photo ajoutée aux photos du site. Pensez à lui donner une description dans « Photos ».' });
    } catch (e) {
      setEnvoi({ erreur: e?.message || 'L’envoi n’a pas abouti. Réessayez.' });
    }
    return undefined;
  }
  return (
    <div className="sheet-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="sheet ed-sheet" role="dialog" aria-modal="true" aria-labelledby="ed-photos-titre">
        <h2 id="ed-photos-titre">{demande.n > 1 ? `Choisir jusqu’à ${demande.n} photos` : 'Choisir une photo'}</h2>
        <p className="muted small">{demande.n > 1 ? 'Touchez les photos dans l’ordre où elles doivent apparaître. Les places restantes sont complétées automatiquement.' : 'Touchez la photo à afficher à cet endroit.'}</p>
        <ul className="ed-galerie">
          {images.map((im) => {
            const rang = choix.indexOf(im.id);
            return (
              <li key={im.id}>
                <button type="button" className={rang >= 0 ? 'on' : ''} aria-pressed={rang >= 0} onClick={() => basculer(im.id)} title={im.alt || ''}>
                  <img src={im.thumb || im.url} alt={im.alt || 'Photo'} loading="lazy" />
                  {rang >= 0 && <span className="ed-num">{demande.n > 1 ? rang + 1 : '✓'}</span>}
                  {im.source !== 'client' && <span className="ed-source">{im.source === 'ia' && !im.reel ? 'Illustration' : im.source === 'unsplash' ? 'Banque d’images' : 'Photo'}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {envoi?.erreur && <p className="q-error">{envoi.erreur}</p>}
        {envoi?.ok && <p className="q-hint">{envoi.ok}</p>}
        <div className="row-actions">
          <button
            type="button"
            className="btn primary"
            disabled={!choix.length}
            onClick={() => {
              maj((b) => {
                b.edition.photos[demande.cle] = choix;
              });
              onFermer();
            }}
          >
            Valider
          </button>
          {!plein && (
            <label className={`btn secondary file-btn${envoi?.cours ? ' disabled' : ''}`}>
              {envoi?.cours || 'Ajouter une photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                disabled={!!envoi?.cours}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  ajouter(f);
                }}
              />
            </label>
          )}
          <button type="button" className="btn-text" onClick={onFermer}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Réglages d'un bloc (section de l'accueil ou bloc d'une page) ----------
function Reglages({ bloc, etat, maj, lecture, erreurs, boutique, images, onChoisirPhotos, ouvrirOnglet }) {
  return (
    <div className="ed-reglages">
      {bloc.aide && <p className="q-hint">{bloc.aide}</p>}
      <ChampsTextes cles={bloc.textes || []} etat={etat} maj={maj} lecture={lecture} boutique={boutique} />
      {bloc.liste && <ChampsListe cle={bloc.liste} etat={etat} maj={maj} lecture={lecture} erreurs={erreurs} />}
      {bloc.faq && (
        <div className="ed-champs">
          {etat.faq.map((f, i) => (
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
          ))}
        </div>
      )}
      {bloc.photos && <ChampPhotos cle={bloc.photos.cle} n={bloc.photos.n} etat={etat} maj={maj} lecture={lecture} images={images} onChoisir={onChoisirPhotos} />}
      {bloc.lien && (
        <button type="button" className="btn-text small" onClick={() => ouvrirOnglet(bloc.lien)}>
          {bloc.lien === 'horaires' ? 'Ouvrir « Horaires et contact »' : bloc.lien === 'boutique' ? 'Ouvrir « Boutique »' : 'Ouvrir la rubrique de l’offre'} →
        </button>
      )}
    </div>
  );
}

// ---------- Page d'accueil : la liste des sections ----------
function SectionsAccueil({ etat, maj, lecture, erreurs, boutique, offre, heroes, heroModele, images, choisi, onChoisir, onChoisirPhotos, ouvrirOnglet }) {
  const liste = etat.edition?.accueil;
  const [glisse, setGlisse] = useState(null);
  const [cible, setCible] = useState(null);
  const [ajout, setAjout] = useState(false);
  const [retrait, setRetrait] = useState(null);
  if (!liste) return <p className="muted small">La mise en page de l’accueil n’est pas disponible pour ce site.</p>;
  const deplacer = (de, vers) =>
    maj((b) => {
      const l = b.edition.accueil;
      if (vers < 1 || vers >= l.length || de < 1) return;
      const [s] = l.splice(de, 1);
      l.splice(vers, 0, s);
    });
  const ajouter = (t) => {
    const id = `${t.slice(0, 8)}${nouvelId('').slice(0, 5)}`;
    const i = Math.max(1, liste.findIndex((s) => s.id === choisi) + 1 || liste.length);
    maj((b) => {
      b.edition.accueil.splice(i, 0, { id, t, v: MODULES[t].variantes?.[0]?.v || '' });
    });
    setAjout(false);
    onChoisir(id, true);
  };
  const nom = (s) => nomModule(s.t, { boutique, offre });
  return (
    <>
      <ul className="ed-sections" aria-label="Sections de la page d’accueil">
        {liste.map((s, i) => {
          const ouvert = choisi === s.id;
          const fixe = s.t === 'hero';
          const variantes = s.t === 'hero' ? heroes.map((v) => ({ v, label: NOMS_HEROS[v] || v })) : MODULES[s.t]?.variantes || [];
          const bloc = { aide: MODULES[s.t]?.aide, textes: textesDuModule(s.t, s.v), liste: listeDuModule(s.t, s.v), lien: MODULES[s.t]?.lien, photos: photosDuModule(s.t, s.v || (s.t === 'hero' ? heroModele : '')) ? { cle: s.id, n: photosDuModule(s.t, s.v || (s.t === 'hero' ? heroModele : '')) } : null };
          return (
            <li
              key={s.id}
              id={`ed-s-${s.id}`}
              className={`ed-section${ouvert ? ' open' : ''}${s.cache ? ' cache' : ''}${cible === i && glisse !== null && glisse !== i ? ' cible' : ''}`}
              draggable={!lecture && !fixe}
              onDragStart={(e) => {
                setGlisse(i);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', s.id);
              }}
              onDragOver={(e) => {
                if (glisse === null || fixe) return;
                e.preventDefault();
                setCible(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (glisse !== null && !fixe) deplacer(glisse, i);
                setGlisse(null);
                setCible(null);
              }}
              onDragEnd={() => {
                setGlisse(null);
                setCible(null);
              }}
            >
              <div className="ed-section-tete">
                <span className={`ed-poignee${fixe || lecture ? ' off' : ''}`} aria-hidden="true" title={fixe ? 'Toujours en premier' : 'Glisser pour déplacer'}>
                  ⋮⋮
                </span>
                <button type="button" className="ed-section-nom" aria-expanded={ouvert} onClick={() => onChoisir(ouvert ? null : s.id, !ouvert)}>
                  <span>{nom(s)}</span>
                  {s.cache && <small>masquée</small>}
                </button>
                {!fixe && !lecture && (
                  <button
                    type="button"
                    className={`ed-oeil${s.cache ? ' off' : ''}`}
                    aria-pressed={!s.cache}
                    aria-label={s.cache ? `Afficher « ${nom(s)} »` : `Masquer « ${nom(s)} »`}
                    title={s.cache ? 'Afficher' : 'Masquer'}
                    onClick={() =>
                      maj((b) => {
                        const x = b.edition.accueil[i];
                        if (x.cache) delete x.cache;
                        else x.cache = true;
                      })
                    }
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      {s.cache && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" />}
                    </svg>
                  </button>
                )}
              </div>
              {ouvert && (
                <div className="ed-section-corps">
                  {variantes.length > 0 && (
                    <div className="q-field">
                      <label className="q-label" htmlFor={`ed-style-${s.id}`}>
                        Style
                      </label>
                      <select
                        id={`ed-style-${s.id}`}
                        value={s.v || ''}
                        disabled={lecture}
                        onChange={(e) =>
                          maj((b) => {
                            b.edition.accueil[i].v = e.target.value;
                          })
                        }
                      >
                        {(s.t === 'hero' || !variantes.some((x) => x.v === '')) && <option value="">{s.t === 'hero' ? `Comme le modèle (${NOMS_HEROS[heroModele] || heroModele})` : 'Comme le style du site'}</option>}
                        {variantes.map((x) => (
                          <option key={x.v} value={x.v}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <Reglages bloc={bloc} etat={etat} maj={maj} lecture={lecture} erreurs={erreurs} boutique={boutique} images={images} onChoisirPhotos={onChoisirPhotos} ouvrirOnglet={ouvrirOnglet} />
                  {!lecture && !fixe && (
                    <div className="ed-section-actions">
                      <button type="button" className="btn-text small" disabled={i <= 1} onClick={() => deplacer(i, i - 1)}>
                        ↑ Monter
                      </button>
                      <button type="button" className="btn-text small" disabled={i >= liste.length - 1} onClick={() => deplacer(i, i + 1)}>
                        ↓ Descendre
                      </button>
                      <Confirmer
                        label="Supprimer la section"
                        question="Supprimer cette section ?"
                        oui="Supprimer"
                        className="btn-text small danger"
                        ouvert={retrait === s.id}
                        setOuvert={(o) => setRetrait(o ? s.id : null)}
                        onConfirm={() => {
                          maj((b) => {
                            b.edition.accueil.splice(i, 1);
                            delete b.edition.photos[s.id];
                          });
                          onChoisir(null);
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!lecture &&
        (ajout ? (
          <div className="ed-ajout">
            <p className="q-label">Ajouter une section{choisi ? ' sous la section ouverte' : ' en bas de la page'}</p>
            <ul>
              {modulesAjoutables(boutique).map((t) => (
                <li key={t}>
                  <button type="button" onClick={() => ajouter(t)}>
                    <b>{nomModule(t, { boutique, offre })}</b>
                    {MODULES[t].aide && <small>{MODULES[t].aide}</small>}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-text small" onClick={() => setAjout(false)}>
              Annuler
            </button>
          </div>
        ) : (
          <button type="button" className="ed-ajouter" onClick={() => setAjout(true)}>
            <span aria-hidden="true">＋</span> Ajouter une section
          </button>
        ))}
    </>
  );
}

// ---------- Autres pages : blocs fixes ----------
function BlocsPage({ blocs, etat, maj, lecture, erreurs, boutique, images, choisi, onChoisir, onChoisirPhotos, ouvrirOnglet }) {
  if (!blocs.length) return <p className="muted small">Cette page se remplit toute seule avec les informations du dossier : rien à régler ici.</p>;
  return (
    <ul className="ed-sections" aria-label="Blocs de la page">
      {blocs.map((bl) => {
        const ouvert = choisi === bl.id;
        return (
          <li key={bl.id} id={`ed-s-${bl.id}`} className={`ed-section${ouvert ? ' open' : ''}`}>
            <div className="ed-section-tete">
              <span className="ed-poignee off" aria-hidden="true">
                ⋮⋮
              </span>
              <button type="button" className="ed-section-nom" aria-expanded={ouvert} onClick={() => onChoisir(ouvert ? null : bl.id, !ouvert)}>
                <span>{bl.label}</span>
              </button>
            </div>
            {ouvert && (
              <div className="ed-section-corps">
                <Reglages bloc={bl} etat={etat} maj={maj} lecture={lecture} erreurs={erreurs} boutique={boutique} images={images} onChoisirPhotos={onChoisirPhotos} ouvrirOnglet={ouvrirOnglet} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------- L'onglet ----------
export function Editeur({ etat, maj, erreurs, lecture, ctx, pages, page, onPage, choisi, onChoisir, images, boutique, offre, heroes, heroModele, ouvrirOnglet }) {
  const [photos, setPhotos] = useState(null);
  const [site, setSite] = useState(false);
  const pageEditable = pages.filter((p) => p.slug !== 'mentions-legales');
  const slug = pageEditable.some((p) => p.slug === page) ? page : 'index';
  const commun = { etat, maj, lecture, erreurs, boutique, images, onChoisirPhotos: setPhotos, ouvrirOnglet };
  // Section choisie dans l'aperçu : la liste la montre
  useEffect(() => {
    if (!choisi) return;
    const el = document.getElementById(`ed-s-${choisi}`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [choisi]);
  if (!etat.textes || !etat.edition) {
    return (
      <Section id="sec-editeur" titre="Mise en page et textes">
        <p className="muted small">Rechargez la page pour utiliser l’éditeur.</p>
      </Section>
    );
  }
  return (
    <Section id="sec-editeur" titre="Mise en page et textes" intro="Touchez une section, ici ou dans l’aperçu, pour changer ses textes, son style et ses photos. Glissez les sections pour changer leur ordre ; l’œil les masque.">
      <div className="q-field ed-page">
        <label className="q-label" htmlFor="ed-page">
          Page
        </label>
        <select id="ed-page" value={slug} onChange={(e) => onPage(e.target.value)}>
          {pageEditable.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.slug === 'index' ? 'Accueil' : p.label}
            </option>
          ))}
        </select>
      </div>
      {slug === 'index' ? (
        <SectionsAccueil {...commun} offre={offre} heroes={heroes} heroModele={heroModele} choisi={choisi} onChoisir={onChoisir} />
      ) : (
        <BlocsPage {...commun} blocs={blocsDePage(slug, { boutique, offre })} choisi={choisi} onChoisir={onChoisir} />
      )}
      <div className={`ed-section ed-site${site ? ' open' : ''}`}>
        <div className="ed-section-tete">
          <button type="button" className="ed-section-nom" aria-expanded={site} onClick={() => setSite((x) => !x)}>
            <span>{BLOC_SITE.label}</span>
          </button>
        </div>
        {site && (
          <div className="ed-section-corps">
            <Reglages bloc={BLOC_SITE} {...commun} />
          </div>
        )}
      </div>
      {photos && <ChoixPhotos demande={photos} etat={etat} maj={maj} images={images} ctx={ctx} onFermer={() => setPhotos(null)} />}
    </Section>
  );
}
