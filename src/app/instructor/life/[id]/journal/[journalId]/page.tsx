"use client";
import { useParams } from "next/navigation";
import JournalView from "@/components/JournalView";

export default function Page() {
  const params = useParams();
  const lifeId = params.id as string;
  return <JournalView lifeId={lifeId} journalId={params.journalId as string} backPath={`/instructor/life/${lifeId}`} />;
}
