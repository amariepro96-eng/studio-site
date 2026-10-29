'use client';
// Appli Devis & Factures : première visite (lien d'invitation → création du compte → téléphone
// relié → codes de secours), connexion (e-mail + mot de passe + code) et mot de passe oublié.
import { useEffect, useState } from 'react';
import { CodeSecours, ReliePhone } from '../AgencyLogin.jsx';
import { appelAcces, Marque, ChampMdp, ChampCode, codeComplet } from './commun.jsx';

const MDP_MIN = 10;
const lireHash = () => {
  const h = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
  const i = h.indexOf('.');
  return i > 0 ? { w: h.slice(0, i), jeton: h.slice(i + 1) } : { w: '', jeton: '' };
};

function Cadre({ children, nom }) {
  return (
    <div className="ss dv">
      <main className="login dv-login">
        <Marque nom={nom} />
        {children}
      </main>
    </div>
  );
}

function Erreur({ texte }) {
  return texte ? (
    <p className="q-error" role="alert">
      {texte}
    </p>
  ) : null;
}

// Relier le téléphone : QR code puis code à 6 chiffres
function EtapeTelephone({ telephone, onFini, intro }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function valider(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await appelAcces({ action: 'activer', code });
    setBusy(false);
    if (!r.ok) {
      setCode('');
      return setErr(r.error || 'Code refusé.');
    }
    return onFini(r.codesSecours || []);
  }
  return (
    <form className="card login-card" onSubmit={valider} noValidate>
      <p className="login-step">Dernière étape : votre code de sécurité</p>
      <h1>Reliez votre téléphone</h1>
      <ReliePhone
        qr={telephone.qr}
        lien={telephone.lien}
        secret={telephone.secret}
        intro={
          intro || (
            <p className="muted small">
              À chaque connexion sur un nouvel appareil, l’appli vous demandera votre mot de passe et un code à 6 chiffres affiché par votre téléphone. Même si quelqu’un connaît votre mot de passe, il ne peut pas entrer sans votre téléphone.
            </p>
          )
        }
      />
      <ChampCode value={code} onChange={setCode} label="3. Saisissez le code à 6 chiffres affiché par l’appli" />
      <Erreur texte={err} />
      <button className="btn primary block" type="submit" disabled={busy || !codeComplet(code, false)}>
        {busy ? 'Vérification…' : 'Relier ce téléphone'}
      </button>
    </form>
  );
}

function EtapeSecours({ codes }) {
  return (
    <div className="card login-card">
      <p className="login-ok">Votre compte est prêt. La double authentification est active.</p>
      <CodeSecours codes={codes} onDone={() => window.location.assign('/devis')} bouton="J’ai noté mes codes, ouvrir l’appli" />
    </div>
  );
}

