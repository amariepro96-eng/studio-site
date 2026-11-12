// Feuille de style commune à tous les sites générés.
// Les couleurs, polices et formes viennent des variables CSS posées par la direction artistique.

export const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{animation:none!important;transition:none!important}}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:var(--body-size);line-height:1.62;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
img{max-width:100%;display:block}
a{color:inherit;text-underline-offset:3px}
h1,h2,h3,h4{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking);text-transform:var(--display-case);line-height:var(--display-lh);margin:0 0 .45em;text-wrap:balance}
h1,h2{overflow-wrap:break-word}
h3{line-height:1.2;letter-spacing:calc(var(--display-tracking) / 2)}
p{margin:0 0 1em;text-wrap:pretty}
ul{padding-left:1.1em}
:focus-visible{outline:3px solid var(--primary-ink);outline-offset:3px}
.skip{position:absolute;left:-9999px}.skip:focus{left:16px;top:16px;z-index:999;background:var(--bg);padding:8px 12px}
.wrap{max-width:var(--max);margin:0 auto;padding:0 clamp(20px,4vw,44px)}
.section{padding:var(--section-pad) 0}
.section.alt{background:var(--surface)}
.section-head{max-width:720px;margin-bottom:clamp(32px,4vw,56px)}
.section-head.center{margin-left:auto;margin-right:auto;text-align:center}
.section-head h2{font-size:var(--h2);margin-bottom:.3em}
.section-head p{color:var(--muted);font-size:1.08em;margin:0}
.lead{font-size:clamp(1.05rem,1.4vw,1.25rem);color:var(--muted);max-width:56ch}
.muted{color:var(--muted)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.55em;padding:.95em 1.6em;border-radius:var(--btn-radius);background:var(--primary);color:var(--on-primary);text-decoration:none;font-weight:600;font-size:.98rem;line-height:1.1;border:1.5px solid var(--primary);cursor:pointer;font-family:var(--font-body);transition:transform .15s ease,background .15s ease,box-shadow .15s ease}
.btn:hover{transform:translateY(-1px)}
.btn.ghost{background:transparent;color:var(--text);border-color:currentColor}
.btn.small{padding:.65em 1.15em;font-size:.9rem}
.link-arrow{display:inline-flex;align-items:center;gap:.4em;font-weight:600;color:var(--primary-ink);text-decoration:none;border-bottom:1.5px solid currentColor;padding-bottom:2px}
.ico{flex:none}
.art{width:100%;height:100%;display:block}
.visual{position:relative;overflow:hidden;background:var(--surface)}
.visual img{width:100%;height:100%;object-fit:cover}

/* Bandeau supérieur */
.topbar{font-size:.85rem;padding:8px 0}
.topbar .wrap{display:flex;gap:24px;justify-content:flex-end;flex-wrap:wrap}
.topbar a{text-decoration:none;display:inline-flex;align-items:center;gap:6px}

/* En-tête et navigation */
.site-header{position:relative;z-index:30;background:var(--header-bg)}
.nav{display:flex;align-items:center;justify-content:space-between;gap:28px;min-height:78px}
.logo{font-family:var(--font-display);font-weight:var(--display-weight);font-size:1.32rem;text-decoration:none;letter-spacing:var(--display-tracking);text-transform:var(--display-case);white-space:nowrap;line-height:1}
.logo-img{display:inline-flex;align-items:center}.logo-img img{display:block;height:46px;width:auto;max-width:190px;object-fit:contain}
.nav-links{display:flex;gap:clamp(16px,2.4vw,32px);align-items:center;list-style:none;margin:0;padding:0}
.nav-links a{text-decoration:none;font-size:.95rem;font-weight:500;opacity:.82}
.nav-links a:hover{opacity:1}
.nav-links a[aria-current="page"]{opacity:1;text-decoration:underline;text-underline-offset:7px;text-decoration-thickness:2px}
.nav-actions{display:flex;align-items:center;gap:12px}
.burger{display:none;background:transparent;border:1.5px solid currentColor;color:inherit;border-radius:var(--btn-radius);width:44px;height:44px;align-items:center;justify-content:center;cursor:pointer}
.mobile-menu{display:none}
.nav-center .nav{flex-direction:column;justify-content:center;gap:14px;padding:26px 0 16px}
.nav-center .logo{font-size:1.7rem}
.nav-center .nav-actions{display:none}
.nav-split .nav{display:grid;grid-template-columns:1fr auto 1fr}
.nav-split .nav-links{justify-self:start}
.nav-split .nav-actions{justify-self:end}
.nav-pill .site-header{padding:14px 0 0;background:transparent}
.nav-pill .nav{background:var(--surface);border-radius:999px;padding:0 10px 0 26px;min-height:64px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 10px 30px -14px rgba(0,0,0,.18)}

/* Héros */
.hero{position:relative;overflow:hidden}
.hero h1{font-size:var(--h1);margin-bottom:.32em}
.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.hero-split .hero-inner{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(32px,5vw,80px);align-items:center;padding-block:clamp(48px,7vw,104px)}
.hero-split .hero-visual{aspect-ratio:4/5;border-radius:var(--radius-lg)}
.hero-overlay{min-height:min(88vh,860px);display:flex;align-items:flex-end;color:#fff}
.hero-overlay .hero-bg{position:absolute;inset:0}
.hero-overlay .hero-bg>*{width:100%;height:100%;object-fit:cover}
.hero-overlay::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.14) 0%,rgba(0,0,0,.4) 40%,rgba(0,0,0,.78) 100%)}
.hero-overlay h1,.hero-overlay .lead,.hero-cover h1,.hero-cover .lead{text-shadow:0 1px 28px rgba(0,0,0,.35)}
.hero-overlay .hero-inner{position:relative;z-index:2;padding-top:140px;padding-bottom:clamp(56px,7vw,96px);width:100%}
.hero-overlay h1{max-width:16ch}
.hero-overlay .lead{color:rgba(255,255,255,.88)}
.hero-overlay .btn.ghost{color:#fff}
.hero-bigtype .hero-inner{padding-top:clamp(56px,8vw,120px)}
.hero-bigtype h1{font-size:var(--h1-big);max-width:14ch;margin-bottom:.2em}
.hero-bigtype .hero-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:32px;align-items:end;margin:28px 0 clamp(40px,5vw,64px)}
.hero-bigtype .hero-row .lead{margin:0}
.hero-bigtype .hero-row .hero-actions{margin:0}
.hero-bigtype .hero-visual{aspect-ratio:21/8;border-radius:var(--radius-lg);margin-bottom:clamp(48px,6vw,88px)}
.hero-centered{text-align:center}
.hero-centered .hero-inner{position:relative;z-index:2;padding:clamp(72px,10vw,150px) 0 clamp(44px,5vw,72px);max-width:980px;margin:0 auto}
.hero-centered .hero-visual{aspect-ratio:21/8;border-radius:var(--radius-lg);margin-bottom:clamp(48px,6vw,88px)}
.hero-centered .lead{margin-left:auto;margin-right:auto}
.hero-centered .hero-actions{justify-content:center}
.hero-framed .hero-inner{display:grid;grid-template-columns:.95fr 1.05fr;gap:clamp(32px,5vw,80px);align-items:center;padding-block:clamp(56px,7vw,110px)}
.hero-framed .frame{position:relative}
.hero-framed .frame::before{content:"";position:absolute;inset:28px -28px -28px 28px;background:var(--primary);border-radius:var(--radius-lg)}
.hero-framed .hero-visual{position:relative;aspect-ratio:1/1;border-radius:var(--radius-lg)}
.hero-mosaic .hero-inner{display:grid;grid-template-columns:1fr 1.1fr;gap:clamp(32px,5vw,72px);align-items:center;padding-block:clamp(48px,7vw,104px)}
.mosaic{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:14px;height:clamp(420px,46vw,600px)}
.mosaic .visual{border-radius:var(--radius-lg)}
.mosaic .visual:first-child{grid-row:1/3}

