// Ancienne route d'envoi vers Google Drive depuis le navigateur. Studio Site range désormais
// lui-même le brief, les photos et le site dans Drive, côté serveur (src/server/drive.js) :
// cette adresse reste fermée pour qu'aucun envoi venu de l'extérieur n'atteigne ton Drive.
export const dynamic = 'force-dynamic';

export function POST() {
  return Response.json({ ok: false, erreur: 'Envoi direct fermé : Studio Site enregistre lui-même les dossiers dans Google Drive.' }, { status: 410 });
}