// ---------- Première visite : lien d'invitation ----------
export function Bienvenue() {
  const [lien, setLien] = useState(null);
  const [etat, setEtat] = useState('chargement');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [telephone, setTelephone] = useState(null);
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const l = lireHash();
    setLien(l);
    if (!l.w) return setEtat('invalide');
    appelAcces({ action: 'apercu', ...l }).then((r) => {
      setNom(r.nom || '');
      setEtat(r.etat || 'invalide');
    });
    return undefined;
  }, []);

  async function commencer() {
    setBusy(true);
    setErr('');
    const r = await appelAcces({ action: 'invitation', ...lien });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error || 'Ce lien ne fonctionne plus.');
      return setEtat(r.code === 'expiree' ? 'expiree' : 'utilisee');
    }
    try {
      window.history.replaceState(null, '', '/devis/bienvenue');
    } catch {}
    setEmail(r.email || '');
    return setEtat('compte');
  }

  async function creer(e) {
    e.preventDefault();
    setErr('');
    if (mdp !== mdp2) return setErr('Les deux mots de passe sont différents.');
    setBusy(true);
    const r = await appelAcces({ action: 'creer', email, mdp });
    setBusy(false);
    if (!r.ok) {
      if (r.code === 'etape') setEtat('perdu');
      return setErr(r.error || 'Création impossible.');
    }
    setMdp('');
    setMdp2('');
    setTelephone(r.telephone);
    return setEtat('telephone');
  }

  if (codes) {
    return (
      <Cadre nom={nom}>
        <EtapeSecours codes={codes} />
      </Cadre>
    );
  }
  return (
    <Cadre nom={nom}>
      {etat === 'chargement' && <p className="muted">Vérification du lien…</p>}
      {['invalide', 'utilisee', 'expiree', 'perdu'].includes(etat) && (
        <div className="card login-card">
          <h1>{etat === 'expiree' ? 'Lien expiré' : etat === 'perdu' ? 'Étape expirée' : 'Lien déjà utilisé'}</h1>
          <p className="muted">
            {etat === 'expiree'
              ? 'Ce lien d’invitation était valable 7 jours. Demandez-en un nouveau à votre prestataire.'
              : etat === 'perdu'
                ? 'La création du compte a pris plus de 15 minutes. Si votre compte n’est pas encore créé, demandez un nouveau lien à votre prestataire. Sinon, connectez-vous.'
                : 'Ce lien ne fonctionne plus : il a déjà servi, ou un lien plus récent l’a remplacé. Si vous avez créé votre compte, connectez-vous.'}
          </p>
          <Erreur texte={err} />
          <a className="btn primary block" href="/devis">
            Se connecter
          </a>
        </div>
      )}
      {etat === 'ok' && (
        <div className="card login-card">
          <h1>Bienvenue{nom ? `, ${nom}` : ''}</h1>
          <p className="muted">Votre appli Devis & Factures est prête. En 3 minutes :</p>
          <ol className="dv-etapes">
            <li>vous choisissez votre adresse e-mail et un mot de passe ;</li>
            <li>vous reliez votre téléphone avec l’appli gratuite <strong>Google Authenticator</strong> (à installer depuis l’App Store ou Google Play) ;</li>
            <li>vous notez 8 codes de secours.</li>
          </ol>
          <Erreur texte={err} />
          <button type="button" className="btn primary block" onClick={commencer} disabled={busy}>
            {busy ? 'Un instant…' : 'Créer mon compte'}
          </button>
          <p className="small muted">Ce lien ne sert qu’une fois : faites-le maintenant, sur l’appareil que vous utiliserez.</p>
        </div>
      )}
      {etat === 'compte' && (
        <form className="card login-card" onSubmit={creer} noValidate>
          <p className="login-step">Étape 1 sur 2</p>
          <h1>Votre compte</h1>
          <div className="q-field">
            <label className="q-label" htmlFor="dv-email">
              Votre adresse e-mail
            </label>
            <p className="q-hint">Elle sert à vous connecter et à recevoir un lien si vous oubliez votre mot de passe.</p>
            <input id="dv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} autoFocus />
          </div>
          <ChampMdp id="dv-mdp" value={mdp} onChange={setMdp} label="Choisissez un mot de passe" autoComplete="new-password" aide={`Au moins ${MDP_MIN} caractères. Une petite phrase est facile à retenir et difficile à deviner.`} />
          <ChampMdp id="dv-mdp2" value={mdp2} onChange={setMdp2} label="Confirmez le mot de passe" autoComplete="new-password" />
          <Erreur texte={err} />
          <button className="btn primary block" type="submit" disabled={busy || !email || mdp.length < MDP_MIN || !mdp2}>
            {busy ? 'Création…' : 'Continuer'}
          </button>
        </form>
      )}
      {etat === 'telephone' && telephone && <EtapeTelephone telephone={telephone} onFini={setCodes} />}
    </Cadre>
  );
}

