// Déclinaisons de chaque direction artistique : 4 versions par style, toutes différentes.
// La version 1 est le style d'origine (archetypes.js) ; les versions 2 à 4 sont définies ici.
// Chaque déclinaison a ses polices, ses palettes, ses formes, son haut de page (héros),
// son enchaînement de sections et sa propre feuille de style (classe .fl-<id>).
// Sources d'inspiration : tendances 2026 (typographie expressive, luxe discret, néo-brutalisme,
// formes organiques, dégradés), mouvements graphiques (Bauhaus, Memphis, Art déco, pop art,
// risographie) et sites de commerces de bouche (photo en vedette, ardoise, épicerie fine).

const gf = (name, weights) => ({ name, spec: `${name.replace(/ /g, '+')}:wght@${weights}` });

// Nom court de la version 1 (le style d'origine), affiché dans les onglets
export const BASE_LABELS = {
  epure: 'Suisse',
  editorial: 'Magazine',
  luxe: 'Nuit dorée',
  artisan: 'Terre cuite',
  tech: 'Dégradés',
  ludique: 'Confettis',
  brutal: 'Béton',
  nature: 'Forêt',
  corporate: 'Confiance',
  retro: 'Années 70',
  audacieux: 'Nuit vibrante',
  doux: 'Poudré',
};

const T = (o) => ({ radius: '0px', radiusLg: '0px', btnRadius: '0px', iconRadius: '50%', displayWeight: 400, tracking: '0em', case: 'none', lh: 1.06, h1: 'clamp(2.5rem, 5.4vw, 4.8rem)', h1Big: 'clamp(2.8rem, 7.6vw, 6.6rem)', bodySize: '17px', sectionPad: 'clamp(72px, 9vw, 120px)', ...o });

