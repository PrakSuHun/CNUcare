"use client";
import { useParams } from "next/navigation";
import LifeDetail from "@/components/LifeDetail";

export default function Page() {
  const params = useParams();
  return <LifeDetail lifeId={params.id as string} basePath="/leader" backPath="/leader" />;
}
