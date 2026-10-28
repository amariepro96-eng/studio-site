// Installation de l'espace agence sur l'écran d'accueil du téléphone (icône « Pilotage »).
// Seulement sur les pages de l'agence : un client qui installe son espace ne doit pas
// tomber sur la connexion de l'agence.
export const metadataAppli = {
  manifest: '/pilotage.webmanifest',
  appleWebApp: { capable: true, title: 'Pilotage', statusBarStyle: 'default' },
  icons: { apple: '/icons/pilotage-180.png' },
};
