import QuestionnaireApp from '../../../src/ui/client/QuestionnaireApp.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Votre questionnaire', robots: { index: false, follow: false } };

export default async function QuestionnairePage({ params }) {
  const { id } = await params;
  return <QuestionnaireApp id={id} />;
}
