// Espace client : lecture et modifications du site, par le client (appareil reconnu)
// ou par l'agence (vue agence, selon le réglage choisi par le client).
import crypto from 'node:crypto';
import { route, fail, readBody, memeOrigine, origine, enHttps } from '../../../../src/server/http.js';
import { getClient, updateClient, getSettings } from '../../../../src/server/store.js';
import { rateLimited, clientIp } from '../../../../src/server/config.js';
import { etapeFichiers, etapeEtat } from '../../../../src/server/publish.js';
import { mailPret, emailValide, envoyerMail } from '../../../../src/server/mail.js';
import {
  espaceDe,
  espaceActif,
  siteChoisi,
  preparer,
  vueEspace,
  quiAppelle,
  ouvrir,
  cookieSession,
  cookieEfface,
  creerLien,
  lienEspace,
  masquerEmail,
  noter,
  preparerEtat,
  enregistrerEtat,
  marquerPublie,
  marquerEnAttente,
  notifier,
  lignes,
  publicationsDuJour,
  imagesConnues,
  etatActuel,
  RAISONS_ATTENTE,
} from '../../../../src/server/espace.js';
import { peutModifier, gestionValide, GESTIONS, LIMITE_JOUR, nettoyer, resume } from '../../../../src/engine/espace.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function json(data, { status = 200, cookie } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(data), { status, headers });
}

const studioDe = (s) => ({ studioName: s.studioName, ownerName: s.ownerName, email: s.email, phone: s.phone });
const maintenant = () => new Date().toISOString();
const PAS_ACTIF = 'Votre espace n’est pas encore ouvert : il arrive avec la mise en ligne de votre site.';

// Dépose le dossier sur GitHub (Vercel met en ligne tout seul). En cas d'empêchement, les
// changements restent enregistrés et l'agence est prévenue : rien n'est perdu.
async function mettreEnLigne(id, rec) {
  try {
    // Dernière version du dossier : une publication faite juste avant est prise en compte
    const frais = (await getClient(id)) || rec;
    const { patch, inchange } = await etapeFichiers(frais);
    const rec2 = await updateClient(id, (r) => {
      marquerPublie(r, inchange ? {} : patch);
      if (!inchange) r.log = [...(r.log || []), { at: maintenant(), what: `Nouvelle version v${patch.version} déposée sur GitHub (espace client)` }];
      return r;
    });
    return { rec: rec2 || rec, etat: inchange ? 'READY' : 'QUEUED', message: '' };
  } catch (err) {
    const raison = err?.code || 'failed';
    const rec2 = await updateClient(id, (r) => {
      marquerEnAttente(r, raison);
      return r;
    });
    return { rec: rec2 || rec, etat: 'ATTENTE', raison, detail: String(err?.message || ''), message: RAISONS_ATTENTE[raison] || 'La mise en ligne n’a pas abouti tout de suite : vos changements sont enregistrés et partiront dès que possible.' };
  }
}

export const GET = route(async (req, { id }) => {
  let rec = await getClient(id);
  if (!rec) return json({ error: 'Cet espace n’existe pas ou a été fermé.', code: 'not_found' }, { status: 404 });
  const settings = await getSettings();
  if (!espaceActif(rec) || !siteChoisi(rec)) return json({ error: PAS_ACTIF, code: 'pas_active', studio: studioDe(settings) }, { status: 403 });
  const q = await quiAppelle(req, rec);
  if (!q) {
    const e = espaceDe(rec);
    return json(
      { error: 'Connexion nécessaire.', code: 'connexion', connexion: { nom: rec.brief?.businessName || rec.name || '', mail: mailPret() && emailValide(e.email), email: masquerEmail(e.email) }, studio: studioDe(settings) },
      { status: 401 }
    );
  }
  // Services sans identifiant durable, ou appareil pas vu depuis 12 h : on met le dossier à jour
  const vieux = q.role === 'client' && Date.now() - new Date(q.appareil.vuLe).getTime() > 12 * 3600e3;
  const sansIds = (rec.result?.content?.services || []).some((s) => !s.sid) || (rec.result?.content?.products || []).some((p) => !p.sid);
  if (vieux || sansIds) {
    rec =
      (await updateClient(id, (r) => {
        preparer(r);
        if (vieux) {
          const e = espaceDe(r);
          e.appareils = e.appareils.map((a) => (a.id === q.appareil.id ? { ...a, vuLe: maintenant() } : a));
          r.espace = e;
        }
        return r;
      })) || rec;
  }
  return json({ espace: vueEspace(rec, { role: q.role, appareil: q.appareil, settings }) });
});

