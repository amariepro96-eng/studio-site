import ProposalsApp from '../../../src/ui/client/ProposalsApp.jsx';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vos propositions de site', robots: { index: false, follow: false } };

export default async function ProposalsPage({ params }) {
  const { id } = await params;
  return <ProposalsApp id={id} />;
}
