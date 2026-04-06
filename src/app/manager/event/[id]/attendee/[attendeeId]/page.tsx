import AttendeeDetail from "@/components/AttendeeDetail";

export default async function Page({ params }: { params: Promise<{ id: string; attendeeId: string }> }) {
  const { id, attendeeId } = await params;
  return <AttendeeDetail eventId={id} attendeeId={attendeeId} basePath="/manager" />;
}