export const FLAVORS = {
  // ---------------------------------------------------------------- Épuré
  epure: [
    {
      id: 'japandi',
      label: 'Japandi',
      name: 'japandi',
      fonts: { display: gf('Shippori Mincho', '500;600'), body: gf('Zen Kaku Gothic New', '400;500;700') },
      tokens: T({ radius: '4px', radiusLg: '6px', btnRadius: '2px', displayWeight: 500, tracking: '0.01em', lh: 1.2, h1: 'clamp(2.3rem, 4.6vw, 4rem)', h1Big: 'clamp(2.6rem, 6vw, 5.4rem)', bodySize: '16.5px', sectionPad: 'clamp(84px, 10vw, 150px)' }),
      palettes: [
        { bg: '#F3EFE8', surface: '#E8E1D5', text: '#2A2723', muted: '#625C54', primary: '#6B4F3A', accent: '#4F5D4E' },
        { bg: '#EEEDE7', surface: '#E0DED5', text: '#23262A', muted: '#5A5E63', primary: '#3E4A3D', accent: '#8A6D50' },
      ],
      heroes: ['centered', 'framed'],
      variants: { nav: ['center'], features: ['icons', 'lined'], services: ['menu', 'alternate'], about: ['split'], cta: ['boxed'], footer: ['columns'], products: ['minimal'] },
      recipes: [
        ['hero', 'statement:center', 'gallery:strip', 'offer:menu', 'offer2', 'about:split', 'cta:boxed', 'info'],
        ['hero', 'highlights:icons', 'offer:alternate', 'offer2', 'gallery:grid', 'band:quote', 'cta:boxed', 'info'],
      ],
      art: 'soft',
      footerMode: 'surface',
      deco: [],
      divider: null,
      css: `
.fl-japandi .site-header{border-bottom:1px solid var(--line-soft)}
.fl-japandi .btn{letter-spacing:.08em;font-weight:500}
.fl-japandi .visual img{filter:saturate(.82) contrast(.97)}
.fl-japandi .section-head{text-align:center;margin-left:auto;margin-right:auto}
.fl-japandi .feature{text-align:center}
.fl-japandi .feature .f-icon{margin-left:auto;margin-right:auto}`,
    },
    {
      id: 'mono-nuit',
      label: 'Mono nuit',
      name: 'monochrome de nuit',
      fonts: { display: gf('Inter Tight', '400;500;600;700'), body: null },
      tokens: T({ btnRadius: '999px', iconRadius: '0px', displayWeight: 600, tracking: '-0.04em', lh: 1.0, h1: 'clamp(2.6rem, 6vw, 5.6rem)', h1Big: 'clamp(3rem, 9vw, 8.4rem)', bodySize: '16.5px', sectionPad: 'clamp(72px, 9vw, 128px)' }),
      palettes: [
        { bg: '#0E0E0E', surface: '#191919', text: '#F2F2EE', muted: '#A2A29C', primary: '#FF5A1F', accent: '#F2F2EE' },
        { bg: '#101214', surface: '#1A1D21', text: '#EEF1F4', muted: '#9AA1A9', primary: '#5B8CFF', accent: '#EEF1F4' },
      ],
      heroes: ['cover', 'bigtype'],
      variants: { nav: ['bar', 'split'], features: ['lined'], services: ['menu', 'grid'], about: ['quote'], cta: ['band'], footer: ['big'], products: ['minimal'] },
      recipes: [
        ['hero', 'statement:left', 'offer:menu', 'offer2', 'gallery:strip', 'band:plain', 'cta:band', 'info'],
        ['hero', 'highlights:lined', 'gallery:grid', 'offer:grid', 'offer2', 'process:line', 'cta:band', 'info'],
      ],
      art: 'grid',
      footerMode: 'deep',
      deco: [],
      divider: null,
      css: `
.fl-mono-nuit .visual img{filter:grayscale(1) contrast(1.1)}
.fl-mono-nuit .section + .section{border-top:1px solid var(--line-soft)}
.fl-mono-nuit .btn.ghost{border-width:1px}
.fl-mono-nuit .svc-card{background:transparent}
.fl-mono-nuit .hero-cover h1{max-width:12ch}`,
    },
    {
      id: 'bento',
      label: 'Bento',
      name: 'grille bento',
      fonts: { display: gf('Geist', '400;500;600;700'), body: null },
      tokens: T({ radius: '18px', radiusLg: '26px', btnRadius: '12px', iconRadius: '12px', displayWeight: 600, tracking: '-0.03em', lh: 1.04, h1: 'clamp(2.5rem, 5.4vw, 4.8rem)', h1Big: 'clamp(2.8rem, 7.6vw, 6.4rem)', bodySize: '16.5px', sectionPad: 'clamp(64px, 8vw, 110px)' }),
      palettes: [
        { bg: '#F4F4F6', surface: '#FFFFFF', text: '#111114', muted: '#575763', primary: '#2A62F0', accent: '#FF7A59' },
        { bg: '#F3F5F0', surface: '#FFFFFF', text: '#141A12', muted: '#555D4C', primary: '#2E7D32', accent: '#E0A100' },
      ],
      heroes: ['mosaic', 'split'],
      variants: { nav: ['pill'], features: ['cards'], services: ['grid'], about: ['split'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:bento', 'gallery:bento', 'offer:cards', 'offer2', 'process:cards', 'cta:boxed', 'info'],
        ['hero', 'offer:grid', 'offer2', 'gallery:bento', 'highlights:cards', 'reviews', 'cta:boxed', 'info'],
      ],
      art: 'grid',
      footerMode: 'invert',
      deco: [],
      divider: null,
      css: `
.fl-bento .section.alt{background:transparent}
.fl-bento .svc-card,.fl-bento .feat-cards .feature{background:var(--surface);border:0;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.fl-bento .mosaic .visual,.fl-bento .hero-visual{box-shadow:0 1px 2px rgba(0,0,0,.06)}`,
    },
  ],

  // ---------------------------------------------------------------- Éditorial
  editorial: [
    {
      id: 'journal',
      label: 'Journal',
      name: 'journal',
      fonts: { display: gf('Playfair Display', '700;900'), body: gf('Source Serif 4', '400;600') },
      tokens: T({ iconRadius: '0px', displayWeight: 900, tracking: '-0.01em', lh: 1.0, h1: 'clamp(2.6rem, 6vw, 5.4rem)', h1Big: 'clamp(3rem, 9vw, 8rem)', bodySize: '17.5px', sectionPad: 'clamp(56px, 7vw, 96px)' }),
      palettes: [
        { bg: '#F2EFE6', surface: '#E7E2D4', text: '#111111', muted: '#47433B', primary: '#B3261E', accent: '#111111' },
        { bg: '#FFFFFF', surface: '#F0EEE8', text: '#0D0D0D', muted: '#4D4D4D', primary: '#0D0D0D', accent: '#B3261E' },
      ],
      heroes: ['bigtype', 'split'],
      variants: { nav: ['center'], features: ['lined'], services: ['menu'], about: ['quote'], cta: ['split'], footer: ['big'], products: ['minimal'] },
      recipes: [
        ['hero', 'statement:left', 'offer:menu', 'offer2', 'gallery:masonry', 'band:quote', 'reviews', 'cta:split', 'info'],
        ['hero', 'highlights:lined', 'about:quote', 'offer:menu', 'offer2', 'gallery:grid', 'cta:split', 'info'],
      ],
      art: 'serif',
      footerMode: 'surface',
      deco: [],
      divider: null,
      css: `
.fl-journal .site-header{border-bottom:4px double var(--text)}
.fl-journal .nav-center .nav-links{border-top:1px solid var(--text);border-bottom:1px solid var(--text);padding:8px 0}
.fl-journal .section + .section{border-top:1px solid var(--text)}
.fl-journal .hero-bigtype h1{max-width:none;text-align:center}
.fl-journal .lead{font-style:italic}
.fl-journal .story p:first-child::first-letter{float:left;font-family:var(--font-display);font-weight:900;font-size:4.4em;line-height:.8;padding:6px 10px 0 0}
.fl-journal .visual img{filter:grayscale(.4) contrast(1.05)}`,
    },
    {
      id: 'revue-art',
      label: 'Revue d’art',
      name: 'revue d’art',
      fonts: { display: gf('Instrument Serif', '400'), body: gf('Instrument Sans', '400;500;600') },
      tokens: T({ btnRadius: '999px', tracking: '-0.02em', lh: 0.98, h1: 'clamp(2.8rem, 6.6vw, 6rem)', h1Big: 'clamp(3.2rem, 10vw, 9rem)', bodySize: '16.5px', sectionPad: 'clamp(72px, 9vw, 128px)' }),
      palettes: [
        { bg: '#FFFFFF', surface: '#F2F0EC', text: '#121212', muted: '#5F5B55', primary: '#D93A21', accent: '#2440A6' },
        { bg: '#F5F2EC', surface: '#EAE5DB', text: '#1A1714', muted: '#635D55', primary: '#2440A6', accent: '#D93A21' },
      ],
      heroes: ['cover', 'split'],
      variants: { nav: ['bar'], features: ['lined'], services: ['alternate'], about: ['split'], cta: ['boxed'], footer: ['big'], products: ['minimal'] },
      recipes: [
        ['hero', 'gallery:masonry', 'statement:left', 'offer:alternate', 'offer2', 'band:duo', 'cta:boxed', 'info'],
        ['hero', 'about:split', 'gallery:strip', 'offer:alternate', 'offer2', 'reviews', 'cta:boxed', 'info'],
      ],
      art: 'serif',
      footerMode: 'invert',
      deco: [],
      divider: null,
      css: `
.fl-revue-art h1,.fl-revue-art h2{font-style:italic}
.fl-revue-art .hero-cover h1{font-size:var(--h1-big);max-width:12ch}
.fl-revue-art .gal-item figcaption{font-style:italic}
.fl-revue-art .site-header{border-bottom:1px solid var(--line-soft)}`,
    },
    {
      id: 'gazette',
      label: 'Gazette',
      name: 'gazette parisienne',
      fonts: { display: gf('Libre Caslon Display', '400'), body: gf('Libre Caslon Text', '400;700') },
      tokens: T({ radius: '2px', radiusLg: '2px', btnRadius: '2px', tracking: '-0.01em', lh: 1.05, h1: 'clamp(2.5rem, 5.4vw, 4.8rem)', bodySize: '17px' }),
      palettes: [
        { bg: '#F6F0E6', surface: '#EBE0CE', text: '#2A1F1A', muted: '#65564A', primary: '#1F4E3D', accent: '#A0522D' },
        { bg: '#F4EEE8', surface: '#E8DCD2', text: '#251A1E', muted: '#65565C', primary: '#6B1F2E', accent: '#2F4858' },
      ],
      heroes: ['split', 'framed'],
      variants: { nav: ['center'], features: ['icons'], services: ['menu'], about: ['quote'], cta: ['boxed'], footer: ['columns'], products: ['minimal'] },
      recipes: [
        ['hero', 'about:quote', 'offer:menu', 'offer2', 'gallery:polaroid', 'band:quote', 'cta:boxed', 'info'],
        ['hero', 'statement:center', 'highlights:icons', 'offer:menu', 'offer2', 'gallery:grid', 'reviews', 'cta:boxed', 'info'],
      ],
      art: 'serif',
      footerMode: 'primary',
      deco: [],
      divider: null,
      css: `
.fl-gazette .hero-split .hero-visual{border-radius:999px 999px 2px 2px}
.fl-gazette .story p:first-child::first-letter{float:left;font-family:var(--font-display);font-size:4em;line-height:.82;padding:6px 10px 0 0;color:var(--primary-ink)}
.fl-gazette .section-head h2::after{content:"";display:block;width:56px;height:2px;background:var(--primary-ink);margin-top:18px}
.fl-gazette .section-head.center h2::after{margin-left:auto;margin-right:auto}
.fl-gazette .site-header{border-bottom:1px solid var(--line-soft)}`,
    },
  ],

  // ---------------------------------------------------------------- Luxe
  luxe: [
    {
      id: 'ivoire',
      label: 'Ivoire',
      name: 'luxe discret',
      fonts: { display: gf('Bodoni Moda', '400;500'), body: gf('Manrope', '400;500;600') },
      tokens: T({ tracking: '-0.01em', lh: 1.04, h1: 'clamp(2.6rem, 5.8vw, 5.2rem)', h1Big: 'clamp(3rem, 8vw, 7rem)', bodySize: '16px', sectionPad: 'clamp(96px, 11vw, 170px)' }),
      palettes: [
        { bg: '#F1F0EB', surface: '#E6E3DA', text: '#1C1A17', muted: '#625D55', primary: '#3B2F25', accent: '#8C7148' },
        { bg: '#F4F3F0', surface: '#E7E6E1', text: '#161A22', muted: '#5C616D', primary: '#1E2A44', accent: '#7A6845' },
      ],
      heroes: ['centered', 'split'],
      variants: { nav: ['center'], features: ['lined'], services: ['alternate', 'menu'], about: ['quote'], cta: ['band'], footer: ['columns'], products: ['minimal'] },
      recipes: [
        ['hero', 'statement:center', 'offer:alternate', 'offer2', 'gallery:strip', 'band:quote', 'cta:band', 'info'],
        ['hero', 'highlights:lined', 'gallery:masonry', 'offer:menu', 'offer2', 'about:quote', 'cta:band', 'info'],
      ],
      art: 'arch',
      footerMode: 'surface',
      deco: [],
      divider: null,
      css: `
.fl-ivoire .btn{background:transparent;color:var(--text);border:1px solid var(--text);letter-spacing:.18em;text-transform:uppercase;font-size:.72rem;font-weight:600;padding:1.3em 2.4em}
.fl-ivoire .btn:hover{background:var(--text);color:var(--bg)}
.fl-ivoire .logo{letter-spacing:.24em;text-transform:uppercase;font-size:1rem}
.fl-ivoire .site-header{border-bottom:1px solid var(--line-soft)}
.fl-ivoire .visual img{filter:saturate(.8)}
.fl-ivoire .cta-band{background:var(--surface);color:var(--text)}`,
    },
    {
      id: 'couture',
      label: 'Couture',
      name: 'haute couture',
      fonts: { display: gf('Cinzel', '400;500;600'), body: gf('Montserrat', '300;400;500') },
      tokens: T({ displayWeight: 500, tracking: '0.06em', case: 'uppercase', lh: 1.1, h1: 'clamp(2.2rem, 5vw, 4.4rem)', h1Big: 'clamp(2.6rem, 7vw, 6rem)', bodySize: '16px', sectionPad: 'clamp(96px, 11vw, 160px)' }),
      palettes: [
        { bg: '#0B0B0B', surface: '#161616', text: '#F5F5F3', muted: '#A8A8A3', primary: '#F5F5F3', accent: '#B8B8B2' },
        { bg: '#FFFFFF', surface: '#F4F4F2', text: '#0B0B0B', muted: '#5C5C58', primary: '#0B0B0B', accent: '#6B6B66' },
      ],
      heroes: ['cover', 'overlay'],
      variants: { nav: ['split'], features: ['lined'], services: ['menu'], about: ['quote'], cta: ['band'], footer: ['big'], products: ['minimal'] },
      recipes: [
        ['hero', 'gallery:strip', 'statement:center', 'offer:menu', 'offer2', 'band:quote', 'cta:band', 'info'],
        ['hero', 'about:quote', 'gallery:masonry', 'offer:menu', 'offer2', 'cta:band', 'info'],
      ],
      art: 'arch',
      footerMode: 'deep',
      deco: [],
      divider: null,
      css: `
.fl-couture .btn{background:transparent;color:var(--text);border:1px solid currentColor;letter-spacing:.24em;text-transform:uppercase;font-size:.7rem;padding:1.35em 2.6em}
.fl-couture .hero-cover .btn,.fl-couture .hero-overlay .btn{color:#fff}
.fl-couture .logo{letter-spacing:.32em}
.fl-couture .visual img{filter:grayscale(1) contrast(1.05)}
.fl-couture .lead{letter-spacing:.02em}`,
    },
    {
      id: 'bordeaux',
      label: 'Bordeaux',
      name: 'marbre et bordeaux',
      fonts: { display: gf('Playfair Display', '400;500;600'), body: gf('Lato', '300;400;700') },
      tokens: T({ radius: '2px', radiusLg: '2px', btnRadius: '999px', displayWeight: 500, tracking: '-0.01em', lh: 1.08, bodySize: '16.5px', sectionPad: 'clamp(80px, 9vw, 136px)' }),
      palettes: [
        { bg: '#F7F2EE', surface: '#EBDDD4', text: '#2B1418', muted: '#684D53', primary: '#6E1A2B', accent: '#8A632E' },
        { bg: '#F6F3EF', surface: '#E6E0D8', text: '#1E1B2B', muted: '#5E5969', primary: '#2D2A5C', accent: '#866734' },
      ],
      heroes: ['split', 'panel'],
      variants: { nav: ['split'], features: ['icons'], services: ['alternate'], about: ['split'], cta: ['image'], footer: ['columns'], products: ['minimal'] },
      recipes: [
        ['hero', 'highlights:icons', 'offer:alternate', 'offer2', 'gallery:masonry', 'band:quote', 'cta:image', 'info'],
        ['hero', 'statement:center', 'about:split', 'offer:alternate', 'offer2', 'gallery:strip', 'cta:boxed', 'info'],
      ],
      art: 'arch',
      footerMode: 'primary-deep',
      deco: [],
      divider: null,
      css: `
.fl-bordeaux .hero-split .hero-visual,.fl-bordeaux .about-visual{border-radius:999px 999px 4px 4px}
.fl-bordeaux .hero h1{font-style:italic}
.fl-bordeaux .btn{padding:1.05em 2em;letter-spacing:.04em}
.fl-bordeaux .section.alt{background:linear-gradient(180deg,var(--surface),var(--bg))}`,
    },
  ],

  // ---------------------------------------------------------------- Artisan chaleureux
  artisan: [
    {
      id: 'campagne',
      label: 'Campagne',
      name: 'boulangerie de campagne',
      fonts: { display: gf('DM Serif Display', '400'), body: gf('Work Sans', '400;500;600') },
      tokens: T({ radius: '10px', radiusLg: '14px', btnRadius: '6px', tracking: '-0.005em', lh: 1.06, h1: 'clamp(2.6rem, 5.8vw, 5rem)', h1Big: 'clamp(3rem, 8vw, 6.8rem)', sectionPad: 'clamp(64px, 8vw, 112px)' }),
      palettes: [
        { bg: '#FAF6EE', surface: '#EFE6D4', text: '#3A2A1C', muted: '#6E5A48', primary: '#A65A24', accent: '#5B6B3A' },
        { bg: '#F8F3EA', surface: '#ECE2D0', text: '#2E2620', muted: '#675A4E', primary: '#7A3E22', accent: '#8F6A27' },
      ],
      heroes: ['overlay', 'panel'],
      variants: { nav: ['bar'], features: ['icons'], services: ['menu', 'grid'], about: ['split'], cta: ['image'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:icons', 'offer:menu', 'offer2', 'gallery:masonry', 'about:split', 'reviews', 'cta:image', 'info'],
        ['hero', 'statement:center', 'gallery:strip', 'offer:grid', 'offer2', 'process:image', 'reviews', 'cta:boxed', 'info'],
      ],
      art: 'blob',
      footerMode: 'invert',
      deco: [],
      divider: null,
      css: `
.fl-campagne .hero-overlay h1{max-width:14ch}
.fl-campagne .menu-row{border-bottom-style:dashed}
.fl-campagne .section-head h2::after{content:"";display:block;width:44px;height:3px;border-radius:3px;background:var(--primary);margin-top:16px}
.fl-campagne .section-head.center h2::after{margin-left:auto;margin-right:auto}`,
    },
    {
      id: 'epicerie',
      label: 'Épicerie fine',
      name: 'épicerie fine',
      fonts: { display: gf('Alegreya', '500;700'), body: gf('Alegreya Sans', '400;500;700') },
      tokens: T({ radius: '4px', radiusLg: '6px', btnRadius: '4px', displayWeight: 700, tracking: '-0.01em', lh: 1.06, h1: 'clamp(2.4rem, 5.2vw, 4.6rem)' }),
      palettes: [
        { bg: '#FDF8F0', surface: '#F1E2CC', text: '#24302A', muted: '#57635A', primary: '#1F5A4E', accent: '#87630F' },
        { bg: '#FBF7F1', surface: '#EFE3D3', text: '#2C2420', muted: '#64574F', primary: '#8E2C2C', accent: '#2F5B4F' },
      ],
      heroes: ['framed', 'split'],
      variants: { nav: ['center'], features: ['cards'], services: ['grid'], about: ['quote'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'offer:cards', 'offer2', 'highlights:cards', 'gallery:grid', 'about:quote', 'cta:boxed', 'info'],
        ['hero', 'statement:center', 'offer:grid', 'offer2', 'gallery:polaroid', 'reviews', 'cta:boxed', 'info'],
      ],
      art: 'blob',
      footerMode: 'primary',
      deco: [],
      divider: null,
      css: `
.fl-epicerie .hero-framed .frame::before{background:transparent;border:2px solid var(--primary);inset:-12px;border-radius:var(--radius)}
.fl-epicerie .svc-card,.fl-epicerie .feat-cards .feature,.fl-epicerie .product{border:1.5px solid var(--primary);outline:1px solid var(--primary);outline-offset:-6px}
.fl-epicerie .logo{font-style:italic}
.fl-epicerie .section-head{text-align:center;margin-left:auto;margin-right:auto}`,
    },
    {
      id: 'kraft',
      label: 'Atelier',
      name: 'atelier kraft',
      fonts: { display: gf('Zilla Slab', '500;700'), body: gf('Source Sans 3', '400;600') },
      tokens: T({ radius: '2px', radiusLg: '4px', btnRadius: '2px', iconRadius: '4px', displayWeight: 700, tracking: '-0.01em', lh: 1.04, h1: 'clamp(2.5rem, 5.6vw, 4.9rem)' }),
      palettes: [
        { bg: '#E9DCC6', surface: '#F4EBDD', text: '#2A2119', muted: '#57493C', primary: '#2B4C7E', accent: '#B04A26' },
        { bg: '#E4DDD0', surface: '#F2EDE4', text: '#1F2420', muted: '#4E554D', primary: '#A8401F', accent: '#2F5D50' },
      ],
      heroes: ['collage', 'centered'],
      variants: { nav: ['bar'], features: ['cards'], services: ['grid'], about: ['split'], cta: ['band'], footer: ['big'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:cards', 'gallery:polaroid', 'offer:grid', 'offer2', 'process:cards', 'reviews', 'cta:band', 'info'],
        ['hero', 'process:cards', 'offer:cards', 'offer2', 'gallery:polaroid', 'about:split', 'cta:band', 'info'],
      ],
      art: 'blocks',
      footerMode: 'invert',
      deco: [['scribble', 'tl']],
      divider: null,
      css: `
.fl-kraft .collage .visual,.fl-kraft .gal-item{box-shadow:0 10px 20px -12px rgba(0,0,0,.45)}
.fl-kraft .collage .visual::before{content:"";position:absolute;top:6px;left:50%;width:84px;height:22px;transform:translateX(-50%) rotate(-3deg);background:rgba(255,255,255,.6);z-index:2}
.fl-kraft .btn{box-shadow:3px 3px 0 var(--text)}
.fl-kraft .svc-card{background:var(--surface);border:1.5px dashed var(--muted)}`,
    },
  ],

  // ---------------------------------------------------------------- Moderne
  tech: [
    {
      id: 'aurora',
      label: 'Aurore',
      name: 'aurore de nuit',
      fonts: { display: gf('Sora', '500;600;700'), body: gf('Inter', '400;500') },
      tokens: T({ radius: '18px', radiusLg: '26px', btnRadius: '999px', iconRadius: '14px', displayWeight: 600, tracking: '-0.03em', lh: 1.04, h1: 'clamp(2.6rem, 5.8vw, 5.2rem)', bodySize: '16.5px' }),
      palettes: [
        { bg: '#0A0F1F', surface: '#121A33', text: '#EAF0FF', muted: '#9BA6C9', primary: '#5B8CFF', accent: '#8F45F5' },
        { bg: '#0B1414', surface: '#122220', text: '#E6FFF9', muted: '#93B8B0', primary: '#2BD9A8', accent: '#5B8CFF' },
      ],
      heroes: ['panel', 'centered'],
      variants: { nav: ['pill'], features: ['cards'], services: ['grid'], about: ['split'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:bento', 'offer:cards', 'offer2', 'gallery:grid', 'process:line', 'cta:boxed', 'info'],
        ['hero', 'offer:grid', 'offer2', 'band:plain', 'process:cards', 'reviews', 'cta:boxed', 'info'],
      ],
      art: 'mesh',
      footerMode: 'deep',
      deco: [],
      divider: null,
      css: `
.fl-aurora body{background:radial-gradient(1200px 600px at 15% -10%,color-mix(in srgb,var(--primary) 26%,transparent),transparent 60%),radial-gradient(900px 500px at 90% 0%,color-mix(in srgb,var(--accent) 20%,transparent),transparent 60%),var(--bg)}
.fl-aurora .site-header{background:transparent}
.fl-aurora .section.alt{background:color-mix(in srgb,var(--surface) 70%,transparent)}
.fl-aurora .svc-card,.fl-aurora .feat-cards .feature,.fl-aurora .panel{background:color-mix(in srgb,var(--surface) 72%,transparent);border:1px solid color-mix(in srgb,var(--text) 14%,transparent);backdrop-filter:blur(14px)}
.fl-aurora .btn{box-shadow:0 10px 30px -10px var(--primary)}`,
    },
    {
      id: 'lime',
      label: 'Startup',
      name: 'startup lumineuse',
      fonts: { display: gf('Outfit', '400;500;600;700'), body: null },
      tokens: T({ radius: '14px', radiusLg: '22px', btnRadius: '10px', iconRadius: '10px', displayWeight: 600, tracking: '-0.035em', lh: 1.02, h1: 'clamp(2.6rem, 6vw, 5.4rem)', bodySize: '16.5px' }),
      palettes: [
        { bg: '#FBFBF6', surface: '#FFFFFF', text: '#0F1A12', muted: '#525C56', primary: '#1B7F4B', accent: '#D6F24A' },
        { bg: '#F8F9FC', surface: '#FFFFFF', text: '#101528', muted: '#565D74', primary: '#C93D14', accent: '#2D5BFF' },
      ],
      heroes: ['mosaic', 'split'],
      variants: { nav: ['bar'], features: ['cards'], services: ['grid'], about: ['split'], cta: ['band'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:bento', 'gallery:bento', 'offer:cards', 'offer2', 'process:line', 'reviews', 'cta:band', 'info'],
        ['hero', 'offer:cards', 'offer2', 'highlights:cards', 'gallery:grid', 'process:cards', 'cta:band', 'info'],
      ],
      art: 'grid',
      footerMode: 'invert',
      deco: [['plus', 'tl']],
      divider: null,
      css: `
.fl-lime .hero h1{letter-spacing:-.045em}
.fl-lime .f-icon{background:var(--accent);color:var(--on-accent)}
.fl-lime .svc-card{box-shadow:0 1px 0 var(--line-soft),0 12px 30px -20px rgba(0,0,0,.25);border:0}`,
    },
    {
      id: 'clay',
      label: 'Clay',
      name: 'pâte à modeler',
      fonts: { display: gf('Lexend', '400;500;600'), body: null },
      tokens: T({ radius: '26px', radiusLg: '34px', btnRadius: '999px', iconRadius: '18px', displayWeight: 600, tracking: '-0.02em', lh: 1.06, bodySize: '16.5px' }),
      palettes: [
        { bg: '#F4F2FF', surface: '#FFFFFF', text: '#1E1B3A', muted: '#57547A', primary: '#6A4DFF', accent: '#E5739B' },
        { bg: '#EFF7F4', surface: '#FFFFFF', text: '#14302A', muted: '#4B665F', primary: '#127A5A', accent: '#D98F1E' },
      ],
      heroes: ['split', 'centered'],
      variants: { nav: ['pill'], features: ['cards'], services: ['grid'], about: ['split'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:cards', 'offer:cards', 'offer2', 'gallery:bento', 'process:cards', 'reviews', 'cta:boxed', 'info'],
        ['hero', 'offer:grid', 'offer2', 'highlights:cards', 'gallery:grid', 'cta:boxed', 'info'],
      ],
      art: 'soft',
      footerMode: 'invert',
      deco: [['blob', 'tr'], ['ring', 'bl']],
      divider: null,
      css: `
.fl-clay .svc-card,.fl-clay .feat-cards .feature,.fl-clay .hero-visual,.fl-clay .btn{box-shadow:inset 0 -6px 0 rgba(0,0,0,.08),0 18px 30px -18px color-mix(in srgb,var(--primary) 55%,transparent)}
.fl-clay .svc-card,.fl-clay .feat-cards .feature{border:0;background:var(--surface)}
.fl-clay .section.alt{background:color-mix(in srgb,var(--primary) 7%,var(--bg))}`,
    },
  ],

  // ---------------------------------------------------------------- Coloré & ludique
  ludique: [
    {
      id: 'memphis',
      label: 'Memphis',
      name: 'memphis',
      fonts: { display: gf('Bricolage Grotesque', '600;800'), body: gf('DM Sans', '400;500;700') },
      tokens: T({ displayWeight: 800, tracking: '-0.03em', lh: 0.98, h1: 'clamp(2.6rem, 6.4vw, 5.8rem)', h1Big: 'clamp(3rem, 9vw, 8rem)' }),
      palettes: [
        { bg: '#FFFDF7', surface: '#FFF1E0', text: '#141414', muted: '#474747', primary: '#D42A63', accent: '#16A398', third: '#FFD23F' },
        { bg: '#F7FBFF', surface: '#E9F3FF', text: '#121212', muted: '#454545', primary: '#2F6FE8', accent: '#E0005F', third: '#FFBE0B' },
      ],
      heroes: ['bigtype', 'split'],
      variants: { nav: ['bar'], features: ['tiles'], services: ['grid'], about: ['split'], cta: ['band'], footer: ['big'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:tiles', 'offer:cards', 'offer2', 'gallery:grid', 'process:cards', 'cta:band', 'info'],
        ['hero', 'statement:center', 'offer:grid', 'offer2', 'gallery:bento', 'reviews', 'cta:band', 'info'],
      ],
      art: 'confetti',
      footerMode: 'invert',
      deco: [['squiggle', 'tr'], ['dots', 'bl'], ['ring', 'tl']],
      divider: 'zigzag',
      css: `
.fl-memphis .btn{border:2.5px solid var(--text);box-shadow:5px 5px 0 var(--third)}
.fl-memphis .svc-card,.fl-memphis .hero-visual,.fl-memphis .gal-item{border:2.5px solid var(--text)}
.fl-memphis .section.alt{background-color:var(--surface);background-image:radial-gradient(color-mix(in srgb,var(--text) 14%,transparent) 1.5px,transparent 1.6px);background-size:22px 22px}`,
    },
    {
      id: 'pop-bd',
      label: 'Pop art',
      name: 'pop art',
      fonts: { display: gf('Bangers', '400'), body: gf('Nunito', '400;600;800') },
      tokens: T({ iconRadius: '0px', tracking: '0.02em', case: 'uppercase', lh: 1.0, h1: 'clamp(2.8rem, 6.6vw, 6rem)', h1Big: 'clamp(3.2rem, 9vw, 8.4rem)' }),
      palettes: [
        { bg: '#FFF3D6', surface: '#FFFFFF', text: '#111111', muted: '#3D3D3D', primary: '#D62835', accent: '#1D4ED8', third: '#FFD60A' },
        { bg: '#E8F6FF', surface: '#FFFFFF', text: '#101010', muted: '#383838', primary: '#1D4ED8', accent: '#D62835', third: '#FFD60A' },
      ],
      heroes: ['framed', 'split'],
      variants: { nav: ['bar'], features: ['tiles'], services: ['grid'], about: ['split'], cta: ['band'], footer: ['big'], products: ['cards'] },
      recipes: [
        ['hero', 'marquee', 'offer:cards', 'offer2', 'gallery:grid', 'highlights:tiles', 'cta:band', 'info'],
        ['hero', 'highlights:tiles', 'gallery:polaroid', 'offer:grid', 'offer2', 'reviews', 'cta:band', 'info'],
      ],
      art: 'blocks',
      footerMode: 'invert',
      deco: [['star', 'tr'], ['asterisk', 'bl']],
      divider: null,
      css: `
.fl-pop-bd .hero-framed .frame::before{background:var(--third);border:3px solid var(--text);border-radius:0}
.fl-pop-bd .hero-visual,.fl-pop-bd .svc-card,.fl-pop-bd .gal-item{border:3px solid var(--text);box-shadow:6px 6px 0 var(--text)}
.fl-pop-bd .btn{border:3px solid var(--text);box-shadow:4px 4px 0 var(--text);font-weight:800}
.fl-pop-bd .section.alt{background-color:var(--third);background-image:radial-gradient(rgba(0,0,0,.12) 1.6px,transparent 1.8px);background-size:14px 14px}`,
    },
    {
      id: 'kawaii',
      label: 'Pastel',
      name: 'pastel',
      fonts: { display: gf('Baloo 2', '600;700;800'), body: gf('Quicksand', '400;500;600;700') },
      tokens: T({ radius: '26px', radiusLg: '36px', btnRadius: '999px', displayWeight: 700, tracking: '-0.01em', lh: 1.05 }),
      palettes: [
        { bg: '#FFF5FA', surface: '#FFFFFF', text: '#3A2440', muted: '#6E5673', primary: '#C7357A', accent: '#1A7A70', third: '#FFD86E' },
        { bg: '#F2FBFF', surface: '#FFFFFF', text: '#203247', muted: '#55687C', primary: '#2C78C0', accent: '#C9457A', third: '#FFE08A' },
      ],
      heroes: ['centered', 'split'],
      variants: { nav: ['pill'], features: ['icons'], services: ['grid'], about: ['split'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:icons', 'offer:cards', 'offer2', 'gallery:polaroid', 'reviews', 'cta:boxed', 'info'],
        ['hero', 'gallery:bento', 'offer:grid', 'offer2', 'process:cards', 'cta:boxed', 'info'],
      ],
      art: 'soft',
      footerMode: 'surface',
      deco: [['star', 'tr'], ['blob', 'bl']],
      divider: 'scallop',
      css: `
.fl-kawaii .btn{box-shadow:0 5px 0 var(--primary-deep)}
.fl-kawaii .svc-card{border:2px solid var(--primary-soft);background:var(--surface)}
.fl-kawaii .hero-centered .hero-visual{border-radius:48px}
.fl-kawaii .section.alt{background:var(--primary-soft)}`,
    },
  ],

  // ---------------------------------------------------------------- Brutaliste
  brutal: [
    {
      id: 'neo-brutal',
      label: 'Néo-brutal',
      name: 'néo-brutal',
      fonts: { display: gf('Unbounded', '600;800'), body: gf('IBM Plex Sans', '400;500;600') },
      tokens: T({ radius: '14px', radiusLg: '18px', btnRadius: '12px', iconRadius: '12px', displayWeight: 800, tracking: '-0.02em', lh: 1.0, h1: 'clamp(2.4rem, 5.6vw, 5rem)', h1Big: 'clamp(2.8rem, 8vw, 7rem)' }),
      palettes: [
        { bg: '#FFF6E0', surface: '#FFFFFF', text: '#0A0A0A', muted: '#333333', primary: '#FF6B6B', accent: '#4ECDC4', third: '#FFE66D' },
        { bg: '#F0F4FF', surface: '#FFFFFF', text: '#0A0A0A', muted: '#333333', primary: '#9B87FF', accent: '#00D1A0', third: '#FFD23F' },
      ],
      heroes: ['split', 'framed'],
      variants: { nav: ['bar'], features: ['cards'], services: ['grid'], about: ['split'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:cards', 'offer:cards', 'offer2', 'gallery:bento', 'process:cards', 'reviews', 'cta:boxed', 'info'],
        ['hero', 'marquee', 'offer:grid', 'offer2', 'gallery:grid', 'highlights:cards', 'cta:boxed', 'info'],
      ],
      art: 'blocks',
      footerMode: 'invert',
      deco: [['asterisk', 'tr']],
      divider: null,
      css: `
.fl-neo-brutal .btn,.fl-neo-brutal .svc-card,.fl-neo-brutal .feat-cards .feature,.fl-neo-brutal .hero-visual,.fl-neo-brutal .gal-item,.fl-neo-brutal .product{border:3px solid #0A0A0A;box-shadow:6px 6px 0 #0A0A0A}
.fl-neo-brutal .btn:hover{transform:translate(2px,2px);box-shadow:3px 3px 0 #0A0A0A}
.fl-neo-brutal .svc-card:nth-child(3n+1){background:var(--third)}
.fl-neo-brutal .site-header{border-bottom:3px solid #0A0A0A}
.fl-neo-brutal .marquee{border-block:3px solid #0A0A0A}`,
    },
    {
      id: 'affiche',
      label: 'Affiche',
      name: 'affiche',
      fonts: { display: gf('Anton', '400'), body: gf('Inter', '400;500;600') },
      tokens: T({ case: 'uppercase', lh: 0.92, h1: 'clamp(3rem, 7.6vw, 7rem)', h1Big: 'clamp(3.4rem, 12vw, 11rem)' }),
      palettes: [
        { bg: '#A8150F', surface: '#8F110B', text: '#FFFFFF', muted: '#FFE6E3', primary: '#111111', accent: '#FFFFFF' },
        { bg: '#1E3BD7', surface: '#182FAF', text: '#FFFFFF', muted: '#E2E7FF', primary: '#FFE14D', accent: '#FFFFFF' },
      ],
      heroes: ['cover', 'bigtype'],
      variants: { nav: ['bar'], features: ['lined'], services: ['menu'], about: ['quote'], cta: ['band'], footer: ['big'], products: ['minimal'] },
      recipes: [
        ['hero', 'marquee', 'statement:left', 'offer:menu', 'offer2', 'gallery:grid', 'cta:band', 'info'],
        ['hero', 'statement:left', 'gallery:strip', 'offer:menu', 'offer2', 'band:plain', 'cta:band', 'info'],
      ],
      art: 'stripes',
      footerMode: 'deep',
      deco: [],
      divider: null,
      css: `
.fl-affiche .hero-cover h1{font-size:var(--h1-big);line-height:.88}
.fl-affiche .visual img{filter:grayscale(1) contrast(1.15)}
.fl-affiche .section + .section{border-top:2px solid currentColor}
.fl-affiche .btn.ghost{color:var(--text)}`,
    },
    {
      id: 'zine',
      label: 'Zine',
      name: 'zine photocopié',
      fonts: { display: gf('Rubik Mono One', '400'), body: gf('Courier Prime', '400;700') },
      tokens: T({ tracking: '-0.02em', case: 'uppercase', lh: 1.0, h1: 'clamp(2.2rem, 5vw, 4.4rem)', h1Big: 'clamp(2.6rem, 7.6vw, 6.6rem)', bodySize: '16.5px' }),
      palettes: [
        { bg: '#F1EFEA', surface: '#FFFFFF', text: '#1A1A1A', muted: '#444444', primary: '#C81C7B', accent: '#0078BF' },
        { bg: '#F3F1EC', surface: '#FFFFFF', text: '#1A1A1A', muted: '#444444', primary: '#007A42', accent: '#C44A12' },
      ],
      heroes: ['framed', 'collage'],
      variants: { nav: ['bar'], features: ['lined'], services: ['grid'], about: ['quote'], cta: ['band'], footer: ['big'], products: ['cards'] },
      recipes: [
        ['hero', 'gallery:polaroid', 'offer:grid', 'offer2', 'statement:left', 'reviews', 'cta:band', 'info'],
        ['hero', 'highlights:lined', 'gallery:grid', 'offer:menu', 'offer2', 'band:plain', 'cta:band', 'info'],
      ],
      art: 'blocks',
      footerMode: 'invert',
      deco: [['scribble', 'tr'], ['arrow', 'bl']],
      divider: null,
      css: `
.fl-zine .visual img{filter:grayscale(1) contrast(1.25)}
.fl-zine .visual::after{content:"";position:absolute;inset:0;background:var(--primary);mix-blend-mode:screen;opacity:.5;pointer-events:none}
.fl-zine .hero-framed .frame{transform:rotate(-2deg)}
.fl-zine .hero-framed .frame::before{background:var(--accent);border-radius:0}
.fl-zine .svc-card{border:2px dashed var(--text);border-radius:0}
.fl-zine .section-head h2{display:inline;background:var(--primary);color:var(--on-primary);padding:0 .2em;-webkit-box-decoration-break:clone;box-decoration-break:clone;line-height:1.3}`,
    },
  ],

  // ---------------------------------------------------------------- Nature
  nature: [
    {
      id: 'boheme',
      label: 'Bohème',
      name: 'bohème',
      fonts: { display: gf('Gilda Display', '400'), body: gf('Jost', '400;500') },
      tokens: T({ radius: '16px', radiusLg: '24px', btnRadius: '999px', lh: 1.1, h1: 'clamp(2.5rem, 5.4vw, 4.6rem)' }),
      palettes: [
        { bg: '#F6EEE3', surface: '#EBDCC8', text: '#3B2A20', muted: '#6E594A', primary: '#A8552F', accent: '#5F6F42' },
        { bg: '#F4EFE6', surface: '#E6DDCC', text: '#2F2A22', muted: '#665F50', primary: '#7E5226', accent: '#9A6550' },
      ],
      heroes: ['split', 'framed'],
      variants: { nav: ['center'], features: ['icons'], services: ['alternate'], about: ['split'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:icons', 'about:split', 'offer:alternate', 'offer2', 'gallery:masonry', 'cta:boxed', 'info'],
        ['hero', 'statement:center', 'gallery:strip', 'offer:cards', 'offer2', 'reviews', 'cta:boxed', 'info'],
      ],
      art: 'arch',
      footerMode: 'primary',
      deco: [['sunburst', 'tr'], ['leaf', 'bl']],
      divider: 'wave',
      css: `
.fl-boheme .hero-split .hero-visual,.fl-boheme .about-visual,.fl-boheme .alt-visual{border-radius:999px 999px var(--radius) var(--radius)}
.fl-boheme .f-icon{border-radius:999px 999px 8px 8px}`,
    },
    {
      id: 'herbier',
      label: 'Herbier',
      name: 'herbier',
      fonts: { display: gf('EB Garamond', '400;500;600'), body: gf('Work Sans', '400;500') },
      tokens: T({ radius: '2px', radiusLg: '2px', btnRadius: '2px', displayWeight: 500, tracking: '-0.01em', lh: 1.08, h1: 'clamp(2.6rem, 5.6vw, 4.8rem)' }),
      palettes: [
        { bg: '#F7F7F0', surface: '#E9EDE0', text: '#1E2B22', muted: '#535F56', primary: '#2F5D3A', accent: '#A8644A' },
        { bg: '#F8F6F1', surface: '#ECE8DD', text: '#2A2620', muted: '#625B51', primary: '#56662A', accent: '#8C3B2E' },
      ],
      heroes: ['centered', 'split'],
      variants: { nav: ['center'], features: ['lined'], services: ['menu'], about: ['quote'], cta: ['band'], footer: ['columns'], products: ['minimal'] },
      recipes: [
        ['hero', 'statement:center', 'offer:menu', 'offer2', 'gallery:grid', 'about:quote', 'cta:band', 'info'],
        ['hero', 'highlights:lined', 'gallery:strip', 'offer:menu', 'offer2', 'reviews', 'cta:band', 'info'],
      ],
      art: 'leaf',
      footerMode: 'surface',
      deco: [['leaf', 'tr'], ['leaf', 'bl']],
      divider: null,
      css: `
.fl-herbier .hero-visual,.fl-herbier .gal-item .visual,.fl-herbier .about-visual{border:1px solid var(--line-soft);padding:10px;background:var(--bg)}
.fl-herbier .gal-item figcaption,.fl-herbier .section-head h2{font-style:italic}
.fl-herbier .site-header{border-bottom:1px solid var(--line-soft)}`,
    },
    {
      id: 'littoral',
      label: 'Littoral',
      name: 'bord de mer',
      fonts: { display: gf('Albert Sans', '500;700'), body: null },
      tokens: T({ radius: '14px', radiusLg: '22px', btnRadius: '999px', displayWeight: 700, tracking: '-0.03em', lh: 1.02, h1: 'clamp(2.6rem, 6vw, 5.2rem)' }),
      palettes: [
        { bg: '#F2F7F7', surface: '#E1ECEC', text: '#12313A', muted: '#4A656B', primary: '#1F6F8B', accent: '#98631A' },
        { bg: '#F7F5EF', surface: '#EAE6DA', text: '#1B2E3C', muted: '#526272', primary: '#2D5F86', accent: '#AE4A30' },
      ],
      heroes: ['overlay', 'split'],
      variants: { nav: ['bar'], features: ['cards'], services: ['grid'], about: ['split'], cta: ['image'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:cards', 'gallery:strip', 'offer:grid', 'offer2', 'about:split', 'cta:image', 'info'],
        ['hero', 'offer:cards', 'offer2', 'gallery:masonry', 'process:line', 'reviews', 'cta:image', 'info'],
      ],
      art: 'lines',
      footerMode: 'primary-deep',
      deco: [],
      divider: 'wave',
      css: `
.fl-littoral .hero-overlay::after{background:linear-gradient(180deg,rgba(10,40,55,.1),rgba(10,40,55,.65))}
.fl-littoral .svc-card{border:0;background:var(--surface)}`,
    },
  ],

  // ---------------------------------------------------------------- Professionnel
  corporate: [
    {
      id: 'cabinet',
      label: 'Cabinet',
      name: 'cabinet classique',
      fonts: { display: gf('Libre Baskerville', '400;700'), body: gf('Source Sans 3', '400;600') },
      tokens: T({ radius: '2px', radiusLg: '2px', btnRadius: '2px', iconRadius: '2px', tracking: '-0.01em', lh: 1.12, h1: 'clamp(2.3rem, 4.8vw, 4.2rem)', h1Big: 'clamp(2.6rem, 6.4vw, 5.6rem)' }),
      palettes: [
        { bg: '#FFFFFF', surface: '#F4F1EA', text: '#1B2433', muted: '#525D6C', primary: '#1F3A5F', accent: '#8F6E3A' },
        { bg: '#FBFAF7', surface: '#F0ECE4', text: '#222222', muted: '#585858', primary: '#3D2B1F', accent: '#7E6234' },
      ],
      heroes: ['framed', 'split'],
      variants: { nav: ['bar'], features: ['lined'], services: ['alternate'], about: ['split'], cta: ['split'], footer: ['columns'], products: ['minimal'] },
      recipes: [
        ['hero', 'highlights:lined', 'offer:alternate', 'offer2', 'about:split', 'process:line', 'reviews', 'cta:split', 'info'],
        ['hero', 'statement:left', 'offer:alternate', 'offer2', 'band:quote', 'gallery:grid', 'cta:split', 'info'],
      ],
      art: 'lines',
      footerMode: 'primary-deep',
      deco: [],
      divider: null,
      css: `
.fl-cabinet .hero-framed .frame::before{background:transparent;border:1px solid var(--accent);inset:18px -18px -18px 18px}
.fl-cabinet .feat-lined .feature{border-top:1px solid var(--accent)}
.fl-cabinet .btn{letter-spacing:.06em;text-transform:uppercase;font-size:.8rem}`,
    },
    {
      id: 'sante',
      label: 'Santé',
      name: 'santé',
      fonts: { display: gf('Red Hat Display', '500;700'), body: gf('Red Hat Text', '400;500') },
      tokens: T({ radius: '16px', radiusLg: '24px', btnRadius: '999px', displayWeight: 700, tracking: '-0.025em', lh: 1.06, bodySize: '16.5px' }),
      palettes: [
        { bg: '#F6FAFB', surface: '#FFFFFF', text: '#0F2A33', muted: '#4B636D', primary: '#0B7079', accent: '#975C12' },
        { bg: '#F7F9FC', surface: '#FFFFFF', text: '#14213D', muted: '#525D77', primary: '#3459B8', accent: '#1A7A4B' },
      ],
      heroes: ['centered', 'split'],
      variants: { nav: ['pill'], features: ['icons'], services: ['grid'], about: ['split'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:icons', 'offer:cards', 'offer2', 'process:cards', 'about:split', 'reviews', 'cta:boxed', 'info'],
        ['hero', 'offer:grid', 'offer2', 'highlights:icons', 'gallery:grid', 'cta:boxed', 'info'],
      ],
      art: 'soft',
      footerMode: 'primary-deep',
      deco: [],
      divider: null,
      css: `
.fl-sante .svc-card{border:0;box-shadow:0 10px 30px -18px rgba(15,42,51,.35);background:var(--surface)}
.fl-sante .section.alt{background:color-mix(in srgb,var(--primary) 6%,var(--bg))}`,
    },
    {
      id: 'chantier',
      label: 'Chantier',
      name: 'bâtiment',
      fonts: { display: gf('Barlow Condensed', '600;700'), body: gf('Barlow', '400;500;600') },
      tokens: T({ iconRadius: '0px', displayWeight: 700, case: 'uppercase', lh: 0.98, h1: 'clamp(2.6rem, 6.4vw, 5.6rem)', h1Big: 'clamp(3rem, 9vw, 8rem)' }),
      palettes: [
        { bg: '#FFFFFF', surface: '#F2F2F2', text: '#1A1A1A', muted: '#4F4F4F', primary: '#F2A900', accent: '#1A1A1A' },
        { bg: '#F7F7F5', surface: '#FFFFFF', text: '#16202A', muted: '#4C5864', primary: '#BF4219', accent: '#16202A' },
      ],
      heroes: ['overlay', 'bigtype'],
      variants: { nav: ['bar'], features: ['tiles'], services: ['grid'], about: ['split'], cta: ['band'], footer: ['big'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:tiles', 'offer:grid', 'offer2', 'process:image', 'gallery:grid', 'reviews', 'cta:band', 'info'],
        ['hero', 'marquee', 'offer:cards', 'offer2', 'gallery:bento', 'process:line', 'cta:band', 'info'],
      ],
      art: 'blocks',
      footerMode: 'invert',
      deco: [],
      divider: null,
      css: `
.fl-chantier .hero-overlay h1{font-size:var(--h1-big);max-width:12ch}
.fl-chantier .btn{font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.fl-chantier .site-header{border-bottom:8px solid var(--primary)}
.fl-chantier .section-head h2::before{content:"";display:block;width:64px;height:8px;background:var(--primary);margin-bottom:16px}
.fl-chantier .section-head.center h2::before{margin-left:auto;margin-right:auto}`,
    },
  ],

  // ---------------------------------------------------------------- Rétro
  retro: [
    {
      id: 'diner',
      label: 'Diner 50s',
      name: 'diner américain',
      fonts: { display: gf('Pacifico', '400'), body: gf('Poppins', '400;500;600') },
      tokens: T({ radius: '18px', radiusLg: '24px', btnRadius: '999px', lh: 1.15, h1: 'clamp(2.4rem, 5.4vw, 4.6rem)', h1Big: 'clamp(2.8rem, 7.4vw, 6.2rem)', bodySize: '16.5px' }),
      palettes: [
        { bg: '#FFF7EC', surface: '#FFFFFF', text: '#1E2A38', muted: '#4F5E70', primary: '#C81E35', accent: '#16807A', third: '#F4D35E' },
        { bg: '#F1FAF8', surface: '#FFFFFF', text: '#1D2B36', muted: '#4B5E6C', primary: '#D02E52', accent: '#1F7F91', third: '#FFD166' },
      ],
      heroes: ['split', 'framed'],
      variants: { nav: ['bar'], features: ['cards'], services: ['menu'], about: ['split'], cta: ['band'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'offer:menu', 'offer2', 'highlights:cards', 'gallery:polaroid', 'reviews', 'cta:band', 'info'],
        ['hero', 'highlights:cards', 'gallery:grid', 'offer:menu', 'offer2', 'process:cards', 'cta:band', 'info'],
      ],
      art: 'confetti',
      footerMode: 'invert',
      deco: [['star', 'tr'], ['sparkle', 'bl']],
      divider: 'scallop',
      css: `
.fl-diner .site-header::after{content:"";display:block;height:14px;background:repeating-conic-gradient(var(--text) 0 25%,transparent 0 50%) 0 0/14px 14px}
.fl-diner h3{font-family:var(--font-body);font-weight:600;letter-spacing:0}
.fl-diner h1,.fl-diner .section-head h2{color:var(--primary-ink)}
.fl-diner .btn{box-shadow:0 4px 0 var(--primary-deep)}
.fl-diner .menu-row{border-bottom:2px dotted var(--line-soft)}`,
    },
    {
      id: 'deco-20',
      label: 'Art déco',
      name: 'art déco',
      fonts: { display: gf('Limelight', '400'), body: gf('Raleway', '400;500;600') },
      tokens: T({ iconRadius: '0px', tracking: '0.03em', case: 'uppercase', lh: 1.08, h1: 'clamp(2.3rem, 5vw, 4.4rem)', h1Big: 'clamp(2.6rem, 7vw, 6rem)', bodySize: '16.5px', sectionPad: 'clamp(80px, 9vw, 136px)' }),
      palettes: [
        { bg: '#111111', surface: '#1B1B1B', text: '#F1E6C8', muted: '#BDB08F', primary: '#C9A227', accent: '#3B7F70' },
        { bg: '#F3EBDD', surface: '#E8DCC6', text: '#1B1A17', muted: '#5A5244', primary: '#7E5F17', accent: '#1F3D36' },
      ],
      heroes: ['framed', 'centered'],
      variants: { nav: ['center'], features: ['icons'], services: ['menu'], about: ['quote'], cta: ['band'], footer: ['big'], products: ['minimal'] },
      recipes: [
        ['hero', 'statement:center', 'offer:menu', 'offer2', 'gallery:grid', 'band:quote', 'cta:band', 'info'],
        ['hero', 'highlights:icons', 'offer:menu', 'offer2', 'gallery:strip', 'about:quote', 'cta:band', 'info'],
      ],
      art: 'arch',
      footerMode: 'deep',
      deco: [['sunburst', 'tr']],
      divider: null,
      css: `
.fl-deco-20 .site-header{border-bottom:1px solid var(--primary);box-shadow:0 5px 0 -1px var(--bg),0 6px 0 -1px var(--primary)}
.fl-deco-20 .hero-framed .frame::before{background:transparent;border:2px solid var(--primary);inset:-14px;border-radius:0}
.fl-deco-20 .hero-visual{border:6px double var(--primary)}
.fl-deco-20 .btn{background:transparent;color:var(--primary-ink);border:1px solid var(--primary);letter-spacing:.14em;text-transform:uppercase;font-size:.78rem}
.fl-deco-20 .btn:hover{background:var(--primary);color:var(--on-primary)}
.fl-deco-20 .section-head{text-align:center;margin-left:auto;margin-right:auto}
.fl-deco-20 .section-head h2::before,.fl-deco-20 .section-head h2::after{content:"";display:inline-block;width:9px;height:9px;background:var(--primary);transform:rotate(45deg);margin:0 .7em;vertical-align:middle}`,
    },
    {
      id: 'bistrot',
      label: 'Bistrot',
      name: 'bistrot parisien',
      fonts: { display: gf('Abril Fatface', '400'), body: gf('Libre Franklin', '400;500;600') },
      tokens: T({ radius: '4px', radiusLg: '6px', btnRadius: '4px', lh: 1.05, h1: 'clamp(2.5rem, 5.6vw, 5rem)' }),
      palettes: [
        { bg: '#F3EDE2', surface: '#E7DCC8', text: '#1F2B24', muted: '#515B4A', primary: '#1F4D3A', accent: '#A3271F', third: '#D6A84A' },
        { bg: '#F5EFE6', surface: '#E9DFD0', text: '#2A1E1A', muted: '#61534B', primary: '#8E1F1A', accent: '#1F4D3A', third: '#D6A84A' },
      ],
      heroes: ['overlay', 'split'],
      variants: { nav: ['center'], features: ['icons'], services: ['menu'], about: ['quote'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'offer:menu', 'offer2', 'statement:center', 'gallery:masonry', 'reviews', 'cta:boxed', 'info'],
        ['hero', 'about:quote', 'offer:menu', 'offer2', 'gallery:polaroid', 'band:quote', 'cta:boxed', 'info'],
      ],
      art: 'serif',
      footerMode: 'primary',
      deco: [],
      divider: null,
      css: `
.fl-bistrot .site-header::before{content:"";display:block;height:12px;background:repeating-linear-gradient(90deg,var(--accent) 0 28px,var(--bg) 28px 56px)}
.fl-bistrot .svc-menu{background:#1F2A24;color:#F3EDE2;padding:clamp(28px,4vw,48px);border:10px solid #6B4A2B;border-radius:4px}
.fl-bistrot .svc-menu .menu-row{border-bottom:1px dashed rgba(243,237,226,.35)}
.fl-bistrot .svc-menu p,.fl-bistrot .svc-menu .menu-price{color:#F3EDE2}`,
    },
  ],

  // ---------------------------------------------------------------- Audacieux
  audacieux: [
    {
      id: 'acide',
      label: 'Acide',
      name: 'acide',
      fonts: { display: gf('Big Shoulders Display', '800;900'), body: gf('Inter', '400;500;600') },
      tokens: T({ btnRadius: '0px', displayWeight: 900, tracking: '-0.01em', case: 'uppercase', lh: 0.9, h1: 'clamp(3rem, 7.6vw, 7rem)', h1Big: 'clamp(3.4rem, 12vw, 11rem)' }),
      palettes: [
        { bg: '#0D0D0D', surface: '#1A1A1A', text: '#F5F5F5', muted: '#A3A3A3', primary: '#C6FF3D', accent: '#FF3DCB' },
        { bg: '#111014', surface: '#1C1B21', text: '#F4F2FF', muted: '#A7A3BB', primary: '#FF3DCB', accent: '#3DF5FF' },
      ],
      heroes: ['split', 'bigtype'],
      variants: { nav: ['bar'], features: ['tiles'], services: ['grid'], about: ['quote'], cta: ['band'], footer: ['big'], products: ['cards'] },
      recipes: [
        ['hero', 'marquee', 'highlights:tiles', 'offer:cards', 'offer2', 'gallery:bento', 'cta:band', 'info'],
        ['hero', 'marquee', 'gallery:grid', 'offer:grid', 'offer2', 'statement:left', 'cta:band', 'info'],
      ],
      art: 'stripes',
      footerMode: 'deep',
      deco: [['asterisk', 'tr']],
      divider: 'diagonal',
      css: `
.fl-acide .hero h1{color:var(--primary-ink)}
.fl-acide .visual img{filter:grayscale(1) contrast(1.2)}
.fl-acide .hero-visual{border:2px solid var(--primary)}`,
    },
    {
      id: 'solaire',
      label: 'Solaire',
      name: 'dégradé solaire',
      fonts: { display: gf('Kanit', '400;600;800'), body: null },
      tokens: T({ radius: '20px', radiusLg: '28px', btnRadius: '999px', displayWeight: 800, tracking: '-0.02em', case: 'uppercase', lh: 0.95, h1: 'clamp(2.8rem, 6.6vw, 6rem)', h1Big: 'clamp(3.2rem, 10vw, 9rem)' }),
      palettes: [
        { bg: '#FFF1E6', surface: '#FFFFFF', text: '#1B0B2E', muted: '#5A4769', primary: '#E0245E', accent: '#C24E00' },
        { bg: '#EEF2FF', surface: '#FFFFFF', text: '#0F1033', muted: '#4E5074', primary: '#4F2EFF', accent: '#0077B6' },
      ],
      heroes: ['centered', 'collage'],
      variants: { nav: ['pill'], features: ['cards'], services: ['grid'], about: ['split'], cta: ['band'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'marquee', 'offer:cards', 'offer2', 'gallery:bento', 'highlights:cards', 'reviews', 'cta:band', 'info'],
        ['hero', 'highlights:cards', 'gallery:grid', 'offer:grid', 'offer2', 'process:line', 'cta:band', 'info'],
      ],
      art: 'mesh',
      footerMode: 'deep',
      deco: [['ring', 'tr']],
      divider: null,
      css: `
.fl-solaire .hero{background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 18%,var(--bg)),color-mix(in srgb,var(--accent) 22%,var(--bg)))}
.fl-solaire .hero h1{background:linear-gradient(90deg,var(--primary),var(--accent));-webkit-background-clip:text;background-clip:text;color:transparent}
.fl-solaire .cta-band,.fl-solaire .marquee{background:linear-gradient(90deg,var(--primary),var(--accent));color:#fff}`,
    },
    {
      id: 'bauhaus',
      label: 'Bauhaus',
      name: 'bauhaus',
      fonts: { display: gf('Jost', '400;500;700'), body: null },
      tokens: T({ displayWeight: 700, tracking: '-0.02em', lh: 1.0, h1: 'clamp(2.6rem, 6vw, 5.4rem)', h1Big: 'clamp(3rem, 9vw, 8rem)' }),
      palettes: [
        { bg: '#F2EEE3', surface: '#FFFFFF', text: '#111111', muted: '#444444', primary: '#C81E1E', accent: '#003F88', third: '#FCBF49' },
        { bg: '#F4F1EA', surface: '#FFFFFF', text: '#141414', muted: '#474747', primary: '#003F88', accent: '#C81E1E', third: '#F7B32B' },
      ],
      heroes: ['collage', 'split'],
      variants: { nav: ['bar'], features: ['tiles'], services: ['grid'], about: ['split'], cta: ['band'], footer: ['big'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:tiles', 'offer:grid', 'offer2', 'gallery:bento', 'statement:left', 'cta:band', 'info'],
        ['hero', 'statement:left', 'offer:cards', 'offer2', 'gallery:grid', 'process:cards', 'cta:band', 'info'],
      ],
      art: 'blocks',
      footerMode: 'invert',
      deco: [['ring', 'tr'], ['plus', 'bl']],
      divider: null,
      css: `
.fl-bauhaus .collage .c1{border-radius:50%}
.fl-bauhaus .collage .c3{clip-path:polygon(50% 0,100% 100%,0 100%)}
.fl-bauhaus .feat-tiles .feature:nth-child(3n+2){background:var(--accent);color:#fff}
.fl-bauhaus .feat-tiles .feature:nth-child(3n){background:var(--third);color:#111}`,
    },
  ],

  // ---------------------------------------------------------------- Doux & bien-être
  doux: [
    {
      id: 'spa',
      label: 'Spa',
      name: 'spa minéral',
      fonts: { display: gf('Italiana', '400'), body: gf('Nunito Sans', '300;400;600') },
      tokens: T({ radius: '2px', radiusLg: '2px', btnRadius: '2px', tracking: '0.02em', lh: 1.12, h1: 'clamp(2.4rem, 5vw, 4.4rem)', sectionPad: 'clamp(88px, 10vw, 150px)' }),
      palettes: [
        { bg: '#EFEDE8', surface: '#E2DED6', text: '#2E2C29', muted: '#5F5A53', primary: '#55644F', accent: '#7C6549' },
        { bg: '#F0EFEC', surface: '#E3E1DC', text: '#2A2C2E', muted: '#5C5F63', primary: '#5E5B7D', accent: '#776446' },
      ],
      heroes: ['overlay', 'panel'],
      variants: { nav: ['split'], features: ['lined'], services: ['alternate'], about: ['quote'], cta: ['image'], footer: ['columns'], products: ['minimal'] },
      recipes: [
        ['hero', 'statement:center', 'offer:alternate', 'offer2', 'gallery:strip', 'about:quote', 'cta:image', 'info'],
        ['hero', 'highlights:lined', 'offer:alternate', 'offer2', 'band:quote', 'gallery:masonry', 'cta:image', 'info'],
      ],
      art: 'soft',
      footerMode: 'surface',
      deco: [],
      divider: null,
      css: `
.fl-spa .btn{letter-spacing:.16em;text-transform:uppercase;font-size:.74rem;font-weight:600;padding:1.2em 2.2em}
.fl-spa .visual img{filter:saturate(.75) brightness(1.03)}
.fl-spa .hero-overlay::after{background:linear-gradient(180deg,rgba(40,38,34,.08),rgba(40,38,34,.45) 45%,rgba(40,38,34,.72))}`,
    },
    {
      id: 'peche',
      label: 'Pêche',
      name: 'pêche et arches',
      fonts: { display: gf('Prata', '400'), body: gf('Manrope', '400;500;600') },
      tokens: T({ radius: '22px', radiusLg: '30px', btnRadius: '999px', lh: 1.12 }),
      palettes: [
        { bg: '#FFF4EE', surface: '#FBE3D6', text: '#43302B', muted: '#735B55', primary: '#B9502F', accent: '#3F7762' },
        { bg: '#FBF6F0', surface: '#F3E6D8', text: '#3B2F2A', muted: '#6E5E55', primary: '#A35A40', accent: '#4D705D' },
      ],
      heroes: ['framed', 'split'],
      variants: { nav: ['center'], features: ['icons'], services: ['grid'], about: ['split'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:icons', 'offer:cards', 'offer2', 'gallery:masonry', 'reviews', 'cta:boxed', 'info'],
        ['hero', 'statement:center', 'about:split', 'offer:grid', 'offer2', 'gallery:strip', 'cta:boxed', 'info'],
      ],
      art: 'arch',
      footerMode: 'surface',
      deco: [['sunburst', 'tr'], ['blob', 'bl']],
      divider: 'wave',
      css: `
.fl-peche .hero-framed .frame::before{border-radius:999px 999px 30px 30px;background:var(--surface)}
.fl-peche .hero-visual,.fl-peche .about-visual{border-radius:999px 999px 30px 30px}`,
    },
    {
      id: 'lavande',
      label: 'Lavande',
      name: 'lavande',
      fonts: { display: gf('Comfortaa', '500;700'), body: gf('Nunito', '400;600') },
      tokens: T({ radius: '28px', radiusLg: '36px', btnRadius: '999px', displayWeight: 700, tracking: '-0.01em', lh: 1.1, h1: 'clamp(2.3rem, 5vw, 4.2rem)' }),
      palettes: [
        { bg: '#F5F3FF', surface: '#FFFFFF', text: '#2F2A45', muted: '#625C7D', primary: '#6E58B8', accent: '#AE4870' },
        { bg: '#F2F8F6', surface: '#FFFFFF', text: '#24363A', muted: '#57696C', primary: '#3E7F74', accent: '#8F5CA6' },
      ],
      heroes: ['split', 'collage'],
      variants: { nav: ['pill'], features: ['cards'], services: ['grid'], about: ['split'], cta: ['boxed'], footer: ['columns'], products: ['cards'] },
      recipes: [
        ['hero', 'highlights:cards', 'offer:cards', 'offer2', 'gallery:grid', 'process:cards', 'cta:boxed', 'info'],
        ['hero', 'offer:grid', 'offer2', 'gallery:bento', 'reviews', 'cta:boxed', 'info'],
      ],
      art: 'soft',
      footerMode: 'surface',
      deco: [['blob', 'tr'], ['ring', 'bl']],
      divider: null,
      css: `
.fl-lavande .svc-card,.fl-lavande .feat-cards .feature{border:0;background:var(--bg);box-shadow:8px 8px 20px color-mix(in srgb,var(--text) 10%,transparent),-8px -8px 20px #fff}
.fl-lavande .section.alt{background:var(--bg)}
.fl-lavande .btn{box-shadow:0 10px 24px -10px var(--primary)}`,
    },
  ],
};

export function flavorOf(archetype, id) {
  return (FLAVORS[archetype] || []).find((f) => f.id === id) || null;
}

// Direction artistique effective d'une déclinaison (le style de départ, retouché)
export function applyFlavor(arch, fl) {
  return {
    ...arch,
    fonts: fl.fonts || arch.fonts,
    tokens: { ...arch.tokens, ...(fl.tokens || {}) },
    palettes: fl.palettes || arch.palettes,
    variants: { ...arch.variants, ...(fl.variants || {}) },
    art: fl.art || arch.art,
    footerMode: fl.footerMode || arch.footerMode,
    topbar: fl.topbar ?? arch.topbar,
    stripes: fl.stripes ?? false,
    marquee: fl.marquee ?? false,
    css: fl.css || '',
  };
}

export function applyFlavorComp(comp, fl) {
  return {
    ...comp,
    heroes: fl.heroes || comp.heroes,
    recipes: fl.recipes || comp.recipes,
    divider: 'divider' in fl ? fl.divider : comp.divider,
    deco: fl.deco || comp.deco,
    css: fl.compCss || '',
  };
}
