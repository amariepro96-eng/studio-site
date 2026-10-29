// Installation de l'espace agence sur l'écran d'accueil du téléphone (icône « Studio Site »,
// qui ouvre l'Accueil). Seulement sur les pages de l'agence : un client qui installe son
// espace ne doit pas tomber sur la connexion de l'agence.
// (Le fichier garde son ancien nom « pilotage.webmanifest » : les icônes déjà installées le connaissent.)
export const metadataAppli = {
  manifest: '/pilotage.webmanifest',
  appleWebApp: { capable: true, title: 'Studio Site', statusBarStyle: 'default' },
  icons: { apple: '/icons/pilotage-180.png' },
};