.marquee{overflow:hidden;background:var(--primary);color:var(--on-primary);border-block:var(--marquee-border,0);white-space:nowrap}
.marquee-track{display:inline-flex;gap:48px;padding:18px 0;animation:marquee 32s linear infinite;font-family:var(--font-display);font-size:clamp(1.3rem,2.6vw,2.2rem);text-transform:var(--display-case);font-weight:var(--display-weight);letter-spacing:var(--display-tracking)}
.marquee-track span{display:inline-flex;align-items:center;gap:48px}
.marquee-track span::after{content:"✦";font-size:.7em}
@keyframes marquee{to{transform:translateX(-50%)}}

/* Atouts */
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:clamp(18px,2.4vw,28px)}
.feature h3{font-size:1.24rem;margin-bottom:.4em}
.feature p{margin:0;color:var(--muted)}
.f-icon{width:50px;height:50px;display:grid;place-items:center;border-radius:var(--icon-radius);background:var(--primary-soft);color:var(--primary-ink);margin-bottom:20px}
.feat-cards .feature{background:var(--surface);padding:32px 28px;border-radius:var(--radius)}
.section.alt .feat-cards .feature{background:var(--bg)}
.feat-lined .feature{border-top:2px solid var(--line);padding-top:22px}
.feat-lined .f-icon{background:transparent;width:auto;height:auto;margin-bottom:14px;justify-content:start}
.feat-icons .feature{text-align:center;padding:8px}
.feat-icons .f-icon{margin:0 auto 18px;width:68px;height:68px}
.feat-tiles .features{gap:0}
.feat-tiles .feature{padding:clamp(28px,3vw,44px);background:var(--primary);color:var(--on-primary)}
.feat-tiles .feature p{color:inherit;opacity:.86}
.feat-tiles .f-icon{background:transparent;color:inherit;border:2px solid currentColor}
.feat-tiles .feature:nth-child(even){background:var(--text);color:var(--bg)}

/* Services */
.svc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr));gap:clamp(18px,2.4vw,28px)}
.svc-card{border:1px solid var(--line-soft);border-radius:var(--radius);padding:30px 28px;display:flex;flex-direction:column;gap:8px;background:var(--bg)}
.section.alt .svc-card{background:var(--bg)}
.svc-card h3{font-size:1.22rem;margin:6px 0 2px}
.svc-card p{color:var(--muted);margin:0}
.svc-card .price{font-weight:700;color:var(--primary-ink);margin-top:auto;padding-top:12px}
.svc-card .f-icon{margin-bottom:6px}
.svc-menu{max-width:880px}
.svc-menu.center{margin:0 auto}
.menu-row{padding:22px 0;border-bottom:1px solid var(--line-soft)}
.menu-row:first-child{border-top:1px solid var(--line-soft)}
.menu-head{display:flex;align-items:baseline;gap:14px}
.menu-head h3{margin:0;font-size:1.28rem}
.menu-dots{flex:1;border-bottom:2px dotted var(--line-soft);transform:translateY(-6px);min-width:24px}
.menu-price{font-weight:700;white-space:nowrap;color:var(--primary-ink)}
.menu-row p{margin:6px 0 0;color:var(--muted);max-width:62ch}
.svc-alternate .alt-row{display:grid;grid-template-columns:1fr 1fr;gap:clamp(32px,5vw,72px);align-items:center}
.svc-alternate .alt-row+.alt-row{margin-top:clamp(48px,6vw,88px)}
.svc-alternate .alt-row:nth-child(even) .alt-visual{order:2}
.alt-visual{aspect-ratio:5/4;border-radius:var(--radius-lg)}
.alt-row h3{font-size:clamp(1.5rem,2.4vw,2.1rem)}
.alt-row .price{font-weight:700;color:var(--primary-ink)}
.more{margin-top:clamp(28px,3vw,44px)}

/* À propos (aperçu) */
.about-split{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(32px,5vw,80px);align-items:center}
.about-visual{aspect-ratio:1/1;border-radius:var(--radius-lg)}
.about-split h2{font-size:var(--h2)}
.about-quote{text-align:center;max-width:960px;margin:0 auto}
.about-quote blockquote{font-family:var(--font-display);font-size:clamp(1.7rem,3.4vw,2.9rem);line-height:1.22;margin:0 0 30px;font-weight:var(--display-weight);letter-spacing:var(--display-tracking);text-wrap:balance}

/* Avis */
.reviews{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:24px}
.review{margin:0;padding:28px;border-radius:var(--radius);background:var(--surface);border:1px solid var(--line-soft)}
.section.alt .review{background:var(--bg)}
.review blockquote{margin:0 0 14px;font-size:1.06rem}
.review figcaption{font-weight:600;color:var(--muted)}

/* Appel à l'action */
.cta-band{background:var(--primary);color:var(--on-primary);padding:clamp(64px,8vw,110px) 0;text-align:center}
.cta-band h2{font-size:var(--h2);max-width:20ch;margin-left:auto;margin-right:auto}
.cta-band p{max-width:56ch;margin:0 auto 28px;opacity:.9}
.cta-band .btn{background:var(--on-primary);color:var(--primary);border-color:var(--on-primary)}
.cta-boxed .cta-box{background:var(--surface);border-radius:var(--radius-lg);padding:clamp(36px,6vw,80px);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:32px;align-items:center}
.cta-boxed h2{font-size:var(--h2);margin-bottom:.25em}
.cta-boxed p{margin:0;color:var(--muted)}
.cta-split .cta-inner{display:grid;grid-template-columns:1.2fr .8fr;gap:clamp(32px,5vw,72px);align-items:center}
.cta-split h2{font-size:var(--h2)}
.cta-split .cta-contact{display:grid;gap:14px;padding:28px;border-radius:var(--radius);background:var(--surface)}
.cta-split .cta-contact a{text-decoration:none;display:flex;gap:10px;align-items:center;font-weight:600}

/* Infos pratiques */
.info-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:28px}
.info-item{display:flex;gap:14px;align-items:flex-start}
.info-item .f-icon{margin:0;width:44px;height:44px}
.info-item h3{font-size:1.02rem;margin:0 0 4px;font-family:var(--font-body);font-weight:700;text-transform:none;letter-spacing:0}
.info-item p,.info-item a{margin:0;color:var(--muted);white-space:pre-line;text-decoration:none}

