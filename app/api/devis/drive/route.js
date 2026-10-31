// Connexion du Google Drive du client (OAuth). Deux temps, tous deux en GET (navigation) :
//   1. Démarrage : le client connecté clique « Connecter » → on l'envoie chez Google.
//   2. Retour (callback) : Google renvoie ici avec un code → on range le jeton (chiffré) dans
//      l'espace, puis on ramène le client sur Réglages.
// La déconnexion se fait par l'action POST « drive.deconnecter » de /api/devis.
import { route, origine, enHttps, readCookie } from '../../../../src/server/http.js';
import { updateDevisEspace } from '../../../../src/server/store.js';
import { lireSession } from '../../../../src/server/devisAcces.js';
import { driveConfigure, urlConsentement, signerEtat, lireEtat, echangerCode, chiffrerJeton } from '../../../../src/server/googleDrive.js';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const COOKIE = 'drive_oauth';
const CHEMIN = '/api/devis/drive';
// SameSite=Lax (et non Strict) : le cookie doit survivre au retour depuis accounts.google.com
const poserEtat = (val, https) => `${COOKIE}=${val}; Path=${CHEMIN}; HttpOnly; SameSite=Lax; Max-Age=600${https ? '; Secure' : ''}`;
const effacerEtat = (https) => `${COOKIE}=; Path=${CHEMIN}; HttpOnly; SameSite=Lax; Max-Age=0${https ? '; Secure' : ''}`;

function redirige(url, cookie) {
  const headers = new Headers({ Location: url, 'Cache-Control': 'no-store' });
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

const redirUri = (req) => `${origine(req)}/api/devis/drive`;
const versReglages = (req, etat) => `${origine(req)}/devis?drive=${etat}#reglages`;

export const GET = route(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const erreur = url.searchParams.get('error');
  const https = enHttps(req);

  // -------- Retour depuis Google --------
  if (code || erreur) {
    const st = lireEtat(readCookie(req, COOKIE));
    if (!st) return redirige(versReglages(req, 'expire'), effacerEtat(https));
    if (erreur || url.searchParams.get('state') !== st.nonce) return redirige(versReglages(req, 'refus'), effacerEtat(https));
    try {
      const { refreshToken, email } = await echangerCode({ code, redirectUri: redirUri(req) });
      await updateDevisEspace(st.w, (e) => {
        e.compte = e.compte || {};
        e.compte.drive = {
          refreshToken: chiffrerJeton(refreshToken),
          email: email || '',
          connecteLe: new Date().toISOString(),
          folderId: '',
          dernier: null,
        };
        return e;
      });
      return redirige(versReglages(req, 'ok'), effacerEtat(https));
    } catch {
      return redirige(versReglages(req, 'echec'), effacerEtat(https));
    }
  }

  // -------- Démarrage de la connexion --------
  const s = await lireSession(req);
  if (!s) return redirige(`${origine(req)}/devis`);
  if (!driveConfigure()) return redirige(versReglages(req, 'indispo'));
  const nonce = crypto.randomBytes(16).toString('base64url');
  const etat = signerEtat({ w: s.w, nonce });
  const url2 = urlConsentement({ redirectUri: redirUri(req), state: nonce });
  return redirige(url2, poserEtat(etat, https));
});
