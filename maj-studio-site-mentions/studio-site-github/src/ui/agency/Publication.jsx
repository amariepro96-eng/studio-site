'use client';
// Mise en ligne automatique depuis le dossier : dépôt GitHub, projet Vercel, version, domaine.
// Chaque action part d'un clic ; l'écran enchaîne ensuite les étapes et affiche où il en est.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, copyText } from '../api.js';

const LABELS = {
  depot: 'Création du dépôt privé',
  vercel: 'Création du projet Vercel',
  fichiers: 'Dépôt du site sur GitHub',
  etat: 'Mise en ligne par Vercel',
};
const FIN = ['ERROR', 'CANCELED', 'BLOCKED', 'DELETED'];
const host = (url) => String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');
// Même règle que le serveur, pour afficher le nom du dépôt pendant la saisie
const slug = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export default function Publication({ rec, onRecord, onEditBrief }) {
  const pub = rec.publication || null;
  const [verif, setVerif] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [ident, setIdent] = useState('');
  const [steps, setSteps] = useState(null);
  const [running, setRunning] = useState(false);
  const [arme, setArme] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const call = useCallback((etape, extra = {}) => api(`/api/agence/clients/${rec.id}/publication`, { method: 'POST', body: { etape, ...extra } }), [rec.id]);

  const check = useCallback(
    async (identifiant) => {
      setChecking(true);
      setError('');
      try {
        const { verif: v } = await call('verifier', identifiant ? { identifiant } : {});
        if (!alive.current) return;
        setVerif(v);
        setIdent(v.identifiant);
      } catch (e) {
        if (alive.current) setError(e.message);
      } finally {
        if (alive.current) setChecking(false);
      }
    },
    [call]
  );
  useEffect(() => {
    check();
  }, [check]);

  const mark = (id, state, note = '') => setSteps((s) => (s || []).map((x) => (x.id === id ? { ...x, state, note } : x)));

  // Suit Vercel jusqu'à « Ready » (4 minutes au plus, puis bouton pour reprendre)
  async function suivre() {
    const debut = Date.now();
    while (alive.current && Date.now() - debut < 240_000) {
      const res = await call('etat');
      if (res.client) onRecord(res.client);
      if (res.state === 'READY') {
        mark('etat', 'done', host(res.publication?.url));
        return;
      }
      if (FIN.includes(res.state)) throw new Error(res.message || `Vercel indique « ${res.state} ». Ouvre le déploiement dans Vercel pour voir le détail, corrige, puis publie une nouvelle version.`);
      mark('etat', 'run', res.state === 'BUILDING' ? 'Vercel prépare le site…' : 'En file d’attente chez Vercel…');
      await pause(3000);
    }
    throw new Error('Vercel met plus de temps que prévu. Le site sera sans doute en ligne dans quelques minutes : clique sur « Vérifier la mise en ligne ».');
  }

  async function run({ remplacer = false, suiviSeul = false } = {}) {
    const ids = suiviSeul ? ['etat'] : [...(!pub?.repo ? ['depot'] : []), ...(!pub?.projectId ? ['vercel'] : []), 'fichiers', 'etat'];
    setSteps(ids.map((id) => ({ id, label: LABELS[id], state: 'todo', note: '' })));
    setRunning(true);
    setError('');
    setArme(false);
    try {
      for (const id of ids) {
        mark(id, 'run');
        if (id === 'etat') {
          await suivre();
          continue;
        }
        const res = await call(id, id === 'depot' ? { identifiant: ident } : id === 'fichiers' ? { remplacer } : {});
        if (res.client) onRecord(res.client);
        if (id === 'fichiers' && res.inchange) {
          mark('fichiers', 'done', 'Aucun changement : le site en ligne est déjà à jour.');
          setSteps((s) => s.filter((x) => x.id !== 'etat'));
          break;
        }
        mark(id, 'done', id === 'depot' ? res.publication?.repo : id === 'vercel' ? res.publication?.projectName : `Version v${res.publication?.version}`);
      }
      await check();
    } catch (e) {
      setSteps((s) => (s || []).map((x) => (x.state === 'run' ? { ...x, state: 'err' } : x)));
      setError(e.message);
    } finally {
      if (alive.current) setRunning(false);
    }
  }

  if (!verif) {
    return (
      <div className="pub">
        <h3>Mise en ligne</h3>
        {error ? (
          <>
            <p className="q-error" role="alert">
              {error}
            </p>
            <button type="button" className="btn-text small" onClick={() => check()}>
              Réessayer
            </button>
          </>
        ) : (
          <p className="muted small">Vérification…</p>
        )}
      </div>
    );
  }

  const st = verif.status;
  if (!st.configured || !st.enabled) {
    return (
      <div className="pub">
        <h3>Mise en ligne automatique</h3>
        {!st.configured ? (
          <p className="small">
            Pas encore branchée : il manque {st.missing.map((m, i) => (
              <span key={m}>
                {i > 0 && ' et '}
                <code>{m}</code>
              </span>
            ))} dans Vercel (document 13, §J). En attendant, télécharge le .zip.
          </p>
        ) : (
          <p className="small">
            Désactivée. Pour l’utiliser, active-la dans <a href="/agence/reglages">Réglages</a>.
          </p>
        )}
      </div>
    );
  }

  const legal = verif.manques || [];
  // Les mentions légales incomplètes ne sont qu'un avertissement : seuls les autres points bloquent
  const autres = (verif.bloquants || []).filter((b) => !b.startsWith('Mentions légales'));
  const bloque = autres.length > 0;
  const repoVu = verif.identifiantFixe ? verif.repo : `${st.org}/site-${slug(ident) || '…'}`;
  const enCours = pub?.commit && pub.deployState && pub.deployState !== 'READY' && !FIN.includes(pub.deployState);
  const chg = verif.changementsGitHub;

  return (
    <div className="pub">
      <h3>Mise en ligne</h3>

      {pub?.url && pub.deployState === 'READY' && (
        <p className="pub-live">
          En ligne :{' '}
          <a href={pub.url} target="_blank" rel="noopener noreferrer">
            {host(pub.url)}
          </a>
          <br />
          <span className="muted small">
            Version v{pub.version}, publiée le {fmt(pub.publishedAt)}
          </span>
        </p>
      )}
      {pub?.repo && (
        <p className="pub-links small">
          <a href={pub.repoUrl} target="_blank" rel="noopener noreferrer">
            Dépôt {pub.repo}
          </a>
          {pub.inspectorUrl && (
            <>
              {' · '}
              <a href={pub.inspectorUrl} target="_blank" rel="noopener noreferrer">
                Déploiement Vercel
              </a>
            </>
          )}
        </p>
      )}

      {!pub?.commit && !running && (
        <>
          <div className="q-field pub-id">
            <label className="q-label" htmlFor="pub-ident">
              Identifiant
            </label>
            {verif.identifiantFixe ? (
              <code>{verif.identifiant}</code>
            ) : (
              <input id="pub-ident" type="text" value={ident} onChange={(e) => setIdent(e.target.value)} onBlur={() => slug(ident) !== verif.identifiant && check(ident)} />
            )}
            <p className="q-hint">
              Dépôt <code>{repoVu}</code>, privé, enregistré à ton nom. Même identifiant que dans Drive et dans le tableau Suivi clients.
            </p>
          </div>
          <ul className="pub-checks">
            <li className={legal.length ? 'is-warn' : 'is-ok'}>
              <span>{legal.length ? `Mentions légales incomplètes : ${legal.join(', ')}. La mise en ligne reste possible ; complète-les avant de livrer le site au client.` : 'Mentions légales complètes'}</span>
            </li>
            <li className="is-ok">
              <span>
                {verif.pages.length} pages et {verif.images} images. <code>LISEZ-MOI.txt</code> n’est pas publié.
              </span>
            </li>
            {autres.map((b) => (
              <li key={b} className="is-ko">
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {legal.length > 0 && onEditBrief && (
            <button type="button" className="btn-text small" onClick={onEditBrief}>
              Compléter le brief
            </button>
          )}
          <button type="button" className="btn primary block" disabled={bloque || checking} onClick={() => run()}>
            {checking ? 'Vérification…' : 'Mettre en ligne'}
          </button>
          <p className="muted small">Crée le dépôt et le projet Vercel, dépose le site, puis attend qu’il soit en ligne sur son adresse provisoire. Environ 1 minute.</p>
        </>
      )}

      {pub?.commit && !running && (
        <>
          {enCours && (
            <button type="button" className="btn secondary block" onClick={() => run({ suiviSeul: true })}>
              Vérifier la mise en ligne
            </button>
          )}
          {chg && (
            <p className="alert soft small">
              Modifié sur GitHub depuis ta dernière publication : {chg.nombre} changement{chg.nombre > 1 ? 's' : ''}
              {chg.dernier ? `, le dernier le ${fmt(chg.dernier.date)} (« ${chg.dernier.message} »)` : ''}. Une nouvelle version les remplacera. Ils restent visibles dans l’historique GitHub.
            </p>
          )}
          {legal.length > 0 && (
            <p className="alert soft small">
              Mentions légales incomplètes : {legal.join(', ')}. La publication reste possible ; complète-les avant de livrer le site au client.
              {onEditBrief && (
                <>
                  {' '}
                  <button type="button" className="btn-text small" onClick={onEditBrief}>
                    Compléter le brief
                  </button>
                </>
              )}
            </p>
          )}
          <button type="button" className={`btn block ${arme ? 'danger-solid' : 'secondary'}`} disabled={bloque || checking} onClick={() => (arme ? run({ remplacer: true }) : setArme(true))}>
            {arme ? 'Confirmer : remplacer le site en ligne' : 'Publier une nouvelle version'}
          </button>
          {arme ? (
            <button type="button" className="btn-text small" onClick={() => setArme(false)}>
              Annuler
            </button>
          ) : (
            <p className="muted small">Remplace tous les fichiers du dépôt par la version actuelle du dossier.</p>
          )}
        </>
      )}

      {steps && (
        <ol className="pub-steps" aria-live="polite">
          {steps.map((s) => (
            <li key={s.id} className={s.state}>
              <span className="ic" aria-hidden="true" />
              <span>
                {s.label}
                {s.note && <small>{s.note}</small>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {error && (
        <p className="q-error" role="alert">
          {error}
        </p>
      )}

      {pub?.deployState === 'READY' && <Domaine key={pub.domain || 'nouveau'} pub={pub} initial={verif.domaine} call={call} onRecord={onRecord} />}
    </div>
  );
}

function Domaine({ pub, initial, call, onRecord }) {
  const [val, setVal] = useState(pub.domain || initial || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState('');

  async function go(etape) {
    setBusy(true);
    setErr('');
    try {
      const res = await call(etape, etape === 'domaine' ? { domaine: val } : {});
      if (res.client) onRecord(res.client);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function copy(v) {
    const ok = await copyText(v);
    setCopied(ok ? v : '');
    setTimeout(() => setCopied(''), 2000);
  }

  if (!pub.domain) {
    return (
      <div className="pub-domain">
        <h4>Nom de domaine du client</h4>
        <div className="linkline">
          <input type="text" value={val} placeholder="boulangerie-martin.fr" aria-label="Nom de domaine du client" onChange={(e) => setVal(e.target.value)} />
          <button type="button" className="btn secondary small" disabled={busy || !val.trim()} onClick={() => go('domaine')}>
            {busy ? 'Ajout…' : 'Ajouter dans Vercel'}
          </button>
        </div>
        <p className="muted small">Le domaine doit déjà être acheté au nom du client (document 14). Il est ajouté avec et sans www, puis tu obtiens les valeurs à saisir chez OVHcloud.</p>
        {err && (
          <p className="q-error" role="alert">
            {err}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="pub-domain">
      <h4>
        {pub.domain} <span className={`tag ${pub.domainOk ? 'ok' : 'wait'}`}>{pub.domainOk ? 'Actif' : 'En attente des réglages DNS'}</span>
      </h4>
      {!pub.domainOk && <p className="muted small">À saisir dans la zone DNS OVHcloud du client (document 14, §D). Ne touche pas aux lignes MX, TXT et NS déjà présentes.</p>}
      <ul className="dns">
        {(pub.dns || []).map((r) => (
          <li key={r.type + r.nom + r.valeur}>
            <div className="dns-head">
              <strong>{r.type}</strong>
              <span>Sous-domaine : {r.nom || '(vide)'}</span>
              <span className={r.ok ? 'dns-ok' : 'dns-wait'}>{r.ok ? 'OK' : 'à faire'}</span>
            </div>
            <div className="dns-val">
              <code>{r.valeur}</code>
              <button type="button" className="btn-text small" onClick={() => copy(r.valeur)}>
                {copied === r.valeur ? 'Copié' : 'Copier'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="row-actions">
        <button type="button" className="btn secondary small" disabled={busy} onClick={() => go('verifierDomaine')}>
          {busy ? 'Vérification…' : 'Vérifier'}
        </button>
        {pub.domainCheckedAt && <span className="muted small">Vérifié le {fmt(pub.domainCheckedAt)}. Compte de quelques minutes à 24 h.</span>}
      </div>
      {pub.domainOk && <p className="side-note">Le cadenas HTTPS est créé par Vercel. Tu peux marquer le site en ligne ci-dessous.</p>}
      {err && (
        <p className="q-error" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
