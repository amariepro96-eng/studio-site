'use client';
// Réglages › Alertes par e-mail : surveillance automatique, adresse, interrupteur et e-mail de test
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { timeAgo } from '../../engine/records.js';

export default function Alertes({ value, onChange, emailEnregistre }) {
  const [etat, setEtat] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/api/agence/alertes')
      .then((d) => setEtat(d.alertes))
      .catch(() => setEtat(null));
  }, [emailEnregistre]);

  async function tester() {
    setOccupe(true);
    setNote('');
    setErr('');
    try {
      const d = await api('/api/agence/alertes', { method: 'POST', body: { action: 'test' } });
      setNote(`E-mail de test envoyé à ${d.email}. Regarde aussi dans les spams.`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setOccupe(false);
    }
  }

  const sansMail = etat && !etat.mail.configured;
  const sansAdresse = !emailEnregistre;
  return (
    <div className="q-field pub-settings">
      <span className="q-label">Alertes par e-mail</span>
      <p className="q-hint">
        Toutes les {etat?.intervalle || 5} minutes, Studio Site revérifie seul tous les sites, même quand le Pilotage est fermé. Si un site tombe en panne (plus visible pour les visiteurs), tu reçois un e-mail à ton <strong>E-mail de contact</strong>, puis un autre quand c’est réglé.
      </p>
      <ul className="pub-checks">
        <li className={sansAdresse ? 'is-ko' : 'is-ok'}>
          <span>{sansAdresse ? 'Aucun « E-mail de contact » enregistré : remplis-le ci-dessus, puis Enregistrer.' : `Envoyées à ${emailEnregistre}`}</span>
        </li>
        {etat && (
          <li className={sansMail ? 'is-ko' : 'is-ok'}>
            <span>{sansMail ? `Envoi d’e-mails pas branché : il manque ${etat.mail.missing.join(' et ')} dans Vercel (document 17).` : 'Envoi par Brevo : branché'}</span>
          </li>
        )}
        {etat && (
          <li className={etat.derniereLe ? 'is-ok' : 'is-wait'}>
            <span>{etat.derniereLe ? `Dernière vérification automatique ${timeAgo(etat.derniereLe)}` : 'Première vérification automatique dans les 5 minutes qui suivent la mise en ligne de cette version'}</span>
          </li>
        )}
        {etat?.erreur && (
          <li className="is-ko">
            <span>Dernier envoi en échec ({timeAgo(etat.erreur.at)}) : {etat.erreur.message}</span>
          </li>
        )}
        {etat?.enCours?.length > 0 && (
          <li className="is-warn">
            <span>Panne annoncée, pas encore réglée : {etat.enCours.map((a) => `${a.nom} (${a.titre})`).join(', ')}</span>
          </li>
        )}
      </ul>
      <label className="q-toggle compact">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        <span>
          <span className="q-option-title">M’envoyer un e-mail quand un site tombe en panne</span>
          <span className="q-option-hint">Décoche puis Enregistrer pour les couper (vacances, essais). Le Pilotage continue de tout afficher.</span>
        </span>
      </label>
      <div className="row-actions">
        <button type="button" className="btn secondary small" onClick={tester} disabled={occupe || sansAdresse || sansMail}>
          {occupe ? 'Envoi…' : 'Envoyer un e-mail de test'}
        </button>
      </div>
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
    </div>
  );
}