/* Pied de page */
.site-footer{background:var(--footer-bg);color:var(--footer-text);padding:clamp(56px,7vw,88px) 0 28px}
.site-footer a{text-decoration:none;opacity:.85}
.site-footer a:hover{opacity:1;text-decoration:underline}
.footer-cols{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:40px}
.footer-cols h4{font-family:var(--font-body);font-size:.95rem;font-weight:700;text-transform:none;letter-spacing:0;margin-bottom:14px;opacity:.7}
.footer-cols ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.footer-cols .logo{display:inline-block;margin-bottom:14px}
.footer-cols p{opacity:.78;max-width:34ch;white-space:pre-line}
.footer-big .big-word{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:var(--display-case);letter-spacing:var(--display-tracking);font-size:clamp(2.6rem,11vw,10rem);line-height:.9;margin:0 0 40px;overflow-wrap:break-word}
.footer-big .footer-row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:24px}
.footer-big .footer-row ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:22px}
.footer-bottom{border-top:1px solid var(--footer-line);margin-top:48px;padding-top:22px;font-size:.85rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;opacity:.75}
.socials{display:flex;gap:12px;margin-top:16px}
.socials a{width:40px;height:40px;border-radius:50%;border:1px solid var(--footer-line);display:grid;place-items:center;opacity:1}
.newsletter{display:flex;gap:8px;margin-top:12px;max-width:360px}
.newsletter input{flex:1;min-width:0;padding:.8em 1em;border-radius:var(--btn-radius);border:1px solid var(--footer-line);background:transparent;color:inherit;font:inherit}
.newsletter .btn{padding:.8em 1.1em}

/* Pages intérieures */
.page-hero{padding:clamp(56px,8vw,120px) 0 clamp(36px,4vw,64px)}
.page-hero h1{font-size:var(--h1-page);margin-bottom:.2em;max-width:20ch}
.page-hero .lead{margin:0}
.page-hero + .section{padding-top:clamp(8px,2vw,24px)}
.story{max-width:68ch;font-size:1.08em}
.story p{margin-bottom:1.1em}
.values{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:28px}
.values .feature{border-top:2px solid var(--line);padding-top:22px}
.prose-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:clamp(32px,5vw,80px);align-items:start}
.prose-grid .about-visual{position:sticky;top:24px}

/* FAQ */
.faq{max-width:860px;display:grid;gap:12px}
.faq details{border:1px solid var(--line-soft);border-radius:var(--radius);padding:0 24px;background:var(--bg)}
.faq summary{cursor:pointer;list-style:none;padding:22px 32px 22px 0;font-weight:600;font-size:1.08rem;position:relative}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:1.5rem;font-weight:400;color:var(--primary-ink)}
.faq details[open] summary::after{content:"−"}
.faq details p{margin:0 0 22px;color:var(--muted)}

/* Contact */
.contact-grid{display:grid;grid-template-columns:.85fr 1.15fr;gap:clamp(32px,5vw,80px);align-items:start}
.contact-list{display:grid;gap:22px}
.form{display:grid;gap:18px;background:var(--surface);padding:clamp(24px,4vw,44px);border-radius:var(--radius-lg)}
.form .row{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.field{display:grid;gap:6px}
.field label{font-weight:600;font-size:.92rem}
.field input,.field textarea,.field select{width:100%;padding:.85em 1em;border-radius:var(--radius-sm);border:1.5px solid var(--line-soft);background:var(--bg);color:var(--text);font:inherit}
.field input:focus,.field textarea:focus,.field select:focus{outline:none;border-color:var(--primary-ink);box-shadow:0 0 0 3px var(--primary-soft)}
.form-note{font-size:.85rem;color:var(--muted);margin:0}
.form-ok{display:none;padding:14px 18px;border-radius:var(--radius-sm);background:var(--primary-soft);color:var(--text)}
.map-link{display:inline-flex;align-items:center;gap:8px;margin-top:6px}

/* Boutique */
.shop-filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:32px}
.chip{border:1.5px solid var(--line-soft);border-radius:999px;padding:.5em 1.05em;background:transparent;cursor:pointer;font:inherit;font-size:.92rem;color:inherit}
.chip[aria-pressed="true"]{background:var(--text);color:var(--bg);border-color:var(--text)}
.products{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,232px),1fr));gap:clamp(20px,2.6vw,32px)}
.product{display:flex;flex-direction:column}
.product .p-visual{aspect-ratio:1/1;border-radius:var(--radius);position:relative}
.badge{position:absolute;top:12px;left:12px;background:var(--accent);color:var(--on-accent);font-size:.78rem;font-weight:700;padding:.35em .75em;border-radius:999px;z-index:2}
.product h3{font-size:1.08rem;margin:16px 0 4px;font-family:var(--font-body);font-weight:700;letter-spacing:0;text-transform:none}
.product p{font-size:.92rem;color:var(--muted);margin:0}
.p-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:auto;padding-top:14px}
.p-price{font-weight:700;font-size:1.05rem}
.products-minimal .product .p-visual{border-radius:0}
.cart-fab{position:fixed;right:20px;bottom:20px;z-index:60;box-shadow:0 10px 30px -8px rgba(0,0,0,.35)}
.cart-count{background:var(--on-primary);color:var(--primary);border-radius:999px;min-width:22px;height:22px;display:inline-grid;place-items:center;font-size:.8rem;padding:0 6px}
.cart-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);opacity:0;pointer-events:none;transition:opacity .2s;z-index:90}
.cart-drawer{position:fixed;top:0;right:0;height:100%;width:min(420px,100%);background:var(--bg);color:var(--text);transform:translateX(105%);transition:transform .25s ease;z-index:100;display:flex;flex-direction:column;box-shadow:-20px 0 60px -20px rgba(0,0,0,.35)}
.cart-open .cart-overlay{opacity:1;pointer-events:auto}
.cart-open .cart-drawer{transform:none}
.cart-head{display:flex;justify-content:space-between;align-items:center;padding:22px 24px;border-bottom:1px solid var(--line-soft)}
.cart-head h2{font-size:1.4rem;margin:0}
.cart-body{flex:1;overflow:auto;padding:12px 24px}
.cart-line{display:grid;grid-template-columns:1fr auto;gap:6px;padding:14px 0;border-bottom:1px solid var(--line-soft)}
.cart-line .qty{display:inline-flex;align-items:center;gap:10px}
.qty button{width:30px;height:30px;border-radius:50%;border:1px solid var(--line-soft);background:transparent;color:inherit;cursor:pointer;display:grid;place-items:center}
.cart-foot{padding:20px 24px;border-top:1px solid var(--line-soft);display:grid;gap:14px}
.cart-total{display:flex;justify-content:space-between;font-weight:700;font-size:1.1rem}
.cart-empty{color:var(--muted);padding:24px 0}
.icon-btn{background:transparent;border:0;color:inherit;cursor:pointer;padding:6px;display:grid;place-items:center}

/* Mentions légales */
.legal{max-width:760px}
.legal h2{font-size:1.4rem;margin-top:1.6em}
.todo{background:var(--primary-soft);padding:0 .3em;border-radius:3px}

