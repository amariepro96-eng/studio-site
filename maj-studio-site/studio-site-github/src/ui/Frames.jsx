'use client';
import { useEffect, useRef, useState } from 'react';

// Vignette : la page d'accueil rendue en 1280 px puis réduite à la largeur de la carte
export function ThumbFrame({ html, title }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const update = () => setScale(el.clientWidth / 1280 || 0.3);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="thumb" ref={box}>
      <iframe title={title} srcDoc={html} sandbox="allow-scripts" tabIndex={-1} aria-hidden="true" loading="lazy" style={{ transform: `scale(${scale})` }} />
    </div>
  );
}

const WIDTHS = { desktop: '100%', tablet: '820px', mobile: '390px' };

// Aperçu interactif : les liens du site changent de page via un message envoyé au parent
export function DeviceFrame({ html, device = 'desktop', onNavigate, title }) {
  const ref = useRef(null);
  useEffect(() => {
    function onMsg(e) {
      if (ref.current && e.source === ref.current.contentWindow && e.data && e.data.type === 'site-nav') onNavigate?.(String(e.data.page));
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onNavigate]);
  return (
    <div className={`device device-${device}`}>
      <iframe ref={ref} title={title} srcDoc={html} sandbox="allow-scripts allow-forms" style={{ width: WIDTHS[device] || '100%' }} />
    </div>
  );
}

export function DeviceToggle({ value, onChange }) {
  const opts = [
    ['desktop', 'Ordinateur'],
    ['tablet', 'Tablette'],
    ['mobile', 'Mobile'],
  ];
  return (
    <div className="seg" role="group" aria-label="Taille d’écran">
      {opts.map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function PageTabs({ pages, value, onChange }) {
  return (
    <div className="tabs" role="tablist" aria-label="Pages du site">
      {pages.map((p) => (
        <button key={p.slug} type="button" role="tab" aria-selected={value === p.slug} onClick={() => onChange(p.slug)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}
