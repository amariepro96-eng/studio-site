import { ClientShell } from '../src/ui/Chrome.jsx';
import { getSettings } from '../src/server/store.js';

export const dynamic = 'force-dynamic';

// Accueil : oriente les clients vers leur lien personnel, et l'agence vers son espace
export default async function Home() {
  let s = { studioName: process.env.NEXT_PUBLIC_APP_NAME || 'Studio Site', ownerName: '', email: '', phone: '' };
  try {
    s = await getSettings();
  } catch {}
  const studio = { studioName: s.studioName, ownerName: s.ownerName, email: s.email, phone: s.phone };
  return (
    <ClientShell studio={studio}>
      <section className="home">
        <h1>Des sites internet faits pour votre activité</h1>
        <p className="lead">
          {s.studioName} crée le site des commerces, artisans et indépendants : vous répondez à un questionnaire, nous vous proposons plusieurs modèles rédigés pour vous, vous choisissez, et nous nous occupons de la mise en ligne.
        </p>
        <ol className="journey journey-lg">
          <li>Vous répondez au questionnaire</li>
          <li>Vous recevez une sélection de modèles</li>
          <li>Vous choisissez celui qui vous ressemble</li>
          <li>Nous mettons votre site en ligne</li>
        </ol>
        <div className="home-note">
          <h2>Vous avez reçu un lien ?</h2>
          <p>Ouvrez-le directement depuis le message reçu : il mène à votre questionnaire ou à vos propositions, et à rien d’autre.</p>
        </div>
        <p className="home-agency">
          <a href="/agence">Espace agence</a>
        </p>
      </section>
    </ClientShell>
  );
}