/* Responsive */
@media (max-width:900px){
  .nav-links,.nav-actions .btn{display:none}
  .burger{display:inline-flex}
  .nav{gap:16px}
  .logo{white-space:normal;font-size:1.12rem;line-height:1.1;min-width:0}
  .nav-center .logo{font-size:1.12rem}
  .nav-center .nav,.nav-split .nav{display:flex;flex-direction:row;justify-content:space-between;padding:0}
  .nav-center .nav-actions{display:flex}
  .mobile-menu{display:none;position:absolute;left:0;right:0;top:100%;background:var(--bg);color:var(--text);padding:12px clamp(20px,4vw,44px) 28px;box-shadow:0 20px 40px -20px rgba(0,0,0,.3)}
  .menu-open .mobile-menu{display:grid;gap:4px}
  .mobile-menu a{text-decoration:none;font-size:1.15rem;padding:12px 0;border-bottom:1px solid var(--line-soft)}
  .mobile-menu .btn{margin-top:16px;border-bottom:0}
  .hero-split .hero-inner,.hero-framed .hero-inner,.hero-mosaic .hero-inner,.about-split,.svc-alternate .alt-row,.contact-grid,.prose-grid,.cta-split .cta-inner,.cta-boxed .cta-box{grid-template-columns:1fr}
  .hero-split .hero-visual{aspect-ratio:4/3}
  .hero-bigtype .hero-row{grid-template-columns:1fr}
  .hero-bigtype .hero-visual{aspect-ratio:16/10}
  .svc-alternate .alt-row:nth-child(even) .alt-visual{order:0}
  .footer-cols{grid-template-columns:1fr 1fr}
  .mosaic{height:380px}
  .hero-framed .frame::before{inset:16px -12px -16px 12px}
  .prose-grid .about-visual{position:static}
}
@media (max-width:560px){
  .footer-cols{grid-template-columns:1fr}
  .form .row{grid-template-columns:1fr}
  .hero-actions .btn{flex:1 1 auto}
  .menu-head{flex-wrap:wrap}
  .menu-dots{display:none}
  .menu-price{margin-left:auto}
}

/* Héros supplémentaires */
.hero-cover{min-height:min(92vh,880px);display:flex;align-items:flex-end;color:#fff}
.hero-cover .hero-bg,.hero-panel .hero-bg{position:absolute;inset:0;border-radius:0}
.hero-cover::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08) 20%,rgba(0,0,0,.35) 50%,rgba(0,0,0,.76));pointer-events:none;z-index:0}
.hero-cover .hero-inner{position:relative;z-index:2;width:100%;padding-top:160px;padding-bottom:clamp(36px,5vw,64px)}
.hero-cover h1{font-size:var(--h1-big);max-width:15ch;margin-bottom:.3em}
.cover-foot{display:flex;justify-content:space-between;align-items:flex-end;gap:24px 40px;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.45);padding-top:24px}
.hero-cover .lead{color:rgba(255,255,255,.9);margin:0}
.hero-cover .hero-actions{margin:0}
.hero-cover .btn.ghost,.hero-overlay .btn.ghost{color:#fff}
.hero-panel{min-height:min(88vh,820px);display:flex;align-items:flex-end}
.hero-panel .hero-inner{position:relative;z-index:2;width:100%}
.hero-panel .panel{background:var(--bg);color:var(--text);max-width:640px;padding:clamp(28px,4vw,56px) clamp(24px,4vw,56px) clamp(32px,4vw,48px);border-radius:var(--radius-lg) var(--radius-lg) 0 0}
.hero-panel h1{font-size:clamp(2.2rem,4.6vw,4rem)}
.hero-collage .hero-inner{display:grid;grid-template-columns:1fr 1fr;gap:clamp(32px,5vw,72px);align-items:center;padding-block:clamp(48px,7vw,104px)}
.collage{position:relative;aspect-ratio:1/1;width:100%;max-width:100%}
.collage .visual{position:absolute;border-radius:var(--radius-lg);box-shadow:0 24px 50px -24px rgba(0,0,0,.4)}
.collage .c1{left:0;top:12%;width:54%;aspect-ratio:3/4;z-index:2}
.collage .c2{right:0;top:0;width:50%;aspect-ratio:4/5}
.collage .c3{right:8%;bottom:0;width:44%;aspect-ratio:1/1;z-index:3}

/* Décor dessiné */
.hero,.statement,.process-sec{position:relative}
.deco-layer{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden}
.hero > .wrap,.statement > .wrap,.process-sec > .wrap{position:relative;z-index:1}
.deco{position:absolute;display:block;width:clamp(56px,7vw,104px)}
.deco svg{width:100%;height:auto;display:block}
.deco.p-tr{top:5%;right:2.5%}
.deco.p-tl{top:4%;left:1.5%}
.deco.p-br{bottom:5%;right:3%}
.deco.p-bl{bottom:4%;left:2%}
.d-squiggle,.d-arrow{width:clamp(90px,10vw,160px)}
.d-sunburst{width:clamp(130px,16vw,230px)}
.d-blob{width:clamp(130px,17vw,250px)}
.d-scribble{width:clamp(110px,12vw,170px)}
.d-sunburst.p-tr{top:-4%;right:-2%}
.d-blob.p-tr{top:-6%;right:-3%}
.deco-statement .p-tl,.deco-process .p-tl{top:10%}

/* Séparateurs */
.divider{line-height:0;position:relative;z-index:2;margin-block:-1px}
.divider svg{display:block;width:100%;height:clamp(22px,3.6vw,52px)}

/* Manifeste */
.statement-text{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking);font-size:clamp(1.55rem,3.2vw,2.8rem);line-height:1.24;margin:0;max-width:30ch;text-wrap:balance}
.statement-center .statement-text{margin:0 auto;text-align:center}

