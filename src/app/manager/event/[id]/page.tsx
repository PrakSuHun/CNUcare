import EventDetail from "@/components/EventDetail";

export default async function ManagerEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventDetail eventId={id} basePath="/manager" />;
}
