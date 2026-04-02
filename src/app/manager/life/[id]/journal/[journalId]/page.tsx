"use client";
import { useParams } from "next/navigation";
import JournalForm from "@/components/JournalForm";

export default function Page() {
  const params = useParams();
  const lifeId = params.id as string;
  return <JournalForm lifeId={lifeId} journalId={params.journalId as string} backPath={`/manager/life/${lifeId}`} />;
}