/* Galeries */
.gal{display:grid;gap:clamp(12px,1.6vw,20px)}
.gal-item{margin:0;min-width:0}
.gal .visual{border-radius:var(--radius)}
.gal-item figcaption{margin-top:10px;color:var(--muted);font-size:.92rem}
.gal-grid{grid-template-columns:repeat(3,1fr)}
.gal-grid .visual{aspect-ratio:1/1}
.gal-masonry{display:block;columns:3;column-gap:clamp(12px,1.6vw,20px)}
.gal-masonry .gal-item{break-inside:avoid;margin-bottom:clamp(12px,1.6vw,20px)}
.gal-strip{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:14px;max-width:100%}
.gal-strip .gal-item{flex:0 0 clamp(220px,26vw,330px);scroll-snap-align:start}
.gal-strip .visual{aspect-ratio:3/4}
.gal-polaroid{display:flex;flex-wrap:wrap;justify-content:center;gap:clamp(18px,2.6vw,34px);padding-block:12px}
.gal-polaroid .gal-item{background:#fff;padding:12px 12px 18px;box-shadow:0 14px 34px -14px rgba(0,0,0,.4);width:clamp(190px,21vw,260px);transform:rotate(-3deg)}
.gal-polaroid .gal-item:nth-child(2n){transform:rotate(2.5deg) translateY(16px)}
.gal-polaroid .gal-item:nth-child(3n){transform:rotate(-1deg) translateY(-6px)}
.gal-polaroid .visual{aspect-ratio:1/1;border-radius:2px}
.gal-polaroid figcaption{color:#2b2b2b;font-family:var(--font-display);text-align:center;font-size:1rem}
.gal-bento{grid-template-columns:repeat(4,1fr);grid-auto-rows:clamp(150px,17vw,240px)}
.gal-bento .gal-item{height:100%}
.gal-bento .visual{height:100%}
.gal-bento .gal-item:nth-child(1){grid-column:span 2;grid-row:span 2}
.gal-bento .gal-item:nth-child(2){grid-column:span 2}
.gal-bento.n-3 .gal-item:nth-child(3){grid-column:span 2}

/* Bandeaux photo */
.band{position:relative;overflow:hidden}
.band-plain .visual{height:clamp(300px,50vw,620px)}
.band-duo{display:grid;grid-template-columns:1fr 1fr}
.band-duo .visual{height:clamp(300px,44vw,600px)}
.band-quote{min-height:clamp(360px,48vw,600px);display:flex;align-items:center;color:#fff}
.band-bg{position:absolute;inset:0}
.band-quote::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,.5);pointer-events:none;z-index:1}
.band-inner{position:relative;z-index:2;padding-block:80px;text-align:center}
.band-quote blockquote{font-family:var(--font-display);font-weight:var(--display-weight);font-size:clamp(1.7rem,3.6vw,3.1rem);line-height:1.2;margin:0 auto;max-width:24ch;text-wrap:balance}

/* Étapes */
.steps{list-style:none;margin:0;padding:0;display:grid;gap:clamp(18px,2.4vw,28px)}
.step{display:flex;gap:18px;align-items:flex-start;min-width:0}
.step h3{font-size:1.2rem;margin:6px 0 6px}
.step p{margin:0;color:var(--muted)}
.step-num{flex:none;width:50px;height:50px;border-radius:50%;display:grid;place-items:center;font-family:var(--font-display);font-weight:var(--display-weight);font-size:1.3rem;background:var(--primary-soft);color:var(--primary-ink);position:relative;z-index:1}
.steps-line{grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));position:relative}
.steps-line .step{flex-direction:column;gap:12px}
.steps-line::before{content:"";position:absolute;left:25px;right:25px;top:25px;height:2px;background:var(--line-soft)}
.steps-cards{grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}
.steps-cards .step{flex-direction:column;gap:12px;background:var(--surface);padding:28px;border-radius:var(--radius)}
.section.alt .steps-cards .step{background:var(--bg)}
.process-image{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(32px,5vw,72px);align-items:center}
.process-visual{aspect-ratio:4/5;border-radius:var(--radius-lg)}

/* Services illustrés */
.svc-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(18px,2.4vw,28px)}
.svc-cards.n-2,.svc-cards.n-4{grid-template-columns:repeat(2,1fr)}
.svc-cards.n-1{grid-template-columns:minmax(0,520px)}
.svc-imgcard{background:var(--surface);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column;min-width:0}
.section.alt .svc-imgcard{background:var(--bg)}
.svc-imgcard .visual{aspect-ratio:4/3}
.svc-body{padding:22px 24px 26px;display:flex;flex-direction:column;gap:6px;flex:1}
.svc-body h3{font-size:1.2rem;margin:0}
.svc-body p{margin:0;color:var(--muted)}
.svc-body .price{font-weight:700;color:var(--primary-ink);margin-top:auto;padding-top:10px}

/* Bento */
.bento{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:clamp(14px,2vw,22px)}
.bento > :nth-child(1){grid-column:1;grid-row:1}
.bento > :nth-child(2){grid-column:2;grid-row:1 / 3}
.bento > :nth-child(3){grid-column:3;grid-row:1}
.bento > :nth-child(4){grid-column:1;grid-row:2}
.bento > :nth-child(5){grid-column:3;grid-row:2}
.bento-card{background:var(--surface);border-radius:var(--radius-lg);padding:28px}
.section.alt .bento-card{background:var(--bg)}
.bento-card p{color:var(--muted);margin:0}
.bento-img{border-radius:var(--radius-lg);min-height:360px}
.bento-accent{background:var(--primary)!important;color:var(--on-primary);display:flex;align-items:flex-end}
.bento-accent p{font-family:var(--font-display);font-size:1.45rem;line-height:1.2;color:inherit}

/* Appel à l'action sur photo */
.cta-image{position:relative;overflow:hidden;color:#fff;text-align:center}
.cta-image::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.42),rgba(0,0,0,.66));pointer-events:none;z-index:1}
.cta-image-inner{position:relative;z-index:2;padding-block:clamp(90px,11vw,160px)}
.cta-image h2{font-size:var(--h2);max-width:20ch;margin:0 auto .4em}
.cta-image p{max-width:52ch;margin:0 auto 28px;opacity:.92}
.section.alt .cta-box{background:var(--bg)}

/* Visuel de page intérieure */
.page-visual{aspect-ratio:21/8;border-radius:var(--radius-lg)}

