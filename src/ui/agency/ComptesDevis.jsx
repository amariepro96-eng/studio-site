'use client';
// Réglages › Comptes Devis & Factures : tous les comptes de l'appli de tes clients. Jamais de mot
// de passe (ils sont chiffrés de façon irréversible), ni de devis, de facture ou de prix.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { AgencyBar, Spinner } from '../Chrome.jsx';
import { timeAgo } from '../../engine/records.js';
import { LISTE_MODELES } from '../../engine/calculateur.js';

const ETATS = {
  actif: ['Actif', 'ok'],
  invitation: ['Invitation envoyée', 'wait'],
  a_terminer: ['Compte à terminer', 'wait'],
  expiree: ['Invitation expirée', 'warn'],
  suspendu: ['Suspendu', 'ko'],
};
const fmt = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Confirmation de suppression (utilisée ici et dans le bloc du dossier client)
export function SuppressionDevis({ nom, appli, onConfirm, onCancel, busy }) {
  const [saisie, setSaisie] = useState('');
  const [prevenu, setPrevenu] = useState(false);
  const factures = appli?.nbFactures || 0;
  const pret = norm(saisie) === norm(nom) && (!factures || prevenu);
  return (
    <div className="cd-suppr" role="group" aria-label="Supprimer l’appli Devis & Factures">
      <p>
        <strong>Supprimer l’appli Devis & Factures de {nom} ?</strong> Tout est effacé, sans retour possible :
      </p>
      <ul>
        <li>son compte et sa connexion (e-mail, mot de passe, double authentification, appareils) ;</li>
        <li>
          {appli?.nbDevis || 0} devis, {pluriel(factures, 'facture')} émise{factures > 1 ? 's' : ''}, {pluriel(appli?.nbProduits || 0, 'produit')} ;
        </li>
        <li>les liens déjà envoyés à ses clients ne marcheront plus.</li>
      </ul>
      {factures > 0 && (
        <>
          <p className="q-error">
            Ses factures émises seront effacées. La loi lui impose de les conserver 10 ans : avant de supprimer, vérifie qu’il les a enregistrées (bouton « Imprimer / PDF » de chaque facture, dans son appli).
          </p>
          <label className="q-toggle compact">
            <input type="checkbox" checked={prevenu} onChange={(e) => setPrevenu(e.target.checked)} />
            <span>
              <span className="q-option-title">Mon client a enregistré ses factures</span>
            </span>
          </label>
        </>
      )}
      <p className="muted small">S’il a seulement perdu son accès (mot de passe et téléphone), préfère « Réinitialiser son compte » : tout est gardé.</p>
      <div className="q-field">
        <label className="q-label" htmlFor="cd-confirm">
          Pour confirmer, tape le nom : <strong>{nom}</strong>
        </label>
        <input id="cd-confirm" type="text" value={saisie} onChange={(e) => setSaisie(e.target.value)} autoComplete="off" />
      </div>
      <div className="row-actions">
        <button type="button" className="btn danger-solid small" disabled={!pret || busy} onClick={onConfirm}>
          {busy ? 'Suppression…' : 'Supprimer définitivement'}
        </button>
        <button type="button" className="btn-text small" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function Compte({ c, recharger }) {
  const a = c.appli;
  const etat = c.etat;
  const label = ETATS[etat]?.[0] || etat;
  const ton = ETATS[c.etat]?.[1] || 'wait';
  const [mode, setMode] = useState(null); // 'suppr' | 'reinit'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  async function agir(fn, apres) {
    setBusy(true);
    setErr('');
    setNote('');
    try {
      const d = await fn();
      setMode(null);
      if (apres) apres(d);
      await recharger();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  const parClient = (action) => () => api(`/api/agence/clients/${c.clientId}/devis`, { method: 'POST', body: { action } });
  return (
    <li className="card cd-compte">
      <div className="cd-tete">
        <h2>{c.nom}</h2>
        <span className={`cd-etat is-${ton}`}>{label}</span>
      </div>
      <ul className="cd-infos">
        {a.compte ? (
          <li>
            Compte : {a.compte.email}
            {a.compte.deuxFacteurs ? ' · double authentification active' : ' · téléphone pas encore relié'}
          </li>
        ) : a.invitation ? (
          <li>{a.invitation.utiliseeLe ? `Lien ouvert ${timeAgo(a.invitation.utiliseeLe)}, compte pas encore créé` : etat === 'invitation' ? `Invitation valable jusqu’au ${fmt(a.invitation.exp)}` : `Invitation du ${fmt(a.invitation.creeLe)} expirée`}</li>
        ) : (
          <li>Pas encore d’invitation</li>
        )}
        <li>
          {a.dernierVu ? `Dernière visite ${timeAgo(a.dernierVu)}` : 'Jamais connecté'} · {pluriel(a.appareils, 'appareil')} · activée {timeAgo(a.creeLe)}
        </li>
        <li>
          {pluriel(a.nbProduits, 'produit')} · {a.nbDevis} devis · {pluriel(a.nbFactures, 'facture')} émise{a.nbFactures > 1 ? 's' : ''}
        </li>
        {a.calculateur?.actif && <li>Calculateur d’estimation activé ({LISTE_MODELES.find((m) => m.id === a.calculateur.modele)?.nom || a.calculateur.modele})</li>}
      </ul>

      {mode === 'suppr' ? (
        <SuppressionDevis
          nom={c.nom}
          appli={a}
          busy={busy}
          onCancel={() => setMode(null)}
          onConfirm={() => agir(() => (c.clientId ? api(`/api/agence/clients/${c.clientId}/devis`, { method: 'POST', body: { action: 'supprimer', confirme: true } }) : api('/api/agence/devis', { method: 'POST', body: { action: 'supprimer', wid: c.wid, confirme: true } })))}
        />
      ) : mode === 'reinit' ? (
        <div className="cd-suppr">
          <p>
            <strong>Réinitialiser le compte de {c.nom} ?</strong> À faire seulement s’il a perdu à la fois son mot de passe et son téléphone, sans code de secours, et après avoir vérifié par téléphone que c’est bien lui. Ses devis, factures et produits sont gardés ; le lien pour recréer son accès part par e-mail à l’adresse de son compte ({a.compte?.email}).
          </p>
          <div className="row-actions">
            <button type="button" className="btn primary small" disabled={busy} onClick={() => agir(parClient('reinitialiser'), () => setNote('Lien envoyé à l’adresse de son compte, valable 7 jours.'))}>
              Réinitialiser
            </button>
            <button type="button" className="btn-text small" onClick={() => setMode(null)}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="row-actions cd-actions">
          {c.clientId ? (
            <a className="btn secondary small" href={`/agence/clients/${c.clientId}`}>
              Ouvrir le dossier
            </a>
          ) : (
            <span className="muted small">Dossier du site supprimé</span>
          )}
          {c.clientId && a.actif && (
            <button type="button" className="btn-text small" disabled={busy} onClick={() => agir(parClient('couper'), () => setNote('Accès suspendu : il est déconnecté partout, ses données sont gardées.'))}>
              Suspendre
            </button>
          )}
          {c.clientId && !a.actif && (
            <button type="button" className="btn-text small" disabled={busy} onClick={() => agir(parClient('retablir'), () => setNote('Accès rétabli.'))}>
              Rétablir
            </button>
          )}
          {c.clientId && a.compte && (
            <button type="button" className="btn-text small" onClick={() => setMode('reinit')}>
              Réinitialiser
            </button>
          )}
          <button type="button" className="btn-text small danger" onClick={() => setMode('suppr')}>
            Supprimer
          </button>
        </div>
      )}
      {note && (
        <p className="side-note" role="status">
          {note}
        </p>
      )}
      {err && (
        <p className="q-error" role="alert">
          {err}
        </p>
      )}
    </li>
  );
}

export default function ComptesDevis({ studioName }) {
  const [comptes, setComptes] = useState(null);
  const [err, setErr] = useState('');
  const charger = useCallback(async () => {
    try {
      const d = await api('/api/agence/devis');
      setComptes(d.comptes);
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  }, []);
  useEffect(() => {
    charger();
  }, [charger]);
  const n = (e) => (comptes || []).filter((c) => c.etat === e).length;
  return (
    <div className="ss">
      <AgencyBar studioName={studioName} current="reglages" />
      <main className="page page-narrow">
        <a className="back" href="/agence/reglages">
          Réglages
        </a>
        <div className="page-head">
          <div>
            <h1>Comptes Devis & Factures</h1>
            <p className="muted">L’appli Devis & Factures de tes clients : l’état de chaque accès, et de quoi le suspendre, le réinitialiser ou le supprimer. Les mots de passe ne sont jamais visibles, ni par toi ni par Studio Site : ils sont enregistrés sous une forme chiffrée qu’on ne peut pas relire. Tu ne vois pas non plus leurs devis, leurs factures ni leurs prix.</p>
          </div>
          <a className="btn secondary" href="/devis" target="_blank" rel="noopener noreferrer">
            Ouvrir l’appli
          </a>
        </div>
        {err && (
          <div className="alert" role="alert">
            {err}
          </div>
        )}
        {!comptes && !err && <Spinner />}
        {comptes && (
          <>
            <div className="cd-chiffres">
              <span>
                <strong>{n('actif')}</strong> actif{n('actif') > 1 ? 's' : ''}
              </span>
              <span>
                <strong>{n('invitation') + n('a_terminer')}</strong> en cours de création
              </span>
              <span>
                <strong>{n('suspendu')}</strong> suspendu{n('suspendu') > 1 ? 's' : ''}
              </span>
              {n('expiree') > 0 && (
                <span>
                  <strong>{n('expiree')}</strong> invitation{n('expiree') > 1 ? 's' : ''} expirée{n('expiree') > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {comptes.length ? (
              <ul className="cd-liste">
                {comptes.map((c) => (
                  <Compte key={c.wid} c={c} recharger={charger} />
                ))}
              </ul>
            ) : (
              <div className="card cd-vide">
                <p>
                  <strong>Aucun client n’a encore l’appli.</strong>
                </p>
                <p className="muted">Pour l’activer : dossier du client › bloc « Appli Devis & Factures » › « Proposer ou activer l’option ».</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
