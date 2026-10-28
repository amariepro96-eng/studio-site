'use client';
// La bulle : explication détaillée d'un problème, accrochée à la tuile du site.
// Sur téléphone, elle s'ouvre comme un panneau qui monte du bas de l'écran.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Explication, { NIVEAUX, depuisTexte } from './Explication.jsx';

export function useEtroit(query = '(max-width: 640px)') {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const maj = () => setM(mq.matches);
    maj();
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, [query]);
  return m;
}

// Fermeture par Échap, focus dans le panneau, puis rendu à l'élément d'origine
export function useDialogue(ref, onClose, retour) {
  useEffect(() => {
    const prec = document.activeElement;
    ref.current?.focus({ preventScroll: true });
    const key = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      const cible = retour?.isConnected ? retour : prec;
      cible?.focus?.({ preventScroll: true });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function Bulle({ site, probleme, ancre, onClose, onVerifier, verif, onFiche }) {
  const ref = useRef(null);
  const etroit = useEtroit();
  const [pos, setPos] = useState(null);
  useDialogue(ref, onClose, ancre);

  useLayoutEffect(() => {
    if (etroit || !ancre?.isConnected) return undefined;
    const placer = () => {
      const r = ancre.getBoundingClientRect();
      const w = Math.min(460, window.innerWidth - 32);
      const left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), window.innerWidth - w - 16);
      const h = ref.current?.offsetHeight || 320;
      const dessous = window.innerHeight - r.bottom - 24;
      const dessus = r.top - 84; // sous la barre du haut
      // Dessous par défaut ; au-dessus seulement si la bulle y tient entière
      const enHaut = dessous < h && dessus >= h;
      const top = enHaut ? r.top + window.scrollY - h - 14 : r.bottom + window.scrollY + 14;
      const fleche = Math.min(Math.max(22, r.left + r.width / 2 - left), w - 22);
      setPos({ top, left: left + window.scrollX, w, enHaut, fleche, defiler: !enHaut && dessous < h });
    };
    placer();
    window.addEventListener('resize', placer);
    return () => window.removeEventListener('resize', placer);
  }, [ancre, etroit, probleme?.id, probleme?.niveau, Boolean(probleme)]);

  // Bulle plus haute que la place sous la tuile : on fait défiler la page pour la montrer en entier
  const defiler = pos?.defiler;
  useEffect(() => {
    if (!defiler || !ref.current) return;
    const doux = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current.scrollIntoView({ block: 'nearest', behavior: doux ? 'smooth' : 'auto' });
  }, [defiler]);

  const niveau = probleme?.niveau || 'ok';
  const style = etroit ? undefined : pos ? { top: pos.top, left: pos.left, width: pos.w, '--fleche': `${pos.fleche}px` } : { top: 0, left: 0, visibility: 'hidden', width: 460 };

  return (
    <>
      <div className={`bulle-fond${etroit ? ' sombre' : ''}`} onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        className={`bulle niveau-${niveau}${etroit ? ' bulle-feuille' : ''}${pos?.enHaut ? ' en-haut' : ''}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulle-titre"
        tabIndex={-1}
      >
        <div className="bulle-tete">
          <div>
            <p className="bulle-site">
              {site.nom}
              {probleme && <span className={`niveau-pill niveau-${niveau}`}>{NIVEAUX[niveau]?.court}</span>}
            </p>
            <h3 id="bulle-titre">{probleme ? probleme.titre : 'Problème réglé'}</h3>
            {probleme?.depuis && <p className="muted small">{depuisTexte(probleme.depuis)}</p>}
          </div>
          <button type="button" className="icon-btn small" aria-label="Fermer l’explication" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="bulle-corps">
          {probleme ? (
            <>
              <p className="bulle-resume">{probleme.resume}</p>
              <Explication p={probleme} onVerifier={onVerifier} verif={verif} />
            </>
          ) : (
            <p className="bulle-regle">La dernière vérification ne montre plus ce problème. Rien d’autre à faire.</p>
          )}
          <button type="button" className="btn-text small" onClick={onFiche}>
            Voir la fiche du client
          </button>
        </div>
      </div>
    </>
  );
}