// ---------- Mot de passe oublié : lien reçu par e-mail ----------
export function Reinitialiser() {
  const [lien, setLien] = useState(null);
  const [etat, setEtat] = useState('chargement');
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [code, setCode] = useState('');
  const [secours, setSecours] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    const l = lireHash();
    setLien(l);
    if (!l.w) return setEtat('invalide');
    appelAcces({ action: 'reinit.apercu', ...l }).then((r) => setEtat(r.etat || 'invalide'));
    return undefined;
  }, []);

  async function valider(e) {
    e.preventDefault();
    setErr('');
    if (mdp !== mdp2) return setErr('Les deux mots de passe sont différents.');
    setBusy(true);
    const r = await appelAcces({ action: 'reinitialiser', ...lien, mdp, code });
    setBusy(false);
    if (!r.ok) {
      setCode('');
      if (r.code === 'expiree' || r.code === 'invalide') setEtat(r.code);
      return setErr(r.error || 'Changement impossible.');
    }
    try {
      window.history.replaceState(null, '', '/devis/reinitialiser');
    } catch {}
    setInfo(r.secours ? `Code de secours accepté : il vous en reste ${r.restants}. Pensez à en créer de nouveaux dans Réglages › Sécurité.` : '');
    return setEtat('fait');
  }

  return (
    <Cadre>
      {etat === 'chargement' && <p className="muted">Vérification du lien…</p>}
      {['invalide', 'expiree'].includes(etat) && (
        <div className="card login-card">
          <h1>{etat === 'expiree' ? 'Lien expiré' : 'Lien invalide'}</h1>
          <p className="muted">Ce lien est valable 30 minutes et ne sert qu’une fois. Refaites « Mot de passe oublié » depuis l’écran de connexion.</p>
          <Erreur texte={err} />
          <a className="btn primary block" href="/devis">
            Écran de connexion
          </a>
        </div>
      )}
      {etat === 'ok' && (
        <form className="card login-card" onSubmit={valider} noValidate>
          <h1>Nouveau mot de passe</h1>
          <ChampMdp id="dv-n1" value={mdp} onChange={setMdp} label="Nouveau mot de passe" autoComplete="new-password" aide={`Au moins ${MDP_MIN} caractères.`} />
          <ChampMdp id="dv-n2" value={mdp2} onChange={setMdp2} label="Confirmez-le" autoComplete="new-password" />
          <p className="muted small">{secours ? 'Saisissez un de vos codes de secours.' : 'Pour confirmer que c’est bien vous : le code à 6 chiffres affiché par Google Authenticator.'}</p>
          <ChampCode value={code} onChange={setCode} secours={secours} autoFocus={false} />
          <button type="button" className="btn-text small" onClick={() => (setSecours((s) => !s), setCode(''))}>
            {secours ? 'Utiliser le code de mon téléphone' : 'Téléphone indisponible ? Code de secours'}
          </button>
          <Erreur texte={err} />
          <button className="btn primary block" type="submit" disabled={busy || mdp.length < MDP_MIN || !mdp2 || !codeComplet(code, secours)}>
            {busy ? 'Enregistrement…' : 'Changer le mot de passe'}
          </button>
        </form>
      )}
      {etat === 'fait' && (
        <div className="card login-card">
          <p className="login-ok">Mot de passe changé. Vos autres appareils ont été déconnectés.</p>
          {info && <p className="note small">{info}</p>}
          <a className="btn primary block" href="/devis">
            Ouvrir l’appli
          </a>
        </div>
      )}
    </Cadre>
  );
}

