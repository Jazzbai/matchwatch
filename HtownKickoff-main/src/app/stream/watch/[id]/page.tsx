import LiveWatch from '../../../../components/stream/LiveWatch';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LiveWatch id={id} />;
}
