"use client";
import { useParams } from "next/navigation";
import JournalForm from "@/components/JournalForm";

export default function Page() {
  const params = useParams();
  const lifeId = params.id as string;
  return <JournalForm lifeId={lifeId} backPath={`/instructor/life/${lifeId}`} />;
}