export const POST = route(async (req, { id }) => {
  if (!memeOrigine(req)) return fail(403, 'Requête refusée.', 'origin');
  const ip = clientIp(req);
  if (rateLimited('espace:' + ip, 400)) return fail(429, 'Trop de demandes en peu de temps. Réessayez dans un moment.', 'rate');
  const body = await readBody(req);
  const action = String(body?.action || '');
  const rec = await getClient(id);
  if (!rec) return fail(404, 'Cet espace n’existe pas ou a été fermé.', 'not_found');
  const settings = await getSettings();
  if (!espaceActif(rec) || !siteChoisi(rec)) return fail(403, PAS_ACTIF, 'pas_active');
  const secure = enHttps(req);
  const origin = origine(req);
  const owner = settings.ownerName || 'Votre interlocuteur';
  const nom = rec.brief?.businessName || rec.name || 'votre site';
  const lienDossier = `${origin}/agence/clients/${id}`;
  const lienClient = `${origin}/espace/${id}`;

  // ---------- Sans session : ouvrir un lien, recevoir un lien par e-mail ----------
  if (action === 'ouvrir') {
    if (rateLimited('espace-ouvrir:' + ip, 20) || rateLimited('espace-ouvrir:' + id, 40)) return fail(429, 'Trop d’essais : réessayez dans une heure.', 'rate');
    let res = { erreur: 'invalide' };
    const rec2 = await updateClient(id, (r) => {
      res = ouvrir(r, String(body.jeton || ''), req.headers.get('user-agent'));
      return res.erreur && !res.enregistrer ? null : r;
    });
    if (res.erreur) {
      const e = espaceDe(rec2 || rec);
      return json(
        {
          error: res.erreur === 'expire' ? 'Ce lien a expiré.' : 'Ce lien a déjà servi ou n’est plus valable.',
          code: 'lien_' + res.erreur,
          connexion: { nom, mail: mailPret() && emailValide(e.email), email: masquerEmail(e.email) },
          studio: studioDe(settings),
        },
        { status: 410 }
      );
    }
    if (res.premiere) await notifier({ rec: rec2, settings }, 'agence', `${nom} a ouvert son espace client`, `${nom} vient d’ouvrir son espace client (${res.appareil.nom}).\n\nDossier : ${lienDossier}`);
    return json({ espace: vueEspace(rec2, { role: 'client', appareil: res.appareil, settings }) }, { cookie: cookieSession(id, res.cookie, secure) });
  }

  if (action === 'lienEmail') {
    const e = espaceDe(rec);
    if (!mailPret() || !emailValide(e.email)) return fail(409, `L’envoi par e-mail n’est pas disponible : demandez un nouveau lien à ${owner}.`, 'mail_off');
    if (rateLimited('espace-mail:' + id, 4) || rateLimited('espace-mail-ip:' + ip, 8)) return fail(429, 'Un lien vient déjà de partir : regardez votre boîte de réception, et les courriers indésirables. Sinon, réessayez dans une heure.', 'rate');
    let lien = null;
    await updateClient(id, (r) => {
      const e2 = espaceDe(r);
      lien = creerLien(e2, 'email', 'client');
      noter(e2, 'Lien de connexion envoyé par e-mail');
      r.espace = e2;
      return r;
    });
    await envoyerMail({
      to: e.email,
      subject: `Votre lien de connexion — ${nom}`,
      text: `Bonjour,\n\nVoici votre lien pour ouvrir l’espace de votre site ${nom} :\n${lienEspace(origin, id, lien.jeton)}\n\nIl ne sert qu’une fois et reste valable 15 minutes. Vous n’avez rien demandé ? Ignorez ce message : sans ce lien, personne ne peut entrer dans votre espace.\n\n${owner}`,
      replyTo: settings.email,
      fromName: settings.studioName,
    });
    return json({ envoye: true, email: masquerEmail(e.email) });
  }

  // ---------- Avec session (client) ou vue agence ----------
  const q = await quiAppelle(req, rec);
  if (!q) return json({ error: 'Votre session a expiré : reconnectez-vous.', code: 'connexion' }, { status: 401 });
  const { role } = q;
  const e0 = espaceDe(rec);
  const vue = (r) => vueEspace(r, { role, appareil: q.appareil, settings });
  const interdit = () =>
    fail(403, role === 'client' ? `${owner} s’occupe des mises à jour de votre site : passez par « Demandes », ou changez ce réglage dans « Mon accès ».` : 'Le client gère seul son site : il ne t’a pas ouvert ses rubriques.', 'interdit');
  const reserveClient = () => fail(403, 'Seul le client peut faire cette action, depuis son espace.', 'interdit');
  const limite = () => fail(429, `Limite de ${LIMITE_JOUR} publications par jour atteinte. Réessayez demain, ou écrivez à ${owner}.`, 'limite');

  switch (action) {
    case 'publier': {
      if (!peutModifier(e0.gestion, role)) return interdit();
      const proposer = role === 'agence' && e0.validation;
      if (!proposer && publicationsDuJour(e0) >= LIMITE_JOUR) return limite();
      let res = null;
      const rec2 = await updateClient(id, (r) => {
        res = preparerEtat(r, { etat: body.etat, base: body.base });
        if (Object.keys(res.erreurs).length || !res.changements.length) return null;
        if (proposer) {
          const e = espaceDe(r);
          e.proposition = { at: maintenant(), par: 'agence', base: res.actuel, etat: res.propre, resume: res.changements.slice(0, 40) };
          noter(e, `Changements proposés par ${owner}, en attente de validation`);
          r.espace = e;
          return r;
        }
        res.v = enregistrerEtat(r, { etat: res.propre, changements: res.changements, par: role });
        return r;
      });
      if (!rec2) return fail(404, 'Cet espace n’existe plus.', 'not_found');
      if (Object.keys(res.erreurs).length) return json({ error: 'Quelques informations sont à corriger avant de publier.', code: 'invalide', erreurs: res.erreurs }, { status: 422 });
      if (!res.changements.length) return json({ error: 'Rien à publier : le site est déjà à jour.', code: 'rien', espace: vue(rec2) }, { status: 409 });
      if (proposer) {
        await notifier({ rec: rec2, settings }, 'client', `${owner} vous propose des changements`, `Bonjour,\n\n${owner} propose ces changements sur le site de ${nom} :\n${lignes(res.changements)}\n\nOuvrez votre espace pour les regarder, puis validez-les ou refusez-les :\n${lienClient}\n\n${owner}`);
        return json({ espace: vue(rec2), proposition: true });
      }
      const pub = await mettreEnLigne(id, rec2);
      if (role === 'client') {
        await notifier(
          { rec: pub.rec, settings },
          'agence',
          `${nom} a modifié son site`,
          `${nom} vient de publier depuis son espace client (v${res.v}) :\n${lignes(res.changements)}\n\n${pub.etat === 'ATTENTE' ? `Pas encore en ligne : ${pub.detail || pub.message}\nPublie depuis le dossier pour l’envoyer.\n\n` : ''}Dossier : ${lienDossier}`
        );
      } else if (!e0.validation) {
        await notifier({ rec: pub.rec, settings }, 'client', `${owner} a mis à jour votre site`, `Bonjour,\n\n${owner} vient de mettre à jour le site de ${nom} :\n${lignes(res.changements)}\n\nTout est gardé dans l’historique de votre espace, d’où vous pouvez remettre la version précédente :\n${lienClient}\n\n${owner}`);
      }
      return json({ espace: vue(pub.rec), version: res.v, miseEnLigne: pub.etat, message: pub.message });
    }

    case 'suivre': {
      const pub = rec.publication || {};
      if (!pub.commit || e0.aPublier) return json({ etat: e0.aPublier ? 'ATTENTE' : 'INCONNU' });
      if (pub.deployState === 'READY') return json({ etat: 'READY', url: rec.liveUrl || pub.url || '' });
      let res;
      try {
        res = await etapeEtat(rec);
      } catch {
        return json({ etat: 'INCONNU' });
      }
      const fini = res.state !== pub.deployState && ['READY', 'ERROR', 'CANCELED', 'BLOCKED'].includes(res.state);
      const rec2 = Object.keys(res.patch).length
        ? await updateClient(id, (r) => {
            r.publication = { ...(r.publication || {}), ...res.patch };
            if (fini) r.log = [...(r.log || []), { at: maintenant(), what: res.state === 'READY' ? `En ligne (v${r.publication.version})` : `Mise en ligne v${r.publication.version} en échec (${res.state})` }];
            return r;
          })
        : rec;
      if (fini && res.state !== 'READY') await notifier({ rec: rec2, settings }, 'agence', `Mise en ligne en échec : ${nom}`, `La version v${pub.version} de ${nom} n’a pas pu être mise en ligne par Vercel (${res.state}).\n${res.message || ''}\n\nDossier : ${lienDossier}`);
      return json({ etat: res.state, url: rec2?.liveUrl || res.url || '', message: ['ERROR', 'CANCELED', 'BLOCKED'].includes(res.state) ? `La mise en ligne a rencontré un problème technique : ${owner} est prévenu et s’en occupe.` : '' });
    }

    case 'annuler': {
      if (!peutModifier(e0.gestion, role)) return interdit();
      if (publicationsDuJour(e0) >= LIMITE_JOUR) return limite();
      let res = null;
      const rec2 = await updateClient(id, (r) => {
        const e = espaceDe(r);
        const vivantes = e.versions.filter((x) => !x.annulee);
        if (vivantes.length < 2) {
          res = null;
          return null;
        }
        const prev = vivantes[vivantes.length - 2];
        const { etat } = nettoyer(prev.etat, { idsImages: imagesConnues(r), boutique: r.brief?.siteType === 'boutique', jour: '2000-01-01' });
        const changements = resume(etatActuel(r), etat);
        res = { v: prev.v, changements };
        enregistrerEtat(r, { etat, changements, par: role, annulation: true });
        return r;
      });
      if (!res) return fail(409, 'Aucune version précédente à remettre.', 'rien');
      const pub = await mettreEnLigne(id, rec2);
      if (role === 'client') await notifier({ rec: pub.rec, settings }, 'agence', `${nom} a remis une version précédente`, `${nom} a remis la version v${res.v} de son site depuis son espace.\n${lignes(res.changements)}\n\nDossier : ${lienDossier}`);
      return json({ espace: vue(pub.rec), version: res.v, miseEnLigne: pub.etat, message: pub.message });
    }

    case 'proposition': {
      if (role !== 'client') return reserveClient();
      if (!e0.proposition) return fail(409, 'Cette proposition n’est plus d’actualité.', 'rien');
      if (body.reponse === 'refuser') {
        const motif = String(body.motif || '').trim().slice(0, 300);
        const rec2 = await updateClient(id, (r) => {
          const e = espaceDe(r);
          e.proposition = null;
          noter(e, `Proposition de ${owner} refusée${motif ? ` : « ${motif} »` : ''}`);
          r.espace = e;
          return r;
        });
        await notifier({ rec: rec2, settings }, 'agence', `${nom} a refusé ta proposition`, `${nom} a refusé les changements proposés.${motif ? `\nSon message : « ${motif} »` : ''}\n\nDossier : ${lienDossier}`);
        return json({ espace: vue(rec2) });
      }
      if (body.reponse !== 'valider') return fail(400, 'Réponse inconnue.', 'bad_request');
      if (publicationsDuJour(e0) >= LIMITE_JOUR) return limite();
      let res = null;
      const rec2 = await updateClient(id, (r) => {
        const e = espaceDe(r);
        const p = e.proposition;
        if (!p) {
          res = { absente: true };
          return null;
        }
        res = preparerEtat(r, { etat: p.etat, base: p.base });
        if (Object.keys(res.erreurs).length) return null;
        e.proposition = null;
        r.espace = e;
        if (!res.changements.length) return r;
        res.v = enregistrerEtat(r, { etat: res.propre, changements: res.changements, par: 'agence', validePar: 'client' });
        return r;
      });
      if (res?.absente) return fail(409, 'Cette proposition n’est plus d’actualité.', 'rien');
      if (Object.keys(res.erreurs).length) return json({ error: `Cette proposition n’est plus valable (une date est peut-être passée). Demandez-en une nouvelle à ${owner}.`, code: 'invalide', erreurs: res.erreurs }, { status: 422 });
      if (!res.changements.length) return json({ espace: vue(rec2), miseEnLigne: 'READY', message: 'Ces changements étaient déjà en ligne.' });
      const pub = await mettreEnLigne(id, rec2);
      await notifier({ rec: pub.rec, settings }, 'agence', `${nom} a validé ta proposition`, `${nom} a validé tes changements (v${res.v}) :\n${lignes(res.changements)}\n\n${pub.etat === 'ATTENTE' ? `Pas encore en ligne : ${pub.detail || pub.message}\n\n` : ''}Dossier : ${lienDossier}`);
      return json({ espace: vue(pub.rec), version: res.v, miseEnLigne: pub.etat, message: pub.message });
    }

    case 'retirerProposition': {
      if (role !== 'agence') return fail(403, 'Action réservée à l’agence.', 'interdit');
      const rec2 = await updateClient(id, (r) => {
        const e = espaceDe(r);
        if (!e.proposition) return null;
        e.proposition = null;
        noter(e, `Proposition retirée par ${owner}`);
        r.espace = e;
        return r;
      });
      return json({ espace: vue(rec2 || rec) });
    }

    case 'gestion': {
      if (role !== 'client') return reserveClient();
      const gestion = String(body.gestion || '');
      if (!gestionValide(gestion)) return fail(400, 'Réglage inconnu.', 'bad_request');
      const validation = gestion !== 'client' && body.validation === true;
      if (gestion === e0.gestion && validation === e0.validation) return json({ espace: vue(rec) });
      const rec2 = await updateClient(id, (r) => {
        const e = espaceDe(r);
        if (e.gestion !== gestion) noter(e, `Réglage choisi par le client : « ${GESTIONS[gestion].titre} »`);
        if (e.validation !== validation) noter(e, `Validation avant chaque publication de ${owner} ${validation ? 'activée' : 'désactivée'} par le client`);
        e.gestion = gestion;
        e.validation = validation;
        if (gestion === 'client' && e.proposition) {
          e.proposition = null;
          noter(e, 'Proposition en attente retirée (le client gère seul)');
        }
        r.espace = e;
        r.log = [...(r.log || []), { at: maintenant(), what: `Espace client : « ${GESTIONS[gestion].titre} »${validation ? ', avec validation' : ''}` }];
        return r;
      });
      await notifier({ rec: rec2, settings }, 'agence', `${nom} : nouveau réglage de l’espace`, `${nom} a choisi : « ${GESTIONS[gestion].titre} »${validation ? ', avec validation de chacune de tes publications' : ''}.\n\nDossier : ${lienDossier}`);
      return json({ espace: vue(rec2) });
    }

    case 'demande': {
      if (role !== 'client') return reserveClient();
      const type = ['page', 'style', 'autre'].includes(body.type) ? body.type : 'autre';
      const texte = String(body.texte || '').trim().slice(0, 800);
      const pages = vue(rec).pagesPossibles;
      const page = type === 'page' ? pages.find((p) => p.id === body.page) : null;
      if (type === 'page' && !page) return fail(400, 'Choisissez la page à ajouter.', 'bad_request');
      if ((type !== 'page' || page.id === 'autre') && texte.length < 5) return fail(400, 'Décrivez votre demande en quelques mots.', 'bad_request');
      if (e0.demandes.filter((d) => ['envoyee', 'devis', 'acceptee'].includes(d.statut)).length >= 10) return fail(429, `Vous avez déjà 10 demandes en cours : ${owner} y répond avant d’en recevoir d’autres.`, 'limite');
      const titre = type === 'page' ? (page.id === 'autre' ? 'Nouvelle page' : `Nouvelle page : ${page.label}`) : type === 'style' ? 'Changer le style du site' : 'Autre demande';
      const d = { id: crypto.randomBytes(6).toString('base64url'), type, page: page?.id || null, titre, texte, statut: 'envoyee', envoyee: maintenant() };
      const rec2 = await updateClient(id, (r) => {
        const e = espaceDe(r);
        e.demandes = [...e.demandes, d].slice(-40);
        r.espace = e;
        r.log = [...(r.log || []), { at: d.envoyee, what: `Demande du client : ${titre}` }];
        return r;
      });
      await notifier({ rec: rec2, settings }, 'agence', `Nouvelle demande de ${nom}`, `${nom} demande : ${titre}\n${texte ? `« ${texte} »\n` : ''}\nRéponds (devis ou « inclus ») depuis le dossier : ${lienDossier}`);
      return json({ espace: vue(rec2) });
    }

    case 'devis': {
      if (role !== 'client') return reserveClient();
      const accepte = body.reponse === 'accepter';
      if (!accepte && body.reponse !== 'refuser') return fail(400, 'Réponse inconnue.', 'bad_request');
      let titre = '';
      let montant = 0;
      const rec2 = await updateClient(id, (r) => {
        const e = espaceDe(r);
        const d = e.demandes.find((x) => x.id === body.demande && x.statut === 'devis');
        if (!d) return null;
        titre = d.titre;
        montant = d.montant;
        Object.assign(d, accepte ? { statut: 'acceptee', accepteeLe: maintenant() } : { statut: 'refusee', refuseeLe: maintenant() });
        noter(e, `Devis ${accepte ? 'accepté' : 'refusé'} par le client : ${d.titre}`);
        r.espace = e;
        r.log = [...(r.log || []), { at: maintenant(), what: `Devis ${accepte ? 'accepté' : 'refusé'} par le client : ${d.titre}` }];
        return r;
      });
      if (!rec2 || !titre) return fail(409, 'Ce devis n’est plus en attente.', 'rien');
      const eur = Number(montant).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      await notifier({ rec: rec2, settings }, 'agence', `Devis ${accepte ? 'accepté' : 'refusé'} : ${nom}`, `${nom} a ${accepte ? 'accepté' : 'refusé'} ton devis de ${eur} € HT pour « ${titre} ».${accepte ? ' Son accord est gardé dans son espace, avec la date.' : ''}\n\nDossier : ${lienDossier}`);
      return json({ espace: vue(rec2) });
    }

    case 'appareil': {
      if (role !== 'client') return reserveClient();
      if (rateLimited('espace-app:' + id, 10)) return fail(429, 'Trop de liens créés en peu de temps. Réessayez dans une heure.', 'rate');
      let lien = null;
      await updateClient(id, (r) => {
        const e = espaceDe(r);
        lien = creerLien(e, 'appareil', 'client');
        noter(e, `Lien pour un autre appareil créé depuis ${q.appareil.nom} (valable 15 minutes)`);
        r.espace = e;
        return r;
      });
      return json({ lien: lienEspace(origin, id, lien.jeton), exp: lien.exp });
    }

    case 'retirerAppareil':
    case 'deconnexion': {
      if (role !== 'client') return reserveClient();
      const cible = action === 'deconnexion' ? q.appareil.id : String(body.appareil || '');
      const rec2 = await updateClient(id, (r) => {
        const e = espaceDe(r);
        const a = e.appareils.find((x) => x.id === cible);
        if (!a) return null;
        e.appareils = e.appareils.filter((x) => x.id !== cible);
        noter(e, action === 'deconnexion' ? `Déconnexion : ${a.nom}` : `Appareil retiré : ${a.nom} (depuis ${q.appareil.nom})`);
        r.espace = e;
        return r;
      });
      const moiMeme = cible === q.appareil.id;
      if (moiMeme) return json({ deconnecte: true }, { cookie: cookieEfface(id, secure) });
      return json({ espace: vue(rec2 || rec) });
    }

    default:
      return fail(400, 'Action inconnue.', 'bad_request');
  }
});
