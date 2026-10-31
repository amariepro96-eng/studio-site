// Range une facture émise dans le Google Drive du client (si connecté). Jamais bloquant pour
// l'émission : l'appelant consigne le résultat et continue quoi qu'il arrive.
import { getClient } from './store.js';
import { pdfFacturX } from './facturxPdf.js';
import { themeDossier } from './factureTheme.js';
import { deposerPdf, dechiffrerJeton } from './googleDrive.js';

// Renvoie { statut: 'absent' | 'reconnexion' | 'ok' | 'echec', lien?, folderId?, message? }
export async function archiverFacture(esp, f) {
  const drive = esp?.compte?.drive;
  if (!drive?.refreshToken) return { statut: 'absent' };
  const refreshToken = dechiffrerJeton(drive.refreshToken);
  if (!refreshToken) return { statut: 'reconnexion', message: 'Connexion Google à refaire.' };

  // Couleurs du site du client, si disponibles
  let theme = null;
  try {
    if (esp.clientId) {
      const rec = await getClient(esp.clientId);
      if (rec) theme = themeDossier(rec);
    }
  } catch {}

  try {
    const bytes = await pdfFacturX(f, theme);
    const nomDossier = `Factures — ${esp.entreprise?.nom || 'Mon entreprise'}`;
    const nomFichier = `Facture ${f.numero || ''}${f.client?.nom ? ' — ' + f.client.nom : ''}.pdf`;
    const res = await deposerPdf({ refreshToken, nomDossier, nomFichier, bytes, folderId: drive.folderId });
    return { statut: 'ok', lien: res.lien, folderId: res.folderId };
  } catch (e) {
    return { statut: 'echec', message: String(e?.message || 'Dépôt refusé').slice(0, 160) };
  }
}