@media (max-width:900px){
  .hero-collage .hero-inner{grid-template-columns:1fr}
  .collage{max-width:520px;margin:0 auto}
  .gal-grid{grid-template-columns:repeat(2,1fr)}
  .gal-masonry{columns:2}
  .gal-bento{grid-template-columns:repeat(2,1fr);grid-auto-rows:clamp(140px,34vw,220px)}
  .gal-bento .gal-item:nth-child(2),.gal-bento.n-3 .gal-item:nth-child(3){grid-column:span 2}
  .steps-line::before{display:none}
  .process-image{grid-template-columns:1fr}
  .process-visual{aspect-ratio:4/3}
  .svc-cards,.svc-cards.n-4{grid-template-columns:1fr 1fr}
  .bento{grid-template-columns:1fr 1fr}
  .bento > *{grid-column:auto!important;grid-row:auto!important}
  .bento > .bento-img{grid-column:1 / -1!important;aspect-ratio:16/10;min-height:0}
  .page-visual{aspect-ratio:16/9}
  .cover-foot{flex-direction:column;align-items:flex-start}
  .deco{width:58px}
  .deco.p-tl,.deco.p-bl{display:none}
}
@media (max-width:560px){
  .band-duo{grid-template-columns:1fr}
  .svc-cards,.svc-cards.n-2,.svc-cards.n-4,.bento{grid-template-columns:1fr}
  .gal-polaroid .gal-item{width:calc(50% - 12px);padding:8px 8px 12px}
  .hero-panel .panel{padding:24px 20px 28px}
}
`;

// Ajouts de l'espace client : bandeaux d'annonces, offres, ruptures de stock.
// Placés après les styles de la direction artistique pour garder la priorité.
export const ESPACE_CSS = `
[hidden]{display:none!important}
.ss-annonces .ss-annonce{position:relative;overflow:hidden;background:var(--primary);color:var(--on-primary);font-family:var(--font-body);font-size:.95rem;line-height:1.35;text-transform:none;letter-spacing:0}
.ss-annonces .ss-annonce .wrap{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:.65em;padding-top:.7em;padding-bottom:.7em;text-align:center}
.ss-annonces .ss-annonce p{margin:0;font-weight:600;text-wrap:balance;color:inherit}
.ss-annonces .ss-ico{display:inline-flex;flex:none}
.ss-annonces .ss-annonce.ss-fermeture{background:var(--text);color:var(--bg)}
.ss-annonces .ss-annonce.ss-fete{background:var(--ss-band);color:var(--ss-fg)}
.ss-annonces .ss-annonce.ss-fete::before,.ss-annonces .ss-annonce.ss-fete::after{content:"";position:absolute;top:0;bottom:0;width:min(26%,260px);background:var(--ss-motif) 0 0/44px 44px;opacity:.55;pointer-events:none}
.ss-annonces .ss-annonce.ss-fete::before{left:0;-webkit-mask-image:linear-gradient(90deg,#000,transparent);mask-image:linear-gradient(90deg,#000,transparent)}
.ss-annonces .ss-annonce.ss-fete::after{right:0;-webkit-mask-image:linear-gradient(270deg,#000,transparent);mask-image:linear-gradient(270deg,#000,transparent)}
.ss-annonces .ss-annonce + .ss-annonce{border-top:1px solid rgba(127,127,127,.25)}
@media (max-width:560px){.ss-annonces .ss-annonce{font-size:.88rem}.ss-annonces .ss-annonce.ss-fete::before,.ss-annonces .ss-annonce.ss-fete::after{width:16%}}
.ss-tag{display:inline-flex;align-items:center;align-self:flex-start;width:fit-content;font-family:var(--font-body);font-size:.78rem;font-weight:700;letter-spacing:0;text-transform:none;line-height:1.25;padding:.32em .75em;border-radius:999px;background:var(--text);color:var(--bg);margin:.25em 0 .55em}
.ss-tag.ss-tag-offre{background:var(--accent);color:var(--on-accent)}
.ss-avant{opacity:.62;font-weight:400;margin-right:.2em}
.ss-indispo h3,.ss-indispo p,.ss-indispo .price,.ss-indispo .menu-price,.ss-indispo .visual{opacity:.55}
.product.ss-rupture .p-visual{filter:grayscale(1) opacity(.7)}
.badge.ss-badge-rupture{background:var(--text);color:var(--bg)}
.btn[disabled]{opacity:.55;cursor:not-allowed;transform:none}
`;

// Mise en page propre à chaque modèle d'une génération (trames.js) : place des titres, rythme
// des sections, modules côte à côte, sommaire. Placé après le CSS du style.
export const MISE_CSS = `
.tt-centre .section>.wrap>.section-head{margin-left:auto;margin-right:auto;text-align:center}
.tt-ligne .section>.wrap>.section-head{max-width:none;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:12px clamp(24px,5vw,72px);align-items:end;text-align:left;margin-left:0;margin-right:0;padding-bottom:clamp(16px,2vw,26px);border-bottom:1px solid var(--line-soft)}
.tt-ligne .section>.wrap>.section-head h2{margin:0}
.tt-numero main{counter-reset:ssec}
.tt-numero .section-head h2::before,.tt-numero .duo-cell>h2:first-child::before{counter-increment:ssec;content:counter(ssec,decimal-leading-zero);display:block;width:auto;height:auto;background:none;font-family:var(--font-body);font-style:normal;font-size:max(.3em,.8rem);font-weight:700;letter-spacing:.16em;color:var(--primary-ink);margin:0 0 .8em}
.tt-numero .section-head.center h2::before{margin-left:auto;margin-right:auto}
@media (min-width:901px){
.tt-cote .section>.wrap:has(>.section-head){display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2.3fr);column-gap:clamp(32px,5vw,80px);align-items:start}
.tt-cote .section>.wrap:has(>.section-head)>*{grid-column:2}
.tt-cote .section>.wrap>.section-head{grid-column:1;grid-row:1/span 6;position:sticky;top:110px;margin:0;max-width:none;text-align:left}
.tt-cote .section>.wrap>.section-head h2{font-size:clamp(1.7rem,2.6vw,2.4rem)}
.tt-cote .gal-grid{grid-template-columns:repeat(2,1fr)}
}
.ry-filets main>.section.alt{background:transparent}
.ry-filets main>.section+.section{padding-top:0}
.ry-filets main>.section+.section>.wrap{border-top:1px solid var(--line-soft);padding-top:var(--section-pad)}
.ry-cartes main>.section.alt{background:transparent;padding:clamp(8px,1.2vw,14px) 0}
.ry-cartes main>.section.alt>.wrap{background:var(--surface);border-radius:var(--radius-lg);padding-top:clamp(40px,5vw,76px);padding-bottom:clamp(40px,5vw,76px);width:min(var(--max),calc(100% - 2 * clamp(10px,2.4vw,28px)))}
.ry-cartes main>:not(.section)+.section.alt,.ry-cartes main>.section.alt:first-child{padding-top:clamp(20px,3vw,40px)}
.ry-cartes main>.section.alt:last-child{padding-bottom:clamp(20px,3vw,40px)}
.duo{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(36px,6vw,96px);align-items:center}
.duo-cell{min-width:0}
.duo-cell>h2{font-size:var(--h2);margin-bottom:.45em}
.duo-cell .lead{margin-bottom:1.1em}
.duo-list{list-style:none;margin:0;padding:0;display:grid;gap:22px}
.duo-list li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;align-items:start}
.duo-list .f-icon{margin:0;width:46px;height:46px}
.duo-list h3{font-size:1.08rem;margin:2px 0 .25em}
.duo-list p{margin:0;color:var(--muted)}
.duo-reviews{display:grid;gap:18px}
.duo-visual{aspect-ratio:4/5;border-radius:var(--radius-lg)}
.duo-cell .statement-text{font-size:clamp(1.35rem,2.5vw,2.1rem);max-width:none}
.duo-statement-about{align-items:start}
.duo-sec~.duo-sec .duo-visual{order:-1}
.sommaire{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:clamp(14px,2vw,22px)}
.som-tuile{position:relative;display:grid;gap:8px;align-content:start;min-height:200px;padding:clamp(22px,2.6vw,32px);border:1px solid var(--line-soft);border-radius:var(--radius-lg);background:var(--bg);color:inherit;text-decoration:none;transition:border-color .2s,transform .2s}
.section:not(.alt) .som-tuile{background:var(--surface)}
.som-tuile:hover{border-color:var(--primary);transform:translateY(-3px)}
.som-num{font-weight:700;letter-spacing:.14em;font-size:.82rem;color:var(--primary-ink)}
.som-titre{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking);font-size:clamp(1.5rem,2.4vw,2.1rem);line-height:1.1}
.som-texte{color:var(--muted);font-size:.95rem}
.som-fleche{position:absolute;right:clamp(20px,2.4vw,28px);bottom:clamp(20px,2.4vw,28px);color:var(--primary-ink)}
@media (max-width:900px){
.duo{grid-template-columns:1fr}
.duo-sec~.duo-sec .duo-visual{order:0}
.duo-visual{aspect-ratio:4/3}
.tt-ligne .section>.wrap>.section-head{grid-template-columns:1fr}
}
/* Hauts de page inspirés de sites tendance */
.hero-masthead .wrap{padding-top:clamp(24px,3.5vw,52px)}
.mot-geant{display:block;width:100%;height:auto;overflow:visible}
.mot-geant text{font-family:var(--font-display);font-weight:var(--display-weight);fill:currentColor}
.mast-nom{margin:0 0 clamp(12px,1.6vw,22px)}
.mast-ligne{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:clamp(20px,4vw,64px);align-items:end;border-top:2px solid var(--text);border-bottom:1px solid var(--line-soft);padding:clamp(16px,2vw,24px) 0;margin-bottom:clamp(20px,3vw,36px)}
.hero-masthead h1{font-size:clamp(1.6rem,3vw,2.6rem);margin:0;max-width:22ch}
.mast-ligne .lead{margin:0}
.mast-ligne .hero-actions{margin-top:16px}
.mast-visual{aspect-ratio:21/9;margin-bottom:clamp(40px,6vw,80px)}
.hero-scinde .wrap{padding-block:clamp(24px,3.5vw,52px) clamp(40px,6vw,80px)}
.sc-mot{max-width:100%}
.sc-mot.sc-b{margin-left:auto}
.sc-milieu{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1fr);gap:clamp(20px,4vw,56px);align-items:center;margin:clamp(14px,2vw,26px) 0}
.sc-visual{aspect-ratio:4/3}
.hero-scinde h1{font-size:clamp(1.5rem,2.8vw,2.4rem);margin-bottom:.4em}
.sc-texte .hero-actions{margin-top:20px}
.hero-capsule .wrap{padding-block:clamp(16px,2vw,28px) clamp(40px,6vw,80px)}
.capsule{position:relative;border-radius:999px;overflow:hidden;min-height:clamp(320px,48vw,620px);display:grid;place-items:center;border:3px solid var(--primary)}
.capsule-img{position:absolute;inset:0;border-radius:0}
.capsule::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,.34)}
.capsule-txt{position:relative;z-index:1;text-align:center;color:#fff;padding:0 9%}
.hero-capsule h1{color:#fff;font-size:var(--h1-big);text-transform:uppercase;margin:.12em 0;line-height:.95;text-shadow:0 2px 30px rgba(0,0,0,.3)}
.orn{display:block;letter-spacing:.5em;font-size:1rem;opacity:.9}
.capsule-pied{display:grid;justify-items:center;text-align:center;margin-top:clamp(20px,3vw,36px)}
.capsule-pied .lead{max-width:60ch;margin:0 auto}
.capsule-pied .hero-actions{justify-content:center}
.hero-diptyque{display:grid;grid-template-columns:1fr 1fr;min-height:min(90vh,880px)}
.dip-img{border-radius:0;min-height:100%}
.dip-carte{position:absolute;left:50%;bottom:clamp(24px,5vw,64px);transform:translateX(-50%);width:min(540px,calc(100% - 40px));background:var(--bg);color:var(--text);padding:clamp(22px,3vw,40px);text-align:center;border-radius:var(--radius-lg);box-shadow:0 30px 80px -30px rgba(0,0,0,.5);z-index:2}
.dip-nom{letter-spacing:.32em;text-transform:uppercase;font-size:.78rem;font-weight:700;margin:0 0 10px;color:var(--primary-ink)}
.hero-diptyque h1{font-size:clamp(1.7rem,3.2vw,2.8rem);margin-bottom:.35em}
.dip-carte .lead{margin:0 auto}
.dip-carte .hero-actions{justify-content:center;margin-top:20px}
.hero-pied{min-height:min(94vh,920px);display:flex;align-items:flex-end;color:#fff}
.hero-pied .hero-bg{position:absolute;inset:0;border-radius:0}
.hero-pied::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08) 25%,rgba(0,0,0,.62));z-index:0;pointer-events:none}
.hero-pied .hero-inner{position:relative;z-index:2;width:100%;padding-top:160px;padding-bottom:clamp(8px,1.4vw,18px)}
.pied-haut{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(20px,4vw,60px);align-items:end;margin-bottom:clamp(10px,2vw,22px)}
.hero-pied h1{font-size:clamp(1.6rem,3vw,2.6rem);margin:0;max-width:20ch;color:#fff}
.hero-pied .lead{color:rgba(255,255,255,.9);margin:0}
.hero-pied .btn.ghost{color:#fff;border-color:rgba(255,255,255,.75)}
.pied-nom{color:#fff}
.hero-objet{background:var(--surface);text-align:center}
.hero-objet .wrap{padding-block:clamp(28px,4vw,60px) clamp(48px,6vw,88px);display:grid;justify-items:center}
.objet-nom{letter-spacing:.3em;text-transform:uppercase;font-size:.8rem;font-weight:700;margin:0 0 clamp(18px,3vw,32px)}
.objet-visual{width:min(400px,72vw);aspect-ratio:4/5;box-shadow:0 40px 90px -40px rgba(0,0,0,.5)}
.objet-texte{max-width:660px;margin-top:clamp(24px,4vw,44px)}
.hero-objet h1{font-size:clamp(1.8rem,3.6vw,3rem)}
.hero-objet .lead{margin-left:auto;margin-right:auto}
.hero-objet .hero-actions{justify-content:center}
.hero-arche .hero-inner{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:clamp(28px,5vw,80px);align-items:center;padding-block:clamp(48px,7vw,104px)}
.hero-arche h1{font-size:var(--h1-big);line-height:.95;margin-bottom:.3em}
.arche{position:relative}
.arche-visual{aspect-ratio:3/4.1;border-radius:999px 999px var(--radius-lg) var(--radius-lg);border:3px solid var(--text)}
.arche-sceau{position:absolute;left:-22px;bottom:34px;background:var(--primary);color:var(--on-primary);font-weight:700;font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;padding:10px 16px;border-radius:999px;transform:rotate(-8deg);box-shadow:0 10px 30px -12px rgba(0,0,0,.45);max-width:80%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hero-affiche{background:var(--primary);color:var(--on-primary)}
.hero-affiche .wrap{padding-block:clamp(36px,5vw,72px) clamp(44px,6vw,90px)}
.hero-affiche .affiche-titre{font-size:clamp(2.6rem,8.4vw,8rem);line-height:.9;text-transform:uppercase;letter-spacing:-.03em;margin:0;color:var(--on-primary);max-width:none;overflow-wrap:anywhere}
.hero-affiche .affiche-titre.affiche-long{font-size:clamp(2.2rem,6vw,5.6rem)}
.affiche-titre .contour{color:transparent;-webkit-text-stroke:max(2px,.02em) var(--on-primary)}
.affiche-bas{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.8fr);gap:clamp(24px,4vw,64px);align-items:end;margin-top:clamp(24px,4vw,48px)}
.hero-affiche .lead{color:var(--on-primary);opacity:.92}
.affiche-visual{aspect-ratio:4/3;transform:rotate(2.5deg);box-shadow:0 30px 70px -30px rgba(0,0,0,.55);border:4px solid var(--on-primary)}
.hero-affiche .btn{background:var(--on-primary);color:var(--primary);border-color:var(--on-primary)}
.hero-affiche .btn.ghost{background:transparent;color:var(--on-primary)}
/* Modules inspirés de sites tendance */
.mi-texte{font-family:var(--font-display);font-weight:var(--display-weight);font-size:clamp(1.9rem,4.3vw,3.9rem);line-height:1.14;text-align:center;letter-spacing:var(--display-tracking);margin:0 auto;max-width:1100px;text-wrap:balance}
.mi-img{display:inline-block;width:2.3em;height:1.05em;border-radius:999px;vertical-align:-.1em;margin:0 .06em}
.portes{display:grid;grid-template-columns:1fr 1fr;gap:clamp(12px,1.6vw,20px)}
.porte{position:relative;display:block;min-height:clamp(320px,40vw,540px);border-radius:var(--radius-lg);overflow:hidden;color:#fff;text-decoration:none}
.porte-img{position:absolute;inset:0;border-radius:0;transition:transform .5s ease}
.porte::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,.72))}
.porte:hover .porte-img{transform:scale(1.04)}
.porte-txt{position:absolute;left:0;right:0;bottom:0;z-index:1;padding:clamp(20px,3vw,36px);display:grid;gap:6px}
.porte-titre{font-family:var(--font-display);font-weight:var(--display-weight);font-size:clamp(1.6rem,3vw,2.6rem);line-height:1.05}
.porte-texte{opacity:.92;max-width:44ch}
.porte-lien{display:inline-flex;gap:8px;align-items:center;font-weight:600;margin-top:6px}
.manifeste{background:var(--primary);color:var(--on-primary);text-align:center;padding:clamp(72px,10vw,150px) 0}
.mf-etiquette{display:inline-block;background:var(--on-primary);color:var(--primary);font-weight:700;font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;padding:7px 14px;border-radius:6px;transform:rotate(-3deg);margin-bottom:clamp(20px,3vw,32px)}
.mf-texte{font-family:var(--font-display);font-weight:var(--display-weight);text-transform:uppercase;font-size:clamp(1.8rem,4.2vw,3.6rem);line-height:1.06;max-width:24ch;margin:0 auto;letter-spacing:-.01em}
.mf-orn{display:block;margin:clamp(20px,3vw,32px) 0;letter-spacing:.6em;font-size:1.1rem}
.mf-intro{max-width:62ch;margin:0 auto;opacity:.9}
.grand-mot{overflow:hidden;text-align:center}
.gm-mot text{fill:none;stroke:var(--text);stroke-width:1.6px;vector-effect:non-scaling-stroke}
.gm-ligne{margin:clamp(14px,2vw,22px) auto 0;max-width:60ch;color:var(--muted)}
.gal-asym{display:grid;grid-template-columns:1.25fr 1fr 1fr;grid-auto-rows:minmax(0,auto);gap:clamp(10px,1.4vw,18px)}
.gal-asym .gal-item{margin:0}
.gal-asym .gal-item:first-child{grid-row:1/3}
.gal-asym .gal-item .visual{aspect-ratio:4/5}
.gal-asym .gal-item:first-child .visual{aspect-ratio:auto;height:100%}
.gal-eventail{display:flex;justify-content:center;padding:clamp(10px,2vw,24px) 0 clamp(26px,3vw,44px)}
.gal-eventail .gal-item{flex:0 1 clamp(150px,18vw,240px);min-width:0;margin:0 calc(clamp(150px,18vw,240px) * -.06);background:var(--bg);padding:10px 10px 14px;border-radius:var(--radius);box-shadow:0 22px 50px -24px rgba(0,0,0,.5);transition:transform .3s ease;position:relative}
.gal-eventail .gal-item:nth-child(odd){transform:rotate(-5deg)}
.gal-eventail .gal-item:nth-child(even){transform:rotate(4deg) translateY(18px)}
.gal-eventail .gal-item:nth-child(3n){transform:rotate(-1.5deg) translateY(-8px)}
.gal-eventail .gal-item:hover{transform:rotate(0) translateY(-10px);z-index:2}
.gal-eventail .visual{aspect-ratio:3/4;border-radius:calc(var(--radius) - 4px)}
.gal-eventail figcaption{font-size:.85rem;margin-top:8px;text-align:center}
.idx-liste{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.idx-ligne{display:grid;grid-template-columns:3.2em minmax(0,1.6fr) minmax(0,1fr);gap:clamp(12px,2vw,28px);align-items:baseline;padding:clamp(14px,1.8vw,22px) 0;border-bottom:1px solid var(--line)}
.idx-num{font-weight:700;font-size:.85rem;letter-spacing:.12em;color:var(--primary-ink)}
.idx-nom{font-family:var(--font-display);font-weight:var(--display-weight);font-size:clamp(1.6rem,3.6vw,3.2rem);line-height:1.02;letter-spacing:var(--display-tracking);text-transform:var(--display-case,none);transition:color .2s}
.idx-info{color:var(--muted);display:flex;justify-content:space-between;gap:16px;align-items:baseline}
.idx-info strong{color:var(--text);white-space:nowrap;margin-left:auto}
.idx-ligne:hover .idx-nom{color:var(--primary-ink)}
.statement-paragraphe .statement-text{font-family:var(--font-body);font-weight:400;font-style:normal;font-size:clamp(1.8rem,4vw,3.4rem);line-height:1.16;max-width:none;text-align:left;letter-spacing:-.01em;text-transform:none}
/* Accents de page */
.deco-cadre body::after{content:"";position:fixed;inset:0;border:clamp(6px,.8vw,12px) solid var(--primary);pointer-events:none;z-index:70}
.deco-etiquettes .section>.wrap>.section-head h2,.deco-etiquettes .duo-cell>h2{display:inline-block;background:var(--primary);color:var(--on-primary);padding:.06em .32em .1em;border-radius:6px;transform:rotate(-1.6deg);box-shadow:4px 4px 0 var(--text)}
.badge-tournant{position:fixed;right:clamp(14px,2vw,26px);bottom:clamp(14px,2vw,26px);width:108px;height:108px;border-radius:50%;background:var(--primary);color:var(--on-primary);display:grid;place-items:center;z-index:65;box-shadow:0 18px 40px -16px rgba(0,0,0,.5);text-decoration:none}
.badge-tournant.badge-gauche{right:auto;left:clamp(14px,2vw,26px)}
.badge-tournant svg{position:absolute;inset:0;width:100%;height:100%;animation:bt-tourne 16s linear infinite}
.badge-tournant text{font-size:12px;font-weight:700;letter-spacing:1.5px;fill:currentColor;font-family:var(--font-body)}
.bt-coeur{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--on-primary);color:var(--primary)}
@keyframes bt-tourne{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.badge-tournant svg{animation:none}}
@media (max-width:900px){
.hero-arche .hero-inner{grid-template-columns:1fr}
.arche{max-width:420px}
.affiche-bas,.mast-ligne,.sc-milieu,.pied-haut{grid-template-columns:1fr}
.portes{grid-template-columns:1fr}
.gal-asym{grid-template-columns:1fr 1fr}
.gal-asym .gal-item:first-child{grid-column:1/-1;grid-row:auto}
.gal-asym .gal-item:first-child .visual{aspect-ratio:4/3;height:auto}
.gal-eventail{justify-content:flex-start;overflow-x:auto;padding-inline:20px;scroll-snap-type:x mandatory}
.gal-eventail .gal-item{flex:0 0 62vw;margin:0 -3vw;scroll-snap-align:center}
.idx-ligne{grid-template-columns:2.2em minmax(0,1fr)}
.idx-info{grid-column:2}
.hero-diptyque{min-height:0}
.dip-img{height:56vh}
.dip-carte{position:relative;left:auto;transform:none;bottom:auto;grid-column:1/-1;width:auto;margin:-64px 16px 0}
.capsule{border-radius:56px;min-height:440px}
.badge-tournant{width:84px;height:84px}
.bt-coeur{width:32px;height:32px}
.hero-objet .deco-layer .p-bl,.hero-objet .deco-layer .p-br,.hero-capsule .deco-layer .p-bl,.hero-capsule .deco-layer .p-br,.hero-arche .deco-layer .p-bl,.hero-arche .deco-layer .p-br{display:none}
}
`;