// ---------- Connexion dans l'appli ----------
export default function Connexion({ onConnecte }) {
  const [etape, setEtape] = useState('mdp');
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [code, setCode] = useState('');
  const [secours, setSecours] = useState(false);
  const [telephone, setTelephone] = useState(null);
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  async function connexion(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await appelAcces({ action: 'connexion', email, mdp });
    setBusy(false);
    if (r.suite === 'code') {
      setMdp('');
      return setEtape('code');
    }
    if (r.suite === 'telephone') {
      setMdp('');
      setTelephone(r.telephone);
      return setEtape('telephone');
    }
    return setErr(r.error || 'Connexion impossible.');
  }
  async function valider(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await appelAcces({ action: 'code', code });
    setBusy(false);
    if (!r.ok) {
      setCode('');
      if (r.code === 'etape') {
        setEtape('mdp');
      }
      return setErr(r.error || 'Code refusé.');
    }
    if (r.secours) {
      setInfo(r.restants > 0 ? `Code de secours accepté. Il vous en reste ${r.restants}. Pensez à en créer de nouveaux dans Réglages › Sécurité.` : 'Code de secours accepté. C’était le dernier : créez-en de nouveaux tout de suite dans Réglages › Sécurité.');
      return setEtape('info');
    }
    return onConnecte();
  }
  async function oubli(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await appelAcces({ action: 'oubli', email });
    setBusy(false);
    if (r.status === 429) return setErr(r.error);
    setInfo(r.sansEmail ? 'L’envoi d’e-mails n’est pas disponible : demandez à votre prestataire de réinitialiser votre accès.' : 'Si un compte existe pour cette adresse, un e-mail vient de partir avec un lien valable 30 minutes. Pensez à regarder dans les courriers indésirables.');
    return setEtape('oubli-fait');
  }

  if (codes) {
    return (
      <Cadre>
        <EtapeSecours codes={codes} />
      </Cadre>
    );
  }
  return (
    <Cadre>
      {etape === 'mdp' && (
        <form className="card login-card" onSubmit={connexion} noValidate>
          <h1>Connexion</h1>
          <p className="muted">Vos devis, vos factures et vos prix.</p>
          <div className="q-field">
            <label className="q-label" htmlFor="dv-login-email">
              Adresse e-mail
            </label>
            <input id="dv-login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus />
          </div>
          <ChampMdp id="dv-login-mdp" value={mdp} onChange={setMdp} label="Mot de passe" />
          <Erreur texte={err} />
          <button className="btn primary block" type="submit" disabled={busy || !email || !mdp}>
            {busy ? 'Vérification…' : 'Continuer'}
          </button>
          <button type="button" className="btn-text small" onClick={() => (setErr(''), setEtape('oubli'))}>
            Mot de passe oublié ?
          </button>
        </form>
      )}
      {etape === 'code' && (
        <form className="card login-card" onSubmit={valider} noValidate>
          <p className="login-step">Étape 2 sur 2</p>
          <h1>{secours ? 'Code de secours' : 'Code de vérification'}</h1>
          <p className="muted">{secours ? 'Saisissez un de vos codes de secours (10 caractères). Il ne servira qu’une fois.' : 'Ouvrez Google Authenticator et saisissez le code à 6 chiffres affiché pour Devis.'}</p>
          <ChampCode value={code} onChange={setCode} secours={secours} />
          <Erreur texte={err} />
          <button className="btn primary block" type="submit" disabled={busy || !codeComplet(code, secours)}>
            {busy ? 'Vérification…' : 'Entrer'}
          </button>
          <button type="button" className="btn-text small" onClick={() => (setSecours((s) => !s), setCode(''), setErr(''))}>
            {secours ? 'Utiliser le code de mon téléphone' : 'Téléphone indisponible ? Code de secours'}
          </button>
        </form>
      )}
      {etape === 'telephone' && telephone && (
        <EtapeTelephone
          telephone={telephone}
          onFini={(c) => (c.length ? setCodes(c) : onConnecte())}
          intro={<p className="muted small">Votre compte n’a pas encore de téléphone relié : faites-le maintenant pour terminer.</p>}
        />
      )}
      {etape === 'info' && (
        <div className="card login-card">
          <h1>Connecté</h1>
          <p className="note small">{info}</p>
          <button type="button" className="btn primary block" onClick={onConnecte}>
            Continuer
          </button>
        </div>
      )}
      {etape === 'oubli' && (
        <form className="card login-card" onSubmit={oubli} noValidate>
          <h1>Mot de passe oublié</h1>
          <p className="muted">Indiquez votre adresse : vous recevrez un lien pour choisir un nouveau mot de passe. Vous aurez besoin du code de votre téléphone (ou d’un code de secours).</p>
          <div className="q-field">
            <label className="q-label" htmlFor="dv-oubli-email">
              Adresse e-mail
            </label>
            <input id="dv-oubli-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus />
          </div>
          <Erreur texte={err} />
          <button className="btn primary block" type="submit" disabled={busy || !email}>
            Recevoir le lien
          </button>
          <button type="button" className="btn-text small" onClick={() => setEtape('mdp')}>
            Retour à la connexion
          </button>
        </form>
      )}
      {etape === 'oubli-fait' && (
        <div className="card login-card">
          <h1>Mot de passe oublié</h1>
          <p className="note small">{info}</p>
          <p className="muted small">Téléphone et codes de secours perdus aussi ? Votre prestataire peut réinitialiser votre accès : vos devis et factures sont conservés.</p>
          <button type="button" className="btn secondary block" onClick={() => setEtape('mdp')}>
            Retour à la connexion
          </button>
        </div>
      )}
    </Cadre>
  );
}
